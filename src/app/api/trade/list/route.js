import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');
    const manager_id = searchParams.get('manager_id');

    if (!league_id || !manager_id) {
        return NextResponse.json({ success: false, error: 'Missing league_id or manager_id' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        // Fetch trades where the user is initiator or recipient
        // And status is pending or accepted
        const { data: trades, error } = await supabase
            .from('trades')
            .select('id, status, initiator_manager_id, recipient_manager_id, initiator_players, recipient_players')
            .eq('league_id', league_id)
            .or(`initiator_manager_id.eq.${manager_id},recipient_manager_id.eq.${manager_id}`)
            .in('status', ['pending', 'accepted']);

        if (error) throw error;

        return NextResponse.json({ success: true, trades });
    } catch (error) {
        console.error('Error fetching trade list:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
