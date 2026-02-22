import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
    try {
        // Step 1: Get all leagues that are publicly viewable
        const { data: publicLeagues, error: leaguesError } = await supabase
            .from('league_settings')
            .select('league_id, league_name, max_teams, scoring_type, draft_type, playoffs, created_at')
            .eq('make_league_publicly_viewable', 'Yes');

        if (leaguesError) {
            console.error('Error fetching public leagues:', leaguesError);
            return NextResponse.json({ success: false, error: 'Failed to fetch leagues' }, { status: 500 });
        }

        if (!publicLeagues || publicLeagues.length === 0) {
            return NextResponse.json({ success: true, leagues: [] });
        }

        const leagueIds = publicLeagues.map(l => l.league_id);

        // Step 2: Get league statuses - only pre-draft
        const { data: statuses, error: statusError } = await supabase
            .from('league_statuses')
            .select('league_id, status')
            .in('league_id', leagueIds)
            .eq('status', 'pre-draft');

        if (statusError) {
            console.error('Error fetching statuses:', statusError);
            return NextResponse.json({ success: false, error: 'Failed to fetch statuses' }, { status: 500 });
        }

        const preDraftLeagueIds = new Set((statuses || []).map(s => s.league_id));

        // Step 3: Get finalized leagues (to exclude)
        const { data: finalizedLeagues, error: finalizedError } = await supabase
            .from('league_finalized_status')
            .select('league_id')
            .in('league_id', leagueIds);

        if (finalizedError) {
            console.error('Error fetching finalized:', finalizedError);
            // Continue even if error - just don't exclude any
        }

        const finalizedLeagueIds = new Set((finalizedLeagues || []).map(f => f.league_id));

        // Step 4: Get member counts for each league
        const { data: memberCounts, error: memberError } = await supabase
            .from('league_members')
            .select('league_id')
            .in('league_id', leagueIds);

        if (memberError) {
            console.error('Error fetching members:', memberError);
            return NextResponse.json({ success: false, error: 'Failed to fetch members' }, { status: 500 });
        }

        // Count members per league
        const memberCountMap = {};
        (memberCounts || []).forEach(m => {
            memberCountMap[m.league_id] = (memberCountMap[m.league_id] || 0) + 1;
        });

        // Step 5: Filter and build final list
        const eligibleLeagues = publicLeagues.filter(league => {
            // Must be pre-draft
            if (!preDraftLeagueIds.has(league.league_id)) return false;

            // Must NOT be finalized
            if (finalizedLeagueIds.has(league.league_id)) return false;

            // Must NOT be full
            const currentMembers = memberCountMap[league.league_id] || 0;
            if (currentMembers >= league.max_teams) return false;

            return true;
        }).map(league => ({
            ...league,
            current_members: memberCountMap[league.league_id] || 0
        }));

        // Sort by creation date (newest first)
        eligibleLeagues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return NextResponse.json({ success: true, leagues: eligibleLeagues });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 });
    }
}
