import supabase from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function PATCH(request, { params }) {
  try {
    const cookieStore = cookies();
    const { leagueId } = params;
    const { is_finalized } = await request.json();

    // Get current user
    const userIdCookie = cookieStore.get('user_id');
    if (!userIdCookie) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    const currentUserId = userIdCookie.value;

    // Check if user is Commissioner or Co-Commissioner
    const { data: member, error: memberError } = await supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('manager_id', currentUserId)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: 'You are not a member of this league' },
        { status: 403 }
      );
    }

    if (member.role !== 'Commissioner' && member.role !== 'Co-Commissioner') {
      return NextResponse.json(
        { success: false, error: 'Only Commissioner and Co-Commissioner can update finalized status' },
        { status: 403 }
      );
    }

    // Check if league is in pre-draft status
    const { data: leagueStatusData, error: leagueStatusError } = await supabase
      .from('league_statuses')
      .select('status')
      .eq('league_id', leagueId)
      .single();

    if (leagueStatusError || !leagueStatusData) {
      return NextResponse.json(
        { success: false, error: 'Failed to check league status' },
        { status: 500 }
      );
    }

    if (leagueStatusData.status !== 'pre-draft') {
      return NextResponse.json(
        { success: false, error: 'Finalized status can only be changed during pre-draft phase' },
        { status: 400 }
      );
    }

    if (is_finalized) {
      // Finalize: Check member count and insert record
      const { data: members, error: countError } = await supabase
        .from('league_members')
        .select('manager_id')
        .eq('league_id', leagueId);

      if (countError) {
        return NextResponse.json(
          { success: false, error: 'Failed to check member count' },
          { status: 500 }
        );
      }

      if (members.length % 2 !== 0) {
        return NextResponse.json(
          { success: false, error: `Cannot finalize with odd number of managers. Current: ${members.length}` },
          { status: 400 }
        );
      }

      // Insert record (existence = finalized)
      const { data: statusRecord, error: statusError } = await supabase
        .from('league_finalized_status')
        .insert({
          league_id: leagueId,
          updated_by: currentUserId
        })
        .select()
        .single();

      if (statusError) {
        console.error('Error inserting finalized status:', statusError);
        return NextResponse.json(
          { success: false, error: 'Failed to finalize teams' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: statusRecord,
        message: 'Teams finalized successfully'
      });
    } else {
      // Unlock: Delete the record
      const { error: deleteError } = await supabase
        .from('league_finalized_status')
        .delete()
        .eq('league_id', leagueId);

      if (deleteError) {
        console.error('Error deleting finalized status:', deleteError);
        return NextResponse.json(
          { success: false, error: 'Failed to unlock teams' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Teams unlocked successfully'
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
