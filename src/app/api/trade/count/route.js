import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const league_id = searchParams.get('league_id');
        const manager_id = searchParams.get('manager_id');

        if (!league_id || !manager_id) {
            return NextResponse.json({ success: false, error: 'Missing league_id or manager_id' }, { status: 400 });
        }

        // Count pending trades where user is initiator OR recipient
        const { count, error } = await supabase
            .from('pending_trade')
            .select('*', { count: 'exact', head: true })
            .eq('league_id', league_id)
            .in('status', ['pending', 'accepted'])
            .or(`initiator_manager_id.eq.${manager_id},recipient_manager_id.eq.${manager_id}`);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: count || 0 });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
