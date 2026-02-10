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
// GET: 取得 pending trades
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');
    const manager_id = searchParams.get('manager_id');
    const time_window = searchParams.get('time_window') || '2026 Season';

    if (!league_id || !manager_id) {
      return NextResponse.json({ success: false, error: 'Missing league_id or manager_id' }, { status: 400 });
    }

    // Fetch league settings for roster positions and stat categories
    const { data: settings, error: settingsError } = await supabase
      .from('league_settings')
      .select('roster_positions, batter_stat_categories, pitcher_stat_categories')
      .eq('league_id', league_id)
      .single();

    if (settingsError) {
      console.error('Error fetching league settings:', settingsError);
    }

    // Fetch pending trades where the user is either initiator or recipient
    const { data: trades, error: tradesError } = await supabase
      .from('pending_trade')
      .select(`
        *,
        initiator:managers!fk_pending_trade_initiator (name),
        recipient:managers!fk_pending_trade_recipient (name)
      `)
      .eq('league_id', league_id)
      .or(`initiator_manager_id.eq.${manager_id},recipient_manager_id.eq.${manager_id}`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (tradesError) {
      return NextResponse.json({ success: false, error: tradesError.message }, { status: 500 });
    }

    // Enrich with player details and stats
    if (trades && trades.length > 0) {
      const playerIds = new Set();
      trades.forEach(t => {
        if (Array.isArray(t.initiator_player_ids)) t.initiator_player_ids.forEach(id => playerIds.add(id));
        if (Array.isArray(t.recipient_player_ids)) t.recipient_player_ids.forEach(id => playerIds.add(id));
      });
      const ids = Array.from(playerIds);

      if (ids.length > 0) {
        // Fetch basic info from player_list
        const { data: playersData, error: playersError } = await supabase
          .from('player_list')
          .select('player_id, name, team, batter_or_pitcher')
          .in('player_id', ids);

        // Fetch positions from views
        const { data: batterPos, error: bError } = await supabase
          .from('v_batter_positions')
          .select('player_id, position_list')
          .in('player_id', ids);

        const { data: pitcherPos, error: pError } = await supabase
          .from('v_pitcher_positions')
          .select('player_id, position_list')
          .in('player_id', ids);

        // Fetch Stats
        const { data: batterStats, error: bsError } = await supabase
          .from('v_batting_summary')
          .select('*')
          .eq('time_window', time_window)
          .in('player_id', ids);

        const { data: pitcherStats, error: psError } = await supabase
          .from('v_pitching_summary')
          .select('*')
          .eq('time_window', time_window)
          .in('player_id', ids);

        if (playersData) {
          const playerMap = {};
          const posMap = {};
          const statsMap = {};

          if (batterPos) batterPos.forEach(p => posMap[p.player_id] = p.position_list);
          if (pitcherPos) pitcherPos.forEach(p => posMap[p.player_id] = p.position_list);

          if (batterStats) batterStats.forEach(s => statsMap[s.player_id] = s);
          if (pitcherStats) pitcherStats.forEach(s => statsMap[s.player_id] = s);

          playersData.forEach(p => {
            let pos = posMap[p.player_id];
            if (!pos) {
              pos = p.batter_or_pitcher === 'pitcher' ? 'P' : 'Util';
            }
            playerMap[p.player_id] = {
              ...p,
              position: pos,
              stats: statsMap[p.player_id] || {}
            };
          });

          trades.forEach(t => {
            t.initiator_players = (t.initiator_player_ids || []).map(id => playerMap[id] || { player_id: id, name: 'Unknown' });
            t.recipient_players = (t.recipient_player_ids || []).map(id => playerMap[id] || { player_id: id, name: 'Unknown' });
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      trades: trades,
      settings: {
        roster_positions: settings?.roster_positions || {},
        batter_stat_categories: settings?.batter_stat_categories || [],
        pitcher_stat_categories: settings?.pitcher_stat_categories || []
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
