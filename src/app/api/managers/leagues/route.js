import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { user_id } = await request.json();

    console.log('=== Fetching leagues for manager ===');
    console.log('Received user_id (manager_id):', user_id);

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // user_id in cookie is actually the manager_id (UUID)
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
      .eq('manager_id', user_id);

    console.log('League members query result:', leagueMembers);
    console.log('League members query error:', membersError);

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

    console.log('Formatted leagues:', leagues);
    console.log('=== End fetching leagues ===');

    return NextResponse.json({ leagues });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
