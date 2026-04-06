import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLeagueOverviewData } from '@/lib/getLeagueOverviewData';
import supabaseAdmin from '@/lib/supabaseAdmin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ROSTER_POSITION_ORDER = [
  'C', '1B', '2B', '3B', 'SS', 'MI', 'CI',
  'OF', 'LF', 'CF', 'RF', 'Util',
  'SP', 'RP', 'P',
  'BN', 'Minor',
];

function getTaiwanDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function getInitialDateFromSchedule(schedule) {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return getTaiwanDateString();
  }

  const todayStr = getTaiwanDateString();
  const firstDate = schedule[0].week_start;
  const lastDate = schedule[schedule.length - 1].week_end;

  if (todayStr < firstDate) return firstDate;
  if (todayStr > lastDate) return lastDate;

  const current = schedule.find((week) => todayStr >= week.week_start && todayStr <= week.week_end);
  return current?.week_start && current?.week_end ? todayStr : firstDate;
}

function getCurrentWeekFromSchedule(schedule, gameDate) {
  if (!Array.isArray(schedule) || schedule.length === 0) return 1;

  const target = gameDate || getTaiwanDateString();
  const current = schedule.find((week) => target >= week.week_start && target <= week.week_end);
  if (current) return current.week_number;
  if (target < schedule[0].week_start) return 1;
  return schedule[schedule.length - 1].week_number;
}

function buildPlayerStatMap(rows = [], type = 'batting', leagueSettings = null) {
  const map = {};

  if (type === 'batting') {
    rows.forEach((row) => {
      if (!row.player_id) return;
      map[row.player_id] = {
        player_id: row.player_id,
        player_name: row.player_name,
        time_window: row.time_window,
        r: row.r || 0,
        hr: row.hr || 0,
        rbi: row.rbi || 0,
        sb: row.sb || 0,
        cs: row.cs || 0,
        k: row.k || 0,
        avg: row.avg || 0,
        '1b': row['1b'] || 0,
        '2b': row['2b'] || 0,
        '3b': row['3b'] || 0,
        ab: row.ab || 0,
        bb: row.bb || 0,
        cyc: row.cyc || 0,
        gidp: row.gidp || 0,
        gp: row.gp || 0,
        h: row.h || 0,
        hbp: row.hbp || 0,
        obp: row.obp || 0,
        ops: row.ops || 0,
        pa: row.pa || 0,
        sf: row.sf || 0,
        sh: row.sh || 0,
        slg: row.slg || 0,
        tb: row.tb || 0,
        xbh: row.xbh || 0,
        fp: row.fp,
      };
    });
  } else {
    rows.forEach((row) => {
      if (!row.player_id) return;
      map[row.player_id] = {
        ...row,
      };
    });
  }

  return map;
}

async function getRosterForManager(leagueId, managerId, gameDate) {
  const { data: rosterData, error: rosterError } = await supabaseAdmin
    .from('league_roster_positions')
    .select(`
      *,
      player:player_list (
        player_id,
        name,
        team,
        batter_or_pitcher,
        identity
      )
    `)
    .eq('league_id', leagueId)
    .eq('manager_id', managerId)
    .eq('game_date', gameDate);

  if (rosterError) throw rosterError;

  const [batterPositions, pitcherPositions, realLifeStatus, scheduleData] = await Promise.all([
    supabaseAdmin.from('v_batter_positions').select('player_id, position_list'),
    supabaseAdmin.from('v_pitcher_positions').select('player_id, position_list'),
    supabaseAdmin.from('real_life_player_status').select('player_id, status'),
    supabaseAdmin.from('cpbl_schedule_2026').select('*').eq('date', gameDate).eq('major_game', true),
  ]);

  const positionMap = {};
  (batterPositions.data || []).forEach((bp) => {
    positionMap[bp.player_id] = bp.position_list;
  });
  (pitcherPositions.data || []).forEach((pp) => {
    positionMap[pp.player_id] = pp.position_list;
  });

  const statusMap = {};
  (realLifeStatus.data || []).forEach((row) => {
    statusMap[row.player_id] = row.status;
  });

  const gameMap = {};
  (scheduleData.data || []).forEach((game) => {
    gameMap[game.home] = {
      opponent: game.away,
      is_home: true,
      time: game.time,
      place: game.place || 'Stadium',
      away_team_score: game.away_team_score,
      home_team_score: game.home_team_score,
      is_postponed: game.is_postponed,
    };
    gameMap[game.away] = {
      opponent: game.home,
      is_home: false,
      time: game.time,
      place: game.place || 'Stadium',
      away_team_score: game.away_team_score,
      home_team_score: game.home_team_score,
      is_postponed: game.is_postponed,
    };
  });

  const positionOrder = {
    C: 1, '1B': 2, '2B': 3, '3B': 4, SS: 5, CI: 6, MI: 7, LF: 8, CF: 9, RF: 10, OF: 11,
    Util: 12, SP: 13, RP: 14, P: 15, BN: 16, NA: 17,
  };

  const roster = (rosterData || []).map((item) => {
    const defaultPos = item.player?.batter_or_pitcher === 'pitcher' ? 'P' : 'Util';
    const posList = positionMap[item.player_id] || defaultPos;
    const team = item.player?.team;
    const gameInfo = team ? gameMap[team] : null;

    return {
      ...item,
      name: item.player?.name,
      team,
      position_list: posList,
      batter_or_pitcher: item.player?.batter_or_pitcher,
      identity: item.player?.identity,
      real_life_status: statusMap[item.player_id] || 'UNREGISTERED',
      game_info: gameInfo,
    };
  }).sort((a, b) => (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99));

  return roster;
}

async function getStartingStatus(date) {
  const [lineupRes, pitcherRes] = await Promise.all([
    supabaseAdmin.from('starting_lineup').select('team, player_id, batting_no').eq('date', date),
    supabaseAdmin.from('starting_pitcher').select('player_id').eq('date', date),
  ]);

  if (lineupRes.error) throw lineupRes.error;
  if (pitcherRes.error) throw pitcherRes.error;

  const lineupByPlayerId = {};
  const lineupTeams = new Set();

  (lineupRes.data || []).forEach((row) => {
    if (row.team) lineupTeams.add(row.team);
    if (row.player_id && row.batting_no != null) {
      lineupByPlayerId[String(row.player_id)] = Number(row.batting_no);
    }
  });

  const pitcherPlayerIds = (pitcherRes.data || []).map((row) => String(row.player_id)).filter(Boolean);

  return {
    lineup_by_player_id: lineupByPlayerId,
    lineup_teams: Array.from(lineupTeams),
    pitcher_player_ids: pitcherPlayerIds,
  };
}

async function getWeeklyIp(leagueId, managerId, date) {
  const { data: weekData } = await supabaseAdmin
    .from('league_schedule')
    .select('week_number, week_start, week_end')
    .eq('league_id', leagueId)
    .lte('week_start', date)
    .gte('week_end', date)
    .single();

  if (!weekData) {
    return { ip: 0, weekNumber: null, addCount: 0 };
  }

  const { data: statsData } = await supabaseAdmin
    .from('v_weekly_manager_stats')
    .select('p_ip')
    .eq('league_id', leagueId)
    .eq('manager_id', managerId)
    .eq('week_number', weekData.week_number)
    .single();

  const startTw = new Date(`${weekData.week_start}T00:00:00+08:00`);
  const endTw = new Date(`${weekData.week_end}T23:59:59.999+08:00`);

  const { count: addCount } = await supabaseAdmin
    .from('transactions_2026')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId)
    .eq('manager_id', managerId)
    .in('transaction_type', ['ADD', 'WAIVER ADD'])
    .gte('transaction_time', startTw.toISOString())
    .lte('transaction_time', endTw.toISOString());

  return {
    ip: statsData?.p_ip ?? 0,
    weekNumber: weekData.week_number,
    addCount: addCount || 0,
  };
}

async function getPlayerRosterAndStats(leagueId, gameDate) {
  const [batterStatsRes, pitcherStatsRes, leagueSettingsRes] = await Promise.all([
    supabaseAdmin.from('batting_stats_2026').select('*').eq('is_major', true).eq('game_date', gameDate),
    supabaseAdmin.from('pitching_stats_2026').select('*').eq('is_major', true).eq('game_date', gameDate),
    supabaseAdmin.from('league_settings').select('scoring_type, batter_stat_categories, pitcher_stat_categories').eq('league_id', leagueId).single(),
  ]);

  if (batterStatsRes.error) throw batterStatsRes.error;
  if (pitcherStatsRes.error) throw pitcherStatsRes.error;

  const battingMap = {};
  const battingRaw = batterStatsRes.data || [];
  battingRaw.forEach((row) => {
    const playerId = row.player_id || null;
    if (!playerId) return;
    if (!battingMap[playerId]) {
      battingMap[playerId] = {
        player_id: playerId,
        player_name: row.name,
        time_window: gameDate,
        r: 0, hr: 0, rbi: 0, sb: 0, cs: 0, k: 0, avg: 0, '1b': 0, '2b': 0, '3b': 0, ab: 0, bb: 0, cyc: 0, gidp: 0, gp: 0, h: 0, hbp: 0, obp: 0, ops: 0, pa: 0, sf: 0, sh: 0, slg: 0, tb: 0, xbh: 0,
      };
    }
    const p = battingMap[playerId];
    p.gp += 1;
    p.ab += row.at_bats || 0;
    p.r += row.runs || 0;
    p.h += row.hits || 0;
    p['2b'] += row.doubles || 0;
    p['3b'] += row.triples || 0;
    p.hr += row.home_runs || 0;
    p.rbi += row.rbis || 0;
    p.k += row.strikeouts || 0;
    p.bb += row.walks || 0;
    p.hbp += row.hbp || row.hit_by_pitch || 0;
    p.sh += row.sacrifice_bunts || 0;
    p.sf += row.sacrifice_flies || 0;
    p.sb += row.stolen_bases || 0;
    p.cs += row.caught_stealing || 0;
    p.gidp += row.double_plays || 0;
    p['1b'] += Math.max(0, (row.hits || 0) - (row.doubles || 0) - (row.triples || 0) - (row.home_runs || 0));
    p.xbh += (row.doubles || 0) + (row.triples || 0) + (row.home_runs || 0);
    p.tb += p['1b'] + (p['2b'] * 2) + (p['3b'] * 3) + (p.hr * 4);
    p.pa += p.ab + p.bb + p.hbp + p.sf + p.sh;
    p.avg = p.ab ? Number((p.h / p.ab).toFixed(3)) : 0;
    const obpDen = p.ab + p.bb + p.hbp + p.sf;
    p.obp = obpDen ? Number(((p.h + p.bb + p.hbp) / obpDen).toFixed(3)) : 0;
    p.slg = p.ab ? Number((p.tb / p.ab).toFixed(3)) : 0;
    p.ops = Number((p.obp + p.slg).toFixed(3));
    p.cyc = (p['1b'] >= 1 && p['2b'] >= 1 && p['3b'] >= 1 && p.hr >= 1) ? 1 : 0;
  });

  const pitchingMap = {};
  const pitchingRaw = pitcherStatsRes.data || [];
  pitchingRaw.forEach((row) => {
    const playerId = row.player_id || null;
    if (!playerId) return;
    if (!pitchingMap[playerId]) {
      pitchingMap[playerId] = {
        player_id: playerId,
        player_name: row.name,
        time_window: gameDate,
        app: 0, gs: 0, rapp: 0, ip: 0, out: 0, tbf: 0, pc: 0, w: 0, l: 0, hld: 0, sv: 0, 'sv+hld': 0, rw: 0, rl: 0, h: 0, hr: 0, k: 0, bb: 0, ibb: 0, hbp: 0, ra: 0, er: 0, qs: 0, cg: 0, sho: 0, pg: 0, nh: 0, era: 0, whip: 0, 'win%': 0, 'k/9': 0, 'bb/9': 0, 'k/bb': 0, 'h/9': 0, obpa: 0,
      };
    }
    const p = pitchingMap[playerId];
    const isStarter = row.position === 'SP';
    const isReliever = row.position === 'RP' || row.position === 'MR' || row.position === 'CL';
    const isWin = row.record === 'W';
    const isLoss = row.record === 'L';
    const rawIP = row.innings_pitched || 0;
    const outs = Math.floor(rawIP) * 3 + Math.round((rawIP % 1) * 10);
    p.app += 1;
    p.gs += isStarter ? 1 : 0;
    p.rapp += isReliever ? 1 : 0;
    p.ip += rawIP;
    p.out += outs;
    p.tbf += row.batters_faced || 0;
    p.pc += row.pitches_thrown || 0;
    if (isWin) p.w += 1;
    if (isLoss) p.l += 1;
    if (row.record === 'HLD') p.hld += 1;
    if (row.record === 'SV') p.sv += 1;
    if (isWin && isReliever) p.rw += 1;
    if (isLoss && isReliever) p.rl += 1;
    p['sv+hld'] = p.sv + p.hld;
    p.h += row.hits_allowed || 0;
    p.hr += row.home_runs_allowed || 0;
    p.k += row.strikeouts || 0;
    p.bb += row.walks || 0;
    p.ibb += row.ibb || 0;
    p.hbp += row.hbp || 0;
    p.ra += row.runs_allowed || 0;
    p.er += row.earned_runs || 0;
    if (rawIP >= 6 && (row.earned_runs || 0) <= 3) p.qs += 1;
    const isCG = row.complete_game === 1;
    if (isCG) {
      p.cg += 1;
      if ((row.runs_allowed || 0) === 0) p.sho += 1;
      if ((row.hits_allowed || 0) === 0) {
        p.nh += 1;
        if ((row.walks || 0) === 0 && (row.hbp || 0) === 0) p.pg += 1;
      }
    }
  });

  const battingStats = Object.values(battingMap);
  const pitchingStats = Object.values(pitchingMap);
  return { battingStats, pitchingStats, leagueSettings: leagueSettingsRes.data || null };
}

async function getPlayersBootstrap() {
  const [playersRes, batterPosRes, pitcherPosRes, realStatusRes, rosterRes, leagueRes, testLeagueRes, leagueStatusRes] = await Promise.all([
    supabaseAdmin.from('player_list').select('*').order('add_date', { ascending: false }),
    supabaseAdmin.from('v_batter_positions').select('player_id, position_list'),
    supabaseAdmin.from('v_pitcher_positions').select('player_id, position_list'),
    supabaseAdmin.from('real_life_player_status').select('player_id, status'),
    supabaseAdmin.from('league_player_ownership').select('player_id, league_id').ilike('status', 'on team'),
    supabaseAdmin.from('league_settings').select('league_id'),
    supabaseAdmin.from('test_league').select('league_id'),
    supabaseAdmin.from('league_statuses').select('league_id, status'),
  ]);

  const positionMap = {};
  (batterPosRes.data || []).forEach((row) => { positionMap[row.player_id] = row.position_list; });
  (pitcherPosRes.data || []).forEach((row) => { positionMap[row.player_id] = row.position_list; });

  const statusMap = {};
  (realStatusRes.data || []).forEach((row) => { statusMap[row.player_id] = row.status; });

  const testLeagueIds = new Set((testLeagueRes.data || []).map((t) => t.league_id));
  const activeLeagueIds = new Set((leagueStatusRes.data || []).filter((row) => row.status !== 'pre-draft' && row.status !== 'drafting now').map((row) => row.league_id));
  const totalLeagues = (leagueRes.data || []).filter((l) => !testLeagueIds.has(l.league_id) && activeLeagueIds.has(l.league_id)).length;

  const rosterPercentageMap = {};
  if (rosterRes.data && totalLeagues > 0) {
    const playerLeagueMap = {};
    rosterRes.data.forEach((row) => {
      if (testLeagueIds.has(row.league_id)) return;
      if (!activeLeagueIds.has(row.league_id)) return;
      if (!playerLeagueMap[row.player_id]) playerLeagueMap[row.player_id] = new Set();
      playerLeagueMap[row.player_id].add(row.league_id);
    });
    Object.entries(playerLeagueMap).forEach(([playerId, leagues]) => {
      rosterPercentageMap[playerId] = Math.round((leagues.size / totalLeagues) * 100);
    });
  }

  const players = (playersRes.data || []).map((player) => ({
    ...player,
    position_list: positionMap[player.player_id] || null,
    real_life_status: statusMap[player.player_id] || 'UNREGISTERED',
    roster_percentage: rosterPercentageMap[player.player_id] ?? 0,
  }));

  return { players, rosterPercentageMap };
}

async function getTransactionsBootstrap(leagueId, managerId) {
  const [transRes, waiverRes, membersRes, watchedRes] = await Promise.all([
    supabaseAdmin
      .from('transactions_2026')
      .select('*')
      .eq('league_id', leagueId)
      .order('transaction_time', { ascending: false }),
    supabaseAdmin
      .from('waiver_claims')
      .select('*')
      .eq('league_id', leagueId)
      .not('status', 'in', '("pending","canceled")')
      .lte('off_waiver', new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('updated_at', { ascending: false }),
    supabaseAdmin
      .from('league_members')
      .select('manager_id, nickname')
      .eq('league_id', leagueId),
    supabaseAdmin
      .from('watched_players')
      .select('player_id')
      .eq('league_id', leagueId)
      .eq('manager_id', managerId),
  ]);

  if (transRes.error) throw transRes.error;
  if (waiverRes.error) throw waiverRes.error;
  if (membersRes.error) throw membersRes.error;
  if (watchedRes.error) throw watchedRes.error;

  const playerIds = new Set();
  transRes.data.forEach((t) => { if (t.player_id) playerIds.add(t.player_id); });
  waiverRes.data.forEach((w) => {
    if (w.player_id) playerIds.add(w.player_id);
    if (w.drop_player_id) playerIds.add(w.drop_player_id);
  });

  const memberMap = {};
  membersRes.data.forEach((m) => { memberMap[m.manager_id] = m.nickname; });

  let playerMap = {};
  if (playerIds.size > 0) {
    const ids = Array.from(playerIds);
    const [playersRes, batterPosRes, pitcherPosRes] = await Promise.all([
      supabaseAdmin.from('player_list').select('player_id, name, batter_or_pitcher, team').in('player_id', ids),
      supabaseAdmin.from('v_batter_positions').select('player_id, position_list').in('player_id', ids),
      supabaseAdmin.from('v_pitcher_positions').select('player_id, position_list').in('player_id', ids),
    ]);

    const posMap = {};
    (batterPosRes.data || []).forEach((row) => { posMap[row.player_id] = row.position_list; });
    (pitcherPosRes.data || []).forEach((row) => { posMap[row.player_id] = row.position_list; });

    (playersRes.data || []).forEach((player) => {
      playerMap[player.player_id] = {
        ...player,
        position_list: posMap[player.player_id],
      };
    });
  }

  return {
    transactions: (transRes.data || []).map((t) => ({
      ...t,
      player: playerMap[t.player_id] || { name: 'Unknown' },
      manager: { nickname: memberMap[t.manager_id] || 'Unknown' },
    })),
    waivers: (waiverRes.data || []).map((w) => ({
      ...w,
      player: playerMap[w.player_id] || { name: 'Unknown' },
      drop_player: w.drop_player_id ? (playerMap[w.drop_player_id] || { name: 'Unknown' }) : null,
      manager: { nickname: memberMap[w.manager_id] || 'Unknown' },
    })),
    watchedIds: (watchedRes.data || []).map((row) => row.player_id),
    pendingTradeCount: null,
    activeTradePlayerIds: [],
  };
}

function sortRosterPositions(positions) {
  if (!positions || typeof positions !== 'object') return positions;

  const sorted = {};
  ROSTER_POSITION_ORDER.forEach((pos) => {
    if (Object.prototype.hasOwnProperty.call(positions, pos)) {
      sorted[pos] = positions[pos];
    }
  });

  Object.keys(positions).forEach((pos) => {
    if (!Object.prototype.hasOwnProperty.call(sorted, pos)) {
      sorted[pos] = positions[pos];
    }
  });

  return sorted;
}

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Please login first' }, { status: 401 });
    }

    const [overview, settingsRes] = await Promise.all([
      getLeagueOverviewData(supabase, leagueId),
      supabase
        .from('league_settings')
        .select('*')
        .eq('league_id', leagueId)
        .single(),
    ]);

    if (settingsRes.error || !settingsRes.data) {
      return NextResponse.json(
        { success: false, error: settingsRes.error?.message || 'League settings not found' },
        { status: 404 }
      );
    }

    const settings = { ...settingsRes.data };
    if (settings.roster_positions) {
      settings.roster_positions = sortRosterPositions(settings.roster_positions);
    }

    const initialSelectedDate = getInitialDateFromSchedule(overview.schedule);
    const managerId = userId;
    const currentWeek = getCurrentWeekFromSchedule(overview.schedule, initialSelectedDate);

    const [roster, startingStatus, weeklyIp, playersBootstrap, dailyStats, transactionsBootstrap, pendingTradeCountRes] = await Promise.all([
      getRosterForManager(leagueId, managerId, initialSelectedDate),
      getStartingStatus(initialSelectedDate),
      getWeeklyIp(leagueId, managerId, initialSelectedDate),
      getPlayersBootstrap(),
      getPlayerRosterAndStats(leagueId, initialSelectedDate),
      getTransactionsBootstrap(leagueId, managerId),
      supabaseAdmin
        .from('pending_trade')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', leagueId)
        .in('status', ['pending', 'accepted'])
        .or(`initiator_manager_id.eq.${managerId},recipient_manager_id.eq.${managerId}`),
    ]);

    if (pendingTradeCountRes.error) {
      throw pendingTradeCountRes.error;
    }

    const activeTradePlayerIds = new Set();
    const pendingTradeCount = pendingTradeCountRes.count || 0;
    // Treat all active trade players as locked for now.
    (transactionsBootstrap.transactions || []).forEach((trade) => {
      const status = String(trade.status || '').toLowerCase();
      if (status === 'pending' || status === 'accepted') {
        (trade.initiator_player_ids || []).forEach((id) => activeTradePlayerIds.add(id));
        (trade.recipient_player_ids || []).forEach((id) => activeTradePlayerIds.add(id));
      }
    });

    return NextResponse.json({
      success: true,
      apiIntegrationBeta: true,
      overview,
      settings,
      initialSelectedDate,
      currentWeek,
      roster,
      rosterPercentageMap: playersBootstrap.rosterPercentageMap,
      players: playersBootstrap.players,
      startingStatus,
      weeklyIP: weeklyIp.ip,
      weeklyAddCount: weeklyIp.addCount,
      playerStats: {
        ...buildPlayerStatMap(dailyStats.battingStats, 'batting', dailyStats.leagueSettings),
        ...buildPlayerStatMap(dailyStats.pitchingStats, 'pitching', dailyStats.leagueSettings),
      },
      dailyStatsForTotals: {
        ...buildPlayerStatMap(dailyStats.battingStats, 'batting', dailyStats.leagueSettings),
        ...buildPlayerStatMap(dailyStats.pitchingStats, 'pitching', dailyStats.leagueSettings),
      },
      transactions: transactionsBootstrap.transactions,
      waivers: transactionsBootstrap.waivers,
      watchedIds: transactionsBootstrap.watchedIds,
      activeTradePlayerIds: Array.from(activeTradePlayerIds),
      pendingTradeCount,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode === 404) {
      return NextResponse.json(
        { success: false, error: 'League not found', details: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: statusCode }
    );
  }
}
