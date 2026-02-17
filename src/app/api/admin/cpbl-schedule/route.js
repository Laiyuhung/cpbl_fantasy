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
            .from('cpbl_schedule')
            .insert(schedules)
            .select();

        if (error) {
            console.error('[CPBL Schedule API] Insert Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: data.length });

    } catch (error) {
        console.error('[CPBL Schedule API] Server Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
