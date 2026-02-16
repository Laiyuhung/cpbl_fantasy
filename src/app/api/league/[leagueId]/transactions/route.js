import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request, { params }) {
    const { leagueId } = params;

    try {
        // 1. Fetch transactions_2026
        const { data: transactions, error: transError } = await supabase
            .from('transactions_2026')
            .select(`
        *,
        player:player_list(name),
        manager:league_members!fk_transactions_manager(nickname)
      `)
            .eq('league_id', leagueId)
            .order('transaction_time', { ascending: false });

        if (transError) throw transError;

        // 2. Fetch waiver_claims (non-pending/canceled, date <= today)
        const today = new Date().toISOString().split('T')[0];
        const { data: waivers, error: waiverError } = await supabase
            .from('waiver_claims')
            .select(`
        *,
        player:player_list!fk_waiver_player_add(name),
        drop_player:player_list!fk_waiver_player_drop(name),
        manager:league_members!fk_waiver_manager(nickname)
      `)
            .eq('league_id', leagueId)
            .not('status', 'in', '("pending","canceled")')
            .lte('off_waiver', today)
            .order('updated_at', { ascending: false });

        if (waiverError) throw waiverError;

        return NextResponse.json({
            success: true,
            transactions: transactions || [],
            waivers: waivers || []
        });
    } catch (err) {
        console.error('Error fetching transactions/waivers:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
