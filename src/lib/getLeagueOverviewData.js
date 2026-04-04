export async function getLeagueOverviewData(supabase, leagueId) {
  if (!leagueId) {
    throw new Error('League ID is required');
  }

  const { data: leagueSettings, error: settingsError } = await supabase
    .from('league_settings')
    .select('*')
    .eq('league_id', leagueId)
    .single();

  if (settingsError) {
    const error = new Error(settingsError.message || 'League not found');
    error.statusCode = 404;
    throw error;
  }

  const [scheduleRes, statusRes, membersRes, finalizedRes] = await Promise.all([
    supabase
      .from('league_schedule')
      .select(`
        id,
        league_id,
        week_number,
        week_type,
        week_start,
        week_end,
        week_label
      `)
      .eq('league_id', leagueId)
      .order('week_number', { ascending: true }),
    supabase
      .from('league_statuses')
      .select('status')
      .eq('league_id', leagueId)
      .maybeSingle(),
    supabase
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
      .order('joined_at', { ascending: true }),
    supabase
      .from('league_finalized_status')
      .select('league_id')
      .eq('league_id', leagueId)
      .maybeSingle(),
  ]);

  const { data: schedule, error: scheduleError } = scheduleRes;
  if (scheduleError) {
    console.error('Supabase schedule error:', scheduleError);
  }

  const { data: statusData, error: statusError } = statusRes;
  if (statusError) {
    console.error('Supabase status error:', statusError);
  }

  const { data: members, error: membersError } = membersRes;
  if (membersError) {
    const error = new Error(membersError.message || 'Failed to fetch members');
    error.statusCode = 500;
    throw error;
  }

  const { data: finalizedStatus, error: finalizedError } = finalizedRes;
  const isFinalized = !finalizedError && finalizedStatus != null;

  return {
    success: true,
    league: {
      ...leagueSettings,
      is_finalized: isFinalized,
    },
    schedule: schedule || [],
    members: members || [],
    status: statusData?.status || 'unknown',
    maxTeams: leagueSettings?.max_teams || 0,
    invitePermissions: leagueSettings?.invite_permissions || 'commissioner only',
  };
}
