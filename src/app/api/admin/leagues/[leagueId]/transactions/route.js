import { NextResponse } from 'next/server';
import supabase from '../../../../../../lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request, { params }) {
    try {
        const { leagueId } = await params;

        // 1. Admin check
        const cookieStore = await cookies();
        const userIdCookie = cookieStore.get('user_id');

        if (!userIdCookie || !userIdCookie.value) {
            return NextResponse.json({ success: false, error: 'Unauthorized: No user cookie' }, { status: 401 });
        }
        const loggedInManagerId = userIdCookie.value;

        const { data: adminRecord, error: adminError } = await supabase
            .from('admin')
            .select('manager_id')
            .eq('manager_id', loggedInManagerId)
            .single();

        if (adminError || !adminRecord) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Admin access required.' }, { status: 403 });
        }

        // 2. Fetch transactions and waiver claims (Mimicking Overview)
        const [transRes, waiverRes, membersRes, priorityRes] = await Promise.all([
            supabase
                .from('transactions_2026')
                .select('*')
                .eq('league_id', leagueId)
                .order('transaction_time', { ascending: false }),
            supabase
                .from('waiver_claims')
                .select('*')
                .eq('league_id', leagueId)
                .order('status', { ascending: false })
                .order('off_waiver', { ascending: false }),
            supabase
                .from('league_members')
                .select('manager_id, nickname')
                .eq('league_id', leagueId),
            supabase
                .from('waiver_priority')
                .select('manager_id, rank')
                .eq('league_id', leagueId)
        ]);

        if (transRes.error) throw transRes.error;
        if (waiverRes.error) throw waiverRes.error;
        if (membersRes.error) throw membersRes.error;

        // 3. Fetch all relevant player names
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
                .select('player_id, name, batter_or_pitcher, team')
                .in('player_id', Array.from(playerIds));

            // Fetch positions too for better modal display
            const { data: batterPos } = await supabase.from('v_batter_positions').select('*').in('player_id', Array.from(playerIds));
            const { data: pitcherPos } = await supabase.from('v_pitcher_positions').select('*').in('player_id', Array.from(playerIds));

            const posMap = {};
            if (batterPos) batterPos.forEach(p => posMap[p.player_id] = p.position_list);
            if (pitcherPos) pitcherPos.forEach(p => posMap[p.player_id] = p.position_list);

            if (!pError && players) {
                players.forEach(p => {
                    playerMap[p.player_id] = {
                        ...p,
                        position_list: posMap[p.player_id]
                    };
                });
            }
        }

        // 4. Map nicknames
        const memberMap = {};
        membersRes.data.forEach(m => memberMap[m.manager_id] = m.nickname);

        // 5. Enrich data
        const enrichedTransactions = transRes.data.map(t => ({
            ...t,
            player: playerMap[t.player_id] || { name: 'Unknown' },
            manager: { nickname: memberMap[t.manager_id] || 'Unknown' }
        }));

        const priorityMap = {};
        if (priorityRes && priorityRes.data) {
            priorityRes.data.forEach(p => priorityMap[p.manager_id] = p.rank);
        }

        const enrichedWaivers = waiverRes.data.map(w => ({
            ...w,
            player: playerMap[w.player_id] || { name: 'Unknown' },
            drop_player: w.drop_player_id ? (playerMap[w.drop_player_id] || { name: 'Unknown' }) : null,
            manager: { nickname: memberMap[w.manager_id] || 'Unknown' },
            waiver_priority: priorityMap[w.manager_id] || '-'
        }));

        // 6. Build waiver priority ranking table
        const priorityRankings = [];
        if (priorityRes && priorityRes.data) {
            priorityRes.data.forEach(p => {
                priorityRankings.push({
                    rank: p.rank,
                    nickname: memberMap[p.manager_id] || 'Unknown'
                });
            });
            priorityRankings.sort((a, b) => a.rank - b.rank);
        }

        return NextResponse.json({
            success: true,
            transactions: enrichedTransactions,
            waivers: enrichedWaivers,
            priorityRankings: priorityRankings,
            totalManagers: Object.keys(memberMap).length
        });

    } catch (error) {
        console.error('Admin transactions error:', error);
        return NextResponse.json({ success: false, error: 'Server error', details: error.message }, { status: 500 });
    }
}
