import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MIN_DRAFT_GAP_MINUTES = 90;
const DRAFT_DURATION_MINUTES = 90; // 預設每個 draft 時長 1.5 小時

function toMillis(timeValue) {
  if (!timeValue) return null;
  const ms = new Date(timeValue).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const proposedDraftTime = url.searchParams.get('proposedTime');
    const excludeLeagueId = url.searchParams.get('excludeLeagueId');

    const { data: leagues, error: leaguesError } = await supabase
      .from('league_settings')
      .select('league_id, league_name, live_draft_time, draft_type, start_scoring_on')
      .eq('draft_type', 'Live Draft');

    if (leaguesError) {
      return NextResponse.json({ error: 'Failed to fetch leagues', details: leaguesError.message }, { status: 500 });
    }

    if (!leagues || leagues.length === 0) {
      return NextResponse.json({
        success: true,
        timeline: [],
        conflicts: [],
        availableSlots: [],
        minGapMinutes: MIN_DRAFT_GAP_MINUTES,
        draftDurationMinutes: DRAFT_DURATION_MINUTES,
      });
    }

    const leagueIds = leagues.map((league) => league.league_id);
    const { data: slots, error: slotsError } = await supabase
      .from('draft_reschedule_slots')
      .select('league_id, queue_number, rescheduled_draft_time')
      .in('league_id', leagueIds);

    if (slotsError) {
      return NextResponse.json({ error: 'Failed to fetch reschedule slots', details: slotsError.message }, { status: 500 });
    }

    const slotMap = {};
    (slots || []).forEach((slot) => {
      slotMap[slot.league_id] = slot;
    });

    // 構建時間線資料
    const fixedLeaguesWithTime = leagues
      .filter(league => {
        const slot = slotMap[league.league_id];
        const effectiveTime = slot?.rescheduled_draft_time || league.live_draft_time;
        return effectiveTime != null;
      })
      .map(league => {
        const slot = slotMap[league.league_id];
        const effectiveTime = slot?.rescheduled_draft_time || league.live_draft_time;
        const draftStartMs = toMillis(effectiveTime);
        return {
          league_id: league.league_id,
          league_name: league.league_name,
          draft_time: effectiveTime,
          draft_start_ms: draftStartMs,
          draft_end_ms: draftStartMs + DRAFT_DURATION_MINUTES * 60 * 1000,
          queue_number: slot?.queue_number ?? null,
        };
      })
      .sort((a, b) => a.draft_start_ms - b.draft_start_ms);

    // 檢查衝突 (改為 2 個以上才算衝突)
    let conflicts = [];
    if (proposedDraftTime) {
      const proposedMs = toMillis(proposedDraftTime);
      if (proposedMs) {
        const foundConflicts = [];
        for (const league of fixedLeaguesWithTime) {
          if (excludeLeagueId && league.league_id === excludeLeagueId) continue;
          
          const gapMs = Math.abs(proposedMs - league.draft_start_ms);
          if (gapMs < MIN_DRAFT_GAP_MINUTES * 60 * 1000) {
            foundConflicts.push({
              league_id: league.league_id,
              league_name: league.league_name,
              minutes_apart: Math.floor(gapMs / 60 / 1000),
            });
          }
        }
        
        // 只有當重疊數 >= 2 才回傳衝突，讓前端顯示紅叉
        if (foundConflicts.length >= 2) {
          conflicts = foundConflicts;
        }
      }
    }

    // 計算可用槽位 (同步 2 盟規則)
    const now = Date.now();
    const availableSlots = [];
    const timelineHours = 48;

    for (let hourOffset = 0; hourOffset <= timelineHours; hourOffset++) {
      const slotTime = new Date(now);
      slotTime.setHours(slotTime.getHours() + hourOffset, 0, 0, 0);
      const slotMs = slotTime.getTime();

      if (slotMs < now) continue;

      const overlappingCount = fixedLeaguesWithTime.filter(league => {
        const gapMs = Math.abs(slotMs - league.draft_start_ms);
        return gapMs < MIN_DRAFT_GAP_MINUTES * 60 * 1000;
      }).length;

      if (overlappingCount < 2) {
        availableSlots.push({
          time: slotTime.toISOString(),
          displayTime: slotTime.toLocaleString('zh-TW'),
          hourOffset,
        });
      }
    }

    // 計算 Line A / Line B (UI 顯示用)
    const timelineA = [];
    const timelineB = [];
    for (const league of fixedLeaguesWithTime) {
      const canAddToA = timelineA.every(existing => {
        const gapMs = Math.abs(league.draft_start_ms - existing.draft_start_ms);
        return gapMs >= MIN_DRAFT_GAP_MINUTES * 60 * 1000;
      });
      if (canAddToA) {
        timelineA.push(league);
      } else {
        timelineB.push(league);
      }
    }

    return NextResponse.json({
      success: true,
      minGapMinutes: MIN_DRAFT_GAP_MINUTES,
      draftDurationMinutes: DRAFT_DURATION_MINUTES,
      timeline: {
        lineA: timelineA,
        lineB: timelineB,
      },
      conflicts,
      availableSlots: availableSlots.slice(0, 15),
      allLeaguesCount: leagues.length,
      scheduledLeaguesCount: fixedLeaguesWithTime.length,
    });
  } catch (error) {
    console.error('Draft timeline GET error:', error);
    return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
}
    return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
}
}
