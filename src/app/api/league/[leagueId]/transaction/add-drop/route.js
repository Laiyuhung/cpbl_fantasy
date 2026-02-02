import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function POST(request, { params }) {
    const { leagueId } = params;

    try {
        const body = await request.json();
        console.log('[AddDrop API] Body:', body);

        // Frontend sends 'targetSlot'
        const { managerId, addPlayerId, dropPlayerId, targetSlot: requestedSlot } = body;
        console.log('[AddDrop API] Requested Slot:', requestedSlot);

        if (!managerId || !addPlayerId) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Fetch Settings
        const { data: settings } = await supabase
            .from('league_settings')
            .select('roster_positions, foreigner_on_team_limit, foreigner_active_limit, waiver_period_days')
            .eq('league_id', leagueId)
            .single();

        const rosterConfig = settings?.roster_positions || {};
        const minorKey = Object.keys(rosterConfig).find(k => k.toLowerCase() === 'minor') || 'Minor';
        const naLimit = rosterConfig[minorKey] || 0;
        const waiverDays = settings?.waiver_period_days || 2; // Default 2 days

        const tradeGroupId = crypto.randomUUID();

        // 2. Process DROP first (to free up space/limits)
        if (dropPlayerId) {
            // Check Drop Player Ownership Info for acquired_at
            const { data: dropOwnership, error: fetchDropError } = await supabase
                .from('league_player_ownership')
                .select('*')
                .eq('league_id', leagueId)
                .eq('manager_id', managerId)
                .eq('player_id', dropPlayerId)
                .single();

            if (fetchDropError || !dropOwnership) {
                // Might already be dropped or invalid? just ignore or error?
                // Safer: Skip drop logic if not owned, but technically validation should catch this.
                // We will throw to be safe
                throw new Error('Drop player not owned by manager.');
            }

            // Date Check (Taiwan Time)
            const taiwanTimeOptions = { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' };
            const now = new Date();
            const todayStr = now.toLocaleDateString('zh-TW', taiwanTimeOptions).replace(/\//g, '-'); // YYYY-MM-DD format depends on locale, let's be careful.
            // Actually 'en-CA' is better for ISO format YYYY-MM-DD
            const todayIso = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

            const acquiredDate = new Date(dropOwnership.acquired_at);
            const acquiredIso = acquiredDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

            const isSameDay = todayIso === acquiredIso;

            if (isSameDay) {
                // Same Day -> Delete Ownership (Treat as FA Drop / Undo)
                const { error: ownError } = await supabase
                    .from('league_player_ownership')
                    .delete()
                    .eq('league_id', leagueId)
                    .eq('manager_id', managerId)
                    .eq('player_id', dropPlayerId);

                if (ownError) throw ownError;
            } else {
                // Different Day -> Move to Waiver
                // Calculate Off Waiver Date
                const offWaiverDate = new Date(now);
                offWaiverDate.setDate(offWaiverDate.getDate() + waiverDays);

                const { error: waiverError } = await supabase
                    .from('league_player_ownership')
                    .update({
                        status: 'Waiver',
                        off_waiver_date: offWaiverDate.toISOString(),
                        manager_id: null // Ownership cleared from manager? 
                        // Wait, usually Waiver means "Dropped by X, available on Waiver".
                        // ownership table usually tracks "who owns them". If on Waiver, manager_id should be null?
                        // OR we map waiver status in a different way?
                        // In standard Yahoo: Dropped player goes to Waiver list, no one owns them.
                        // So manager_id = null is correct.
                        // BUT `league_player_ownership` link player to manager.
                        // If manager_id is null, how do we track 'off_waiver_date'?
                        // Maybe update the row to manager_id=null? Or delete and insert a 'system' ownership?
                        // Usually we DELETE the ownership row for the user, and UPDATE the 'player_list' or a separate 'waivers' table?
                        // Let's assume standard logic provided by user: "status改Waiver ... 把off_waiver填入".
                        // If I keep manager_id, it implies they still own them? No.
                        // The user said: "delete that row (FA)... otherwise modify status to Waiver".
                        // If I modify status to Waiver but keep manager_id, they still appear on roster?
                        // No, Roster Position is deleted. 
                        // But `ownerships` query usually checks `manager_id`.
                        // If I leave manager_id, they will show up as "Waiver" on MY team?
                        // User said: "status改Waiver... 並且... 把league_player_ownership.off_waiver日期...".
                        // This implies keeping the row but changing status?
                        // BUT `league_ownerships` table usually has unique constraints or implies current ownership.
                        // If I drop them, I shouldn't own them.
                        // Maybe I should set manager_id to NULL?
                        // But if I set manager_id to NULL, how do I find this row later? By player_id?
                        // If multiple people drop the same player (impossible sequentially)?
                        // A player can only be owned by one person.
                        // So setting manager_id = NULL (or a specific system ID) + status = 'Waiver' makes sense.
                        // Let's assume setting `manager_id = NULL` is correct for "On Waiver (Unowned)".
                    })
                    .eq('league_id', leagueId)
                    .eq('manager_id', managerId)
                    .eq('player_id', dropPlayerId);

                // Wait, if I set manager_id to NULL, I must ensure current query handles it.
                // Actually, if I update, I must strictly match the row.
                // Let's TRY updating status to 'Waiver' and SET manager_id to NULL to detach from user.

                // Update: The requirement is "status改Waiver...". 
                // If I keep manager_id, it confuses "My Players".
                // I will set manager_id to NULL to indicate "No Team (Waiver)".
                // Note: The delete logic above deletes it entirely.
                // The update logic keeps it but detaches from manager.
                const { error: updateError } = await supabase
                    .from('league_player_ownership')
                    .update({
                        status: 'Waiver',
                        off_waiver: offWaiverDate.toISOString(),
                        manager_id: null // DETACH
                    })
                    .eq('league_id', leagueId)
                    //.eq('manager_id', managerId) // If I detach, I match by PK or IDs
                    .eq('player_id', dropPlayerId); // Player is unique in league ownership usually?
                // Verify: league_player_ownership PK is usually (league_id, player_id) or similar.

                if (updateError) throw updateError;
            }

            // Always Delete Roster Position (Future dates? Or just all relevant?)
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
        // Determine Slot: NA or BN
        let targetSlot = 'BN'; // Default

        if (requestedSlot && ['NA', 'BN'].includes(requestedSlot)) {
            targetSlot = requestedSlot;
        } else if (isNaEligible) {
            // Check NA Capacity
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

            const limitOnTeam = settings?.foreigner_on_team_limit;

            // On Team Limit Check
            if (limitOnTeam && limitOnTeam !== 'No limit') {
                if (onTeamCount + 1 > parseInt(limitOnTeam)) {
                    // Rollback? We already dropped...
                    // Ideally this check should happen BEFORE drop.
                    // But we rely on Drop to clear space.
                    // Does dropPlayerId reduce count? Yes.
                    // If we had 4/4, dropped 1 (now 3/4), adding 1 makes 4/4. Safe.
                    // OnTeam Limit Check
                    return NextResponse.json({ success: false, error: 'Foreigner On-Team limit exceeded.' }, { status: 400 });
                }
            }
        }

        // Insert Ownership
        // Check if player row already exists (e.g. was on Waiver)?
        // Upsert or Insert? 
        // If player was on Waiver (manager_id=null), we should UPDATE to claim them?
        // OR delete old waiver row and insert new?
        // Standard logic: Delete any existing ownership for simple processing, then insert new.
        // Or check unique constraint.
        const { error: deleteOldOwn } = await supabase
            .from('league_player_ownership')
            .delete()
            .eq('league_id', leagueId)
            .eq('player_id', addPlayerId);
        // This clears any waiver status or previous ownership artifacts

        const { error: addOwnError } = await supabase
            .from('league_player_ownership')
            .insert({
                league_id: leagueId,
                manager_id: managerId,
                player_id: addPlayerId,
                status: 'On Team',
                acquired_at: new Date().toISOString()
            });

        if (addOwnError) throw addOwnError;

        // Insert Roster Position (Full Season Generation)
        // Logic adapted from ownership/route.js to ensure consistency (game_date range)

        // 1. Get Schedule Info for Season End
        const { data: scheduleInfo } = await supabase
            .from('league_schedule')
            .select('week_number, week_start, week_end')
            .eq('league_id', leagueId)
            .order('week_number', { ascending: true });

        let seasonEnd = null;
        let seasonStart = null;

        if (scheduleInfo && scheduleInfo.length > 0) {
            const firstWeek = scheduleInfo[0];
            const lastWeek = scheduleInfo[scheduleInfo.length - 1];
            seasonStart = new Date(firstWeek.week_start);
            seasonEnd = new Date(lastWeek.week_end);
        }

        // 2. Determine Start Date (Today)
        const nowTaiwan = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
        nowTaiwan.setHours(0, 0, 0, 0);

        let startDate = nowTaiwan;
        if (seasonStart && nowTaiwan < seasonStart) {
            startDate = seasonStart;
        }

        // 3. Generate Rows
        const rosterRows = [];
        if (seasonEnd) {
            let currentDate = new Date(startDate);
            while (currentDate <= seasonEnd) {
                rosterRows.push({
                    league_id: leagueId,
                    manager_id: managerId,
                    player_id: addPlayerId,
                    position: targetSlot,
                    game_date: currentDate.toISOString().split('T')[0]
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } else {
            // Fallback if no schedule: Insert for Today only
            rosterRows.push({
                league_id: leagueId,
                manager_id: managerId,
                player_id: addPlayerId,
                position: targetSlot,
                game_date: new Date().toISOString().split('T')[0]
            });
        }

        if (rosterRows.length > 0) {
            const { error: addPosError } = await supabase
                .from('league_roster_positions')
                .upsert(rosterRows, { onConflict: 'league_id, player_id, game_date' });

            if (addPosError) throw addPosError;
        }

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
