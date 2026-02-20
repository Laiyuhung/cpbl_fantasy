import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Fetch watched players for a manager in a league
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueId = searchParams.get('league_id');
        const managerId = searchParams.get('manager_id');

        if (!leagueId || !managerId) {
            return NextResponse.json({ success: false, error: 'Missing league_id or manager_id' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('watched_players')
            .select('id, player_id, created_at')
            .eq('league_id', leagueId)
            .eq('manager_id', managerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching watched players:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            watched: data || [],
            watchedIds: (data || []).map(w => w.player_id)
        });
    } catch (err) {
        console.error('Error in GET /api/watched:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Add a player to watchlist
export async function POST(request) {
    try {
        const body = await request.json();
        const { league_id, manager_id, player_id } = body;

        if (!league_id || !manager_id || !player_id) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('watched_players')
            .insert({
                league_id,
                manager_id,
                player_id
            })
            .select()
            .single();

        if (error) {
            // Check if it's a unique constraint violation (already watched)
            if (error.code === '23505') {
                return NextResponse.json({ success: false, error: 'Player already in watchlist' }, { status: 409 });
            }
            console.error('Error adding to watchlist:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, watched: data });
    } catch (err) {
        console.error('Error in POST /api/watched:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Remove a player from watchlist
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { league_id, manager_id, player_id } = body;

        if (!league_id || !manager_id || !player_id) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const { error } = await supabase
            .from('watched_players')
            .delete()
            .eq('league_id', league_id)
            .eq('manager_id', manager_id)
            .eq('player_id', player_id);

        if (error) {
            console.error('Error removing from watchlist:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Error in DELETE /api/watched:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
