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

        // 2. Determine Current Week
        // Use Taiwan Time for consistency
        const now = new Date();
        const year = now.getFullYear();
        // Adjust for Taiwan Timezone manually or use locale string logic if server is UTC
        // Standard approach: Get YYYY-MM-DD in TW time
        const todayCommon = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

        const { data: weekData, error: weekError } = await supabase
            .from('schedule_date')
            .select('*')
            .lte('start', todayCommon)
            .gte('end', todayCommon)
            .single();

        // If no week found (offseason?), maybe return 0 usage or handle gracefully
        // Or default to "All time" if offseason? No, usually no adds allowed or no limit checks?
        // Let's assume if no week, no limit check or 0 usage.

        let usage = 0;
        let weekInfo = null;

        if (weekData) {
            weekInfo = weekData;
            // 3. Count 'ADD' transactions in this week
            // transactions_2026 has created_at (timestamptz).
            // We need to compare created_at with week start/end (which are usually YYYY-MM-DD).
            // Start: weekData.start + 'T00:00:00' (in TW time context)
            // End: weekData.end + 'T23:59:59' (in TW time context)

            // However, DB timestamps are UTC.
            // We need to convert DB timestamps to TW time OR convert Week Strings to UTC range.
            // Easier: Convert Week Strings (TW date) to UTC range.

            // Start of Week (TW 00:00) -> UTC
            const startTw = new Date(`${weekData.start}T00:00:00+08:00`);
            // End of Week (TW 23:59:59.999) -> UTC
            const endTw = new Date(`${weekData.end}T23:59:59.999+08:00`);

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

        return NextResponse.json({
            success: true,
            usage,
            limit: limit === Infinity ? 'No maximum' : limit,
            remaining: limit === Infinity ? 'Unlimited' : Math.max(0, limit - usage),
            week: weekInfo?.week || 'Offseason'
        });

    } catch (error) {
        console.error('Error fetching acquisitions:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
