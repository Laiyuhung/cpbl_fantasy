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

      // Only fetch stats and matchups if the league is active (in season or playoffs)
      if (status === 'in season' || status === 'post-draft & pre-season' || status === 'playoffs') {
        // Fetch User's Standing
        const { data: standing } = await supabase
          .from('v_league_standings')
          .select('rank, win, loss, tie')
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

        // Fetch Current Matchup
        const { data: matchup } = await supabase
          .from('matchups')
          .select(`
                score_a,
                score_b,
                manager_id_a,
                manager_id_b
            `)
          .eq('league_id', leagueId)
          .eq('week_number', currentWeekNumber)
          .or(`manager_id_a.eq.${user_id},manager_id_b.eq.${user_id}`)
          .single();

        if (matchup) {
          // Identify opponent
          const isManagerA = matchup.manager_id_a === user_id;
          const opponentId = isManagerA ? matchup.manager_id_b : matchup.manager_id_a;

          // Get opponent nickname
          const { data: opponentMember } = await supabase
            .from('league_members')
            .select('nickname')
            .eq('league_id', leagueId)
            .eq('manager_id', opponentId)
            .single();

          currentMatchup = {
            myScore: isManagerA ? (matchup.score_a || 0) : (matchup.score_b || 0),
            opponentScore: isManagerA ? (matchup.score_b || 0) : (matchup.score_a || 0),
            opponentName: opponentMember?.nickname || 'Unknown',
            week: currentWeekNumber
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
        season_year: 2025, // Hardcoded as it's not in DB
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
