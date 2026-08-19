import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function requireAdmin() {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
        return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
    }

    const { data: adminRecord, error: adminError } = await supabase
        .from('admin')
        .select('manager_id')
        .eq('manager_id', userId)
        .single();

    if (adminError || !adminRecord) {
        return { ok: false, response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
    }

    return { ok: true, userId };
}

export async function POST(request) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { leagueId, standings } = body;

        if (!leagueId) {
            return NextResponse.json({ success: false, error: 'League ID is required' }, { status: 400 });
        }

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
