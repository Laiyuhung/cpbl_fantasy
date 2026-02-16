import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request, { params }) {
    const { leagueId } = params;

    try {
        // 1. Fetch transactions and waiver claims
        const [transRes, waiverRes, membersRes] = await Promise.all([
            supabase
                .from('transactions_2026')
                .select('*')
                .eq('league_id', leagueId)
                .order('transaction_time', { ascending: false }),
            supabase
                .from('waiver_claims')
                .select('*')
                .eq('league_id', leagueId)
                .not('status', 'in', '("pending","canceled")')
                .lte('off_waiver', new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0])
                .order('updated_at', { ascending: false }),
            supabase
                .from('league_members')
                .select('manager_id, nickname')
                .eq('league_id', leagueId)
        ]);

        if (transRes.error) throw transRes.error;
        if (waiverRes.error) throw waiverRes.error;
        if (membersRes.error) throw membersRes.error;

        // 2. Fetch all relevant player names
        const playerIds = new Set();
        transRes.data.forEach(t => {
            if (t.player_id) playerIds.add(t.player_id);
        });
        waiverRes.data.forEach(w => {
            if (w.player_id) playerIds.add(w.player_id);
            if (w.drop_player_id) playerIds.add(w.drop_player_id);
        });

        let playerMap = {};
        if (playerIds.size > 0) {
            const { data: players, error: pError } = await supabase
                .from('player_list')
                .select('player_id, name')
                .in('player_id', Array.from(playerIds));
            if (!pError && players) {
                players.forEach(p => playerMap[p.player_id] = p.name);
            }
        }

        // 3. Map nicknames
        const memberMap = {};
        membersRes.data.forEach(m => memberMap[m.manager_id] = m.nickname);

        // 4. Enrich data
        const enrichedTransactions = transRes.data.map(t => ({
            ...t,
            player: { name: playerMap[t.player_id] || 'Unknown' },
            manager: { nickname: memberMap[t.manager_id] || 'Unknown' }
        }));

        const enrichedWaivers = waiverRes.data.map(w => ({
            ...w,
            player: { name: playerMap[w.player_id] || 'Unknown' },
            drop_player: w.drop_player_id ? { name: playerMap[w.drop_player_id] || 'Unknown' } : null,
            manager: { nickname: memberMap[w.manager_id] || 'Unknown' }
        }));

        return NextResponse.json({
            success: true,
            transactions: enrichedTransactions,
            waivers: enrichedWaivers
        });
    } catch (err) {
        console.error('Error fetching transactions/waivers:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
