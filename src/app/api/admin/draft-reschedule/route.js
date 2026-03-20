import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MIN_DRAFT_GAP_MINUTES = 90;

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: adminRecord, error: adminError } = await supabase
    .from('admin')
    .select('manager_id')
    .eq('manager_id', userId)
    .single();

  if (adminError || !adminRecord) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId };
}

function toMillis(timeValue) {
  if (!timeValue) return null;
  const ms = new Date(timeValue).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function buildEffectiveTimeMap(leagues, slots) {
  const map = new Map();
  for (const league of leagues || []) {
    map.set(league.league_id, league.live_draft_time || null);
  }
  for (const slot of slots || []) {
    map.set(slot.league_id, slot.rescheduled_draft_time || null);
  }
  return map;
}

function getGapConflicts({ nextLeagueId, nextDraftMs, leagues, effectiveTimeMap }) {
  const conflicts = [];

  for (const league of leagues || []) {
    if (league.league_id === nextLeagueId) continue;

    const otherMs = toMillis(effectiveTimeMap.get(league.league_id));
    if (!otherMs) continue;

    const diffMinutes = Math.abs(nextDraftMs - otherMs) / (1000 * 60);
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
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { data: leagues, error: leaguesError } = await supabase
      .from('league_settings')
      .select('league_id, league_name, live_draft_time, draft_type, created_at, max_teams')
      .order('created_at', { ascending: false });

    if (leaguesError) {
      return NextResponse.json({ error: 'Failed to fetch leagues', details: leaguesError.message }, { status: 500 });
    }

    if (!leagues || leagues.length === 0) {
      return NextResponse.json({ success: true, leagues: [], minGapMinutes: MIN_DRAFT_GAP_MINUTES });
    }

    const leagueIds = leagues.map((league) => league.league_id);

    const [{ data: statuses }, { data: finalizedList }, { data: members }, { data: slots }] = await Promise.all([
      supabase.from('league_statuses').select('league_id, status').in('league_id', leagueIds),
      supabase.from('league_finalized_status').select('league_id').in('league_id', leagueIds),
      supabase.from('league_members').select('league_id, nickname, role').in('league_id', leagueIds),
      supabase.from('draft_reschedule_slots').select('league_id, queue_number, rescheduled_draft_time, updated_at').in('league_id', leagueIds),
    ]);

    const statusMap = {};
    (statuses || []).forEach((row) => {
      statusMap[row.league_id] = row.status;
    });

    const finalizedSet = new Set((finalizedList || []).map((row) => row.league_id));

    const memberCountMap = {};
    const commissionerMap = {};
    (members || []).forEach((member) => {
      memberCountMap[member.league_id] = (memberCountMap[member.league_id] || 0) + 1;
      if (member.role === 'Commissioner') {
        commissionerMap[member.league_id] = member.nickname;
      }
    });

    const slotMap = {};
    (slots || []).forEach((slot) => {
      slotMap[slot.league_id] = slot;
    });

    const enrichedLeagues = leagues
      .map((league) => {
        const slot = slotMap[league.league_id] || null;
        return {
          league_id: league.league_id,
          league_name: league.league_name,
          status: statusMap[league.league_id] || 'unknown',
          is_finalized: finalizedSet.has(league.league_id),
          commissioner: commissionerMap[league.league_id] || '-',
          current_members: memberCountMap[league.league_id] || 0,
          max_teams: league.max_teams,
          draft_type: league.draft_type,
          live_draft_time: league.live_draft_time,
          queue_number: slot?.queue_number ?? null,
          rescheduled_draft_time: slot?.rescheduled_draft_time ?? null,
          effective_draft_time: slot?.rescheduled_draft_time || league.live_draft_time || null,
          slot_updated_at: slot?.updated_at ?? null,
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

    return NextResponse.json({
      success: true,
      minGapMinutes: MIN_DRAFT_GAP_MINUTES,
      leagues: enrichedLeagues,
    });
  } catch (error) {
    console.error('Admin draft reschedule GET error:', error);
    return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const leagueId = String(body?.leagueId || '').trim();
    const queueNumber = Number.parseInt(body?.queueNumber, 10);
    const draftTimeInput = String(body?.draftTime || '').trim();

    if (!leagueId || Number.isNaN(queueNumber) || queueNumber <= 0 || !draftTimeInput) {
      return NextResponse.json(
        { error: 'leagueId, queueNumber (positive integer), and draftTime are required' },
        { status: 400 }
      );
    }

    const draftTime = new Date(draftTimeInput);
    if (Number.isNaN(draftTime.getTime())) {
      return NextResponse.json({ error: 'Invalid draftTime format' }, { status: 400 });
    }

    const { data: leagues, error: leaguesError } = await supabase
      .from('league_settings')
      .select('league_id, league_name, live_draft_time')
      .order('created_at', { ascending: false });

    if (leaguesError) {
      return NextResponse.json({ error: 'Failed to fetch league data', details: leaguesError.message }, { status: 500 });
    }

    const targetLeague = (leagues || []).find((league) => league.league_id === leagueId);
    if (!targetLeague) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    const { data: slots, error: slotsError } = await supabase
      .from('draft_reschedule_slots')
      .select('league_id, queue_number, rescheduled_draft_time');

    if (slotsError) {
      return NextResponse.json({ error: 'Failed to fetch reschedule slots', details: slotsError.message }, { status: 500 });
    }

    const duplicateQueue = (slots || []).find(
      (slot) => slot.queue_number === queueNumber && slot.league_id !== leagueId
    );
    if (duplicateQueue) {
      return NextResponse.json(
        {
          error: `Queue number ${queueNumber} is already assigned to another league`,
          conflictLeagueId: duplicateQueue.league_id,
        },
        { status: 409 }
      );
    }

    const effectiveTimeMap = buildEffectiveTimeMap(leagues || [], slots || []);
    const nextDraftMs = draftTime.getTime();
    effectiveTimeMap.set(leagueId, draftTime.toISOString());

    const conflicts = getGapConflicts({
      nextLeagueId: leagueId,
      nextDraftMs,
      leagues: leagues || [],
      effectiveTimeMap,
    });

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: `Draft time must be at least ${MIN_DRAFT_GAP_MINUTES} minutes apart from other leagues`,
          conflicts,
        },
        { status: 400 }
      );
    }

    const { error: upsertError } = await supabase.from('draft_reschedule_slots').upsert(
      {
        league_id: leagueId,
        queue_number: queueNumber,
        rescheduled_draft_time: draftTime.toISOString(),
        created_by: auth.userId,
      },
      { onConflict: 'league_id' }
    );

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to save reschedule slot', details: upsertError.message },
        { status: 500 }
      );
    }

    const { error: updateLeagueError } = await supabase
      .from('league_settings')
      .update({ live_draft_time: draftTime.toISOString() })
      .eq('league_id', leagueId);

    if (updateLeagueError) {
      return NextResponse.json(
        { error: 'Failed to update league draft time', details: updateLeagueError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      league_id: leagueId,
      league_name: targetLeague.league_name,
      queue_number: queueNumber,
      draft_time: draftTime.toISOString(),
      minGapMinutes: MIN_DRAFT_GAP_MINUTES,
    });
  } catch (error) {
    console.error('Admin draft reschedule PATCH error:', error);
    return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
}
