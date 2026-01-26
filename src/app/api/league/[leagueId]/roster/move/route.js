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

        // --- 1. Fetch League Settings (for limits) ---
        let naLimit = 0;
        let targetLimit = 0;
        let checkNaLimit = targetPosition === 'NA';

        const { data: settings } = await supabase
            .from('league_settings')
            .select('roster_positions')
            .eq('league_id', leagueId)
            .single();

        if (settings && settings.roster_positions) {
            const positions = settings.roster_positions;
            // Get NA limit
            const minorKey = Object.keys(positions).find(k => k.toLowerCase() === 'minor') || 'Minor';
            naLimit = positions[minorKey] || 0;
            // Get Target limit
            targetLimit = positions[targetPosition] || 0;
            // BN limit is effectively infinite
            if (targetPosition === 'BN') targetLimit = 999;
        }

        // --- 2. Fetch Current Roster State ---
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
            .eq('game_date', gameDate);

        if (rosterError) throw rosterError;

        // --- 3. Validate Main Player Eligibility for NA ---
        if (targetPosition === 'NA') {
            const { data: playerStatusData } = await supabase
                .from('real_life_player_status')
                .select('status')
                .eq('player_id', playerId)
                .single();
            const pStatus = playerStatusData?.status || 'Active';
            // Logic: Not MAJOR -> Eligible for NA
            const isEligibleForNA = pStatus.toUpperCase() !== 'MAJOR';

            console.log(`[MoveRoster] NA Eligibility Check for ${playerId}: Status=${pStatus}, Eligible=${isEligibleForNA}`);

            if (!isEligibleForNA) {
                return NextResponse.json({ success: false, error: 'Player is MAJOR status, cannot move to NA.' }, { status: 400 });
            }
        }

        // --- 4. Identify Target Occupants ---
        // Find existing players in the target position
        const occupants = currentRosterData.filter(p => p.position === targetPosition);

        // --- 5. Determine Logic: Move vs Swap ---
        const updates = [];

        // Check if full
        let isFull = false;
        if (targetPosition === 'NA') {
            isFull = occupants.length >= naLimit;
        } else if (targetPosition !== 'BN') {
            isFull = occupants.length >= targetLimit;
        }

        if (!isFull && !swapWithPlayerId) {
            // Case A: Not Full AND No Explicit Swap -> Direct Move
            console.log(`[MoveRoster] Slot ${targetPosition} is not full. Direct Move.`);
            updates.push({ player_id: playerId, new_position: targetPosition });
        } else {
            // Case B: Full OR Explicit Swap -> Swap or Displacement
            console.log(`[MoveRoster] Slot ${targetPosition} is full. Attempting Swap/Displacement.`);

            // Resolve Target Occupant
            let targetOccupant = null;
            if (swapWithPlayerId) {
                targetOccupant = occupants.find(p => p.player_id === swapWithPlayerId);
            } else if (occupants.length === 1) {
                targetOccupant = occupants[0]; // Auto-select if only one
            } else if (occupants.length > 0) {
                targetOccupant = occupants[0]; // Logic assumption: Swap with first if unspecified (legacy)
            }

            if (!targetOccupant) {
                return NextResponse.json({ success: false, error: 'Slot is full. Please select a player to swap.' }, { status: 400 });
            }

            console.log(`[MoveRoster] Target Occupant Identified: ${targetOccupant.player_id} (${targetOccupant.player.name})`);

            // Check if Target Occupant can go to `currentPosition`
            // If currentPosition is 'BN', answer is always YES.
            // If currentPosition is 'NA' or other, check eligibility.
            // Also need to check position_list, B/P type, etc.

            // Fetch Target Occupant Extended Info (Status & Positions)

            // Helper: NA Eligibility (Match Frontend)
            const checkEligibleForNa = (status) => {
                const s = (status || '').toUpperCase();
                return s.includes('MN') || s.includes('MINOR') || s === 'NA' ||
                    s.includes('DEREGISTERED') || s === 'DR' || s === 'D' ||
                    s.includes('UNREGISTERED') || s === 'NR';
            };

            // 1. Get Status
            const { data: targetStatusData } = await supabase
                .from('real_life_player_status')
                .select('status')
                .eq('player_id', targetOccupant.player_id)
                .single();
            const targetStatus = targetStatusData?.status || 'Active';

            // 2. Get Positions
            let occupantPositions = [];
            const { data: bPos } = await supabase.from('v_batter_positions').select('position_list').eq('player_id', targetOccupant.player_id).single();
            const { data: pPos } = await supabase.from('v_pitcher_positions').select('position_list').eq('player_id', targetOccupant.player_id).single();

            if (bPos) occupantPositions = bPos.position_list.split(',').map(s => s.trim());
            if (pPos) occupantPositions = pPos.position_list.split(',').map(s => s.trim());

            // 3. Add Implicit Positions
            occupantPositions.push('BN'); // Everyone can go to BN

            if (targetOccupant.player.batter_or_pitcher === 'batter') {
                occupantPositions.push('Util');
            } else if (targetOccupant.player.batter_or_pitcher === 'pitcher') {
                occupantPositions.push('P');
            }
            // Add NA if eligible
            if (checkEligibleForNa(targetStatus)) {
                occupantPositions.push('NA');
            }

            occupantPositions = [...new Set(occupantPositions)]; // Unique

            console.log(`[MoveRoster] Target Eligible Positions: [${occupantPositions.join(', ')}]`);
            console.log(`[MoveRoster] Checking compatibility with Current Pos: ${currentPosition}`);

            const canSwap = occupantPositions.includes(currentPosition);
            console.log(`[MoveRoster] Can Swap? ${canSwap}`);

            updates.push({ player_id: playerId, new_position: targetPosition }); // Main Player always moves

            if (swapWithPlayerId) {
                // If explicit swap requested, be strict
                if (!canSwap) {
                    return NextResponse.json({ success: false, error: `Swap target ${targetOccupant.player.name} is not eligible for ${currentPosition}` }, { status: 400 });
                }
                updates.push({ player_id: targetOccupant.player_id, new_position: currentPosition });
                console.log(`[MoveRoster] Action: SWAP performed.`);
            } else {
                // Implicit displacement (Legacy/Fallback)
                if (canSwap) {
                    updates.push({ player_id: targetOccupant.player_id, new_position: currentPosition });
                    console.log(`[MoveRoster] Action: Auto-SWAP performed.`);
                } else {
                    updates.push({ player_id: targetOccupant.player_id, new_position: 'BN' });
                    console.log(`[MoveRoster] Action: Target moved to BN (Incompatible with ${currentPosition}).`);
                }
            }
        }

        // --- 6. Execute Updates ---
        // Apply to >= gameDate
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
