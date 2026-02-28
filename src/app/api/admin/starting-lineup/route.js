import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

// GET: Fetch starting lineups for a date
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
        return NextResponse.json({ success: false, error: 'Missing date' }, { status: 400 });
    }

    try {
        const { data, error } = await supabase
            .from('starting_lineup')
            .select('*')
            .eq('date', date)
            .order('team')
            .order('batting_no', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (err) {
        console.error('Starting Lineup GET Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST: Save lineup for a team on a date (replaces existing)
export async function POST(request) {
    try {
        const body = await request.json();
        const { date, team, lineup } = body;
        // lineup = [{ batting_no: 1, name: '...' }, ...]

        if (!date || !team || !lineup || !Array.isArray(lineup)) {
            return NextResponse.json({ success: false, error: 'Missing date, team, or lineup' }, { status: 400 });
        }

        // Delete existing entries for this date + team
        const { error: delError } = await supabase
            .from('starting_lineup')
            .delete()
            .eq('date', date)
            .eq('team', team);

        if (delError) throw delError;

        // Filter out empty names
        const validLineup = lineup.filter(l => l.name && l.name.trim());

        if (validLineup.length > 0) {
            const rows = validLineup.map(l => ({
                date,
                team,
                batting_no: l.batting_no,
                name: l.name.trim()
            }));

            const { error: insertError } = await supabase
                .from('starting_lineup')
                .insert(rows);

            if (insertError) throw insertError;
        }

        return NextResponse.json({ success: true, inserted: validLineup.length });
    } catch (err) {
        console.error('Starting Lineup POST Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// DELETE: Delete lineup for a team on a date
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { date, team } = body;

        if (!date || !team) {
            return NextResponse.json({ success: false, error: 'Missing date or team' }, { status: 400 });
        }

        const { error } = await supabase
            .from('starting_lineup')
            .delete()
            .eq('date', date)
            .eq('team', team);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Starting Lineup DELETE Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
