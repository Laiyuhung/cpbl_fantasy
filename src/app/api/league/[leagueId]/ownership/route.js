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

    // 【執行前再次檢查】檢查該球員是否已在此聯盟中，避免多人同時操作衝突
    const { data: existing, error: checkError } = await supabase
      .from('league_player_ownership')
      .select('id, status, manager_id')
      .eq('league_id', leagueId)
      .eq('player_id', player_id)
      .maybeSingle();  // 使用 maybeSingle 而非 single，避免 no rows 錯誤

    if (checkError) {
      console.error('Check ownership error:', checkError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify player status', details: checkError.message },
        { status: 500 }
      );
    }

    if (existing) {
      // 球員已被佔用，返回具體錯誤
      if (existing.manager_id === manager_id) {
        return NextResponse.json(
          { success: false, error: 'You already own this player' },
          { status: 409 }
        );
      } else {
        return NextResponse.json(
          { success: false, error: 'This player has been taken by another team' },
          { status: 409 }
        );
      }
    }

    // 取得台灣當地時間，再轉換為 UTC 格式寫入
    const taiwanTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    
    // 插入新記錄（使用 upsert 確保原子性，但設定 onConflict 讓重複時返回錯誤）
    const { data: newOwnership, error: insertError } = await supabase
      .from('league_player_ownership')
      .insert({
        league_id: leagueId,
        player_id: player_id,
        manager_id: manager_id,
        status: 'On Team',
        acquired_at: taiwanTime.toISOString(),
        off_waiver: null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert ownership error:', insertError);
      // 如果是唯一性約束違反（race condition），返回友善錯誤
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'This player was just taken by another team' },
          { status: 409 }
        );
      }
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
