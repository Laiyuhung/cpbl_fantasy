import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request, { params }) {
    const { leagueId } = params;
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');

    if (!leagueId) {
        return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    if (!week) {
        return NextResponse.json({ error: 'Week number is required' }, { status: 400 });
    }

    try {
        const { data: matchups, error } = await supabase
            .from('league_matchups')
            .select('*')
            .eq('league_id', leagueId)
            .eq('week_number', week);

        if (error) {
            console.error('Error fetching matchups:', error);
            return NextResponse.json({ error: 'Failed to fetch matchups' }, { status: 500 });
        }

        return NextResponse.json({ success: true, matchups });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}
