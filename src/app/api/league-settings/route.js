import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 將 datetime-local 字串視為台灣時間 (+08:00) 存成 ISO（UTC）
const toTaiwanIso = (dt) => {
  if (!dt) return null;
  const [datePart, timePart] = dt.split('T');
  if (!datePart || !timePart) return null;
  const iso = `${datePart}T${timePart}:00+08:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { settings } = body;

    // 準備數據
    const draftType = settings.general['Draft Type'];
    const leagueData = {
      // General
      league_name: settings.general['League Name'],
      draft_type: draftType,
      live_draft_pick_time: draftType === 'Live Draft' ? settings.general['Live Draft Pick Time'] : null,
      live_draft_time: draftType === 'Live Draft' ? toTaiwanIso(settings.general['Live Draft Time']) : null,
      max_teams: parseInt(settings.general['Max Teams']),
      scoring_type: settings.general['Scoring Type'],

      // Acquisitions
      trade_end_date: settings.acquisitions['Trade End Date'],
      max_acquisitions_per_week: settings.acquisitions['Max Acquisitions per Week'],

      // Waivers
      waiver_players_unfreeze_time: settings.waivers['Waiver Players Unfreeze Time'],
      allow_injured_to_injury_slot: settings.waivers['Allow injured players from waivers or free agents to be added directly to the injury slot'],
      post_draft_players_unfreeze_time: settings.waivers['Post Draft Players Unfreeze Time'],

      // Trading
      trade_review: settings.trading['Trade Review'],
      trade_reject_time: settings.trading['Trade Review'] === 'No review' ? null : settings.trading['Trade Reject Time'],
      trade_reject_percentage: settings.trading['Trade Review'] === 'No review' ? null : settings.trading['Trade Reject percentage needed'],

      // Roster
      min_innings_pitched_per_week: settings.roster['Min Innings pitched per team per week'],
      roster_positions: settings.roster['Roster Positions'],

      // Scoring
      start_scoring_on: settings.scoring['Start Scoring On'],
      batter_stat_categories: settings.scoring['Batter Stat Categories'],
      pitcher_stat_categories: settings.scoring['Pitcher Stat Categories'],

      // Playoffs
      playoffs: settings.playoffs['Playoffs'],
      playoffs_start: settings.playoffs['Playoffs'] === 'No playoffs' ? null : settings.playoffs['Playoffs start'],
      playoff_tie_breaker: settings.playoffs['Playoff/ranking Tie-Breaker'],
      playoff_reseeding: settings.playoffs['Playoffs'] === 'No playoffs' ? null : settings.playoffs['Playoff Reseeding'],
      lock_eliminated_teams: settings.playoffs['Playoffs'] === 'No playoffs' ? null : settings.playoffs['Lock Eliminated Teams'],

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

    // 建立預設狀態為 pre-draft
    const leagueId = data[0].league_id;
    const { error: statusError } = await supabase
      .from('league_statuses')
      .insert([{ league_id: leagueId, status: 'pre-draft' }]);

    if (statusError) {
      console.error('Supabase status error:', statusError);
      return NextResponse.json(
        { error: '建立聯盟狀態失敗', details: statusError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'League created successfully!',
      league_id: leagueId,
      data: data[0],
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { league_id, settings } = body;

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    const draftType = settings.general['Draft Type'];
    const leagueData = {
      league_name: settings.general['League Name'],
      draft_type: draftType,
      live_draft_pick_time: draftType === 'Live Draft' ? settings.general['Live Draft Pick Time'] : null,
      live_draft_time: draftType === 'Live Draft' ? toTaiwanIso(settings.general['Live Draft Time']) : null,
      max_teams: parseInt(settings.general['Max Teams']),
      scoring_type: settings.general['Scoring Type'],

      trade_end_date: settings.acquisitions['Trade End Date'],
      max_acquisitions_per_week: settings.acquisitions['Max Acquisitions per Week'],

      waiver_players_unfreeze_time: settings.waivers['Waiver Players Unfreeze Time'],
      allow_injured_to_injury_slot: settings.waivers['Allow injured players from waivers or free agents to be added directly to the injury slot'],
      post_draft_players_unfreeze_time: settings.waivers['Post Draft Players Unfreeze Time'],

      trade_review: settings.trading['Trade Review'],
      trade_reject_time: settings.trading['Trade Review'] === 'No review' ? null : settings.trading['Trade Reject Time'],
      trade_reject_percentage: settings.trading['Trade Review'] === 'No review' ? null : settings.trading['Trade Reject percentage needed'],

      min_innings_pitched_per_week: settings.roster['Min Innings pitched per team per week'],
      roster_positions: settings.roster['Roster Positions'],

      start_scoring_on: settings.scoring['Start Scoring On'],
      batter_stat_categories: settings.scoring['Batter Stat Categories'],
      pitcher_stat_categories: settings.scoring['Pitcher Stat Categories'],

      playoffs: settings.playoffs['Playoffs'],
      playoffs_start: settings.playoffs['Playoffs'] === 'No playoffs' ? null : settings.playoffs['Playoffs start'],
      playoff_tie_breaker: settings.playoffs['Playoff/ranking Tie-Breaker'],
      playoff_reseeding: settings.playoffs['Playoffs'] === 'No playoffs' ? null : settings.playoffs['Playoff Reseeding'],
      lock_eliminated_teams: settings.playoffs['Playoffs'] === 'No playoffs' ? null : settings.playoffs['Lock Eliminated Teams'],

      make_league_publicly_viewable: settings.league['Make League Publicly Viewable'],
      invite_permissions: settings.league['Invite Permissions'],
    };

    const { data, error } = await supabase
      .from('league_settings')
      .update(leagueData)
      .eq('league_id', league_id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: '更新失敗', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'League updated successfully!',
      league_id,
      data,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
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

      // 取得狀態（若沒有就回傳 null）
      const { data: statusData, error: statusError } = await supabase
        .from('league_statuses')
        .select('status')
        .eq('league_id', leagueId)
        .single();

      const status = statusError ? null : statusData?.status ?? null;

      return NextResponse.json({ success: true, data, status });
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
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
