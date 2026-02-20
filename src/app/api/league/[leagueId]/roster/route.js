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

        // 5. Fetch Schedule for the Game Date
        const { data: scheduleData, error: scheduleError } = await supabase
            .from('cpbl_schedule_2026')
            .select('*')
            .eq('date', gameDateStr);

        if (scheduleError) {
            console.error('Error fetching schedule:', scheduleError);
        }

        const gameMap = {};
        if (scheduleData) {
            scheduleData.forEach(game => {
                // Map Home Team Key
                gameMap[game.home] = {
                    opponent: game.away,
                    is_home: true,
                    time: game.time,
                    place: game.place || 'Stadium'
                };
                // Map Away Team Key
                gameMap[game.away] = {
                    opponent: game.home,
                    is_home: false,
                    time: game.time,
                    place: game.place || 'Stadium'
                };
            });
        }

        const roster = (rosterData || []).map(item => {
            const defaultPos = item.player?.batter_or_pitcher === 'pitcher' ? 'P' : 'Util';
            // Use the map populated from the full views
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
