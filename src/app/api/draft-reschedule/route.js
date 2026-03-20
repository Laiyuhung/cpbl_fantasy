import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MIN_DRAFT_GAP_MINUTES = 90;
const BATCH_SIZE = 5;

async function getUserIdFromCookie() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  return userId || null;
}

function toMillis(timeValue) {
  if (!timeValue) return null;
  const ms = new Date(timeValue).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function getBatchStartFromPendingQueues(pendingQueues) {
  if (!pendingQueues || pendingQueues.length === 0) return null;
  const minQueue = Math.min(...pendingQueues);
  return Math.floor((minQueue - 1) / BATCH_SIZE) * BATCH_SIZE + 1;
}

async function getOpenWindowFromScheduleTable() {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('draft_reschedule_queue_windows')
    .select('batch_start_queue, batch_end_queue, open_at')
    .lte('open_at', nowIso)
    .order('open_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { openWindow: null, openAt: null, source: 'fallback', error };
  }

  if (!data) {
    return { openWindow: null, openAt: null, source: 'schedule-table', error: null };
  }

  return {
    openWindow: {
      start: data.batch_start_queue,
      end: data.batch_end_queue,
    },
    openAt: data.open_at,
    source: 'schedule-table',
    error: null,
  };
}

async function getQueueWindowsForDisplay() {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('draft_reschedule_queue_windows')
    .select('batch_start_queue, batch_end_queue, open_at')
    .order('open_at', { ascending: true });

  if (error) {
    return { windows: [], error };
  }

  const rows = data || [];
  return {
    windows: rows.map((row) => ({
      ...row,
      is_open: row.open_at <= nowIso,
    })),
    error: null,
  };
}

function buildEffectiveDraftTimeMap(leagues, slots) {
  const map = new Map();
  for (const league of leagues || []) {
    map.set(league.league_id, league.live_draft_time || null);
  }
  for (const slot of slots || []) {
    if (slot.rescheduled_draft_time) {
      map.set(slot.league_id, slot.rescheduled_draft_time);
    }
  }
  return map;
}

function getGapConflicts({ targetLeagueId, targetDraftMs, leagues, effectiveMap }) {
  const conflicts = [];
  for (const league of leagues || []) {
    if (league.league_id === targetLeagueId) continue;
    const otherMs = toMillis(effectiveMap.get(league.league_id));
    if (!otherMs) continue;

    const diffMinutes = Math.abs(targetDraftMs - otherMs) / (1000 * 60);
    if (diffMinutes < MIN_DRAFT_GAP_MINUTES) {
      conflicts.push({
        league_id: league.league_id,
        league_name: league.league_name,
        minutes_apart: Math.floor(diffMinutes),
      });
    }
  }
  return conflicts;
}

export async function GET() {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: leagues, error: leaguesError } = await supabase
      .from('league_settings')
      .select('league_id, league_name, draft_type, live_draft_time')
      .eq('draft_type', 'Live Draft');

    if (leaguesError) {
      return NextResponse.json({ error: leaguesError.message }, { status: 500 });
    }

    const leagueIds = (leagues || []).map((league) => league.league_id);
    if (leagueIds.length === 0) {
      return NextResponse.json({
        success: true,
        batchSize: BATCH_SIZE,
        minGapMinutes: MIN_DRAFT_GAP_MINUTES,
        openWindow: null,
        leagues: [],
      });
    }

    const [{ data: slots, error: slotsError }, { data: members, error: membersError }] = await Promise.all([
      supabase
        .from('draft_reschedule_slots')
        .select('league_id, queue_number, rescheduled_draft_time, updated_at')
        .in('league_id', leagueIds),
      supabase
        .from('league_members')
        .select('league_id, manager_id, role, nickname')
        .in('league_id', leagueIds),
    ]);

    if (slotsError) {
      return NextResponse.json({ error: slotsError.message }, { status: 500 });
    }
    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    const slotMap = {};
    (slots || []).forEach((slot) => {
      slotMap[slot.league_id] = slot;
    });

    const commissionerMap = {};
    const myRoleMap = {};
    (members || []).forEach((member) => {
      if (member.role === 'Commissioner') {
        commissionerMap[member.league_id] = member.nickname || 'Commissioner';
      }
      if (member.manager_id === userId) {
        myRoleMap[member.league_id] = member.role;
      }
    });

    const scheduleWindow = await getOpenWindowFromScheduleTable();
    let openWindow = scheduleWindow.openWindow;
    let openWindowSource = scheduleWindow.source;

    // Fallback to old auto-window logic if schedule table is not available yet.
    if (!openWindow && scheduleWindow.error) {
      const pendingQueues = (slots || [])
        .filter((slot) => slot.queue_number && !slot.rescheduled_draft_time)
        .map((slot) => slot.queue_number);
      const openStart = getBatchStartFromPendingQueues(pendingQueues);
      openWindow = openStart == null ? null : { start: openStart, end: openStart + BATCH_SIZE - 1 };
    }

    const rows = (leagues || [])
      .map((league) => {
        const slot = slotMap[league.league_id] || null;
        const queueNumber = slot?.queue_number ?? null;
        const isCommissioner = myRoleMap[league.league_id] === 'Commissioner';
        // Overdue can still reschedule: if current window is 6-10, then 1-5 can also edit.
        const inOpenWindowOrOverdue =
          openWindow != null &&
          queueNumber != null &&
          queueNumber > 0 &&
          queueNumber <= openWindow.end;

        return {
          league_id: league.league_id,
          league_name: league.league_name,
          commissioner: commissionerMap[league.league_id] || '-',
          queue_number: queueNumber,
          rescheduled_draft_time: slot?.rescheduled_draft_time || null,
          live_draft_time: league.live_draft_time || null,
          effective_draft_time: slot?.rescheduled_draft_time || league.live_draft_time || null,
          is_my_league_commissioner: isCommissioner,
          can_edit: Boolean(isCommissioner && inOpenWindowOrOverdue),
          updated_at: slot?.updated_at || null,
        };
      })
      .sort((a, b) => {
        const qa = a.queue_number;
        const qb = b.queue_number;
        if (qa != null && qb != null && qa !== qb) return qa - qb;
        if (qa != null && qb == null) return -1;
        if (qa == null && qb != null) return 1;

        const ta = toMillis(a.effective_draft_time) || Number.MAX_SAFE_INTEGER;
        const tb = toMillis(b.effective_draft_time) || Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;

        return String(a.league_name || '').localeCompare(String(b.league_name || ''));
      });

    const displayWindows = await getQueueWindowsForDisplay();

    return NextResponse.json({
      success: true,
      batchSize: BATCH_SIZE,
      minGapMinutes: MIN_DRAFT_GAP_MINUTES,
      openWindow,
      openWindowAt: scheduleWindow.openAt || null,
      openWindowSource,
      queueWindows: displayWindows.windows,
      leagues: rows,
    });
  } catch (error) {
    console.error('draft-reschedule GET error:', error);
    return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const leagueId = String(body?.leagueId || '').trim();
    const draftTimeInput = String(body?.draftTime || '').trim();

    if (!leagueId || !draftTimeInput) {
      return NextResponse.json({ error: 'leagueId and draftTime are required' }, { status: 400 });
    }

    const draftDate = new Date(draftTimeInput);
    if (Number.isNaN(draftDate.getTime())) {
      return NextResponse.json({ error: 'Invalid draftTime format' }, { status: 400 });
    }

    const { data: myMember, error: myMemberError } = await supabase
      .from('league_members')
      .select('league_id, role')
      .eq('league_id', leagueId)
      .eq('manager_id', userId)
      .single();

    if (myMemberError || !myMember || myMember.role !== 'Commissioner') {
      return NextResponse.json({ error: 'Only league commissioner can reschedule draft time' }, { status: 403 });
    }

    const { data: leagues, error: leaguesError } = await supabase
      .from('league_settings')
      .select('league_id, league_name, draft_type, live_draft_time')
      .eq('draft_type', 'Live Draft');

    if (leaguesError) {
      return NextResponse.json({ error: leaguesError.message }, { status: 500 });
    }

    const leagueIds = (leagues || []).map((league) => league.league_id);
    const { data: slots, error: slotsError } = await supabase
      .from('draft_reschedule_slots')
      .select('league_id, queue_number, rescheduled_draft_time')
      .in('league_id', leagueIds);

    if (slotsError) {
      return NextResponse.json({ error: slotsError.message }, { status: 500 });
    }

    const mySlot = (slots || []).find((slot) => slot.league_id === leagueId);
    if (!mySlot || !mySlot.queue_number) {
      return NextResponse.json({ error: 'This league has no queue number assigned yet' }, { status: 400 });
    }

    const scheduleWindow = await getOpenWindowFromScheduleTable();
    let openWindow = scheduleWindow.openWindow;

    if (!openWindow && scheduleWindow.error) {
      const pendingQueues = (slots || [])
        .filter((slot) => slot.queue_number && !slot.rescheduled_draft_time)
        .map((slot) => slot.queue_number);
      const openStartFallback = getBatchStartFromPendingQueues(pendingQueues);
      openWindow = openStartFallback == null
        ? null
        : { start: openStartFallback, end: openStartFallback + BATCH_SIZE - 1 };
    }

    const canEditByWindow =
      openWindow != null &&
      mySlot.queue_number > 0 &&
      mySlot.queue_number <= openWindow.end;

    if (!canEditByWindow) {
      return NextResponse.json(
        {
          error: openWindow == null
            ? 'No open reschedule window right now'
            : `Not your turn yet. Current open queue window: ${openWindow.start}-${openWindow.end} (overdue queues are allowed)`,
          openWindow,
        },
        { status: 403 }
      );
    }

    const effectiveMap = buildEffectiveDraftTimeMap(leagues || [], slots || []);
    effectiveMap.set(leagueId, draftDate.toISOString());

    const conflicts = getGapConflicts({
      targetLeagueId: leagueId,
      targetDraftMs: draftDate.getTime(),
      leagues: leagues || [],
      effectiveMap,
    });

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: `Draft time must be at least ${MIN_DRAFT_GAP_MINUTES} minutes apart from other leagues`,
          minGapMinutes: MIN_DRAFT_GAP_MINUTES,
          conflicts,
        },
        { status: 400 }
      );
    }

    const { error: slotUpdateError } = await supabase
      .from('draft_reschedule_slots')
      .update({
        rescheduled_draft_time: draftDate.toISOString(),
        created_by: userId,
      })
      .eq('league_id', leagueId);

    if (slotUpdateError) {
      return NextResponse.json({ error: slotUpdateError.message }, { status: 500 });
    }

    const { error: leagueUpdateError } = await supabase
      .from('league_settings')
      .update({ live_draft_time: draftDate.toISOString() })
      .eq('league_id', leagueId);

    if (leagueUpdateError) {
      return NextResponse.json({ error: leagueUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      league_id: leagueId,
      queue_number: mySlot.queue_number,
      draft_time: draftDate.toISOString(),
      minGapMinutes: MIN_DRAFT_GAP_MINUTES,
      openWindow,
    });
  } catch (error) {
    console.error('draft-reschedule PATCH error:', error);
    return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
}
