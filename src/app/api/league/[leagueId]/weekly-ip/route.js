import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request, { params }) {
    const { leagueId } = await params;
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('manager_id');

    if (!managerId) {
        return NextResponse.json({ success: false, error: 'Missing manager_id' }, { status: 400 });
    }

    try {
        // Determine current week (Taiwan time)
        const now = new Date();
        const todayTw = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

        const { data: weekData } = await supabase
            .from('league_schedule')
            .select('week_number, week_start, week_end')
            .eq('league_id', leagueId)
            .lte('week_start', todayTw)
            .gte('week_end', todayTw)
            .single();

        if (!weekData) {
            return NextResponse.json({ success: true, ip: 0, weekNumber: null, addCount: 0 });
        }

        // Fetch weekly IP from v_weekly_manager_stats
        const { data: statsData } = await supabase
            .from('v_weekly_manager_stats')
            .select('p_ip')
            .eq('league_id', leagueId)
            .eq('manager_id', managerId)
            .eq('week_number', weekData.week_number)
            .single();

        // Count ADDs this week
        const startTw = new Date(`${weekData.week_start}T00:00:00+08:00`);
        const endTw = new Date(`${weekData.week_end}T23:59:59.999+08:00`);

        const { count: addCount } = await supabase
            .from('transactions_2026')
            .select('*', { count: 'exact', head: true })
            .eq('league_id', leagueId)
            .eq('manager_id', managerId)
            .eq('transaction_type', 'ADD')
            .gte('transaction_time', startTw.toISOString())
            .lte('transaction_time', endTw.toISOString());

        return NextResponse.json({
            success: true,
            ip: statsData?.p_ip ?? 0,
            weekNumber: weekData.week_number,
            addCount: addCount || 0
        });

    } catch (error) {
        console.error('Weekly IP API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
