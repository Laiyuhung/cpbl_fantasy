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
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');

        let query = supabaseAdmin
            .from('cpbl_schedule_2026')
            .select('*')
            .order('game_no', { ascending: false });

        if (dateParam) {
            query = query.eq('date', dateParam);
        } else {
            query = query.limit(50);
        }

        const { data, error } = await query;

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
        const { uuid, updates, reschedule } = body;

        if (!uuid || !updates) {
            return NextResponse.json({ success: false, error: 'Missing uuid or updates' }, { status: 400 });
        }

        const updatesToSave = { ...updates };

        // 1. Update the Original Game (Postponed)
        // If rescheduling, force is_postponed=true on the original if not already set
        if (reschedule) {
            updatesToSave.is_postponed = true;
        }

        if (updates.time && updates.date && !updates.time.includes('T')) {
            const twDateTimeStr = `${updates.date}T${updates.time}:00+08:00`;
            updatesToSave.time = new Date(twDateTimeStr).toISOString();
        }

        const { data: updatedGame, error: updateError } = await supabaseAdmin
            .from('cpbl_schedule_2026')
            .update(updatesToSave)
            .eq('uuid', uuid)
            .select()
            .single();

        if (updateError) {
            console.error('[CPBL Schedule API] Update Error:', updateError);
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        let newGame = null;

        // 2. If Reschedule Info Provided, Insert NEW ROW
        if (reschedule && reschedule.date && reschedule.time) {
            // Calculate UTC for new game
            const twDateTimeStr = `${reschedule.date}T${reschedule.time}:00+08:00`;
            const utcTime = new Date(twDateTimeStr).toISOString();

            const newGamePayload = {
                game_no: updatedGame.game_no, // Keep same game number
                home: updatedGame.home,
                away: updatedGame.away,
                stadium: reschedule.stadium || updatedGame.stadium,
                date: reschedule.date,
                time: utcTime,
                is_postponed: false // New game is scheduled, not postponed
            };

            const { data: insertedGame, error: insertError } = await supabaseAdmin
                .from('cpbl_schedule_2026')
                .insert([newGamePayload])
                .select()
                .single();

            if (insertError) {
                console.error('[CPBL Schedule API] Reschedule Insert Error:', insertError);
                // Note: We updated the original but failed to insert new. 
                // Return success for update but warning for insert? Or fail?
                // Let's return success but include error in logic
                return NextResponse.json({
                    success: true,
                    data: updatedGame,
                    warning: 'Game updated to postponed, but failed to create rescheduled game: ' + insertError.message
                });
            }
            newGame = insertedGame;
        }

        return NextResponse.json({ success: true, data: updatedGame, newGame });
    } catch (error) {
        console.error('[CPBL Schedule API] Server Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
