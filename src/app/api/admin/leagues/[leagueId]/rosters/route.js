import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import supabase from '../../../../../../lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request, { params }) {
    try {
        const { leagueId } = params; // Changed from `await params` as params is an object, not a Promise
        const { searchParams } = new URL(request.url);

        // Use provided manager_id or fetch all
        const requestedManagerId = searchParams.get('manager_id');
        const gameDateStr = searchParams.get('game_date');

        // 1. Admin Check Setup (MUST happen first)
        const cookieStore = cookies(); // No await needed for cookies()
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


        // 2. Build the query based on whether a specific manager or all managers are requested
        let query = supabase
            .from('ownership')
            .select(`
                manager_id,
                player_id,
                position,
                status
            `)
            .eq('league_id', leagueId)
            .eq('status', 'On Team'); // Only active roster players

        if (requestedManagerId) {
            query = query.eq('manager_id', requestedManagerId);
        }

        const { data: ownerships, error: ownershipsError } = await query;

        if (ownershipsError) throw ownershipsError;

        // Fetch players details separately to avoid relationship cache issues
        const playerIds = [...new Set(ownerships.map(o => o.player_id))];
        let playersMap = {};
        if (playerIds.length > 0) {
            const { data: players, error: playersError } = await supabase
                .from('playerslist')
                .select('player_id, name, team, position_list, batter_or_pitcher, identity, real_life_status')
                .in('player_id', playerIds);

            if (playersError) throw playersError;
            players.forEach(p => { playersMap[p.player_id] = p; });
        }

        // 3. Process game dates to check for game info
        let gameDate = new Date();
        if (gameDateStr) {
            gameDate = new Date(gameDateStr);
        }

        // Ensure we handle the timezone correctly (Taiwan time)
        const taiwanTime = new Date(gameDate.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
        const searchDateStr = taiwanTime.toISOString().split('T')[0];

        // Fetch schedule for this date
        const { data: scheduleData, error: scheduleError } = await supabase
            .from('cpbl_schedule')
            .select('*')
            .eq('date', searchDateStr);

        if (scheduleError) {
            console.error("Error fetching schedule data:", scheduleError);
        }

        // Map teams to their games
        const gamesByTeam = {};
        if (scheduleData) {
            scheduleData.forEach(game => {
                gamesByTeam[game.home_team] = { ...game, is_home: true, opponent: game.away_team };
                gamesByTeam[game.away_team] = { ...game, is_home: false, opponent: game.home_team };
            });
        }

        // 4. Format roster data
        const formattedRoster = ownerships.map(o => {
            const playerInfo = playersMap[o.player_id] || {};
            const team = playerInfo.team;
            const gameInfo = team ? gamesByTeam[team] : null;

            return {
                id: `${o.manager_id}-${o.player_id}`, // Unique ID for frontend rendering
                player_id: o.player_id,
                manager_id: o.manager_id, // include manager_id, so the frontend knows whose player this is
                name: playerInfo.name,
                team: playerInfo.team,
                position: o.position, // Important: Fantasy position
                position_list: playerInfo.position_list,
                batter_or_pitcher: playerInfo.batter_or_pitcher,
                identity: playerInfo.identity,
                real_life_status: playerInfo.real_life_status,
                game_info: gameInfo
            };
        });

        // 5. Fetch members to get nicknames (to map managers)
        const { data: membersData, error: membersError } = await supabase
            .from('league_members')
            .select('manager_id, nickname')
            .eq('league_id', leagueId);

        if (membersError) throw membersError;

        const memberMap = {};
        membersData.forEach(m => memberMap[m.manager_id] = m.nickname);

        // Group by manager if no specific manager was requested
        if (!requestedManagerId) {
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
        }

        // If specific manager requested, return flat array matching the main app behavior
        return NextResponse.json({
            success: true,
            roster: formattedRoster,
            date: searchDateStr
        });

    } catch (error) {
        console.error('Error fetching admin rosters:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
