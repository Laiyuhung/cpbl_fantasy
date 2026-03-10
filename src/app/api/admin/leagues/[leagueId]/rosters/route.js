import { NextResponse } from 'next/server';
import supabase from '../../../../../../lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request, { params }) {
    try {
        const { leagueId } = await params;
        const { searchParams } = new URL(request.url);

        // Use provided manager_id or fetch all
        const requestedManagerId = searchParams.get('manager_id');
        const gameDateStr = searchParams.get('game_date');

        // 1. Admin Check Setup (MUST happen first)
        const cookieStore = await cookies();
        const userIdCookie = cookieStore.get('user_id');

        if (!userIdCookie || !userIdCookie.value) {
            return NextResponse.json({ success: false, error: 'Unauthorized: No user cookie' }, { status: 401 });
        }
        const loggedInManagerId = userIdCookie.value;

        // Query the 'admin' table specifically
        const { data: adminData, error: adminError } = await supabase
            .from('admin')
            .select('*')
            .eq('manager_id', loggedInManagerId)
            .single();

        if (adminError || !adminData) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required.' }, { status: 403 });
        }

        // 2. Fetch Members (to attach manager metadata if getting all rosters)
        const { data: membersData, error: membersError } = await supabase
            .from('league_members')
            .select('manager_id, nickname')
            .eq('league_id', leagueId);

        if (membersError) throw membersError;

        const memberMap = {};
        membersData.forEach(m => memberMap[m.manager_id] = m.nickname);

        // Calculate gameDate if not strictly provided
        let searchDateStr = gameDateStr;
        if (!searchDateStr) {
            const now = new Date();
            const nowTaiwan = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
            searchDateStr = nowTaiwan.toISOString().split('T')[0];
        }

        // 3. Fetch Roster
        let query = supabase
            .from('league_roster_positions')
            .select(`
                *,
                player:player_list (
                    player_id,
                    name,
                    team,
                    batter_or_pitcher,
                    identity
                )
            `)
            .eq('league_id', leagueId)
            .eq('game_date', searchDateStr);

        if (requestedManagerId) {
            query = query.eq('manager_id', requestedManagerId);
        }

        const { data: rosterData, error: rosterError } = await query;
        if (rosterError) throw rosterError;

        // 4. Fetch positions, real life status, and schedule
        const [
            { data: batterPositions },
            { data: pitcherPositions },
            { data: realLifeStatus },
            { data: scheduleData }
        ] = await Promise.all([
            supabase.from('v_batter_positions').select('player_id, position_list'),
            supabase.from('v_pitcher_positions').select('player_id, position_list'),
            supabase.from('real_life_player_status').select('player_id, status'),
            supabase.from('cpbl_schedule_2026').select('*').eq('date', searchDateStr)
        ]);

        const positionMap = {};
        if (batterPositions) batterPositions.forEach(bp => positionMap[bp.player_id] = bp.position_list);
        if (pitcherPositions) pitcherPositions.forEach(pp => positionMap[pp.player_id] = pp.position_list);

        const statusMap = {};
        if (realLifeStatus) realLifeStatus.forEach(s => statusMap[s.player_id] = s.status);

        const gameMap = {};
        if (scheduleData) {
            scheduleData.forEach(game => {
                gameMap[game.home] = {
                    opponent: game.away,
                    is_home: true,
                    time: game.time,
                    place: game.place || 'Stadium',
                    away_team_score: game.away_team_score,
                    home_team_score: game.home_team_score,
                    is_postponed: game.is_postponed
                };
                gameMap[game.away] = {
                    opponent: game.home,
                    is_home: false,
                    time: game.time,
                    place: game.place || 'Stadium',
                    away_team_score: game.away_team_score,
                    home_team_score: game.home_team_score,
                    is_postponed: game.is_postponed
                };
            });
        }

        // 5. Build final output
        const positionOrder = {
            'C': 1, '1B': 2, '2B': 3, '3B': 4, 'SS': 5, 'CI': 6, 'MI': 7,
            'LF': 8, 'CF': 9, 'RF': 10, 'OF': 11, 'Util': 12,
            'SP': 13, 'RP': 14, 'P': 15, 'BN': 16, 'NA': 17 // Minor
        };

        const formattedRoster = (rosterData || []).map(item => {
            const defaultPos = item.player?.batter_or_pitcher === 'pitcher' ? 'P' : 'Util';
            const posList = positionMap[item.player_id] || defaultPos;
            const team = item.player?.team;
            const gameInfo = team ? gameMap[team] : null;

            return {
                ...item,
                name: item.player?.name,
                team: team,
                position_list: posList,
                batter_or_pitcher: item.player?.batter_or_pitcher,
                identity: item.player?.identity,
                real_life_status: statusMap[item.player_id] || 'UNREGISTERED',
                game_info: gameInfo
            };
        }).sort((a, b) => {
            const orderA = positionOrder[a.position] || 99;
            const orderB = positionOrder[b.position] || 99;
            return orderA - orderB;
        });

        // If specific manager requested, return flat array matching the main app behavior
        if (requestedManagerId) {
            return NextResponse.json({
                success: true,
                roster: formattedRoster,
                date: searchDateStr
            });
        }

        // Group by manager if no specific manager was requested
        const rosterByManager = {};
        formattedRoster.forEach(player => {
            const managerNick = memberMap[player.manager_id] || player.manager_id;
            if (!rosterByManager[managerNick]) {
                rosterByManager[managerNick] = [];
            }
            rosterByManager[managerNick].push(player);
        });

        return NextResponse.json({
            success: true,
            rosters: rosterByManager,
            members: membersData,
            date: searchDateStr
        });

    } catch (error) {
        console.error('Error fetching admin rosters:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
