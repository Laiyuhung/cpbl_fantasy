import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// DELETE: Remove a member from the league
export async function DELETE(request, { params }) {
  try {
    const { leagueId } = params;
    const body = await request.json();
    const { manager_id } = body;

    if (!leagueId || !manager_id) {
      return NextResponse.json(
        { success: false, error: 'League ID and Manager ID are required' },
        { status: 400 }
      );
    }

    // Check if the member is the Commissioner
    const { data: member, error: memberError } = await supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('manager_id', manager_id)
      .single();

    if (memberError) {
      console.error('Error fetching member:', memberError);
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    // Prevent Commissioner from leaving (they should delete the entire league instead)
    if (member.role === 'Commissioner') {
      return NextResponse.json(
        { success: false, error: 'Commissioner cannot leave the league. Please delete the entire league instead.' },
        { status: 403 }
      );
    }

    // Delete the member
    const { error: deleteError } = await supabase
      .from('league_members')
      .delete()
      .eq('league_id', leagueId)
      .eq('manager_id', manager_id);

    if (deleteError) {
      console.error('Error deleting member:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to remove member from league', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully left the league'
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH: Update member's nickname
export async function PATCH(request, { params }) {
  try {
    const { leagueId } = params;
    const body = await request.json();
    const { manager_id, nickname } = body;

    if (!leagueId || !manager_id) {
      return NextResponse.json(
        { success: false, error: 'League ID and Manager ID are required' },
        { status: 400 }
      );
    }

    if (!nickname || nickname.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Nickname cannot be empty' },
        { status: 400 }
      );
    }

    if (nickname.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Nickname cannot exceed 50 characters' },
        { status: 400 }
      );
    }

    // Check if the member exists in the league
    const { data: member, error: memberError } = await supabase
      .from('league_members')
      .select('nickname')
      .eq('league_id', leagueId)
      .eq('manager_id', manager_id)
      .single();

    if (memberError || !member) {
      console.error('Error fetching member:', memberError);
      return NextResponse.json(
        { success: false, error: 'Member not found in this league' },
        { status: 404 }
      );
    }

    // Update the nickname
    const { error: updateError } = await supabase
      .from('league_members')
      .update({ nickname: nickname.trim() })
      .eq('league_id', leagueId)
      .eq('manager_id', manager_id);

    if (updateError) {
      console.error('Error updating nickname:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update nickname', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Nickname updated successfully',
      nickname: nickname.trim()
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
