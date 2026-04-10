'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

function toAbbr(team) {
    switch (team) {
        case '統一獅': return 'UL';
        case '富邦悍將': return 'FG';
        case '樂天桃猿': return 'RM';
        case '中信兄弟': return 'B';
        case '味全龍': return 'W';
        case '台鋼雄鷹': return 'TSG';
        default: return team || '';
    }
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    try {
        if (timeStr.includes('T') || (timeStr.length > 5 && timeStr.includes('-') && !timeStr.startsWith('0'))) {
            const dt = new Date(timeStr);
            if (!isNaN(dt.getTime())) {
                const h = String(dt.getHours()).padStart(2, '0');
                const m = String(dt.getMinutes()).padStart(2, '0');
                return `${h}:${m}`;
            }
        }
        return timeStr.substring(0, 5);
    } catch {
        return timeStr.substring(0, 5);
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
}

export default function AdminLeagueRostersPage() {
    const params = useParams();
    const router = useRouter();
    const leagueId = params.leagueId;

    const [members, setMembers] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedManagerId, setSelectedManagerId] = useState('');
    const [rosterData, setRosterData] = useState({ batters: [], pitchers: [] });
    const [actualDate, setActualDate] = useState('');
    const [loading, setLoading] = useState(false);

    // Stats state keyed by player_id (fallback: player_name)
    const [playerStats, setPlayerStats] = useState({});
    const [statsLoading, setStatsLoading] = useState(false);
    const [batterStatCategories, setBatterStatCategories] = useState([]);
    const [pitcherStatCategories, setPitcherStatCategories] = useState([]);
    const [scoringType, setScoringType] = useState('');

    // Date Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const dateControlRef = useRef(null);
    const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });

    // Fetch schedule (for availableDates) + league settings on mount
    useEffect(() => {
        if (!leagueId) return;
        const fetchInit = async () => {
            try {
                // Schedule → availableDates (using main app api)
                const schedRes = await fetch(`/api/league/${leagueId}`);
                const schedData = await schedRes.json();
                if (schedData.success && schedData.schedule) {
                    const dates = [];
                    schedData.schedule.forEach(week => {
                        const start = new Date(week.week_start);
                        const end = new Date(week.week_end);
                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                            dates.push(new Date(d).toISOString().split('T')[0]);
                        }
                    });
                    setAvailableDates(dates);

                    // Init selectedDate → today (Taiwan) clamped to season
                    if (dates.length > 0) {
                        const taiwanNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
                        const todayStr = taiwanNow.toISOString().split('T')[0];
                        if (dates.includes(todayStr)) setSelectedDate(todayStr);
                        else if (todayStr < dates[0]) setSelectedDate(dates[0]);
                        else setSelectedDate(dates[dates.length - 1]);
                    }
                }
            } catch (e) { console.error('Failed to fetch schedule:', e); }

            try {
                // League settings → stat categories
                const settRes = await fetch(`/api/league-settings?league_id=${leagueId}`);
                const settData = await settRes.json();
                if (settData.success && settData.data) {
                    setBatterStatCategories(settData.data.batter_stat_categories || []);
                    setPitcherStatCategories(settData.data.pitcher_stat_categories || []);
                    setScoringType(settData.data.scoring_type || '');
                }
            } catch (e) { console.error('Failed to fetch league settings:', e); }
        };
        fetchInit();
    }, [leagueId]);

    // Fetch members initially
    useEffect(() => {
        if (!leagueId) return;
        const fetchMembers = async () => {
            try {
                // Fetch members (can use the new admin roster endpoint or a separate one)
                const res = await fetch(`/api/admin/leagues/${leagueId}/rosters`);
                const data = await res.json();
                if (data.success && data.members) {
                    setMembers(data.members);
                }
            } catch (e) { console.error('Failed to fetch members:', e); }
        }
        fetchMembers();
    }, [leagueId]);

    // Fetch Roster
    useEffect(() => {
        const fetchRoster = async () => {
            if (!leagueId || !selectedManagerId || !selectedDate) {
                setRosterData({ batters: [], pitchers: [] });
                setActualDate('');
                return;
            }

            setLoading(true);
            try {
                // Use our new admin endpoint providing manager_id
                const response = await fetch(`/api/admin/leagues/${leagueId}/rosters?manager_id=${selectedManagerId}&game_date=${selectedDate}`);
                const data = await response.json();

                if (data.success) {
                    const sortedRoster = data.roster || [];
                    setActualDate(data.date || selectedDate);

                    const batterPos = ['C', '1B', '2B', '3B', 'SS', 'CI', 'MI', 'LF', 'CF', 'RF', 'OF', 'Util'];
                    const pitcherPos = ['SP', 'RP', 'P'];
                    const pRoster = [];
                    const bRoster = [];

                    sortedRoster.forEach(item => {
                        const isPitcherPos = pitcherPos.includes(item.position);
                        const isBatterPos = batterPos.includes(item.position);
                        if (isPitcherPos) pRoster.push(item);
                        else if (isBatterPos) bRoster.push(item);
                        else if (item.batter_or_pitcher === 'pitcher') pRoster.push(item);
                        else bRoster.push(item);
                    });

                    setRosterData({ batters: bRoster, pitchers: pRoster });
                }
            } catch (error) {
                console.error('Error fetching daily roster:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRoster();
    }, [leagueId, selectedManagerId, selectedDate]);

    // Fetch stats — always use daily APIs for per-day data
    useEffect(() => {
        if (!selectedManagerId || !selectedDate) {
            setPlayerStats({});
            return;
        }

        const fetchStats = async () => {
            setStatsLoading(true);
            try {
                const statsMap = {};
                const [batterRes, pitcherRes] = await Promise.all([
                    fetch('/api/playerStats/daily-batting', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: selectedDate, league_id: leagueId })
                    }),
                    fetch('/api/playerStats/daily-pitching', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: selectedDate, league_id: leagueId })
                    })
                ]);
                const batterData = await batterRes.json();
                const pitcherData = await pitcherRes.json();
                if (Array.isArray(batterData)) {
                    batterData.forEach((s) => {
                        if (s.player_id) statsMap[String(s.player_id)] = s;
                        else if (s.player_name) statsMap[s.player_name] = s;
                    });
                }
                if (Array.isArray(pitcherData)) {
                    pitcherData.forEach((s) => {
                        if (s.player_id) statsMap[String(s.player_id)] = s;
                        else if (s.player_name) statsMap[s.player_name] = s;
                    });
                }
                setPlayerStats(statsMap);
            } catch (e) {
                console.error('Failed to fetch stats:', e);
                setPlayerStats({});
            } finally {
                setStatsLoading(false);
            }
        };
        fetchStats();
    }, [selectedManagerId, selectedDate]);

    const handleDateChange = (days) => {
        const currentIdx = availableDates.indexOf(selectedDate);
        if (currentIdx === -1) return;
        const nextIdx = currentIdx + days;
        if (nextIdx >= 0 && nextIdx < availableDates.length) {
            setSelectedDate(availableDates[nextIdx]);
        }
    };

    const canGoPrev = availableDates.length > 0 && selectedDate !== availableDates[0];
    const canGoNext = availableDates.length > 0 && selectedDate !== availableDates[availableDates.length - 1];

    const getTeamColor = (team) => {
        switch (team) {
            case '統一獅': return 'text-orange-400';
            case '富邦悍將': return 'text-blue-400';
            case '台鋼雄鷹': return 'text-green-400';
            case '味全龍': return 'text-red-400';
            case '樂天桃猿': return 'text-rose-400';
            case '中信兄弟': return 'text-yellow-400';
            default: return 'text-slate-400';
        }
    };

    const parseStatKey = (cat) => {
        const matches = cat.match(/\(([^)]+)\)/g);
        return matches ? matches[matches.length - 1].replace(/[()]/g, '') : cat;
    };

    const getStatValue = (player, statKey) => {
        if (!player) return '-';
        const row = playerStats[String(player.player_id)] || playerStats[player.name];
        if (!row) return '-';
        const key = parseStatKey(statKey).toLowerCase();
        const val = row[key];
        if (val === undefined || val === null) return '-';
        if (key === 'fp') {
            const parsed = Number(val);
            return Number.isFinite(parsed) ? parsed.toFixed(2) : '-';
        }
        if (Number(val) === 0) return <span className="text-slate-600">0</span>;
        return val;
    };

    const isFantasyPoints = scoringType === 'Head-to-Head Fantasy Points';

    const displayBatterCats = (() => {
        const base = batterStatCategories.length > 0 && !batterStatCategories.some(c => parseStatKey(c) === 'AB')
            ? ['At Bats (AB)', ...batterStatCategories]
            : batterStatCategories;
        return isFantasyPoints ? ['Fantasy Points (FP)', ...base] : base;
    })();

    const displayPitcherCats = (() => {
        const base = pitcherStatCategories.length > 0 && !pitcherStatCategories.some(c => parseStatKey(c) === 'IP')
            ? ['Innings Pitched (IP)', ...pitcherStatCategories]
            : pitcherStatCategories;
        return isFantasyPoints ? ['Fantasy Points (FP)', ...base] : base;
    })();

    const parseBaseballIpToOuts = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return null;
        return Math.floor(parsed) * 3 + Math.round((parsed % 1) * 10);
    };

    const formatOutsToIp = (outs) => {
        const safeOuts = Number.isFinite(outs) ? outs : 0;
        return `${Math.floor(safeOuts / 3)}.${safeOuts % 3}`;
    };

    const formatCategoryTotal = (abbr, value) => {
        if (value === 'INF') return 'INF';
        if (abbr === 'IP') return formatOutsToIp(value);
        if (abbr === 'FP') return Number(value || 0).toFixed(2);

        const threeDecimals = new Set(['AVG', 'OBP', 'SLG', 'OPS', 'OBPA', 'WIN%']);
        const twoDecimals = new Set(['ERA', 'WHIP', 'K/9', 'BB/9', 'K/BB', 'H/9']);

        if (threeDecimals.has(abbr)) return Number(value || 0).toFixed(3);
        if (twoDecimals.has(abbr)) return Number(value || 0).toFixed(2);

        const rounded = Math.round(Number(value || 0));
        return Math.abs(Number(value || 0) - rounded) < 0.000001 ? String(rounded) : Number(value || 0).toFixed(2);
    };

    const isStarterSlot = (position) => {
        const slot = String(position || '').toUpperCase();
        return slot !== 'BN' && slot !== 'NA';
    };

    const computeCategoryTotals = (players, categories) => {
        const validPlayers = (players || []).filter(
            (p) => p && p.player_id && p.player_id !== 'empty' && isStarterSlot(p.position)
        );

        const sums = {
            gp: 0, pa: 0, ab: 0, h: 0, bb: 0, hbp: 0, sh: 0, sf: 0, tb: 0,
            ['1b']: 0, ['2b']: 0, ['3b']: 0, xbh: 0, cyc: 0,
            er: 0, k: 0, tbf: 0, w: 0, l: 0,
            fp: 0, r: 0, hr: 0, rbi: 0, sb: 0, cs: 0, gidp: 0,
            app: 0, gs: 0, rapp: 0, pc: 0, sv: 0, hld: 0, rw: 0, rl: 0, ra: 0,
            hr_p: 0, bb_p: 0, ibb: 0, hbp_p: 0, qs: 0, cg: 0, sho: 0, pg: 0, nh: 0,
            outs: 0,
        };

        const addNum = (field, raw) => {
            const num = Number(raw);
            if (Number.isFinite(num)) sums[field] += num;
        };

        validPlayers.forEach((p) => {
            const row = playerStats[String(p.player_id)] || playerStats[p.name];
            if (!row) return;

            addNum('gp', row.gp);
            addNum('pa', row.pa);
            addNum('ab', row.ab);
            addNum('h', row.h);
            addNum('bb', row.bb);
            addNum('hbp', row.hbp);
            addNum('sh', row.sh);
            addNum('sf', row.sf);
            addNum('tb', row.tb);
            addNum('1b', row['1b']);
            addNum('2b', row['2b']);
            addNum('3b', row['3b']);
            addNum('xbh', row.xbh);
            addNum('cyc', row.cyc);

            addNum('er', row.er);
            addNum('k', row.k);
            addNum('tbf', row.tbf);
            addNum('w', row.w);
            addNum('l', row.l);

            addNum('fp', row.fp);
            addNum('r', row.r);
            addNum('hr', row.hr);
            addNum('rbi', row.rbi);
            addNum('sb', row.sb);
            addNum('cs', row.cs);
            addNum('gidp', row.gidp);
            addNum('app', row.app);
            addNum('gs', row.gs);
            addNum('rapp', row.rapp);
            addNum('pc', row.pc);
            addNum('sv', row.sv);
            addNum('hld', row.hld);
            addNum('rw', row.rw);
            addNum('rl', row.rl);
            addNum('ra', row.ra);
            addNum('hr_p', row.hr);
            addNum('bb_p', row.bb);
            addNum('ibb', row.ibb);
            addNum('hbp_p', row.hbp);
            addNum('qs', row.qs);
            addNum('cg', row.cg);
            addNum('sho', row.sho);
            addNum('pg', row.pg);
            addNum('nh', row.nh);

            const outsRaw = row.out ?? row.outs;
            if (outsRaw !== undefined && outsRaw !== null && outsRaw !== '') {
                addNum('outs', outsRaw);
            } else {
                const parsedOuts = parseBaseballIpToOuts(row.ip);
                if (Number.isFinite(parsedOuts)) sums.outs += parsedOuts;
            }
        });

        const ip = sums.outs / 3;

        const resolveValue = (key) => {
            switch (key) {
                case 'avg': return sums.ab > 0 ? (sums.h / sums.ab) : 0;
                case 'obp': {
                    const den = sums.ab + sums.bb + sums.hbp + sums.sf;
                    return den > 0 ? ((sums.h + sums.bb + sums.hbp) / den) : 0;
                }
                case 'slg': return sums.ab > 0 ? (sums.tb / sums.ab) : 0;
                case 'ops': {
                    const den = sums.ab + sums.bb + sums.hbp + sums.sf;
                    const obp = den > 0 ? ((sums.h + sums.bb + sums.hbp) / den) : 0;
                    const slg = sums.ab > 0 ? (sums.tb / sums.ab) : 0;
                    return obp + slg;
                }
                case 'era': return ip > 0 ? ((9 * sums.er) / ip) : 0;
                case 'whip': return ip > 0 ? ((sums.bb_p + sums.h) / ip) : 0;
                case 'k/9': return ip > 0 ? ((9 * sums.k) / ip) : 0;
                case 'bb/9': return ip > 0 ? ((9 * sums.bb_p) / ip) : 0;
                case 'h/9': return ip > 0 ? ((9 * sums.h) / ip) : 0;
                case 'k/bb':
                    if (sums.bb_p === 0) return sums.k > 0 ? 'INF' : 0;
                    return sums.k / sums.bb_p;
                case 'obpa': return sums.tbf > 0 ? ((sums.h + sums.bb_p + sums.hbp_p) / sums.tbf) : 0;
                case 'win%': return (sums.w + sums.l) > 0 ? (sums.w / (sums.w + sums.l)) : 0;
                case 'sv+hld': return sums.sv + sums.hld;
                case 'ip': return sums.outs;
                case 'out': return sums.outs;
                case 'outs': return sums.outs;
                default: {
                    const raw = Number(
                        key === 'hr' ? sums.hr :
                            key === 'bb' ? sums.bb :
                                key === 'hbp' ? sums.hbp :
                                    key === 'r' ? sums.r :
                                        key === 'rbi' ? sums.rbi :
                                            key === 'sb' ? sums.sb :
                                                key === 'cs' ? sums.cs :
                                                    key === 'gidp' ? sums.gidp :
                                                        key === 'gp' ? sums.gp :
                                                            key === 'pa' ? sums.pa :
                                                                key === '1b' ? sums['1b'] :
                                                                    key === '2b' ? sums['2b'] :
                                                                        key === '3b' ? sums['3b'] :
                                                                            key === 'xbh' ? sums.xbh :
                                                                                key === 'sh' ? sums.sh :
                                                                                    key === 'cyc' ? sums.cyc :
                                                                                        key === 'ab' ? sums.ab :
                                                                                            key === 'app' ? sums.app :
                                                                                                key === 'gs' ? sums.gs :
                                                                                                    key === 'rapp' ? sums.rapp :
                                                                                                        key === 'pc' ? sums.pc :
                                                                                                            key === 'w' ? sums.w :
                                                                                                                key === 'l' ? sums.l :
                                                                                                                    key === 'sv' ? sums.sv :
                                                                                                                        key === 'hld' ? sums.hld :
                                                                                                                            key === 'rw' ? sums.rw :
                                                                                                                                key === 'rl' ? sums.rl :
                                                                                                                                    key === 'ra' ? sums.ra :
                                                                                                                                        key === 'er' ? sums.er :
                                                                                                                                            key === 'ibb' ? sums.ibb :
                                                                                                                                                key === 'qs' ? sums.qs :
                                                                                                                                                    key === 'cg' ? sums.cg :
                                                                                                                                                        key === 'sho' ? sums.sho :
                                                                                                                                                            key === 'pg' ? sums.pg :
                                                                                                                                                                key === 'nh' ? sums.nh :
                                                                                                                                                                    key === 'fp' ? sums.fp :
                                                                                                                                                                        (sums[key] || 0)
                    );
                    return Number.isFinite(raw) ? raw : 0;
                }
            }
        };

        return (categories || []).map((cat) => {
            const abbr = parseStatKey(cat);
            const key = abbr.toLowerCase();
            const computed = resolveValue(key);

            return {
                abbr,
                value: formatCategoryTotal(abbr, computed)
            };
        });
    };

    const batterCategoryTotals = computeCategoryTotals(rosterData.batters, displayBatterCats);
    const pitcherCategoryTotals = computeCategoryTotals(rosterData.pitchers, displayPitcherCats);


    const renderPlayerRow = (p) => {
        const isEmpty = !p.player_id || p.player_id === 'empty';
        const name = p.name || (isEmpty ? 'Empty' : 'Unknown');
        const teamAbbr = toAbbr(p.team);
        const isPitcher = p.batter_or_pitcher === 'pitcher' || ['SP', 'RP', 'P'].includes(p.position);
        const statCats = isPitcher ? pitcherStatCategories : batterStatCategories;

        // Game info
        let gameInfoEl = null;
        if (!isEmpty && p.game_info) {
            if (p.game_info.is_postponed) {
                gameInfoEl = <span className="text-[11px] text-red-400 font-bold flex-shrink-0 ml-1">PPD</span>;
            } else if (p.game_info.away_team_score != null && p.game_info.home_team_score != null) {
                const myScore = p.game_info.is_home ? p.game_info.home_team_score : p.game_info.away_team_score;
                const oppScore = p.game_info.is_home ? p.game_info.away_team_score : p.game_info.home_team_score;
                const result = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
                const resultColor = result === 'W' ? 'text-green-400' : result === 'L' ? 'text-red-400' : 'text-cyan-300';
                const vsAt = p.game_info.is_home ? 'vs' : '@';
                const opp = p.game_info.opponent || '';
                gameInfoEl = (
                    <span className="flex items-center gap-1 flex-shrink-0 ml-1 font-mono text-[11px]">
                        <span className={`font-bold ${resultColor}`}>{myScore}:{oppScore} {result}</span>
                        <span className="text-cyan-400">{vsAt}</span>
                        <span className="text-cyan-400 font-bold">{opp}</span>
                    </span>
                );
            } else {
                const timeStr = formatTime(p.game_info.time);
                const vsAt = p.game_info.is_home ? 'vs' : '@';
                const opp = p.game_info.opponent || '';

                // Check if game date differs from selected date (cross-day game)
                let datePrefix = '';
                if (p.game_info.time) {
                    try {
                        const gameDate = new Date(p.game_info.time);
                        const gameDateStr = gameDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
                        if (gameDateStr !== selectedDate) {
                            const month = gameDate.getMonth() + 1;
                            const day = gameDate.getDate();
                            datePrefix = `${month}/${day} `;
                        }
                    } catch (e) { }
                }

                gameInfoEl = (
                    <span className="flex items-center gap-1 flex-shrink-0 ml-1 text-cyan-400 font-mono text-[11px]">
                        {datePrefix && <span>{datePrefix}</span>}
                        <span className="font-bold">{timeStr}</span>
                        <span>{vsAt}</span>
                        <span className="font-bold">{opp}</span>
                    </span>
                );
            }
        } else if (!isEmpty && !p.game_info) {
            gameInfoEl = <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">No game</span>;
        }

        // Stats
        const displayCats = isPitcher ? displayPitcherCats : displayBatterCats;

        const statsRow = !isEmpty && displayCats.length > 0 ? (
            <div className="overflow-x-auto mt-1.5 pb-0.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
                <div className="flex items-end gap-x-4 flex-nowrap min-w-max">
                    {displayCats.map((cat) => {
                        const abbr = parseStatKey(cat);
                        const val = getStatValue(p, cat);
                        const isZeroOrDash = val === '-' || val === 0 || val === '0';
                        const isFp = abbr === 'FP';
                        const isForced = !statCats.includes(cat);
                        return (
                            <div key={abbr} className="flex flex-col items-center flex-shrink-0">
                                <span className={`text-[9px] font-semibold leading-none tracking-wide ${isFp ? 'text-amber-300' : isForced ? 'text-slate-600' : 'text-slate-500'}`}>{abbr}</span>
                                <span className={`text-xs font-mono font-bold leading-tight mt-0.5 ${isFp ? 'text-amber-300' : isForced ? 'text-slate-500' : (isZeroOrDash ? 'text-slate-600' : 'text-cyan-200')}`}>{val}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        ) : null;

        return (
            <div key={p.id || `empty-${p.position}-${Math.random()}`} className="py-2.5 border-b border-white/5 last:border-0 hover:bg-white/15 px-2 transition-colors">
                <div className="flex items-start gap-3">
                    {/* Position badge */}
                    <span className={`w-8 flex-shrink-0 text-center text-xs font-bold mt-0.5 ${['BN', 'NA', 'IL'].includes(p.position) ? 'text-slate-500' : 'text-purple-400'}`}>
                        {p.position}
                    </span>

                    <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                        {/* Row 1: Name + Team + Game Info */}
                        <div className="flex items-center gap-1 flex-wrap">
                            <span className={`text-sm font-bold ${isEmpty ? 'text-slate-600 italic' : 'text-slate-100 cursor-pointer hover:text-purple-300 transition-colors'}`}>
                                {name}
                            </span>
                            {!isEmpty && p.team && (
                                <span className={`${getTeamColor(p.team)} font-bold text-[10px] flex-shrink-0`}>{teamAbbr}</span>
                            )}
                            {gameInfoEl}
                        </div>

                        {/* Row 2: Stats with horizontal scroll */}
                        {statsLoading && !isEmpty ? (
                            <div className="text-[9px] text-slate-600 italic mt-1">Loading...</div>
                        ) : statsRow}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-6 lg:p-8 space-y-8 animate-fadeIn max-w-[1600px] mx-auto">
            <div className="bg-gradient-to-br from-slate-800/80 to-purple-800/40 backdrop-blur-md rounded-3xl border border-white/5 p-4 sm:p-6 shadow-xl w-full relative">
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
                    Admin Roster Overview
                </h3>

                {/* Controls — Date + Manager on same row */}
                <div className="flex items-center gap-2 mb-6">
                    {/* Date Selector */}
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-white/10 flex-shrink-0" ref={dateControlRef}>
                        <button onClick={() => handleDateChange(-1)} disabled={!canGoPrev} className={`p-1.5 rounded transition-colors ${canGoPrev ? 'hover:bg-white/10 text-slate-300' : 'text-slate-700 cursor-not-allowed'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>

                        <div className="relative flex justify-center">
                            <button
                                onClick={() => {
                                    if (!showDatePicker) {
                                        let initDate = new Date();
                                        if (selectedDate) {
                                            const [y, m, d] = selectedDate.split('-').map(Number);
                                            initDate = new Date(y, m - 1, d);
                                        }
                                        setViewDate(initDate);
                                        if (dateControlRef.current) {
                                            const rect = dateControlRef.current.getBoundingClientRect();
                                            let top = rect.bottom + 8;
                                            let left = rect.left;
                                            if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
                                            if (left < 10) left = 10;
                                            if (top + 320 > window.innerHeight) top = rect.top - 328;
                                            setPickerPosition({ top, left });
                                        }
                                    }
                                    setShowDatePicker(!showDatePicker);
                                }}
                                className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 rounded transition-colors"
                            >
                                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm font-bold text-white font-mono">{formatDate(selectedDate)}</span>
                            </button>

                            {/* Calendar — rendered via portal to escape stacking context */}
                            {showDatePicker && createPortal(
                                <div className="fixed inset-0 z-[890]" onClick={() => setShowDatePicker(false)}>
                                    <div className="fixed bg-slate-900 border border-purple-500/50 rounded-xl shadow-2xl p-4 w-[280px] max-w-[90vw] z-[900]" style={{ top: pickerPosition.top, left: pickerPosition.left }} onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-between items-center mb-4">
                                            <button onClick={(e) => { e.stopPropagation(); const nd = new Date(viewDate); nd.setMonth(nd.getMonth() - 1); setViewDate(nd); }} className="p-1 hover:bg-slate-700 rounded text-purple-300">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                            </button>
                                            <span className="text-white font-bold text-sm">{viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span>
                                            <button onClick={(e) => { e.stopPropagation(); const nd = new Date(viewDate); nd.setMonth(nd.getMonth() + 1); setViewDate(nd); }} className="p-1 hover:bg-slate-700 rounded text-purple-300">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-7 mb-2">
                                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                                <div key={d} className="text-center text-xs font-bold text-slate-500">{d}</div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">
                                            {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() }).map((_, i) => <div key={`e-${i}`} />)}
                                            {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                                                const day = i + 1;
                                                const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                const isAvailable = availableDates.includes(dateStr);
                                                const isSelected = selectedDate === dateStr;
                                                const todayStr = new Date(new Date().getTime() + 8 * 3600000).toISOString().split('T')[0];
                                                const isToday = dateStr === todayStr;
                                                return (
                                                    <button key={dateStr}
                                                        onClick={(e) => { e.stopPropagation(); if (isAvailable) { setSelectedDate(dateStr); setShowDatePicker(false); } }}
                                                        disabled={!isAvailable}
                                                        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                                            ${isSelected ? 'bg-purple-600 text-white shadow-lg scale-110' : ''}
                                                            ${!isSelected && isToday && isAvailable ? 'border border-green-500 text-green-400' : ''}
                                                            ${!isSelected && !isToday && isAvailable ? 'text-slate-300 hover:bg-purple-500/20 hover:text-white' : ''}
                                                            ${!isAvailable ? 'text-slate-700 cursor-not-allowed opacity-40' : ''}
                                                        `}>{day}</button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}
                        </div>

                        <button onClick={() => handleDateChange(1)} disabled={!canGoNext} className={`p-1.5 rounded transition-colors ${canGoNext ? 'hover:bg-white/10 text-slate-300' : 'text-slate-700 cursor-not-allowed'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>

                    {/* Manager Selector */}
                    <select
                        value={selectedManagerId}
                        onChange={(e) => setSelectedManagerId(e.target.value)}
                        className="flex-1 min-w-0 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                    >
                        <option value="">Select Manager...</option>
                        {members && members.map(m => (
                            <option key={m.manager_id} value={m.manager_id}>{m.nickname}</option>
                        ))}
                    </select>
                </div>

                {/* Content */}
                {!selectedManagerId ? (
                    <div className="h-48 flex items-center justify-center text-slate-500 text-sm italic">
                        Select a manager to view roster
                    </div>
                ) : loading ? (
                    <div className="h-64 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        {/* Batters */}
                        <div className="bg-slate-800/60 rounded-2xl border border-white/10 overflow-hidden shadow-lg p-4">
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-white/10 pb-2 flex justify-between">
                                <span>Batters</span>
                                <span className="text-xs opacity-70">{rosterData.batters.length}</span>
                            </h4>
                            <div className="mb-3 overflow-x-auto pb-1">
                                <div className="inline-flex items-center gap-2 min-w-max">
                                    <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-200 border border-pink-500/30 text-[11px] font-bold">Batter Total</span>
                                    {batterCategoryTotals.map((item) => (
                                        <span key={`admin-b-total-${item.abbr}`} className="px-2 py-1 rounded bg-slate-700/50 text-slate-100 border border-slate-600/50 text-[11px] font-mono font-bold">
                                            {item.abbr}: {item.value}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                {rosterData.batters.length === 0 ? (
                                    <div className="text-slate-600 text-xs italic py-2">No batters found</div>
                                ) : rosterData.batters.map(renderPlayerRow)}
                            </div>
                        </div>

                        {/* Pitchers */}
                        <div className="bg-slate-800/60 rounded-2xl border border-white/10 overflow-hidden shadow-lg p-4">
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-white/10 pb-2 flex justify-between">
                                <span>Pitchers</span>
                                <span className="text-xs opacity-70">{rosterData.pitchers.length}</span>
                            </h4>
                            <div className="mb-3 overflow-x-auto pb-1">
                                <div className="inline-flex items-center gap-2 min-w-max">
                                    <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-200 border border-orange-500/30 text-[11px] font-bold">Pitcher Total</span>
                                    {pitcherCategoryTotals.map((item) => (
                                        <span key={`admin-p-total-${item.abbr}`} className="px-2 py-1 rounded bg-slate-700/50 text-slate-100 border border-slate-600/50 text-[11px] font-mono font-bold">
                                            {item.abbr}: {item.value}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                {rosterData.pitchers.length === 0 ? (
                                    <div className="text-slate-600 text-xs italic py-2">No pitchers found</div>
                                ) : rosterData.pitchers.map(renderPlayerRow)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
