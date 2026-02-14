
import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseServer';

// GET /api/waiver_claims/manage
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const league_id = searchParams.get('league_id');
        const manager_id = searchParams.get('manager_id');

        if (!league_id || !manager_id) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('waiver_claims')
            .select(`
        *,
        player:player_list!waiver_claims_player_id_fkey(name, team, identity),
        drop_player:player_list!waiver_claims_drop_player_id_fkey(name, team, identity)
      `)
            .eq('league_id', league_id)
            .eq('manager_id', manager_id)
            .eq('status', 'pending')
            .order('off_waiver', { ascending: true })
            .order('personal_priority', { ascending: true });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// DELETE /api/waiver_claims/manage
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing claim ID' }, { status: 400 });
        }

        const { error } = await supabase
            .from('waiver_claims')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// PATCH /api/waiver_claims/manage
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { order } = body; // Array of { id, personal_priority }

        if (!order || !Array.isArray(order)) {
            return NextResponse.json({ success: false, error: 'Missing order array' }, { status: 400 });
        }

        // Update priorities in a transaction-like manner using Promise.all
        // Since we are just reordering for a manager, simple updates are fine.
        const updates = order.map(item =>
            supabase
                .from('waiver_claims')
                .update({ personal_priority: item.personal_priority })
                .eq('id', item.id)
        );

        await Promise.all(updates);

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
