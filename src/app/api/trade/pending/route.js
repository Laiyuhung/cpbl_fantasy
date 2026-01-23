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

    // 檢查聯盟設定中的交易截止日
    const { data: leagueSettings, error: settingsError } = await supabase
      .from('league_settings')
      .select('trade_end_date, start_scoring_on')
      .eq('league_id', league_id)
      .single();

    if (!settingsError && leagueSettings) {
      const tradeEndDate = leagueSettings.trade_end_date;

      if (tradeEndDate && tradeEndDate.trim().toLowerCase() !== 'no trade deadline') {
        try {
          const trimmedDate = tradeEndDate.trim();
          let dateStr = trimmedDate;

          // 如果沒有年份，嘗試從 start_scoring_on 取得年份或使用今年
          if (!/\d{4}/.test(trimmedDate)) {
            let year = new Date().getFullYear();
            if (leagueSettings.start_scoring_on) {
              const parts = leagueSettings.start_scoring_on.split('.');
              if (parts.length > 0) {
                const parsedYear = parseInt(parts[0]);
                if (!isNaN(parsedYear)) year = parsedYear;
              }
            }
            dateStr = `${trimmedDate}, ${year}`;
          }

          const deadline = new Date(dateStr);
          if (!isNaN(deadline.getTime())) {
            // 設定截止時間為當天 23:59:59
            deadline.setHours(23, 59, 59, 999);

            if (new Date() > deadline) {
              return NextResponse.json({
                success: false,
                error: 'Trade deadline has passed'
              }, { status: 400 });
            }
          }
        } catch (e) {
          console.error('Error checking trade deadline:', e);
          // 發生錯誤時允許交易，避免因格式問題卡住
        }
      }
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
