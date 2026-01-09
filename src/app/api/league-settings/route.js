import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { settings } = body;

    // 準備數據
    const leagueData = {
      // General
      league_name: settings.general['League Name'],
      draft_type: settings.general['Draft Type'],
      live_draft_pick_time: settings.general['Live Draft Pick Time'],
      max_teams: parseInt(settings.general['Max Teams']),

      // Acquisitions
      trade_end_date: settings.acquisitions['Trade End Date'],
      max_acquisitions_per_week: settings.acquisitions['Max Acquisitions per Week'],

      // Waivers
      waiver_players_unfreeze_time: settings.waivers['Waiver Players Unfreeze Time'],
      allow_injured_to_injury_slot: settings.waivers['Allow injured players from waivers or free agents to be added directly to the injury slot'],

      // Trading
      trade_review: settings.trading['Trade Review'],
      trade_reject_time: settings.trading['Trade Reject Time'],
      trade_reject_percentage: settings.trading['Trade Reject percentage'],
      post_draft_players_unfreeze_time: settings.trading['Post Draft Players  Unfreeze Time'],

      // Roster
      min_innings_pitched_per_week: settings.roster['Min Innings pitched per team per week'],
      roster_positions: settings.roster['Roster Positions'],

      // Scoring
      start_scoring_on: settings.scoring['Start Scoring On'],
      batter_stat_categories: settings.scoring['Batter Stat Categories'],
      pitcher_stat_categories: settings.scoring['Pitcher Stat Categories'],

      // Playoffs
      playoffs: settings.playoffs['Playoffs'],
      playoffs_start: settings.playoffs['Playoffs start'],
      playoff_tie_breaker: settings.playoffs['Playoff Tie-Breaker'],
      playoff_reseeding: settings.playoffs['Playoff Reseeding'],
      lock_eliminated_teams: settings.playoffs['Lock Eliminated Teams'],

      // League
      make_league_publicly_viewable: settings.league['Make League Publicly Viewable'],
      invite_permissions: settings.league['Invite Permissions'],
    };

    // 插入到資料庫
    const { data, error } = await supabase
      .from('league_settings')
      .insert([leagueData])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: '保存失敗', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '聯盟設定已成功保存！',
      league_id: data[0].league_id,
      data: data[0],
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: '伺服器錯誤', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');

    if (leagueId) {
      // 取得特定聯盟的設定
      const { data, error } = await supabase
        .from('league_settings')
        .select('*')
        .eq('league_id', leagueId)
        .single();

      if (error) {
        return NextResponse.json(
          { error: '找不到聯盟設定', details: error.message },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data });
    } else {
      // 取得所有聯盟
      const { data, error } = await supabase
        .from('league_settings')
        .select('league_id, league_name, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json(
          { error: '取得資料失敗', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: '伺服器錯誤', details: error.message },
      { status: 500 }
    );
  }
}
