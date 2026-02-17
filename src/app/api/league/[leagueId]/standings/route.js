import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request, { params }) {
    try {
        const { leagueId } = params;

        if (!leagueId) {
            return NextResponse.json(
                { error: 'League ID is required' },
                { status: 400 }
            );
        }

        // Fetch standings from the v_league_standings view
        const { data: standings, error: standingsError } = await supabase
            .from('v_league_standings')
            .select('*')
            .eq('league_id', leagueId)
            .order('rank', { ascending: true });

        if (standingsError) {
            console.error('Error fetching standings:', standingsError);
            return NextResponse.json(
                { error: 'Failed to fetch standings', details: standingsError.message },
                { status: 500 }
            );
        }

        // Fetch waiver priority
        const { data: waiverPriorities, error: waiverError } = await supabase
            .from('waiver_priority')
            .select('manager_id, rank')
            .eq('league_id', leagueId);

        if (waiverError) {
            console.error('Error fetching waiver priority:', waiverError);
            // Don't fail the whole request, just log it
        }

        // Merge waiver rank into standings
        const standingsWithWaiver = standings.map(team => {
            const waiver = waiverPriorities?.find(w => w.manager_id === team.manager_id);
            return {
                ...team,
                waiver_rank: waiver ? waiver.rank : '-'
            };
        });

        return NextResponse.json({
            success: true,
            standings: standingsWithWaiver || [],
        });
    } catch (error) {
        console.error('Unexpected error in standings API:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred', details: error.message },
            { status: 500 }
        );
    }
}
