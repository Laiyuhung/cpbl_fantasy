import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseServer';

// POST /api/waiver_claims
export async function POST(request) {
  try {
    const body = await request.json();
    const { league_id, manager_id, player_id, drop_player_id, off_waiver } = body;
    if (!league_id || !manager_id || !player_id) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 取得目前該 manager 在該 off_waiver 日期的最大 priority
    // 如果 off_waiver 為 null (照理說 waiver claims 應該都有 off_waiver)，則只看 null? 
    // 假設前端傳來的 off_waiver 格式正確

    let query = supabase
      .from('waiver_claims')
      .select('personal_priority')
      .eq('league_id', league_id)
      .eq('manager_id', manager_id);

    if (off_waiver) {
      query = query.eq('off_waiver', off_waiver);
    } else {
      query = query.is('off_waiver', null);
    }

    const { data: existingClaims, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }

    let nextPriority = 1;
    if (existingClaims && existingClaims.length > 0) {
      const maxPriority = Math.max(...existingClaims.map(c => c.personal_priority || 0));
      nextPriority = maxPriority + 1;
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
          off_waiver: off_waiver || null,
          personal_priority: nextPriority
        },
      ])
      .select();

    if (error) {
      if (error.message.includes('uniq_manager_claim_active')) {
        return NextResponse.json({ success: false, error: 'You have already submitted a claim for this player.' }, { status: 400 });
      }
      if (error.message.includes('idx_waiver_claims_pending_unique')) {
        return NextResponse.json({ success: false, error: 'You have already submitted an identical waiver claim for this player. Please change the player to drop or cancel your existing pending waiver(s).' }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: data[0] });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
