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

    // 直接使用 UTC 時間
    const now = new Date();

    // 插入新記錄（使用 upsert 確保原子性，但設定 onConflict 讓重複時返回錯誤）
    const { data: newOwnership, error: insertError } = await supabase
      .from('league_player_ownership')
      .insert({
        league_id: leagueId,
        player_id: player_id,
        manager_id: manager_id,
        status: 'On Team',
        acquired_at: now.toISOString(),
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

    // 記錄 ADD 交易到 transactions_2026
    const { error: transError } = await supabase
      .from('transactions_2026')
      .insert({
        league_id: leagueId,
        player_id: player_id,
        manager_id: manager_id,
        transaction_type: 'ADD',
        transaction_time: now.toISOString()
      });

    if (transError) {
      console.error('Failed to log transaction:', transError);
      // 不阻擋主流程，僅記錄錯誤
    }

    // --- 自動生成 league_roster_positions ---
    try {
      // 1. 取得聯盟賽程的開始與結束週資訊
      const { data: scheduleInfo, error: scheduleError } = await supabase
        .from('league_schedule')
        .select('week_number, week_start, week_end')
        .eq('league_id', leagueId)
        .order('week_number', { ascending: true }); // 用於取第一週

      if (!scheduleError && scheduleInfo && scheduleInfo.length > 0) {
        // 第一週開始日 (Season Start)
        const firstWeek = scheduleInfo[0];
        const lastWeek = scheduleInfo[scheduleInfo.length - 1]; // 最後一週

        let seasonStart = new Date(firstWeek.week_start);
        let seasonEnd = null;

        // 2. 透過最後一週的 week_end 去 schedule_date 找 week_id
        const { data: weekData, error: weekError } = await supabase
          .from('schedule_date')
          .select('week')
          .eq('end', lastWeek.week_end) // 假設完全匹配
          .single();

        if (!weekError && weekData) {
          // 3. 找到 week_id + 1 作為賽季結束判定點
          const currentWeekNum = parseInt(weekData.week.replace('W', ''), 10);
          const nextWeekNum = currentWeekNum + 1;
          const nextWeekStr = `W${nextWeekNum}`;

          const { data: nextWeekData, error: nextWeekError } = await supabase
            .from('schedule_date')
            .select('end')
            .eq('week', nextWeekStr)
            .single();

          if (!nextWeekError && nextWeekData) {
            seasonEnd = new Date(nextWeekData.end);
          }
        }

        // 如果找不到 next week，fallback 使用最後一週的 end date + 1 天? 
        // 依照需求："將week_id+1才是這裡要的賽季結束"，若找不到可能代表賽季未定義完全，暫時不生成或報錯？
        // 這裡做個 fallback：如果找不到 week+1，就用 lastWeek.week_end
        if (!seasonEnd) {
          seasonEnd = new Date(lastWeek.week_end);
          // 通常 end date 是包含的，所以如果要用作 exclusive upper bound，可能要 +1 天，但這裡暫且依賴 week+1 邏輯
        }

        // 4. 決定生成區間
        // 取得台灣時間的今天 (去除時間部分)
        const nowTaiwan = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
        nowTaiwan.setHours(0, 0, 0, 0);

        // 如果 Today < SeasonStart，從 SeasonStart 開始
        // 如果 Today >= SeasonStart，從 Today 開始
        // 注意：這裡的 seasonStart 應該也是 Date 物件 (UTC 00:00:00)，比較時要注意時區
        // 為求保險，將 seasonStart 也視為當日 00:00

        let startDate = nowTaiwan < seasonStart ? seasonStart : nowTaiwan;

        // 生成每一天的資料
        const rosterRows = [];
        let currentDate = new Date(startDate);

        // 迴圈：currentDate <= seasonEnd
        // 注意：seasonEnd 是 "Week+1" 的 end，即本季最後一天。
        // 所以 <= seasonEnd 以包含這一天。
        while (currentDate <= seasonEnd) {
          rosterRows.push({
            league_id: leagueId,
            manager_id: manager_id,
            player_id: player_id,
            game_date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD
            position: 'BN' // 預設板凳
          });

          // 加一天
          currentDate.setDate(currentDate.getDate() + 1);
        }

        if (rosterRows.length > 0) {
          const { error: rosterError } = await supabase
            .from('league_roster_positions')
            .upsert(rosterRows, { onConflict: 'league_id, player_id, game_date' }); // 避免重複報錯

          if (rosterError) {
            console.error('Failed to generate roster positions:', rosterError);
          } else {
            console.log(`Generated ${rosterRows.length} roster positions for player ${player_id}`);
          }
        }
      }
    } catch (rosterGenError) {
      console.error('Error in roster generation logic:', rosterGenError);
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
    const now = new Date();
    const nowTaiwan = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const todayMD = `${nowTaiwan.getMonth() + 1}/${nowTaiwan.getDate()}`;

    // --- 清除未來及今日的 league_roster_positions ---
    // 無論是 Same day drop 還是 Waiver drop，今天起該球員都不應再出現在 roster 中
    const todayStr = nowTaiwan.toISOString().split('T')[0];

    const { error: rosterDeleteError } = await supabase
      .from('league_roster_positions')
      .delete()
      .eq('league_id', leagueId)
      .eq('manager_id', manager_id)
      .eq('player_id', player_id)
      .gte('game_date', todayStr);

    if (rosterDeleteError) {
      console.error('Failed to cleanup roster positions:', rosterDeleteError);
      // 不阻擋 Drop 流程，僅記錄錯誤
    }

    // 將 acquired_at (UTC) 轉換為台灣時間後取得 m/d
    const acquiredUTC = new Date(ownership.acquired_at);
    const acquiredTaiwan = new Date(acquiredUTC.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const acquiredMD = `${acquiredTaiwan.getMonth() + 1}/${acquiredTaiwan.getDate()}`;

    // 判斷是否為同日 add & drop
    console.log('=== Checking same day add & drop ===');
    console.log('acquired_at (raw):', ownership.acquired_at);
    console.log('acquired_at (UTC Date):', acquiredUTC);
    console.log('acquired_at (Taiwan Time):', acquiredTaiwan);
    console.log('acquiredMD:', acquiredMD);
    console.log('nowTaiwan:', nowTaiwan);
    console.log('todayMD:', todayMD);
    console.log('Is same day?:', acquiredMD === todayMD);

    if (acquiredMD === todayMD) {
      console.log('→ Same day detected, deleting record...');
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

      // 記錄 DROP 交易到 transactions_2026
      const { error: transError } = await supabase
        .from('transactions_2026')
        .insert({
          league_id: leagueId,
          player_id: player_id,
          manager_id: manager_id,
          transaction_type: 'DROP',
          transaction_time: now.toISOString()
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
      console.log('→ Different day detected, setting to Waiver...');
      // 非同日 -> 設為 Waiver，off_waiver = 台灣今天 + waiver_players_unfreeze_time 天
      // 使用台灣時間計算 waiver 解凍日期
      const offWaiverTaiwan = new Date(nowTaiwan);
      offWaiverTaiwan.setDate(offWaiverTaiwan.getDate() + waiverDays);

      // 將台灣時間轉回 UTC 存入資料庫
      const offWaiverUTC = new Date(offWaiverTaiwan.toLocaleString('en-US', { timeZone: 'UTC' }));

      const { error: updateError } = await supabase
        .from('league_player_ownership')
        .update({
          status: 'Waiver',
          acquired_at: now.toISOString(),
          off_waiver: offWaiverUTC.toISOString().split('T')[0]  // 只取日期部分 YYYY-MM-DD
        })
        .eq('id', ownership.id);

      if (updateError) {
        console.error('Update ownership error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to drop player', details: updateError.message },
          { status: 500 }
        );
      }

      // 記錄 DROP 交易到 transactions_2026
      const { error: transError } = await supabase
        .from('transactions_2026')
        .insert({
          league_id: leagueId,
          player_id: player_id,
          manager_id: manager_id,
          transaction_type: 'DROP',
          transaction_time: now.toISOString()
        });

      if (transError) {
        console.error('Failed to log transaction:', transError);
      }

      return NextResponse.json({
        success: true,
        message: 'Player moved to waiver',
        action: 'waiver',
        off_waiver: offWaiverUTC.toISOString().split('T')[0]
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
