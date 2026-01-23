import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseServer';

// POST /api/waiver_claims
export async function POST(request) {
  try {
    const body = await request.json();
    const { league_id, manager_id, player_id, drop_player_id } = body;
    if (!league_id || !manager_id || !player_id) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 寫入 waiver_claims
    const { data, error } = await supabase
      .from('waiver_claims')
      .insert([
        {
          league_id,
          manager_id,
          player_id,
          drop_player_id: drop_player_id || null,
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: data[0] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
