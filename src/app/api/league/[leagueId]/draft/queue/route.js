import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request, { params }) {
    const { leagueId } = params;
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('managerId');

    if (!managerId) {
        return NextResponse.json({ success: false, error: 'Manager ID required' }, { status: 400 });
    }

    try {
        const { data: queue, error } = await supabase
            .from('draft_queues')
            .select(`
                queue_id,
                player_id,
                rank_order,
                player:player_list(name, team, position, photo_url)
            `)
            .eq('league_id', leagueId)
            .eq('manager_id', managerId)
            .order('rank_order', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, queue });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    const { leagueId } = params;
    try {
        const body = await request.json();
        const { managerId, playerId } = body;

        // Get max rank
        const { data: maxRankData } = await supabase
            .from('draft_queues')
            .select('rank_order')
            .eq('league_id', leagueId)
            .eq('manager_id', managerId)
            .order('rank_order', { ascending: false })
            .limit(1);

        const nextRank = (maxRankData && maxRankData.length > 0) ? maxRankData[0].rank_order + 1 : 1;

        const { error } = await supabase
            .from('draft_queues')
            .insert({
                league_id: leagueId,
                manager_id: managerId,
                player_id: playerId,
                rank_order: nextRank
            });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const { leagueId } = params;
    try {
        const body = await request.json();
        const { queueId } = body;

        const { error } = await supabase
            .from('draft_queues')
            .delete()
            .eq('queue_id', queueId)
            .eq('league_id', leagueId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
