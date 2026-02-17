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

    // 1. Get all leagues where this manager is a member
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
      .eq('manager_id', user_id);

    if (membersError) {
      console.error('Error fetching leagues:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch leagues', details: membersError.message },
        { status: 500 }
      );
    }

    // 2. Fetch additional data for each league (Standings & Matchups)
    const enrichedLeagues = await Promise.all(leagueMembers.map(async (member) => {
      const leagueId = member.league_id;
      // Handle array or object return from Supabase relations
      const statusData = member.league_settings?.league_statuses;
      // It might be an array or object depending on Supabase detection, verify typically array if 1:many or object if 1:1 detected
      // Safest to handle both or access property safely
      const status = (Array.isArray(statusData) ? statusData[0]?.status : statusData?.status) || 'unknown';

      let stats = null;
      let currentMatchup = null;

      const activeStatuses = ['in season', 'post-draft & pre-season', 'playoffs', 'finished'];

      if (activeStatuses.includes(status)) {
        // Fetch User's Standing
        const { data: standing } = await supabase
          .from('v_league_standings')
          .select('rank, wins, losses, ties, win_pct')
          .eq('league_id', leagueId)
          .eq('manager_id', user_id)
          .single();

        if (standing) {
          stats = standing;
        }

        // Determine Current Week based on Taiwan Time
        const now = new Date();
        const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

        const { data: schedule } = await supabase
          .from('league_schedule')
          .select('week_number, week_start, week_end')
          .eq('league_id', leagueId)
          .order('week_number', { ascending: true });

        // Logic to find current week (similar to League Page)
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
            const current = schedule.find(w => {
              const start = getDateInTaiwan(w.week_start);
              const end = getDateInTaiwan(w.week_end);
              end.setUTCHours(23, 59, 59, 999);
              return taiwanTime >= start && taiwanTime <= end;
            });
            if (current) currentWeekNumber = current.week_number;
          }
        }

        // Fetch ALL matchups for this user to decide which one to show
        const { data: userMatchups } = await supabase
          .from('league_matchups')
          .select(`
                score_a,
                score_b,
                manager_id_a,
                manager_id_b,
                winner_manager_id,
                is_tie,
                week_number
            `)
          .eq('league_id', leagueId)
          .or(`manager_id_a.eq.${user_id},manager_id_b.eq.${user_id}`)
          .order('week_number', { ascending: false }); // Latest first

        let targetMatchupData = null;

        if (userMatchups && userMatchups.length > 0) {
          if (status === 'post-draft & pre-season') {
            // Try Week 1
            targetMatchupData = userMatchups.find(m => m.week_number === 1);
          } else if (status === 'in season') {
            // Try Current Week
            targetMatchupData = userMatchups.find(m => m.week_number === currentWeekNumber);
          } else if (status === 'playoffs' || status === 'post-season') {
            // Try Current Week
            targetMatchupData = userMatchups.find(m => m.week_number === currentWeekNumber);
          } else if (status === 'finished') {
            // Show Latest (Last played) - userMatchups is ordered desc
            targetMatchupData = userMatchups[0];
          }

          // FALLBACK: If specific logic returned nothing (e.g. bye week, or currentWeek mismatch),
          // find the matchup closest to currentWeekNumber
          if (!targetMatchupData) {
            targetMatchupData = userMatchups.reduce((prev, curr) => {
              return (Math.abs(curr.week_number - currentWeekNumber) < Math.abs(prev.week_number - currentWeekNumber) ? curr : prev);
            });
          }

          // If still nothing (shouldn't happen if length > 0), default to latest
          if (!targetMatchupData) {
            targetMatchupData = userMatchups[0];
          }
        }

        if (targetMatchupData) {
          // Identify opponent
          const isManagerA = targetMatchupData.manager_id_a === user_id;
          const opponentId = isManagerA ? targetMatchupData.manager_id_b : targetMatchupData.manager_id_a;

          // Get opponent nickname
          let opponentName = 'Unknown';
          if (opponentId) {
            const { data: opponentMember } = await supabase
              .from('league_members')
              .select('nickname')
              .eq('league_id', leagueId)
              .eq('manager_id', opponentId)
              .single();
            if (opponentMember) opponentName = opponentMember.nickname;
          } else {
            opponentName = 'Bye';
          }

          currentMatchup = {
            myScore: isManagerA ? (targetMatchupData.score_a || 0) : (targetMatchupData.score_b || 0),
            opponentScore: isManagerA ? (targetMatchupData.score_b || 0) : (targetMatchupData.score_a || 0),
            opponentName: opponentName,
            week: targetMatchupData.week_number
          };
        }
      }

      return {
        league_id: member.league_id,
        league_name: member.league_settings?.league_name || 'Unnamed League',
        nickname: member.nickname,
        role: member.role,
        status: status,
        draft_time: member.league_settings?.live_draft_time,
        stats: stats,
        matchup: currentMatchup
      };
    }));

    return NextResponse.json({ leagues: enrichedLeagues });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
