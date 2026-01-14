import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;

    if (!leagueId) {
      return NextResponse.json(
        { error: 'League ID is required' },
        { status: 400 }
      );
    }

    // Fetch league settings
    const { data: leagueSettings, error: settingsError } = await supabase
      .from('league_settings')
      .select('*')
      .eq('league_id', leagueId)
      .single();

    if (settingsError) {
      console.error('Supabase settings error:', settingsError);
      return NextResponse.json(
        { error: 'League not found', details: settingsError.message },
        { status: 404 }
      );
    }

    // Fetch league schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('league_schedule')
      .select('*')
      .eq('league_id', leagueId)
      .order('week_number', { ascending: true });

    if (scheduleError) {
      console.error('Supabase schedule error:', scheduleError);
      return NextResponse.json(
        { error: 'Failed to fetch schedule', details: scheduleError.message },
        { status: 500 }
      );
    }

    // Fetch league status
    const { data: statusData, error: statusError } = await supabase
      .from('league_statuses')
      .select('status')
      .eq('league_id', leagueId)
      .single();

    if (statusError) {
      console.error('Supabase status error:', statusError);
    }

    // Fetch league members with manager details and role
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .select(`
        nickname,
        joined_at,
        manager_id,
        role,
        managers (
          name
        )
      `)
      .eq('league_id', leagueId)
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error('Supabase members error:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch members', details: membersError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      league: leagueSettings,
      schedule: schedule || [],
      members: members || [],
      status: statusData?.status || 'unknown',
      maxTeams: leagueSettings?.max_teams || 0,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
