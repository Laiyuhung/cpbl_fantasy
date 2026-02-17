import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    try {
        let query = supabaseAdmin
            .from('cpbl_schedule_2026')
            .select('*')
            .order('game_no', { ascending: true }); // Default sort by game number

        if (date) {
            query = query.eq('date', date);
        } else if (start && end) {
            query = query.gte('date', start).lte('date', end);
        } else {
            // Default: Returns nothing or maybe today's games?
            // Let's return today's games if no params provided, or maybe just empty to save bandwidth.
            // Actually, returning "upcoming" games might be nice?
            // Let's stick to explicit date requests for the widget to keep it simple.
            // If no date, return today.
            const today = new Date().toISOString().split('T')[0];
            query = query.eq('date', today);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[CPBL Schedule API Public] Fetch Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[CPBL Schedule API Public] Server Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
