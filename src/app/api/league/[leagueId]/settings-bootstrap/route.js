import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function toCategoryWeights(rows = []) {
  const weights = { batter: {}, pitcher: {} };
  rows.forEach((row) => {
    if (!row?.category_type || !row?.category_name) return;
    if (!weights[row.category_type]) return;
    weights[row.category_type][row.category_name] = parseFloat(row.weight);
  });
  return weights;
}

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const [memberRes, settingsRes, statusRes] = await Promise.all([
      supabase
        .from('league_members')
        .select('role')
        .eq('league_id', leagueId)
        .eq('manager_id', userId)
        .maybeSingle(),
      supabase
        .from('league_settings')
        .select('*')
        .eq('league_id', leagueId)
        .single(),
      supabase
        .from('league_statuses')
        .select('status')
        .eq('league_id', leagueId)
        .maybeSingle(),
    ]);

    if (memberRes.error) {
      return NextResponse.json({ success: false, error: memberRes.error.message }, { status: 500 });
    }

    if (!memberRes.data) {
      return NextResponse.json({ success: false, error: 'You are not a member of this league' }, { status: 403 });
    }

    const currentUserRole = memberRes.data.role;
    const isAuthorized = currentUserRole === 'Commissioner' || currentUserRole === 'Co-Commissioner';

    if (!isAuthorized) {
      return NextResponse.json({
        success: false,
        currentUserRole,
        isAuthorized: false,
        error: 'Access denied. Only Commissioner or Co-Commissioner can edit league settings.',
      }, { status: 403 });
    }

    if (settingsRes.error || !settingsRes.data) {
      return NextResponse.json({ success: false, error: settingsRes.error?.message || 'Failed to load league settings' }, { status: 404 });
    }

    const [scheduleRes, draftPicksRes] = await Promise.all([
      supabase
        .from('schedule_date')
        .select('*')
        .order('week_id', { ascending: true }),
      supabase
        .from('draft_picks')
        .select('pick_number, manager_id, player_id, round_number')
        .eq('league_id', leagueId)
        .order('round_number', { ascending: true })
        .order('pick_number', { ascending: true }),
    ]);

    if (scheduleRes.error) {
      return NextResponse.json({ success: false, error: scheduleRes.error.message }, { status: 500 });
    }

    if (draftPicksRes.error) {
      return NextResponse.json({ success: false, error: draftPicksRes.error.message }, { status: 500 });
    }

    let categoryWeights = { batter: {}, pitcher: {} };
    if (settingsRes.data.scoring_type === 'Head-to-Head Fantasy Points') {
      const weightsRes = await supabase
        .from('league_stat_category_weights')
        .select('category_type, category_name, weight')
        .eq('league_id', leagueId)
        .order('category_type', { ascending: true })
        .order('category_name', { ascending: true });

      if (weightsRes.error) {
        return NextResponse.json({ success: false, error: weightsRes.error.message }, { status: 500 });
      }

      categoryWeights = toCategoryWeights(weightsRes.data || []);
    }

    const draftPicks = draftPicksRes.data || [];
    const hasDraftOrder = draftPicks.some((pick) => pick.player_id != null);

    const draftOrder = [];
    if (draftPicks.length > 0) {
      const managerIds = [...new Set(draftPicks.map((pick) => pick.manager_id).filter(Boolean))];
      const membersRes = managerIds.length > 0
        ? await supabase
          .from('league_members')
          .select('manager_id, nickname')
          .eq('league_id', leagueId)
          .in('manager_id', managerIds)
        : { data: [], error: null };

      if (membersRes.error) {
        return NextResponse.json({ success: false, error: membersRes.error.message }, { status: 500 });
      }

      const nicknameMap = {};
      (membersRes.data || []).forEach((member) => {
        nicknameMap[member.manager_id] = member.nickname;
      });

      const seenManagers = new Set();
      draftPicks.forEach((pick) => {
        if (!pick.manager_id || seenManagers.has(pick.manager_id)) return;
        seenManagers.add(pick.manager_id);
        draftOrder.push({
          manager_id: pick.manager_id,
          nickname: nicknameMap[pick.manager_id] || 'Unknown Manager',
        });
      });
    }

    return NextResponse.json({
      success: true,
      apiIntegrationBeta: true,
      isAuthorized: true,
      currentUserRole,
      status: statusRes.data?.status || '',
      settings: settingsRes.data,
      categoryWeights,
      scheduleData: scheduleRes.data || [],
      hasDraftOrder,
      draftOrder,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
