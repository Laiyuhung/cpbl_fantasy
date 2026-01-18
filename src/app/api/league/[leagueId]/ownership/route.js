import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

// POST - 新增球員到隊伍（寫入 league_player_ownership）
export async function POST(req, { params }) {
  try {
    const { leagueId } = params;
    const body = await req.json();
    const { player_id, manager_id } = body;

    // 驗證必要參數
    if (!leagueId || !player_id || !manager_id) {
      return NextResponse.json(
        { success: false, error: 'League ID, Player ID, and Manager ID are required' },
        { status: 400 }
      );
    }

    // 檢查該球員是否已在此聯盟中
    const { data: existing, error: checkError } = await supabase
      .from('league_player_ownership')
      .select('id, status, manager_id')
      .eq('league_id', leagueId)
      .eq('player_id', player_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (正常情況)
      console.error('Check ownership error:', checkError);
      return NextResponse.json(
        { success: false, error: 'Failed to check ownership', details: checkError.message },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { success: false, error: '此球員已在聯盟中，無法重複加入' },
        { status: 409 }
      );
    }

    // 插入新記錄
    const { data: newOwnership, error: insertError } = await supabase
      .from('league_player_ownership')
      .insert({
        league_id: leagueId,
        player_id: player_id,
        manager_id: manager_id,
        status: 'On Team',
        acquired_at: new Date().toISOString(),
        off_waiver: null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert ownership error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to add player', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Player added successfully',
      ownership: newOwnership
    });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: err.message },
      { status: 500 }
    );
  }
}

// GET - 獲取聯盟球員擁有權狀態
export async function GET(req, { params }) {
  try {
    const { leagueId } = params;

    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: 'League ID is required' },
        { status: 400 }
      );
    }

    // 獲取該聯盟所有球員的擁有權狀態
    const { data: ownerships, error } = await supabase
      .from('league_player_ownership')
      .select('*')
      .eq('league_id', leagueId);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch ownership data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ownerships: ownerships || [],
    });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: err.message },
      { status: 500 }
    );
  }
}
