import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// PATCH: Update member's role
export async function PATCH(request, { params }) {
  try {
    const { leagueId } = params;
    const body = await request.json();
    const { manager_id, role } = body;

    // Get current user from cookies
    const cookieStore = cookies();
    const currentUserId = cookieStore.get('user_id')?.value;

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    if (!leagueId || !manager_id) {
      return NextResponse.json(
        { success: false, error: 'League ID and Manager ID are required' },
        { status: 400 }
      );
    }

    if (!role || !['Member', 'Co-Commissioner', 'Commissioner'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be Member, Co-Commissioner, or Commissioner' },
        { status: 400 }
      );
    }

    // Check if the current user is Commissioner or Co-Commissioner
    const { data: currentMember, error: currentMemberError } = await supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('manager_id', currentUserId)
      .single();

    if (currentMemberError || !currentMember) {
      console.error('Error fetching current member:', currentMemberError);
      return NextResponse.json(
        { success: false, error: 'You are not a member of this league' },
        { status: 403 }
      );
    }

    // Only Commissioner and Co-Commissioner can update roles
    if (currentMember.role !== 'Commissioner' && currentMember.role !== 'Co-Commissioner') {
      return NextResponse.json(
        { success: false, error: 'Only Commissioner and Co-Commissioner can manage permissions' },
        { status: 403 }
      );
    }

    // Check if the target member exists in the league
    const { data: targetMember, error: targetMemberError } = await supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('manager_id', manager_id)
      .single();

    if (targetMemberError || !targetMember) {
      console.error('Error fetching target member:', targetMemberError);
      return NextResponse.json(
        { success: false, error: 'Target member not found in this league' },
        { status: 404 }
      );
    }

    // Prevent changing the Commissioner's role
    if (targetMember.role === 'Commissioner') {
      return NextResponse.json(
        { success: false, error: 'Cannot change the Commissioner\'s role' },
        { status: 403 }
      );
    }

    // Prevent setting role to Commissioner (only one Commissioner per league)
    if (role === 'Commissioner') {
      return NextResponse.json(
        { success: false, error: 'Cannot assign Commissioner role. Each league can only have one Commissioner.' },
        { status: 403 }
      );
    }

    // Update the role
    const { error: updateError } = await supabase
      .from('league_members')
      .update({ role: role })
      .eq('league_id', leagueId)
      .eq('manager_id', manager_id);

    if (updateError) {
      console.error('Error updating role:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update role', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Role updated successfully',
      role: role
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
