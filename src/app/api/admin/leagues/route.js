import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
    try {
        // 1. Admin check
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: adminRecord, error: adminError } = await supabase
            .from('admin')
            .select('manager_id')
            .eq('manager_id', userId)
            .single();

        if (adminError || !adminRecord) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Fetch all league settings
        const { data: leagues, error: leaguesError } = await supabase
            .from('league_settings')
            .select('league_id, league_name, draft_type, scoring_type, max_teams, live_draft_time, start_scoring_on, playoffs, created_at')
            .order('created_at', { ascending: false });

        if (leaguesError) {
            return NextResponse.json({ error: 'Failed to fetch leagues', details: leaguesError.message }, { status: 500 });
        }

        if (!leagues || leagues.length === 0) {
            return NextResponse.json({ success: true, leagues: [] });
        }

        const leagueIds = leagues.map(l => l.league_id);

        // 3. Fetch all statuses
        const { data: statuses } = await supabase
            .from('league_statuses')
            .select('league_id, status')
            .in('league_id', leagueIds);

        const statusMap = {};
        (statuses || []).forEach(s => { statusMap[s.league_id] = s.status; });

        // 4. Fetch all members (with role) in one query
        const { data: allMembers } = await supabase
            .from('league_members')
            .select('league_id, manager_id, nickname, role')
            .in('league_id', leagueIds);

        const memberCountMap = {};
        const commissionerMap = {};
        (allMembers || []).forEach(m => {
            memberCountMap[m.league_id] = (memberCountMap[m.league_id] || 0) + 1;
            if (m.role === 'Commissioner') {
                commissionerMap[m.league_id] = m.nickname;
            }
        });

        // 5. Fetch finalized status
        const { data: finalizedList } = await supabase
            .from('league_finalized_status')
            .select('league_id')
            .in('league_id', leagueIds);

        const finalizedSet = new Set((finalizedList || []).map(f => f.league_id));

        // 6. Fetch schedules to compute current week
        const { data: allSchedules } = await supabase
            .from('league_schedule')
            .select('league_id, week_number, week_start, week_end')
            .in('league_id', leagueIds)
            .order('week_number', { ascending: true });

        // Group schedules by league
        const scheduleMap = {};
        (allSchedules || []).forEach(s => {
            if (!scheduleMap[s.league_id]) scheduleMap[s.league_id] = [];
            scheduleMap[s.league_id].push(s);
        });

        // Current time in Taiwan
        const now = new Date();
        const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

        const getDateInTaiwan = (dateStr) => new Date(new Date(dateStr).getTime() + (8 * 60 * 60 * 1000));

        // 7. Build response
        const enrichedLeagues = leagues.map(league => {
            const schedule = scheduleMap[league.league_id] || [];
            let currentWeek = null;

            if (schedule.length > 0) {
                const firstWeekStart = getDateInTaiwan(schedule[0].week_start);
                const lastWeekEnd = getDateInTaiwan(schedule[schedule.length - 1].week_end);

                if (taiwanTime < firstWeekStart) {
                    currentWeek = 0; // before season
                } else if (taiwanTime > lastWeekEnd) {
                    currentWeek = schedule[schedule.length - 1].week_number;
                } else {
                    const current = schedule.find(w => {
                        const start = getDateInTaiwan(w.week_start);
                        const end = getDateInTaiwan(w.week_end);
                        end.setUTCHours(23, 59, 59, 999);
                        return taiwanTime >= start && taiwanTime <= end;
                    });
                    currentWeek = current ? current.week_number : null;
                }
            }

            return {
                league_id: league.league_id,
                league_name: league.league_name,
                status: statusMap[league.league_id] || 'unknown',
                draft_type: league.draft_type,
                scoring_type: league.scoring_type,
                max_teams: league.max_teams,
                current_members: memberCountMap[league.league_id] || 0,
                commissioner: commissionerMap[league.league_id] || '-',
                live_draft_time: league.live_draft_time,
                start_scoring_on: league.start_scoring_on,
                playoffs: league.playoffs,
                is_finalized: finalizedSet.has(league.league_id),
                created_at: league.created_at,
                current_week: currentWeek,
            };
        });

        return NextResponse.json({ success: true, leagues: enrichedLeagues });
    } catch (error) {
        console.error('Admin leagues error:', error);
        return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
    }
}
