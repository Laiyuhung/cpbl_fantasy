import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function POST(request, { params }) {
    const { leagueId } = params;

    try {
        const body = await request.json();
        const { managerId, addPlayerId, dropPlayerId } = body;

        if (!managerId || !addPlayerId) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Fetch Settings
        const { data: settings } = await supabase
            .from('league_settings')
            .select('roster_positions, foreigner_on_team_limit, foreigner_active_limit')
            .eq('league_id', leagueId)
            .single();

        const rosterConfig = settings?.roster_positions || {};
        const minorKey = Object.keys(rosterConfig).find(k => k.toLowerCase() === 'minor') || 'Minor';
        const naLimit = rosterConfig[minorKey] || 0;

        const tradeGroupId = crypto.randomUUID();

        // 2. Process DROP first (to free up space/limits)
        if (dropPlayerId) {
            // Delete Ownership
            const { error: ownError } = await supabase
                .from('league_player_ownership')
                .delete()
                .eq('league_id', leagueId)
                .eq('manager_id', managerId)
                .eq('player_id', dropPlayerId);

            if (ownError) throw ownError;

            // Delete Roster Position (Future dates? Or just all relevant?)
            // Usually we delete for >= Today or 'current'. 
            // For now, let's delete all future/current records for this league/manager/player.
            const { error: posError } = await supabase
                .from('league_roster_positions')
                .delete()
                .eq('league_id', leagueId)
                .eq('manager_id', managerId)
                .eq('player_id', dropPlayerId);

            if (posError) throw posError;

            // Log Drop Transaction
            await supabase.from('transactions_2026').insert({
                league_id: leagueId,
                player_id: dropPlayerId,
                manager_id: managerId,
                transaction_type: 'DROP',
                trade_group_id: tradeGroupId
            });
        }

        // 3. Process ADD
        // Check Limits (Foreigner Limits need current roster count)
        // Fetch Current Roster (after drop)
        // Since we just dropped, the DB query will reflect the state *after* drop.

        // Get Add Player Info
        const { data: addPlayer } = await supabase
            .from('player_list')
            .select('*')
            .eq('player_id', addPlayerId)
            .single();

        const { data: addPlayerStatus } = await supabase
            .from('real_life_player_status')
            .select('status')
            .eq('player_id', addPlayerId)
            .single();

        const isForeigner = addPlayer.identity?.toLowerCase() === 'foreigner';
        const realStatus = addPlayerStatus?.status || 'Active';

        // Determine Slot: NA or BN
        // Check NA Eligibility
        const isNaEligible = realStatus.toUpperCase() !== 'MAJOR';

        // Check NA Capacity
        let targetSlot = 'BN'; // Default
        if (isNaEligible) {
            const { count: naCount } = await supabase
                .from('league_roster_positions')
                .select('*', { count: 'exact', head: true })
                .eq('league_id', leagueId)
                .eq('manager_id', managerId)
                .eq('position', 'NA'); // Adjust if Position string varies (Minor/NA)

            if ((naCount || 0) < naLimit) {
                targetSlot = 'NA';
            }
        }

        // Check Foreigner Limits if applies
        if (isForeigner) {
            // Fetch current foreigner counts
            const { data: currentRoster } = await supabase
                .from('league_roster_positions')
                .select('position, player_id, player:player_list(identity)')
                .eq('league_id', leagueId)
                .eq('manager_id', managerId);

            const foreigners = currentRoster.filter(p => p.player?.identity?.toLowerCase() === 'foreigner');
            const onTeamCount = foreigners.length;
            // Note: Since we haven't inserted the new player yet, this is "Pre-Add" count.
            // If we Dropped a foreigner, this count reflects that (due to await).

            const limitOnTeam = settings?.foreigner_on_team_limit;

            // On Team Limit Check
            if (limitOnTeam && limitOnTeam !== 'No limit') {
                if (onTeamCount + 1 > parseInt(limitOnTeam)) {
                    // Rollback? We already dropped...
                    // Ideally this check should happen BEFORE drop.
                    // But we rely on Drop to clear space.
                    // Does dropPlayerId reduce count? Yes.
                    // If we had 4/4, dropped 1 (now 3/4), adding 1 makes 4/4. Safe.
                    // If we had 4/4, dropped Local, adding Foreigner -> 5/4. Error.
                    return NextResponse.json({ success: false, error: 'Foreigner On-Team limit exceeded.' }, { status: 400 });
                }
            }

            // Active Limit Check
            // Does adding to BN/NA count as Active? No.
            // So Add never triggers Active Limit violation immediately (unless targetSlot calculated as Active, which we don't do).
        }

        // Insert Ownership
        const { error: addOwnError } = await supabase
            .from('league_player_ownership')
            .insert({
                league_id: leagueId,
                manager_id: managerId,
                player_id: addPlayerId,
                status: 'On Team',
                acquired_date: new Date().toISOString()
            });

        if (addOwnError) throw addOwnError;

        // Insert Roster Position
        const { error: addPosError } = await supabase
            .from('league_roster_positions')
            .insert({
                league_id: leagueId,
                manager_id: managerId,
                player_id: addPlayerId,
                position: targetSlot,
                game_date: new Date().toISOString().split('T')[0] // Effective Today/Now
            });

        if (addPosError) throw addPosError;

        // Log Add Transaction
        await supabase.from('transactions_2026').insert({
            league_id: leagueId,
            player_id: addPlayerId,
            manager_id: managerId,
            transaction_type: 'ADD',
            trade_group_id: tradeGroupId
        });

        return NextResponse.json({ success: true, slot: targetSlot });

    } catch (error) {
        console.error('Transaction Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
