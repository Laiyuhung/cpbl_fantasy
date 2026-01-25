import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function POST(request, { params }) {
    const { leagueId } = params;

    try {
        const body = await request.json();
        const { managerId, playerId, targetPosition, currentPosition, gameDate, swapWithPlayerId } = body;

        if (!managerId || !playerId || !targetPosition || !gameDate) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        console.log(`[MoveRoster] Request: Player ${playerId} (${currentPosition} -> ${targetPosition}) on >= ${gameDate}`);

        // 1. Fetch League Settings (for limits, specifically Minor)
        // We need to check if Target is NA, is it full?
        let checkNaLimit = false;
        let naLimit = 0;

        if (targetPosition === 'NA') {
            const { data: settings } = await supabase
                .from('league_settings')
                .select('roster_positions')
                .eq('league_id', leagueId)
                .single();
            if (settings && settings.roster_positions) {
                checkNaLimit = true;
                // Case insensitive check for 'Minor' key in JSONB
                const positions = settings.roster_positions;
                const minorKey = Object.keys(positions).find(k => k.toLowerCase() === 'minor') || 'Minor';
                naLimit = positions[minorKey] || 0;
            }
        }

        // 2. Fetch Roster Data for the *Specific Date* first to determine the Swap context
        // We assume consistency for future dates for now, or we apply the same logic to all future dates.
        // User Requirement: "務必僅更新該聯盟的，並且更新>=game_date的部分"
        // This usually implies a "Rest of Season" move. 
        // We will execute the logic based on the *Start Date* state, and apply the *result* (Swap vs BN) to all future dates.

        const { data: currentRosterData, error: rosterError } = await supabase
            .from('league_roster_positions')
            .select(`
                player_id, 
                position,
                player:player_list (
                    player_id,
                    name,
                    identity,
                    batter_or_pitcher
                )
            `)
            .eq('league_id', leagueId)
            .eq('manager_id', managerId)
            .eq('game_date', gameDate); // Check correct state based on the clicked date

        if (rosterError) throw rosterError;

        // Find Target Player (Occupant)
        // Note: targetPosition might be 'BN', which allows multiple.
        // If Target is BN, we just move Player to BN. (No swap needed usually, unless we want to be fancy).
        // But user said "show out available positions". BN is always available (unlimited).
        // So if Target == BN, we just update Player -> BN.

        // If Target is a specific slot (e.g. 'SS'), and it is occupied, checks needed.
        // If Target is 'NA', check limit.

        // Helper: Is Valid Move? (Backend verification optional but good)
        // We trust frontend parsed position_list, but checking occupant is crucial.

        // Filter roster to find occupant(s) at targetPosition
        const occupants = currentRosterData.filter(p => p.position === targetPosition);

        // Variables for Update
        const updates = []; // Array of { player_id, new_position }

        if (targetPosition === 'BN') {
            // Always allowed
            updates.push({ player_id: playerId, new_position: 'BN' });
        } else if (targetPosition === 'NA') {
            // Check Limit
            if (checkNaLimit && occupants.length >= naLimit) {
                // NA is Full. Try Swap.
                let targetOccupant = null;

                if (swapWithPlayerId) {
                    targetOccupant = occupants.find(p => p.player_id === swapWithPlayerId);
                } else if (occupants.length === 1) {
                    // If only 1 occupant, auto-swap with them
                    targetOccupant = occupants[0];
                }

                if (!targetOccupant) {
                    return NextResponse.json({ success: false, error: 'Minor (NA) slots are full. Please select a player to swap.' }, { status: 400 });
                }

                // Perform Swap (Player -> NA, Target -> CurrentPos/BN)
                // Logic shared with Standard Position Swap
                // We reuse the logic below by temporarily setting occupants to [targetOccupant] and treating as 'Standard' swap flow?
                // Or just copy swap logic here.

                // Can targetOccupant go to currentPosition?
                // Fetch basic info for TargetOccupant
                const { data: occupantData } = await supabase
                    .from('player_list')
                    .select('*')
                    .eq('player_id', targetOccupant.player_id)
                    .single();

                // Fetch their positions
                let occupantPositions = [];
                const { data: bPos } = await supabase.from('v_batter_positions').select('position_list').eq('player_id', targetOccupant.player_id).single();
                const { data: pPos } = await supabase.from('v_pitcher_positions').select('position_list').eq('player_id', targetOccupant.player_id).single();

                if (bPos) occupantPositions = bPos.position_list.split(',').map(s => s.trim());
                if (pPos) occupantPositions = pPos.position_list.split(',').map(s => s.trim());

                if (occupantData.B_or_P === 'B') {
                    occupantPositions.push('Util');
                    occupantPositions.push('BN');
                }
                if (occupantData.B_or_P === 'P') {
                    occupantPositions.push('P');
                    occupantPositions.push('BN');
                }
                occupantPositions = [...new Set(occupantPositions)];

                const canSwap = occupantPositions.includes(currentPosition);

                updates.push({ player_id: playerId, new_position: 'NA' }); // Move Main Player to NA
                if (canSwap) {
                    updates.push({ player_id: targetOccupant.player_id, new_position: currentPosition });
                } else {
                    updates.push({ player_id: targetOccupant.player_id, new_position: 'BN' });
                }

            } else {
                updates.push({ player_id: playerId, new_position: 'NA' });
            }
        } else {
            // Standard Position (C, 1B, SP, Util, etc.) - usually Single Slot (except OF/P maybe? User settings usually 1 per key, but if OF=3, we have multiple 'OF' slots?
            // The user settings structure { "OF": 1 } implies generic slots.
            // If the user has "OF": 3, the database likely stores 3 rows with position='OF'.
            // In a fantasy app, if I move to 'OF', and there is an Empty 'OF', I take it.
            // If all 'OF's are full, I must swap with *one* of them. 
            // This is tricky if there are multiple occupants (e.g. 3 OFs). 
            // UI usually asks "Who to swap with?".
            // BUT, user prompt said: "如果 位子為空... 如果位置有人..."
            // If there are multiple slots for 'OF', and 1 is empty, we should find the empty one (implied by just updating to 'OF').
            // If *all* are full, we need to swap.
            // Current simplified logic: logic assumes we are targeting a specific *Slot*?
            // User said: "Show out available positions (look at position_list)".
            // If I click 'OF', and there are 3 OF slots engaged, checking if "Empty" exists.

            // Check limits for this position
            const { data: settings } = await supabase.from('league_settings').select('roster_positions').eq('league_id', leagueId).single();
            const posLimit = settings?.roster_positions?.[targetPosition] || 0;

            if (occupants.length < posLimit) {
                // Have space (Empty slot exists)
                updates.push({ player_id: playerId, new_position: targetPosition });
            } else {
                // Full. Need Swap.
                // If multiple occupants, which one to swap? 
                // Simple logic for now: Swap with the *first* occupant found, or require UI to specify.
                // Given the prompt "如果位置有人且雙方換為合理... 直接交換", it implies a direct 1-on-1 interaction.
                // However, the UI described is "Click Slot -> Choose Position". It doesn't select *which* OF to swap with.
                // I will assume for multi-slot positions (OF, P), we swap with the *first* one OR (better) fail if ambiguous?
                // Let's assume simplest: Swap with the first occupant.
                // Most positions are 1-count (C, SS, 2B). OF/P/RP might be multiple.
                // Ideally, if multiple, we'd pick one. I'll pick `occupants[0]`.

                const targetOccupant = occupants[0];

                // Eligibility Check for TargetOccupant -> CurrentPosition
                // We need targetOccupant's position list.
                // Fetching explicitly matching playerslist logic
                const { data: occupantData } = await supabase
                    .from('player_list') // We assume we can get basic info or view
                    .select('*')
                    .eq('player_id', targetOccupant.player_id)
                    .single();

                // Fetch their positions (We need to replicate the View logic or just fetch from View)
                // Let's use the V_batter/V_pitcher views
                let occupantPositions = [];

                const { data: bPos } = await supabase.from('v_batter_positions').select('position_list').eq('player_id', targetOccupant.player_id).single();
                const { data: pPos } = await supabase.from('v_pitcher_positions').select('position_list').eq('player_id', targetOccupant.player_id).single();

                if (bPos) occupantPositions = bPos.position_list.split(',').map(s => s.trim());
                if (pPos) occupantPositions = pPos.position_list.split(',').map(s => s.trim());

                // Also Util is universal for Batters, P for Pitchers.
                // Add defaults
                if (occupantData.B_or_P === 'B') {
                    occupantPositions.push('Util');
                    occupantPositions.push('BN');
                }
                if (occupantData.B_or_P === 'P') {
                    occupantPositions.push('P');
                    occupantPositions.push('BN');
                }

                // Clean up
                occupantPositions = [...new Set(occupantPositions)];

                const canSwap = occupantPositions.includes(currentPosition);

                if (canSwap) {
                    // Swap
                    updates.push({ player_id: playerId, new_position: targetPosition });
                    updates.push({ player_id: targetOccupant.player_id, new_position: currentPosition });
                } else {
                    // Move Target to BN
                    updates.push({ player_id: playerId, new_position: targetPosition });
                    updates.push({ player_id: targetOccupant.player_id, new_position: 'BN' });
                }
            }
        }

        // 3. Execute Updates for >= gameDate
        // We use a loop or multiple queries. transaction is best but simple updates work.
        for (const update of updates) {
            const { error: updateError } = await supabase
                .from('league_roster_positions')
                .update({ position: update.new_position })
                .eq('league_id', leagueId)
                .eq('manager_id', managerId)
                .eq('player_id', update.player_id)
                .gte('game_date', gameDate);

            if (updateError) {
                console.error('Update Validation Error:', updateError);
                return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, updates });

    } catch (error) {
        console.error('Move Roster Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
