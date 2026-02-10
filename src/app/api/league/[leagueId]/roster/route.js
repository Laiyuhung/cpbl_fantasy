import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request, { params }) {
    const { leagueId } = params;
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('manager_id');
    const gameDate = searchParams.get('game_date'); // Get game_date from query params

    if (!leagueId || !managerId) {
        return NextResponse.json({ success: false, error: 'Missing league_id or manager_id' }, { status: 400 });
    }

    try {
        let gameDateStr;

        // If game_date is provided, use it directly
        if (gameDate) {
            gameDateStr = gameDate;
            console.log('='.repeat(80));
            console.log(`[Roster API] 📅 Using provided game_date: ${gameDateStr}`);
            console.log('='.repeat(80));
        } else {
            // Otherwise, calculate today's date in Taiwan Time (UTC+8) and apply clamping logic
            console.log('='.repeat(80));
            console.log(`[Roster API] ⚠️  No game_date provided, calculating from today (Taiwan time)`);
            console.log('='.repeat(80));

            const now = new Date();
            const nowTaiwan = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
            const todayStr = nowTaiwan.toISOString().split('T')[0];
            const todayDate = new Date(todayStr);

            // Fetch League Settings (Start Scoring On) and Schedule (Season End)
            const { data: settings, error: settingsError } = await supabase
                .from('league_settings')
                .select('start_scoring_on')
                .eq('league_id', leagueId)
                .single();

            if (settingsError) {
                console.error('Error fetching league settings:', settingsError);
                return NextResponse.json({ success: false, error: 'Settings Error' }, { status: 500 });
            }

            const { data: scheduleInfo } = await supabase
                .from('league_schedule')
                .select('week_number, week_end')
                .eq('league_id', leagueId)
                .order('week_number', { ascending: true });

            gameDateStr = todayStr;
            let seasonEnd = null;
            let seasonStart = null;

            if (settings && settings.start_scoring_on) {
                const parts = settings.start_scoring_on.split('.');
                if (parts.length === 3) {
                    seasonStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
            }

            if (scheduleInfo && scheduleInfo.length > 0) {
                const lastWeek = scheduleInfo[scheduleInfo.length - 1];

                const { data: weekData } = await supabase
                    .from('schedule_date')
                    .select('week')
                    .eq('end', lastWeek.week_end)
                    .single();

                if (weekData) {
                    const currentWeekNum = parseInt(weekData.week.replace('W', ''), 10);
                    const nextWeekNum = currentWeekNum + 1;
                    const nextWeekStr = `W${nextWeekNum}`;

                    const { data: nextWeekData } = await supabase
                        .from('schedule_date')
                        .select('end')
                        .eq('week', nextWeekStr)
                        .single();

                    if (nextWeekData) {
                        seasonEnd = new Date(nextWeekData.end);
                    }
                }

                if (!seasonEnd) {
                    seasonEnd = new Date(lastWeek.week_end);
                }
            }

            // Logic: Clamp Date
            if (seasonStart && todayDate < seasonStart) {
                const year = seasonStart.getFullYear();
                const month = String(seasonStart.getMonth() + 1).padStart(2, '0');
                const day = String(seasonStart.getDate()).padStart(2, '0');
                gameDateStr = `${year}-${month}-${day}`;
            } else if (seasonEnd && todayDate > seasonEnd) {
                const year = seasonEnd.getFullYear();
                const month = String(seasonEnd.getMonth() + 1).padStart(2, '0');
                const day = String(seasonEnd.getDate()).padStart(2, '0');
                gameDateStr = `${year}-${month}-${day}`;
            }

            console.log(`[Roster API] 📅 Calculated game_date: ${gameDateStr}`);
        }

        // 4. Fetch Roster with Clamped Date
        const { data: rosterData, error: rosterError } = await supabase
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
            .eq('manager_id', managerId)
            .eq('game_date', gameDateStr);

        if (rosterError) {
            console.error('Supabase error:', rosterError);
            return NextResponse.json({ success: false, error: 'Database Error', details: rosterError.message }, { status: 500 });
        }

        // --- ALIGNMENT WITH playerslist API ---
        // Fetch ALL positions from views, without filtering by ID.
        // This matches the logic exactly from src/app/api/playerslist/route.js

        // 獲取野手位置資料
        const { data: batterPositions, error: batterError } = await supabase
            .from('v_batter_positions')
            .select('player_id, position_list');

        if (batterError) {
            console.error('Error fetching batter positions:', batterError);
        }

        // 獲取投手位置資料
        const { data: pitcherPositions, error: pitcherError } = await supabase
            .from('v_pitcher_positions')
            .select('player_id, position_list');

        if (pitcherError) {
            console.error('Error fetching pitcher positions:', pitcherError);
        }

        // 建立位置對照表
        const positionMap = {};
        if (batterPositions) {
            batterPositions.forEach(bp => {
                positionMap[bp.player_id] = bp.position_list;
            });
        }
        if (pitcherPositions) {
            pitcherPositions.forEach(pp => {
                positionMap[pp.player_id] = pp.position_list;
            });
        }
        // --------------------------------------

        // 獲取球員真實狀態
        const { data: realLifeStatus, error: statusError } = await supabase
            .from('real_life_player_status')
            .select('player_id, status');

        if (statusError) {
            console.error('Error fetching real life status:', statusError);
        }

        // 建立狀態對照表
        const statusMap = {};
        if (realLifeStatus) {
            realLifeStatus.forEach(s => {
                statusMap[s.player_id] = s.status;
            });
        }

        // Flatten and Sort
        const positionOrder = {
            'C': 1,
            '1B': 2,
            '2B': 3,
            '3B': 4,
            'SS': 5,
            'CI': 6,
            'MI': 7,
            'LF': 8,
            'CF': 9,
            'RF': 10,
            'OF': 11,
            'Util': 12,
            'SP': 13,
            'RP': 14,
            'P': 15,
            'BN': 16,
            'NA': 17 // Minor
        };

        const roster = (rosterData || []).map(item => {
            const defaultPos = item.player?.batter_or_pitcher === 'pitcher' ? 'P' : 'Util';
            // Use the map populated from the full views
            const posList = positionMap[item.player_id] || defaultPos;

            return {
                ...item,
                name: item.player?.name,
                team: item.player?.team,
                position_list: posList,
                team: item.player?.team,
                position_list: posList,
                batter_or_pitcher: item.player?.batter_or_pitcher,
                identity: item.player?.identity,
                real_life_status: statusMap[item.player_id] || 'UNREGISTERED'
            };
        }).sort((a, b) => {
            const orderA = positionOrder[a.position] || 99;
            const orderB = positionOrder[b.position] || 99;
            return orderA - orderB;
        });

        return NextResponse.json({
            success: true,
            date: gameDateStr,
            roster: roster
        });

    } catch (error) {
        console.error('Error fetching roster:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
