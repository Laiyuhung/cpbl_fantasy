import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(request, { params }) {
    const { leagueId } = params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
        return NextResponse.json({ success: false, error: 'Please login first' }, { status: 401 });
    }

    if (!leagueId) {
        return NextResponse.json({ success: false, error: 'League ID is required' }, { status: 400 });
    }

    try {
        // Check if user is commissioner or co-commissioner
        const { data: member, error: memberError } = await supabase
            .from('league_members')
            .select('role')
            .eq('league_id', leagueId)
            .eq('manager_id', userId)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ success: false, error: 'Not a member of this league' }, { status: 403 });
        }

        if (member.role !== 'Commissioner' && member.role !== 'Co-Commissioner') {
            return NextResponse.json({ success: false, error: 'Only commissioners can set final standings' }, { status: 403 });
        }

        const body = await request.json();
        const { standings } = body;

        if (!Array.isArray(standings) || standings.length === 0) {
            return NextResponse.json({ success: false, error: 'Standings array is required' }, { status: 400 });
        }

        // Validate each standing entry
        for (const standing of standings) {
            if (!standing.manager_id || typeof standing.rank !== 'number') {
                return NextResponse.json({ success: false, error: 'Each standing must have manager_id and rank' }, { status: 400 });
            }
        }

        // Delete existing final standings for this league
        const { error: deleteError } = await supabase
            .from('league_final_standings')
            .delete()
            .eq('league_id', leagueId);

        if (deleteError) {
            console.error('Error deleting existing final standings:', deleteError);
            return NextResponse.json({ success: false, error: 'Failed to clear existing final standings' }, { status: 500 });
        }

        // Insert new final standings
        const { data: insertData, error: insertError } = await supabase
            .from('league_final_standings')
            .insert(
                standings.map(standing => ({
                    league_id: leagueId,
                    manager_id: standing.manager_id,
                    rank: standing.rank
                }))
            )
            .select();

        if (insertError) {
            console.error('Error inserting final standings:', insertError);
            return NextResponse.json({ success: false, error: 'Failed to insert final standings' }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            finalStandings: insertData,
            message: 'Final standings updated successfully'
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 });
    }
}