import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get manager_id from user_id
    const { data: manager, error: managerError } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (managerError || !manager) {
      return NextResponse.json({ leagues: [] });
    }

    // Get all leagues where this manager is a member
    const { data: leagueMembers, error: membersError } = await supabase
      .from('league_members')
      .select(`
        league_id,
        nickname,
        league_settings (
          league_id,
          league_name
        )
      `)
      .eq('manager_id', manager.id);

    if (membersError) {
      console.error('Error fetching leagues:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch leagues', details: membersError.message },
        { status: 500 }
      );
    }

    // Format the response
    const leagues = leagueMembers?.map(member => ({
      league_id: member.league_id,
      league_name: member.league_settings?.league_name || 'Unnamed League',
      nickname: member.nickname
    })) || [];

    return NextResponse.json({ leagues });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
