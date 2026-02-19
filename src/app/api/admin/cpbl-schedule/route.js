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

        // Process schedules to convert time to UTC
        const processedSchedules = schedules.map(game => {
            // Assume input time is 'HH:mm' and date is 'YYYY-MM-DD' in Taiwan Time
            // We need to create a UTC timestamp
            const twDateTimeStr = `${game.date}T${game.time}:00+08:00`; // Force Taiwan Offset
            const utcDate = new Date(twDateTimeStr);

            return {
                ...game,
                time: utcDate.toISOString() // Save as UTC timestamp
            };
        });

        const { data, error } = await supabaseAdmin
            .from('cpbl_schedule_2026')
            .insert(processedSchedules)
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

export async function PUT(request) {
    try {
        const body = await request.json();
        const { uuid, updates } = body;

        if (!uuid || !updates) {
            return NextResponse.json({ success: false, error: 'Missing uuid or updates' }, { status: 400 });
        }

        const updatesToSave = { ...updates };

        // If updating time or date, we need to recalculate the UTC timestamp
        // However, usually we might get just one field. 
        // For simplicity, if 'time' (string HH:mm) or 'date' is present, we might need the other to form a timestamp.
        // But the admin page sends the full object usually? 
        // Let's check the admin page... it sends `editForm` which has both.

        if (updates.time && updates.date && !updates.time.includes('T')) {
            // It's likely HH:mm format from input, convert to UTC
            const twDateTimeStr = `${updates.date}T${updates.time}:00+08:00`;
            updatesToSave.time = new Date(twDateTimeStr).toISOString();
        }

        const { data, error } = await supabaseAdmin
            .from('cpbl_schedule_2026')
            .update(updatesToSave)
            .eq('uuid', uuid)
            .select()
            .single();

        if (error) {
            console.error('[CPBL Schedule API] Update Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[CPBL Schedule API] Server Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
