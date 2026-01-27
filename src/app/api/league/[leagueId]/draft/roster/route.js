import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request, { params }) {
    const { leagueId } = params;
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('manager_id');

    if (!leagueId || !managerId) {
        return NextResponse.json({ success: false, error: 'Missing league_id or manager_id' }, { status: 400 });
    }

    try {
        const { data, error } = await supabase
            .from('draft_roster_assignments')
            .select(`
                *,
                player:player_list (
                    player_id,
                    name,
                    team,
                    batter_or_pitcher,
                    identity,
                    original_name
                )
            `)
            .eq('league_id', leagueId)
            .eq('manager_id', managerId);

        if (error) {
            console.error('Error fetching draft roster assignments:', error);
            return NextResponse.json({ success: false, error: 'Database Error' }, { status: 500 });
        }

        // Fetch positions for each player
        const { data: batterPositions } = await supabase
            .from('v_batter_positions')
            .select('player_id, position_list');

        const { data: pitcherPositions } = await supabase
            .from('v_pitcher_positions')
            .select('player_id, position_list');

        const positionMap = {};
        if (batterPositions) {
            batterPositions.forEach(bp => {
                positionMap[bp.player_id] = bp.position_list;
            });
        }
        if (pitcherPositions) {
            pitcherPositions.forEach(pp => {
                positionMap[pp.player_id] = pp.position_list;
            });
        }

        const assignments = (data || []).map(item => ({
            ...item,
            name: item.player?.name,
            team: item.player?.team,
            position_list: positionMap[item.player_id] || (item.player?.batter_or_pitcher === 'pitcher' ? 'P' : 'Util'),
            batter_or_pitcher: item.player?.batter_or_pitcher,
            identity: item.player?.identity,
            original_name: item.player?.original_name
        }));

        return NextResponse.json({ success: true, assignments });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    const { leagueId } = params;
    const body = await request.json();
    const { managerId, playerId, rosterSlot } = body;

    if (!leagueId || !managerId || !playerId || !rosterSlot) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    try {
        // Check if player already assigned
        const { data: existing } = await supabase
            .from('draft_roster_assignments')
            .select('assignment_id')
            .eq('league_id', leagueId)
            .eq('manager_id', managerId)
            .eq('player_id', playerId)
            .single();

        if (existing) {
            // Update existing assignment
            const { error } = await supabase
                .from('draft_roster_assignments')
                .update({ roster_slot: rosterSlot, updated_at: new Date().toISOString() })
                .eq('assignment_id', existing.assignment_id);

            if (error) {
                console.error('Error updating assignment:', error);
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
        } else {
            // Create new assignment
            const { error } = await supabase
                .from('draft_roster_assignments')
                .insert({
                    league_id: leagueId,
                    manager_id: managerId,
                    player_id: playerId,
                    roster_slot: rosterSlot
                });

            if (error) {
                console.error('Error creating assignment:', error);
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const { leagueId } = params;
    const body = await request.json();
    const { assignmentId } = body;

    if (!assignmentId) {
        return NextResponse.json({ success: false, error: 'Missing assignment_id' }, { status: 400 });
    }

    try {
        const { error } = await supabase
            .from('draft_roster_assignments')
            .delete()
            .eq('assignment_id', assignmentId);

        if (error) {
            console.error('Error deleting assignment:', error);
            return NextResponse.json({ success: false, error: 'Database Error' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
