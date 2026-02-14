import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseServer';

// GET /api/waiver_claims/manage?league_id=...&manager_id=...
// Fetch pending waiver claims for a manager
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const league_id = searchParams.get('league_id');
        const manager_id = searchParams.get('manager_id');

        if (!league_id || !manager_id) {
            return NextResponse.json({ success: false, error: 'Missing league_id or manager_id' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('waiver_claims')
            .select(`
        *,
        player:player_list!fk_waiver_player_add (name, team, identity),
        drop_player:player_list!fk_waiver_player_drop (name, team, identity)
      `)
            .eq('league_id', league_id)
            .eq('manager_id', manager_id)
            .eq('status', 'pending')
            .order('off_waiver', { ascending: true })
            .order('personal_priority', { ascending: true });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, claims: data });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// DELETE /api/waiver_claims/manage
// Cancel a waiver claim
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { claim_id, manager_id } = body;

        if (!claim_id || !manager_id) {
            return NextResponse.json({ success: false, error: 'Missing claim_id or manager_id' }, { status: 400 });
        }

        // Verify ownership of the claim
        const { data: claim, error: fetchError } = await supabase
            .from('waiver_claims')
            .select('id, off_waiver, league_id')
            .eq('id', claim_id)
            .eq('manager_id', manager_id)
            .single();

        if (fetchError || !claim) {
            return NextResponse.json({ success: false, error: 'Claim not found or access denied' }, { status: 404 });
        }

        // Delete the claim
        const { error: deleteError } = await supabase
            .from('waiver_claims')
            .delete()
            .eq('id', claim_id);

        if (deleteError) {
            return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
        }

        // Reorder remaining claims for the same off_waiver date
        // Fetch remaining claims for this date/manager
        const { data: remainingClaims, error: remainingError } = await supabase
            .from('waiver_claims')
            .select('id, personal_priority')
            .eq('league_id', claim.league_id)
            .eq('manager_id', manager_id)
            .eq('status', 'pending');

        // Allow off_waiver to be null (though unlikely for waivers) or match
        let query = supabase.from('waiver_claims')
            .select('id, personal_priority')
            .eq('league_id', claim.league_id)
            .eq('manager_id', manager_id)
            .eq('status', 'pending');

        if (claim.off_waiver) {
            query = query.eq('off_waiver', claim.off_waiver);
        } else {
            query = query.is('off_waiver', null);
        }

        const { data: groupClaims, error: groupError } = await query.order('personal_priority', { ascending: true });

        if (!groupError && groupClaims) {
            // Re-assign priorities 1..N
            for (let i = 0; i < groupClaims.length; i++) {
                const c = groupClaims[i];
                const newPrior = i + 1;
                if (c.personal_priority !== newPrior) {
                    await supabase
                        .from('waiver_claims')
                        .update({ personal_priority: newPrior })
                        .eq('id', c.id);
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// PUT /api/waiver_claims/manage
// Reorder claims
export async function PUT(request) {
    try {
        const body = await request.json();
        const { claims_order, manager_id } = body;
        // claims_order: [{ id: 'uuid', priority: 1 }, { id: 'uuid2', priority: 2 }]

        if (!claims_order || !Array.isArray(claims_order) || !manager_id) {
            return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
        }

        // Validate all belong to manager
        // (Simplified: just try update with manager_id filter)

        for (const item of claims_order) {
            const { error } = await supabase
                .from('waiver_claims')
                .update({ personal_priority: item.priority })
                .eq('id', item.id)
                .eq('manager_id', manager_id)
                .eq('status', 'pending');

            if (error) {
                console.error('Reorder update failed for', item.id, error);
                throw error;
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
