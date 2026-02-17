import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase'; // Using standard client since public.schedule is typically public? 
// Or use admin client if inserting requires privileges?
// User said "in admin", so let's use standard for now but check safety.
// Actually, for inserts, admin client is safer/better if RLS is strict.
// But current pattern often uses standard client. Let's stick to standard unless user specified otherwise.
// Wait, user provided 'supabaseAdmin.js' recently.
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function POST(request) {
    try {
        const body = await request.json();
        const { schedules } = body;

        if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
            return NextResponse.json({ success: false, error: 'Invalid data format' }, { status: 400 });
        }

        console.log(`[CPBL Schedule API] Inserting ${schedules.length} rows...`);

        const { data, error } = await supabaseAdmin
            .from('cpbl_schedule_2026')
            .insert(schedules)
            .select();

        if (error) {
            console.error('[CPBL Schedule API] Insert Error:', JSON.stringify(error, null, 2));
            console.error('Payload was:', JSON.stringify(schedules, null, 2));
            return NextResponse.json({ success: false, error: error.message || 'Unknown DB Error', details: error }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: data.length });

    } catch (error) {
        console.error('[CPBL Schedule API] Server Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request) {
    try {
        // Fetch recent schedule items, ordered by game_no desc to see what's newly added
        const { data, error } = await supabaseAdmin
            .from('cpbl_schedule_2026')
            .select('*')
            .order('game_no', { ascending: false })
            .limit(50);

        if (error) {
            console.error('[CPBL Schedule API] Fetch Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[CPBL Schedule API] Server Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
