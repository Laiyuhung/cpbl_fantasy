import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request, { params }) {
    const { leagueId } = params;

    try {
        // 1. Get League Settings & Members
        const { data: members, error: membersError } = await supabase
            .from('league_members')
            .select('manager_id, nickname')
            .eq('league_id', leagueId)
            // Ideally sorted by specific draft order or random. 
            // For now, let's sort by joined_at or random.
            // Let's assume random shuffle logic or existing order later.
            // Here we just take them as is (sort by joined_at usually default)
            .order('joined_at', { ascending: true });

        if (membersError || !members || members.length === 0) {
            return NextResponse.json({ success: false, error: 'No members found' }, { status: 400 });
        }

        const { data: settings } = await supabase
            .from('league_settings')
            .select('roster_positions')
            .eq('league_id', leagueId)
            .single();

        if (!settings) {
            return NextResponse.json({ success: false, error: 'Settings not found' }, { status: 400 });
        }

        // 2. Calculate Total Rounds
        // Sum of all roster limits (C:1, 1B:1 ... BN:5, Minor:2)
        const rosterConfig = settings.roster_positions || {};
        const totalRounds = Object.values(rosterConfig).reduce((sum, count) => sum + (parseInt(count) || 0), 0);

        // 3. Generate Picks (Snake Draft)
        const picks = [];
        const teamCount = members.length;
        let globalPickCount = 1;

        for (let round = 1; round <= totalRounds; round++) {
            // Odd rounds: 1 -> N
            // Even rounds: N -> 1 (Snake)
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

        // 4. Transaction: Clear old picks -> Insert new -> Update Status
        // A. Delete old
        await supabase.from('draft_picks').delete().eq('league_id', leagueId);

        // B. Insert new
        const { error: insertError } = await supabase
            .from('draft_picks')
            .insert(picks);

        if (insertError) throw insertError;

        // C. Update League Status to 'in_draft'
        // And set the FIRST pick's deadline to (Now + 2 mins buffer for start)?
        // Or let the first user polling trigger the start. 
        // Let's set status to 'in_draft'. 
        await supabase.from('league_statuses').update({ status: 'in_draft' }).eq('league_id', leagueId);

        // Also, initialize the first pick's deadline?
        // We can do it lazily or now. Let's do it now.
        // Query the first pick
        const startTimeResult = new Date();
        startTimeResult.setSeconds(startTimeResult.getSeconds() + 10); // Start in 10 secs

        // Update first pick deadline = Start + 60s (Live Draft Pick Time)
        // We need to fetch the pick_time from settings. Assuming 60s for now or fetch it.
        // For simplicity, default to 60s. API should fetch it properly.

        // Actually, let's just leave deadline NULL. 
        // The GET /state endpoint will detect "Current pick has no deadline? Set it to Now + 60s".
        // This handles the "Start Draft" button press smoothly.

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
