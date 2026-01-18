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

    // 記錄 ADD 交易到 transactions_2025
    const { error: transError } = await supabase
      .from('transactions_2025')
      .insert({
        league_id: leagueId,
        player_id: player_id,
        manager_id: manager_id,
        transaction_type: 'ADD',
        transaction_time: taiwanTime.toISOString()
      });

    if (transError) {
      console.error('Failed to log transaction:', transError);
      // 不阻擋主流程，僅記錄錯誤
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

// DELETE - DROP 球員（設為 Waiver 或直接刪除）
export async function DELETE(req, { params }) {
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

    // 檢查該球員是否由此 manager 擁有
    const { data: ownership, error: checkError } = await supabase
      .from('league_player_ownership')
      .select('id, status, manager_id, acquired_at')
      .eq('league_id', leagueId)
      .eq('player_id', player_id)
      .maybeSingle();

    if (checkError) {
      console.error('Check ownership error:', checkError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify player ownership', details: checkError.message },
        { status: 500 }
      );
    }

    if (!ownership) {
      return NextResponse.json(
        { success: false, error: 'Player not found in this league' },
        { status: 404 }
      );
    }

    if (ownership.manager_id !== manager_id) {
      return NextResponse.json(
        { success: false, error: 'You do not own this player' },
        { status: 403 }
      );
    }

    // 取得聯盟設定中的 waiver_players_unfreeze_time
    const { data: leagueSettings, error: settingsError } = await supabase
      .from('league_settings')
      .select('waiver_players_unfreeze_time')
      .eq('league_id', leagueId)
      .single();

    if (settingsError || !leagueSettings) {
      console.error('Failed to fetch league settings:', settingsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch league settings', details: settingsError?.message },
        { status: 500 }
      );
    }

    // 解析 waiver_players_unfreeze_time，可能是 "2 day(s)" 或數字
    let waiverDays = 2; // 預設 2 天
    const rawValue = leagueSettings.waiver_players_unfreeze_time;
    if (rawValue) {
      if (typeof rawValue === 'number') {
        waiverDays = rawValue;
      } else if (typeof rawValue === 'string') {
        const match = rawValue.match(/(\d+)/);
        waiverDays = match ? parseInt(match[1], 10) : 2;
      }
    }

    // 取得台灣當前時間
    const nowTaiwan = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const todayMD = `${nowTaiwan.getMonth() + 1}/${nowTaiwan.getDate()}`;

    // 將 acquired_at (UTC) 轉換為台灣時間後取得 m/d
    const acquiredUTC = new Date(ownership.acquired_at);
    const acquiredTaiwan = new Date(acquiredUTC.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const acquiredMD = `${acquiredTaiwan.getMonth() + 1}/${acquiredTaiwan.getDate()}`;

    // 判斷是否為同日 add & drop
    if (acquiredMD === todayMD) {
      // 同日 add & drop -> 直接刪除記錄（回到 FA）
      const { error: deleteError } = await supabase
        .from('league_player_ownership')
        .delete()
        .eq('id', ownership.id);

      if (deleteError) {
        console.error('Delete ownership error:', deleteError);
        return NextResponse.json(
          { success: false, error: 'Failed to drop player', details: deleteError.message },
          { status: 500 }
        );
      }

      // 記錄 DROP 交易到 transactions_2025
      const { error: transError } = await supabase
        .from('transactions_2025')
        .insert({
          league_id: leagueId,
          player_id: player_id,
          manager_id: manager_id,
          transaction_type: 'DROP',
          transaction_time: nowTaiwan.toISOString()
        });

      if (transError) {
        console.error('Failed to log transaction:', transError);
      }

      return NextResponse.json({
        success: true,
        message: 'Player dropped (same day add & drop)',
        action: 'deleted'
      });
    } else {
      // 非同日 -> 設為 Waiver，off_waiver = 今天 + waiver_players_unfreeze_time 天
      const offWaiverDate = new Date(nowTaiwan);
      offWaiverDate.setDate(offWaiverDate.getDate() + waiverDays);

      const { error: updateError } = await supabase
        .from('league_player_ownership')
        .update({
          status: 'Waiver',
          acquired_at: nowTaiwan.toISOString(),
          off_waiver: offWaiverDate.toISOString().split('T')[0]  // 只取日期部分 YYYY-MM-DD
        })
        .eq('id', ownership.id);

      if (updateError) {
        console.error('Update ownership error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to drop player', details: updateError.message },
          { status: 500 }
        );
      }

      // 記錄 DROP 交易到 transactions_2025
      const { error: transError } = await supabase
        .from('transactions_2025')
        .insert({
          league_id: leagueId,
          player_id: player_id,
          manager_id: manager_id,
          transaction_type: 'DROP',
          transaction_time: nowTaiwan.toISOString()
        });

      if (transError) {
        console.error('Failed to log transaction:', transError);
      }

      return NextResponse.json({
        success: true,
        message: 'Player moved to waiver',
        action: 'waiver',
        off_waiver: offWaiverDate.toISOString().split('T')[0]
      });
    }
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: err.message },
      { status: 500 }
    );
  }
}
