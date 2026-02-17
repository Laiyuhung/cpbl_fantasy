import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request, { params }) {
    const { leagueId } = params;
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('manager_id');

    if (!managerId) {
        return NextResponse.json({ success: false, error: 'Missing manager_id' }, { status: 400 });
    }

    try {
        // 1. Fetch League Settings
        const { data: settings } = await supabase
            .from('league_settings')
            .select('max_acquisitions_per_week')
            .eq('league_id', leagueId)
            .single();

        const limitStr = settings?.max_acquisitions_per_week || 'No maximum';
        let limit = Infinity;
        const parsedLimit = parseInt(limitStr);
        if (!isNaN(parsedLimit)) {
            limit = parsedLimit;
        }

        // 2. Determine Current Week via league_schedule
        // Use Taiwan Time for consistency
        const now = new Date();
        const todayCommon = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

        // Fetch Week 1 Start to check for Pre-season
        const { data: week1 } = await supabase
            .from('league_schedule')
            .select('week_start')
            .eq('league_id', leagueId)
            .eq('week_number', 1)
            .single();

        let usage = 0;
        let weekInfo = null;
        let isPreSeason = false;
        let isOffSeason = false;
        let dateRange = '';

        if (week1 && todayCommon < week1.week_start) {
            isPreSeason = true;
            dateRange = `Pre-season`;
        } else {
            // Find current week in schedule
            const { data: weekData } = await supabase
                .from('league_schedule')
                .select('*')
                .eq('league_id', leagueId)
                .lte('week_start', todayCommon)
                .gte('week_end', todayCommon)
                .single();

            if (weekData) {
                weekInfo = weekData;

                // Check for multi-week period (e.g. All Star or Playoffs)
                const { count: scheduleWeeksCount, error: weekCountError } = await supabase
                    .from('schedule_date')
                    .select('*', { count: 'exact', head: true })
                    .gte('week_start', weekData.week_start)
                    .lte('week_start', weekData.week_end); // Count weeks starting in this period

                if (weekCountError) {
                    console.error('[Acquisitions API] Error counting schedule weeks:', weekCountError);
                }

                // Default to 1 if count is 0 or undefined
                const multiplier = (scheduleWeeksCount && scheduleWeeksCount > 0) ? scheduleWeeksCount : 1;

                // Update limit if it's not Infinity
                if (limit !== Infinity) {
                    limit = limit * multiplier;
                }

                // Format Date Range: "MM/DD - MM/DD"
                const startObj = new Date(weekData.week_start);
                const endObj = new Date(weekData.week_end);
                const startStr = `${startObj.getMonth() + 1}/${startObj.getDate()}`;
                const endStr = `${endObj.getMonth() + 1}/${endObj.getDate()}`;
                dateRange = `${startStr} - ${endStr}`;

                // 3. Count 'ADD' transactions in this week
                const startTw = new Date(`${weekData.week_start}T00:00:00+08:00`);
                const endTw = new Date(`${weekData.week_end}T23:59:59.999+08:00`);

                const { count, error: countError } = await supabase
                    .from('transactions_2026')
                    .select('*', { count: 'exact', head: true })
                    .eq('league_id', leagueId)
                    .eq('manager_id', managerId)
                    .eq('transaction_type', 'ADD')
                    .gte('transaction_time', startTw.toISOString())
                    .lte('transaction_time', endTw.toISOString());

                if (!countError) {
                    usage = count || 0;
                }
            } else {
                // Not Pre-season and No Week Data found -> Off-season
                isOffSeason = true;
                dateRange = 'Off-season';
            }
        }

        let displayLimit = limit === Infinity ? 'No Maximum' : limit;
        if (isPreSeason) {
            displayLimit = 'No Maximum';
        } else if (isOffSeason) {
            displayLimit = 0; // Off-season limit is 0
        }

        return NextResponse.json({
            success: true,
            usage,
            limit: displayLimit,
            remaining: displayLimit === 'No Maximum' ? 'Unlimited' : Math.max(0, displayLimit - usage),
            week: dateRange // Using 'week' field to carry the formatted label
        });

    } catch (error) {
        console.error('Error fetching acquisitions:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
