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
        if (limitStr !== 'No maximum') {
            limit = parseInt(limitStr);
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

        if (week1 && todayCommon < week1.week_start) {
            isPreSeason = true;
            // Pre-season: usage counts don't matter / are free
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

                // 3. Count 'ADD' transactions in this week
                const startTw = new Date(`${weekData.week_start}T00:00:00+08:00`);
                const endTw = new Date(`${weekData.week_end}T23:59:59.999+08:00`);

                const { count, error: countError } = await supabase
                    .from('transactions_2026')
                    .select('*', { count: 'exact', head: true })
                    .eq('league_id', leagueId)
                    .eq('manager_id', managerId)
                    .eq('transaction_type', 'ADD')
                    .gte('created_at', startTw.toISOString())
                    .lte('created_at', endTw.toISOString());

                if (!countError) {
                    usage = count || 0;
                }
            }
        }

        const displayLimit = isPreSeason ? 'No maximum' : (limit === Infinity ? 'No maximum' : limit);

        return NextResponse.json({
            success: true,
            usage,
            limit: displayLimit,
            remaining: displayLimit === 'No maximum' ? 'Unlimited' : Math.max(0, limit - usage),
            week: isPreSeason ? 'Pre-season' : (weekInfo?.week_label || `Week ${weekInfo?.week_number || '?'}`)
        });

    } catch (error) {
        console.error('Error fetching acquisitions:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
