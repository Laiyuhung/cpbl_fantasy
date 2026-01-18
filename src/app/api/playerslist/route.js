import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

// GET - 獲取球員列表
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const availableOnly = searchParams.get('available') !== 'false';

    let query = supabase
      .from('player_list')
      .select('*')
      .order('add_date', { ascending: false });

    if (availableOnly) {
      query = query.eq('available', true);
    }

    const { data: players, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch players', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      players: players || [],
    });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: err.message },
      { status: 500 }
    );
  }
}

// 新增球員 API
export async function POST(req) {
  try {
    const body = await req.json()
    const { Name, Team, 原名, pitch_side, identity, B_or_P, Available, add_date } = body
    if (!Name || !B_or_P) {
      return NextResponse.json({ error: 'Name 與 B_or_P 為必填' }, { status: 400 })
    }

    // 取得目前最大 Player_no
    const { data: maxData, error: maxErr } = await supabase
      .from('playerslist')
      .select('Player_no')
      .order('Player_no', { ascending: false })
      .limit(1)
      .single()
    if (maxErr) throw new Error('查詢 Player_no 失敗: ' + maxErr.message)
    const nextPlayerNo = (maxData?.Player_no || 0) + 1

    // 新增球員
    const { error: insertErr } = await supabase.from('playerslist').insert([
      {
        Player_no: nextPlayerNo,
        Name,
        Team: Team || null,
        原名: 原名 || null,
        pitch_side: pitch_side || null,
        identity: identity || null,
        B_or_P,
        Available: Available ?? 'V', // 預設 V
        add_date: add_date || new Date().toISOString().slice(0, 10)
      }
    ])
    if (insertErr) throw new Error('新增球員失敗: ' + insertErr.message)

    return NextResponse.json({ success: true, Player_no: nextPlayerNo })
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
