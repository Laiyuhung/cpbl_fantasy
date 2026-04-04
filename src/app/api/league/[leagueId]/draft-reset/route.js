import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MIN_DRAFT_GAP_MINUTES = 90;

async function getLeagueStatus(leagueId) {
    const { data, error } = await supabase
        .from('league_statuses')
        .select('status')
        .eq('league_id', leagueId)
        .single();

    if (error) {
        return { status: null, error };
    }

    return { status: data?.status || null, error: null };
}

// GET: Check if league has a draft reset record
export async function GET(request, { params }) {
    try {
        const { leagueId } = await params;

        const { status, error: statusError } = await getLeagueStatus(leagueId);
        if (statusError) {
            return NextResponse.json({ success: false, error: statusError.message }, { status: 500 });
        }

        if (status !== 'pre-season') {
            return NextResponse.json({
                success: true,
                needsReset: false,
                resetRecord: null,
            });
        }

        const { data, error } = await supabase
            .from('league_draft_reset')
            .select('*')
            .eq('league_id', leagueId)
            .order('reset_at', { ascending: false })
            .limit(1);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            needsReset: data && data.length > 0,
            resetRecord: data?.[0] || null,
        });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST: Update the draft time and remove the reset record
export async function POST(request, { params }) {
    try {
        const { leagueId } = await params;
        const { newDraftTime } = await request.json();

        const { status, error: statusError } = await getLeagueStatus(leagueId);
        if (statusError) {
            return NextResponse.json({ success: false, error: statusError.message }, { status: 500 });
        }

        if (status !== 'pre-season') {
            return NextResponse.json(
                { success: false, error: 'Draft reset is only available when league status is pre-season' },
                { status: 400 }
            );
        }

        if (!newDraftTime) {
            return NextResponse.json({ success: false, error: 'newDraftTime is required' }, { status: 400 });
        }

        // Convert datetime-local (Taiwan time) to ISO UTC
        const [datePart, timePart] = newDraftTime.split('T');
        if (!datePart || !timePart) {
            return NextResponse.json({ success: false, error: 'Invalid datetime format' }, { status: 400 });
        }
        const iso = `${datePart}T${timePart}:00+08:00`;
        const d = new Date(iso);
        if (isNaN(d.getTime())) {
            return NextResponse.json({ success: false, error: 'Invalid datetime' }, { status: 400 });
        }

        // Enforce draft gap rule against all other live-draft leagues.
        const { data: leagues, error: leaguesError } = await supabase
            .from('league_settings')
            .select('league_id, league_name, live_draft_time, draft_type')
            .eq('draft_type', 'Live Draft');

        if (leaguesError) {
            return NextResponse.json({ success: false, error: leaguesError.message }, { status: 500 });
        }

        const leagueIds = (leagues || []).map((league) => league.league_id);
        const { data: slots, error: slotsError } = await supabase
            .from('draft_reschedule_slots')
            .select('league_id, rescheduled_draft_time')
            .in('league_id', leagueIds);

        if (slotsError) {
            return NextResponse.json({ success: false, error: slotsError.message }, { status: 500 });
        }

        const slotMap = {};
        (slots || []).forEach((slot) => {
            slotMap[slot.league_id] = slot;
        });

        const targetMs = d.getTime();
        const conflicts = [];
        for (const league of leagues || []) {
            if (league.league_id === leagueId) continue;
            const effectiveTime = slotMap[league.league_id]?.rescheduled_draft_time || league.live_draft_time;
            if (!effectiveTime) continue;
            const existingMs = new Date(effectiveTime).getTime();
            if (Number.isNaN(existingMs)) continue;

            const gapMs = Math.abs(targetMs - existingMs);
            if (gapMs < MIN_DRAFT_GAP_MINUTES * 60 * 1000) {
                conflicts.push({
                    league_id: league.league_id,
                    league_name: league.league_name,
                    minutes_apart: Math.floor(gapMs / 60 / 1000),
                });
            }
        }

        if (conflicts.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Draft time conflict: at most 2 leagues can draft concurrently, and any additional draft must be at least 90 minutes apart.',
                    minGapMinutes: MIN_DRAFT_GAP_MINUTES,
                    conflicts,
                },
                { status: 400 }
            );
        }

        // Update league_settings with the new draft time
        const { error: updateError } = await supabase
            .from('league_settings')
            .update({ live_draft_time: d.toISOString() })
            .eq('league_id', leagueId);

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        // Delete the reset record(s) for this league
        const { error: deleteError } = await supabase
            .from('league_draft_reset')
            .delete()
            .eq('league_id', leagueId);

        if (deleteError) {
            console.error('Failed to delete draft reset record:', deleteError);
        }

        // Update league status back to pre-draft
        const { error: statusError } = await supabase
            .from('league_statuses')
            .update({ status: 'pre-draft' })
            .eq('league_id', leagueId);

        if (statusError) {
            console.error('Failed to update league status:', statusError);
        }

        return NextResponse.json({
            success: true,
            message: 'Draft time updated successfully',
            newDraftTime: d.toISOString(),
        });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
