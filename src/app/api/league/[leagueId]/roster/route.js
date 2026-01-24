import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request, { params }) {
    const { leagueId } = params;
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('manager_id');

    if (!leagueId || !managerId) {
        return NextResponse.json({ success: false, error: 'Missing league_id or manager_id' }, { status: 400 });
    }

    try {
        // 1. Calculate Today's Date in Taiwan Time (UTC+8)
        const now = new Date();
        const nowTaiwan = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
        // Normalize to YYYY-MM-DD
        const todayStr = nowTaiwan.toISOString().split('T')[0];
        const todayDate = new Date(todayStr); // 00:00:00 UTC representing Taiwan midnight

        // 2. Fetch League Settings (Start Scoring On) and Schedule (Season End)
        // Fetch Start Scoring On
        const { data: settings, error: settingsError } = await supabase
            .from('league_settings')
            .select('start_scoring_on')
            .eq('league_id', leagueId)
            .single();

        if (settingsError) {
            console.error('Error fetching league settings:', settingsError);
            return NextResponse.json({ success: false, error: 'Settings Error' }, { status: 500 });
        }

        // Fetch Last Week to calculate Season End (Preparation Week End)
        const { data: scheduleInfo, error: scheduleError } = await supabase
            .from('league_schedule')
            .select('week_number, week_end')
            .eq('league_id', leagueId)
            .order('week_number', { ascending: true });

        let gameDateStr = todayStr;
        let seasonEnd = null;
        let seasonStart = null;

        if (settings && settings.start_scoring_on) {
            // Only parse YYYY-MM-DD part if dot separated
            const parts = settings.start_scoring_on.split('.');
            if (parts.length === 3) {
                seasonStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
        }

        if (scheduleInfo && scheduleInfo.length > 0) {
            const lastWeek = scheduleInfo[scheduleInfo.length - 1]; // Last week of generated schedule

            // Logic from ownership/route.js: Find week_id + 1 for Season End
            const { data: weekData, error: weekError } = await supabase
                .from('schedule_date')
                .select('week')
                .eq('end', lastWeek.week_end)
                .single();

            if (!weekError && weekData) {
                const currentWeekNum = parseInt(weekData.week.replace('W', ''), 10);
                const nextWeekNum = currentWeekNum + 1;
                const nextWeekStr = `W${nextWeekNum}`;

                const { data: nextWeekData, error: nextWeekError } = await supabase
                    .from('schedule_date')
                    .select('end')
                    .eq('week', nextWeekStr)
                    .single();

                if (!nextWeekError && nextWeekData) {
                    seasonEnd = new Date(nextWeekData.end);
                }
            }

            // Fallback if no next week found
            if (!seasonEnd) {
                seasonEnd = new Date(lastWeek.week_end);
            }
        }

        // 3. Logic: Clamp Date
        if (seasonStart && todayDate < seasonStart) {
            // Before Season Start -> Use Start Date
            // Helper to format Date -> YYYY-MM-DD
            const year = seasonStart.getFullYear();
            const month = String(seasonStart.getMonth() + 1).padStart(2, '0');
            const day = String(seasonStart.getDate()).padStart(2, '0');
            gameDateStr = `${year}-${month}-${day}`;
        } else if (seasonEnd && todayDate > seasonEnd) {
            // After Season End -> Use End Date
            const year = seasonEnd.getFullYear();
            const month = String(seasonEnd.getMonth() + 1).padStart(2, '0');
            const day = String(seasonEnd.getDate()).padStart(2, '0');
            gameDateStr = `${year}-${month}-${day}`;
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
          batter_or_pitcher
        )
      `)
            .eq('league_id', leagueId)
            .eq('manager_id', managerId)
            .eq('game_date', gameDateStr);

        if (rosterError) {
            console.error('Supabase error:', rosterError);
            return NextResponse.json({ success: false, error: 'Database Error', details: rosterError.message }, { status: 500 });
        }

        // Prepare to fetch position eligibility from views
        const playerIds = (rosterData || []).map(r => r.player_id);
        const positionMap = {};

        if (playerIds.length > 0) {
            // Fetch batter positions
            const { data: batterPos } = await supabase
                .from('v_batter_positions')
                .select('player_id, position_list')
                .in('player_id', playerIds);

            // Fetch pitcher positions
            const { data: pitcherPos } = await supabase
                .from('v_pitcher_positions')
                .select('player_id, position_list')
                .in('player_id', playerIds);

            // Merge into map
            batterPos?.forEach(p => positionMap[p.player_id] = p.position_list);
            pitcherPos?.forEach(p => positionMap[p.player_id] = p.position_list);
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
            return {
                ...item,
                name: item.player?.name,
                team: item.player?.team,
                // Use map to get position_list, fallback if not found in views
                position_list: positionMap[item.player_id] || defaultPos,
                batter_or_pitcher: item.player?.batter_or_pitcher
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
