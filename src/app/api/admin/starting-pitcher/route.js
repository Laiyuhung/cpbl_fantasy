import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

// GET: Fetch starting pitchers for a date
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
        return NextResponse.json({ success: false, error: 'Missing date' }, { status: 400 });
    }

    try {
        const { data, error } = await supabase
            .from('starting_pitcher')
            .select('*')
            .eq('date', date)
            .order('team');

        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (err) {
        console.error('Starting Pitcher GET Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST: Save starting pitcher for a team on a date (replaces existing)
export async function POST(request) {
    try {
        const body = await request.json();
        const { date, pitchers } = body;
        // pitchers = [{ team: '...', name: '...', is_confirmed: true/false }, ...]

        if (!date || !pitchers || !Array.isArray(pitchers)) {
            return NextResponse.json({ success: false, error: 'Missing date or pitchers' }, { status: 400 });
        }

        // Filter out empty names
        const validPitchers = pitchers.filter(p => p.name && p.name.trim() && p.team);

        // Get unique teams from the input to delete their existing entries
        const teams = [...new Set(validPitchers.map(p => p.team))];

        // Delete existing entries for these teams on this date
        if (teams.length > 0) {
            const { error: delError } = await supabase
                .from('starting_pitcher')
                .delete()
                .eq('date', date)
                .in('team', teams);

            if (delError) throw delError;
        }

        if (validPitchers.length > 0) {
            const rows = validPitchers.map(p => ({
                date,
                team: p.team,
                name: p.name.trim()
            }));

            const { error: insertError } = await supabase
                .from('starting_pitcher')
                .insert(rows);

            if (insertError) throw insertError;
        }

        return NextResponse.json({ success: true, inserted: validPitchers.length });
    } catch (err) {
        console.error('Starting Pitcher POST Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// DELETE: Delete pitcher for a team on a date
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { date, team } = body;

        if (!date || !team) {
            return NextResponse.json({ success: false, error: 'Missing date or team' }, { status: 400 });
        }

        const { error } = await supabase
            .from('starting_pitcher')
            .delete()
            .eq('date', date)
            .eq('team', team);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Starting Pitcher DELETE Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
