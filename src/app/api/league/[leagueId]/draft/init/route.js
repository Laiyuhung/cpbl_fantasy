import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request, { params }) {
    const { leagueId } = params;

    try {
        const body = await request.json().catch(() => ({})); // Handle empty body
        const { managerId } = body;

        // 0. Verify Commissioner Role
        if (managerId) {
            const { data: member } = await supabase
                .from('league_members')
                .select('role')
                .eq('league_id', leagueId)
                .eq('manager_id', managerId)
                .single();

            if (member?.role !== 'Commissioner' && member?.role !== 'Co-Commissioner') {
                return NextResponse.json({ success: false, error: 'Only Commissioner can initialize draft' }, { status: 403 });
            }
        }
        // Note: If no managerId provided, we assume it's an internal call or fail? 
        // User requested "Only admin can execute". So requiring managerId is safer.
        else {
            return NextResponse.json({ success: false, error: 'Manager ID required' }, { status: 400 });
        }

        // 0.3 Check if draft already generated
        const { count: pickCount } = await supabase
            .from('draft_picks')
            .select('*', { count: 'exact', head: true })
            .eq('league_id', leagueId);

        if (pickCount > 0) {
            return NextResponse.json({
                success: false,
                error: 'Draft order already generated',
                code: 'DRAFT_EXISTS'
            }, { status: 400 });
        }

        // 0.5. Check if league is finalized (exists in league_finalized_status table)
        const { data: finalizedStatus } = await supabase
            .from('league_finalized_status')
            .select('id')
            .eq('league_id', leagueId)
            .single();

        if (!finalizedStatus) {
            return NextResponse.json({
                success: false,
                error: 'League must be finalized before generating draft order'
            }, { status: 400 });
        }

        // 1. Get League Settings & Members (Sort by random or custom order in future)
        const { data: members, error: membersError } = await supabase
            .from('league_members')
            .select('manager_id, nickname')
            .eq('league_id', leagueId)
            // Ideally use `draft_order` column if exists, otherwise random/joined_at
            .order('joined_at', { ascending: true });

        if (membersError || !members || members.length === 0) {
            return NextResponse.json({ success: false, error: 'No members found' }, { status: 400 });
        }

        const { data: settings } = await supabase
            .from('league_settings')
            .select('roster_positions, live_draft_time, live_draft_pick_time')
            .eq('league_id', leagueId)
            .single();

        if (!settings) {
            return NextResponse.json({ success: false, error: 'Settings not found' }, { status: 400 });
        }

        // 2. Calculate Total Rounds (exclude Minor positions)
        const rosterConfig = settings.roster_positions || {};
        const totalRounds = Object.entries(rosterConfig)
            .filter(([position]) => !position.includes('Minor'))  // Exclude Minor positions
            .reduce((sum, [, count]) => sum + (parseInt(count) || 0), 0);

        // 3. Generate Picks (Snake Draft)
        const picks = [];
        const teamCount = members.length;
        let globalPickCount = 1;

        for (let round = 1; round <= totalRounds; round++) {
            const isEven = round % 2 === 0;
            const roundPicks = [];
            for (let i = 0; i < teamCount; i++) {
                const teamIndex = isEven ? (teamCount - 1 - i) : i;
                const manager = members[teamIndex];

                roundPicks.push({
                    league_id: leagueId,
                    round_number: round,
                    pick_number: globalPickCount,
                    manager_id: manager.manager_id,
                    is_auto_picked: false
                });
                globalPickCount++;
            }
            picks.push(...roundPicks);
        }

        // 4. Transaction: Clear old picks -> Insert new
        await supabase.from('draft_picks').delete().eq('league_id', leagueId);

        const { error: insertError } = await supabase
            .from('draft_picks')
            .insert(picks);

        if (insertError) throw insertError;

        // Ensure status is 'pre-draft' (waiting for time)
        await supabase.from('league_statuses').update({ status: 'pre-draft' }).eq('league_id', leagueId);

        // Set deadline for pick 1 if live_draft_time is configured
        if (settings.live_draft_time && settings.live_draft_pick_time) {
            // Parse live_draft_pick_time (e.g., "1 Minute", "30 Seconds")
            const pickTimeStr = settings.live_draft_pick_time.toLowerCase();
            let durationSeconds = 60; // Default 1 minute

            if (pickTimeStr.includes('second')) {
                durationSeconds = parseInt(pickTimeStr) || 30;
            } else if (pickTimeStr.includes('minute')) {
                durationSeconds = (parseInt(pickTimeStr) || 1) * 60;
            }

            // Calculate deadline = live_draft_time + pick_time
            const startTime = new Date(settings.live_draft_time);
            const deadline = new Date(startTime.getTime() + durationSeconds * 1000);

            await supabase
                .from('draft_picks')
                .update({ deadline: deadline.toISOString() })
                .eq('league_id', leagueId)
                .eq('pick_number', 1);

            console.log(`[Draft Init] Set pick 1 deadline to ${deadline.toISOString()} (start: ${settings.live_draft_time} + ${durationSeconds}s)`);
        }

        return NextResponse.json({
            success: true,
            message: `Draft initialized with ${totalRounds} rounds for ${teamCount} teams.`,
            total_picks: picks.length
        });

    } catch (error) {
        console.error('Draft Init Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
