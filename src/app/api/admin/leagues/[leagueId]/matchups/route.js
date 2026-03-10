import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request, { params }) {
    try {
        const { leagueId } = params;

        // 1. Admin check
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: adminRecord, error: adminError } = await supabase
            .from('admin')
            .select('manager_id')
            .eq('manager_id', userId)
            .single();

        if (adminError || !adminRecord) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Fetch league schedules
        const { data: schedules, error: scheduleError } = await supabase
            .from('league_schedule')
            .select('*')
            .eq('league_id', leagueId)
            .order('week_number', { ascending: true });

        if (scheduleError) {
            return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
        }

        // 3. Fetch league matchups
        const { data: matchups, error: matchupsError } = await supabase
            .from('league_matchups')
            .select('*')
            .eq('league_id', leagueId);

        if (matchupsError) {
            return NextResponse.json({ error: 'Failed to fetch matchups' }, { status: 500 });
        }

        // 4. Fetch member names
        const { data: members, error: membersError } = await supabase
            .from('league_members')
            .select('manager_id, nickname')
            .eq('league_id', leagueId);

        const memberMap = {};
        if (members) {
            members.forEach(m => {
                memberMap[m.manager_id] = m.nickname;
            });
        }

        return NextResponse.json({
            success: true,
            schedules: schedules || [],
            matchups: matchups || [],
            memberMap
        });

    } catch (error) {
        console.error('Admin matchups error:', error);
        return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
    }
}
