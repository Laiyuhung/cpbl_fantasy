import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// POST: 建立 pending trade
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      league_id,
      initiator_manager_id,
      recipient_manager_id,
      initiator_player_ids,
      recipient_player_ids
    } = body;

    if (!league_id || !initiator_manager_id || !recipient_manager_id) {
      return NextResponse.json({ success: false, error: '缺少必要欄位' }, { status: 400 });
    }
    if (!Array.isArray(initiator_player_ids) || !Array.isArray(recipient_player_ids)) {
      return NextResponse.json({ success: false, error: '球員ID格式錯誤' }, { status: 400 });
    }

    // 寫入 pending_trade 表
    const { error } = await supabase.from('pending_trade').insert([
      {
        league_id,
        status: 'pending',
        initiator_manager_id,
        recipient_manager_id,
        initiator_player_ids,
        recipient_player_ids
      }
    ]);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
