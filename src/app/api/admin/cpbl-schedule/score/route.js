import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function PUT(request) {
    try {
        const body = await request.json();
        const { uuid, away_team_score, home_team_score } = body;

        if (!uuid) {
            return NextResponse.json({ success: false, error: 'Missing uuid' }, { status: 400 });
        }

        const updates = {};
        if (away_team_score !== undefined) {
            updates.away_team_score = away_team_score;
        }
        if (home_team_score !== undefined) {
            updates.home_team_score = home_team_score;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: false, error: 'No scores provided' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('cpbl_schedule_2026')
            .update(updates)
            .eq('uuid', uuid)
            .select();

        if (error) {
            console.error('[CPBL Schedule Score API] Update Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: data[0] });

    } catch (error) {
        console.error('[CPBL Schedule Score API] Server Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
