import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function POST(req) {
    try {
        const body = await req.json();
        const { trade_id, manager_id } = body;

        if (!trade_id || !manager_id) {
            return NextResponse.json({ success: false, error: 'Missing Required Fields' }, { status: 400 });
        }

        // 1. Fetch Trade
        const { data: trade, error: fetchError } = await supabase
            .from('pending_trade')
            .select('league_id, status, veto_votes')
            .eq('id', trade_id)
            .single();

        if (fetchError || !trade) {
            return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
        }

        if (trade.status !== 'accepted') {
            return NextResponse.json({ success: false, error: 'Trade is not in accepted status' }, { status: 400 });
        }

        // 2. Fetch League Settings (for Review Rule)
        const { data: settings } = await supabase
            .from('league_settings')
            .select('trade_review')
            .eq('league_id', trade.league_id)
            .single();

        const reviewRule = settings?.trade_review || 'League votes';

        if (reviewRule === 'No review') {
            return NextResponse.json({ success: false, error: 'Veto not enabled for this league' }, { status: 400 });
        }

        // 3. Fetch Member Role
        const { data: member } = await supabase
            .from('league_members')
            .select('role')
            .eq('league_id', trade.league_id)
            .eq('manager_id', manager_id)
            .single();

        const role = member?.role || 'member';
        const isCommish = role === 'Commissioner';

        // 4. Validate Permission
        if (reviewRule === 'Commissioner reviews' && !isCommish) {
            return NextResponse.json({ success: false, error: 'Only Commissioner can veto' }, { status: 403 });
        }

        // 5. Check if already voted
        const currentVotes = trade.veto_votes || [];
        if (currentVotes.includes(manager_id)) {
            return NextResponse.json({ success: false, error: 'Already voted' }, { status: 400 });
        }

        // 6. Append Vote
        const newVotes = [...currentVotes, manager_id];

        const { error: updateError } = await supabase
            .from('pending_trade')
            .update({ veto_votes: newVotes })
            .eq('id', trade_id);

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, veto_votes: newVotes });

    } catch (error) {
        console.error('Veto API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
