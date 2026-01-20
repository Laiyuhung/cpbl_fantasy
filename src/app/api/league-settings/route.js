import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Roster Positions 預定義順序
const ROSTER_POSITION_ORDER = [
  'C', '1B', '2B', '3B', 'SS', 'MI', 'CI', 
  'OF', 'LF', 'CF', 'RF', 'Util', 
  'SP', 'RP', 'P', 
  'BN', 'Minor'
];

// 按照預定義順序重新排列 Roster Positions
const sortRosterPositions = (positions) => {
  if (!positions || typeof positions !== 'object') return positions;
  
  const sorted = {};
  ROSTER_POSITION_ORDER.forEach(pos => {
    if (positions.hasOwnProperty(pos)) {
      sorted[pos] = positions[pos];
    }
  });
  
  // 添加任何不在預定義列表中的位置（以防萬一）
  Object.keys(positions).forEach(pos => {
    if (!sorted.hasOwnProperty(pos)) {
      sorted[pos] = positions[pos];
    }
  });
  
  return sorted;
};

// 將 datetime-local 字串視為台灣時間 (+08:00) 存成 ISO（UTC）
const toTaiwanIso = (dt) => {
  if (!dt) return null;
  const [datePart, timePart] = dt.split('T');
  if (!datePart || !timePart) return null;
  const iso = `${datePart}T${timePart}:00+08:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// 計算聯盟周次
const generateLeagueSchedule = (startScoringOn, playoffsStart, playoffsType) => {
  const schedule = [];
  const maxWeeks = 23; // 总共可用周次（week_id 1-23）
  const reservedWeek = 23; // 保留周（补赛周）
  const maxRegularAndPlayoff = 21; // 例行赛+季后赛不能超过21周（留1周给补赛）
  
  // 解析日期 (格式: YYYY.M.D)
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  };

  const startDate = parseDate(startScoringOn);
  if (!startDate) return { schedule: [], error: null };

  let weekNumber = 1;
  let currentDate = new Date(startDate);

  // 計算例行賽周次
  const playoffDate = parseDate(playoffsStart);
  const endDate = playoffDate || new Date(startDate.getFullYear(), 8, 30);

  while (currentDate < endDate && weekNumber < reservedWeek) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);

    if (playoffDate && weekEnd >= playoffDate) {
      weekEnd.setTime(playoffDate.getTime() - 86400000);
    }

    schedule.push({
      week_number: weekNumber,
      week_type: 'regular_season',
      week_label: `Week ${weekNumber}`,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
    });

    weekNumber++;
    currentDate.setDate(currentDate.getDate() + 7);

    if (playoffDate && currentDate >= playoffDate) {
      break;
    }
  }

  const regularSeasonWeeks = schedule.length;

  // 計算季後賽周次
  if (playoffsStart && playoffsType && playoffsType !== 'No playoffs') {
    const teamsMatch = playoffsType.match(/^(\d+) teams/);
    const weeksMatch = playoffsType.match(/(\d+) weeks?$/);
    const playoffTeams = teamsMatch ? parseInt(teamsMatch[1]) : 0;
    const playoffWeeks = weeksMatch ? parseInt(weeksMatch[1]) : 0;

    let playoffLabels = [];
    if (playoffTeams === 2) {
      playoffLabels = ['Final'];
    } else if (playoffTeams === 4) {
      playoffLabels = ['Semifinal', 'Final'];
    } else if (playoffTeams >= 5 && playoffTeams <= 8) {
      playoffLabels = ['Quarterfinal', 'Semifinal', 'Final'];
      if (playoffWeeks === 4) {
        playoffLabels.unshift('First Round');
      }
    }

    // 在季后赛前插入补赛周
    if (weekNumber < reservedWeek) {
      schedule.push({
        week_number: weekNumber,
        week_type: 'makeup',
        week_label: 'Makeup Week',
        week_start: playoffDate.toISOString().split('T')[0],
        week_end: new Date(playoffDate.getTime() + 6 * 86400000).toISOString().split('T')[0],
      });
      weekNumber++;
    }

    let playoffCurrentDate = new Date(playoffDate);
    playoffCurrentDate.setDate(playoffCurrentDate.getDate() + 7); // 跳过补赛周

    for (let i = 0; i < playoffWeeks; i++) {
      const weekStart = new Date(playoffCurrentDate);
      const weekEnd = new Date(playoffCurrentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);

      schedule.push({
        week_number: weekNumber,
        week_type: 'playoffs',
        week_label: playoffLabels[i] || `Playoff Week ${i + 1}`,
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
      });

      weekNumber++;
      playoffCurrentDate.setDate(playoffCurrentDate.getDate() + 7);
    }
  }

  return { schedule };
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { settings, manager_id, categoryWeights } = body;

    console.log('\n=== POST /api/league-settings ===');
    console.log('📝 Roster Positions (原始):', JSON.stringify(settings.roster['Roster Positions'], null, 2));
    console.log('📝 Batter Stats (原始):', settings.scoring['Batter Stat Categories']);
    console.log('📝 Pitcher Stats (原始):', settings.scoring['Pitcher Stat Categories']);

    if (!manager_id) {
      return NextResponse.json(
        { error: 'Manager ID is required' },
        { status: 400 }
      );
    }

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
      // 按預定義順序排列 roster_positions
      roster_positions: sortRosterPositions(settings.roster['Roster Positions']),

      // Scoring
      start_scoring_on: settings.scoring['Start Scoring On'],
      // 直接塞入前端传来的数组，保持顺序
      batter_stat_categories: Array.isArray(settings.scoring['Batter Stat Categories']) 
        ? JSON.parse(JSON.stringify(settings.scoring['Batter Stat Categories'])) 
        : [],
      pitcher_stat_categories: Array.isArray(settings.scoring['Pitcher Stat Categories']) 
        ? JSON.parse(JSON.stringify(settings.scoring['Pitcher Stat Categories'])) 
        : [],

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

    console.log('✅ Roster Positions (排序後):', JSON.stringify(leagueData.roster_positions, null, 2));
    console.log('✅ Batter Stats (處理後):', leagueData.batter_stat_categories);
    console.log('✅ Pitcher Stats (處理後):', leagueData.pitcher_stat_categories);

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

    // 將創建者加入 league_members 並設為 Commissioner
    const { data: managerData, error: managerError } = await supabase
      .from('managers')
      .select('name')
      .eq('manager_id', manager_id)
      .single();

    if (managerError || !managerData) {
      console.error('Manager not found:', managerError);
      return NextResponse.json(
        { error: '找不到管理員資料', details: managerError?.message },
        { status: 404 }
      );
    }

    const { error: memberError } = await supabase
      .from('league_members')
      .insert([{
        league_id: leagueId,
        manager_id: manager_id,
        nickname: managerData.name,
        role: 'Commissioner'
      }]);

    if (memberError) {
      console.error('Failed to add creator as Commissioner:', memberError);
      return NextResponse.json(
        { error: '加入聯盟成員失敗', details: memberError.message },
        { status: 500 }
      );
    }

    // 生成並插入周次數據
    const { schedule: scheduleData } = generateLeagueSchedule(
      settings.scoring['Start Scoring On'],
      settings.playoffs['Playoffs start'],
      settings.playoffs['Playoffs']
    );

    if (scheduleData.length > 0) {
      const scheduleRecords = scheduleData.map(week => ({
        league_id: leagueId,
        ...week
      }));

      const { error: scheduleInsertError } = await supabase
        .from('league_schedule')
        .insert(scheduleRecords);

      if (scheduleInsertError) {
        console.error('Supabase schedule error:', scheduleInsertError);
        console.warn('Failed to create league schedule:', scheduleInsertError.message);
      }
    }

    // 如果是 Head-to-Head Fantasy Points 模式，處理權重
    if (settings.general['Scoring Type'] === 'Head-to-Head Fantasy Points' && categoryWeights) {
      // 準備權重記錄
      const weightsToInsert = [];

      // 處理 batter 權重
      if (categoryWeights.batter && typeof categoryWeights.batter === 'object') {
        Object.entries(categoryWeights.batter).forEach(([categoryName, weight]) => {
          weightsToInsert.push({
            league_id: leagueId,
            category_type: 'batter',
            category_name: categoryName,
            weight: parseFloat(weight) || 1.0,
          });
        });
      }

      // 處理 pitcher 權重
      if (categoryWeights.pitcher && typeof categoryWeights.pitcher === 'object') {
        Object.entries(categoryWeights.pitcher).forEach(([categoryName, weight]) => {
          weightsToInsert.push({
            league_id: leagueId,
            category_type: 'pitcher',
            category_name: categoryName,
            weight: parseFloat(weight) || 1.0,
          });
        });
      }

      // 插入權重
      if (weightsToInsert.length > 0) {
        const { error: weightError } = await supabase
          .from('league_stat_category_weights')
          .insert(weightsToInsert);

        if (weightError) {
          console.error('Error inserting weights:', weightError);
          console.warn('Failed to save category weights:', weightError.message);
        }
      }
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
    const { league_id, settings, categoryWeights } = body;

    console.log('\n=== PUT /api/league-settings ===');
    console.log('🔄 League ID:', league_id);
    console.log('📝 Roster Positions (原始):', JSON.stringify(settings.roster['Roster Positions'], null, 2));
    console.log('📝 Batter Stats (原始):', settings.scoring['Batter Stat Categories']);
    console.log('📝 Pitcher Stats (原始):', settings.scoring['Pitcher Stat Categories']);

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    // 檢查 Scoring Type 是否改變
    const { data: currentSettings } = await supabase
      .from('league_settings')
      .select('scoring_type')
      .eq('league_id', league_id)
      .single();

    const oldScoringType = currentSettings?.scoring_type;
    const newScoringType = settings.general['Scoring Type'];

    // 如果 Scoring Type 改變且舊的是 Head-to-Head Fantasy Points，刪除權重
    if (oldScoringType === 'Head-to-Head Fantasy Points' && newScoringType !== 'Head-to-Head Fantasy Points') {
      await supabase
        .from('league_stat_category_weights')
        .delete()
        .eq('league_id', league_id);
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
      // 按預定義順序排列 roster_positions
      roster_positions: sortRosterPositions(settings.roster['Roster Positions']),

      start_scoring_on: settings.scoring['Start Scoring On'],
      // 完全覆盖，无视原有数据，保持前端传来的顺序
      batter_stat_categories: Array.isArray(settings.scoring['Batter Stat Categories']) 
        ? JSON.parse(JSON.stringify(settings.scoring['Batter Stat Categories'])) 
        : [],
      pitcher_stat_categories: Array.isArray(settings.scoring['Pitcher Stat Categories']) 
        ? JSON.parse(JSON.stringify(settings.scoring['Pitcher Stat Categories'])) 
        : [],

      playoffs: settings.playoffs['Playoffs'],
      playoffs_start: settings.playoffs['Playoffs'] === 'No playoffs' ? null : settings.playoffs['Playoffs start'],
      playoff_tie_breaker: settings.playoffs['Playoff/ranking Tie-Breaker'],
      playoff_reseeding: settings.playoffs['Playoffs'] === 'No playoffs' ? null : settings.playoffs['Playoff Reseeding'],
      lock_eliminated_teams: settings.playoffs['Playoffs'] === 'No playoffs' ? null : settings.playoffs['Lock Eliminated Teams'],

      make_league_publicly_viewable: settings.league['Make League Publicly Viewable'],
      invite_permissions: settings.league['Invite Permissions'],
    };

    console.log('✅ Roster Positions (排序後):', JSON.stringify(leagueData.roster_positions, null, 2));
    console.log('✅ Batter Stats (處理後):', leagueData.batter_stat_categories);
    console.log('✅ Pitcher Stats (處理後):', leagueData.pitcher_stat_categories);

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

    // 刪除舊的周次數據
    await supabase
      .from('league_schedule')
      .delete()
      .eq('league_id', league_id);

    // 重新生成並插入周次數據
    const { schedule: scheduleData } = generateLeagueSchedule(
      settings.scoring['Start Scoring On'],
      settings.playoffs['Playoffs start'],
      settings.playoffs['Playoffs']
    );

    if (scheduleData.length > 0) {
      const scheduleRecords = scheduleData.map(week => ({
        league_id: league_id,
        ...week
      }));

      const { error: scheduleInsertError } = await supabase
        .from('league_schedule')
        .insert(scheduleRecords);

      if (scheduleInsertError) {
        console.error('Supabase schedule error:', scheduleInsertError);
        console.warn('Failed to update league schedule:', scheduleInsertError.message);
      }
    }

    // 如果是 Head-to-Head Fantasy Points 模式，處理權重
    if (newScoringType === 'Head-to-Head Fantasy Points' && categoryWeights) {
      // 先刪除舊的權重
      await supabase
        .from('league_stat_category_weights')
        .delete()
        .eq('league_id', league_id);

      // 準備新的權重記錄
      const weightsToInsert = [];

      // 處理 batter 權重
      if (categoryWeights.batter && typeof categoryWeights.batter === 'object') {
        Object.entries(categoryWeights.batter).forEach(([categoryName, weight]) => {
          weightsToInsert.push({
            league_id: league_id,
            category_type: 'batter',
            category_name: categoryName,
            weight: parseFloat(weight) || 1.0,
          });
        });
      }

      // 處理 pitcher 權重
      if (categoryWeights.pitcher && typeof categoryWeights.pitcher === 'object') {
        Object.entries(categoryWeights.pitcher).forEach(([categoryName, weight]) => {
          weightsToInsert.push({
            league_id: league_id,
            category_type: 'pitcher',
            category_name: categoryName,
            weight: parseFloat(weight) || 1.0,
          });
        });
      }

      // 插入新的權重
      if (weightsToInsert.length > 0) {
        const { error: weightError } = await supabase
          .from('league_stat_category_weights')
          .insert(weightsToInsert);

        if (weightError) {
          console.error('Error inserting weights:', weightError);
          console.warn('Failed to save category weights:', weightError.message);
        }
      }
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
