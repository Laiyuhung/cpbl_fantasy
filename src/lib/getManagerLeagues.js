export async function getManagerLeagues(supabase, userId) {
  const { data: leagueMembers, error: membersError } = await supabase
    .from('league_members')
    .select(`
      league_id,
      nickname,
      role,
      league_settings (
        league_id,
        league_name,
        live_draft_time,
        league_statuses (
          status
        )
      )
    `)
    .eq('manager_id', userId);

  if (membersError) {
    throw new Error(`Failed to fetch leagues: ${membersError.message}`);
  }

  const enrichedLeagues = await Promise.all((leagueMembers || []).map(async (member) => {
    const leagueId = member.league_id;
    const statusData = member.league_settings?.league_statuses;
    const status = (Array.isArray(statusData) ? statusData[0]?.status : statusData?.status) || 'unknown';

    let stats = null;
    let currentMatchup = null;

    const activeStatuses = ['in season', 'post-draft & pre-season', 'playoffs', 'finished'];

    if (activeStatuses.includes(status)) {
      const { data: standing } = await supabase
        .from('v_league_standings')
        .select('rank, wins, losses, ties, win_pct')
        .eq('league_id', leagueId)
        .eq('manager_id', userId)
        .single();

      if (standing) stats = standing;

      const now = new Date();
      const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

      const { data: schedule } = await supabase
        .from('league_schedule')
        .select('week_number, week_start, week_end')
        .eq('league_id', leagueId)
        .order('week_number', { ascending: true });

      let currentWeekNumber = 1;
      if (schedule && schedule.length > 0) {
        const getDateInTaiwan = (dateStr) => new Date(new Date(dateStr).getTime() + (8 * 60 * 60 * 1000));
        const firstWeekStart = getDateInTaiwan(schedule[0].week_start);
        const lastWeekEnd = getDateInTaiwan(schedule[schedule.length - 1].week_end);

        if (taiwanTime < firstWeekStart) {
          currentWeekNumber = 1;
        } else if (taiwanTime > lastWeekEnd) {
          currentWeekNumber = schedule[schedule.length - 1].week_number;
        } else {
          const current = schedule.find((w) => {
            const start = getDateInTaiwan(w.week_start);
            const end = getDateInTaiwan(w.week_end);
            end.setUTCHours(23, 59, 59, 999);
            return taiwanTime >= start && taiwanTime <= end;
          });
          if (current) currentWeekNumber = current.week_number;
        }
      }

      const { data: userMatchups } = await supabase
        .from('league_matchups')
        .select(`
          score_a,
          score_b,
          manager_id_a,
          manager_id_b,
          week_number
        `)
        .eq('league_id', leagueId)
        .or(`manager_id_a.eq.${userId},manager_id_b.eq.${userId}`)
        .order('week_number', { ascending: false });

      let targetMatchupData = null;

      if (userMatchups && userMatchups.length > 0) {
        if (status === 'post-draft & pre-season') {
          targetMatchupData = userMatchups.find((m) => m.week_number === 1);
        } else if (status === 'in season') {
          targetMatchupData = userMatchups.find((m) => m.week_number === currentWeekNumber);
        } else if (status === 'playoffs' || status === 'post-season') {
          targetMatchupData = userMatchups.find((m) => m.week_number === currentWeekNumber);
        } else if (status === 'finished') {
          targetMatchupData = userMatchups[0];
        }

        if (!targetMatchupData) {
          targetMatchupData = userMatchups.reduce((prev, curr) => {
            return Math.abs(curr.week_number - currentWeekNumber) < Math.abs(prev.week_number - currentWeekNumber) ? curr : prev;
          });
        }

        if (!targetMatchupData) {
          targetMatchupData = userMatchups[0];
        }
      }

      if (targetMatchupData) {
        const isManagerA = targetMatchupData.manager_id_a === userId;
        const opponentId = isManagerA ? targetMatchupData.manager_id_b : targetMatchupData.manager_id_a;

        let opponentName = 'Unknown';
        let opponentStats = null;

        if (opponentId) {
          const { data: opponentMember } = await supabase
            .from('league_members')
            .select('nickname')
            .eq('league_id', leagueId)
            .eq('manager_id', opponentId)
            .single();

          if (opponentMember) opponentName = opponentMember.nickname;

          const { data: oppStanding } = await supabase
            .from('v_league_standings')
            .select('rank, wins, losses, ties')
            .eq('league_id', leagueId)
            .eq('manager_id', opponentId)
            .single();

          if (oppStanding) opponentStats = oppStanding;
        } else {
          opponentName = 'Bye';
        }

        const matchupWeekSchedule = schedule?.find((w) => w.week_number === targetMatchupData.week_number);
        const isPastWeek = matchupWeekSchedule
          ? taiwanTime > new Date(new Date(matchupWeekSchedule.week_end).getTime() + (8 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000 - 1))
          : false;

        currentMatchup = {
          myScore: isManagerA ? (targetMatchupData.score_a || 0) : (targetMatchupData.score_b || 0),
          opponentScore: isManagerA ? (targetMatchupData.score_b || 0) : (targetMatchupData.score_a || 0),
          opponentName,
          opponentStats,
          week: targetMatchupData.week_number,
          isPastWeek,
        };
      }
    }

    return {
      league_id: member.league_id,
      league_name: member.league_settings?.league_name || 'Unnamed League',
      nickname: member.nickname,
      role: member.role,
      status,
      draft_time: member.league_settings?.live_draft_time,
      stats,
      matchup: currentMatchup,
    };
  }));

  return enrichedLeagues;
}