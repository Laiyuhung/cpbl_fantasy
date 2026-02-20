import React, { useState, useEffect } from 'react';
import PlayerDetailModal from '../../../components/PlayerDetailModal';

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

export default function LeagueDailyRoster({ leagueId, members }) {
    const [selectedDate, setSelectedDate] = useState('');
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedManagerId, setSelectedManagerId] = useState('');
    const [rosterData, setRosterData] = useState({ batters: [], pitchers: [] });
    const [actualDate, setActualDate] = useState('');
    const [loading, setLoading] = useState(false);

    // Stats state keyed by player name
    const [playerStats, setPlayerStats] = useState({});
    const [statsLoading, setStatsLoading] = useState(false);
    const [batterStatCategories, setBatterStatCategories] = useState([]);
    const [pitcherStatCategories, setPitcherStatCategories] = useState([]);

    // Date Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());

    const [selectedPlayerModal, setSelectedPlayerModal] = useState(null);

    // Watch state
    const [watchedPlayerIds, setWatchedPlayerIds] = useState(new Set());
    const [myManagerId, setMyManagerId] = useState(null);

    // Get current user's manager ID
    useEffect(() => {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const userId = cookie?.split('=')[1];
        if (userId) setMyManagerId(userId);
    }, []);

    // Fetch watched players
    useEffect(() => {
        if (!leagueId || !myManagerId) return;
        const fetchWatched = async () => {
            try {
                const res = await fetch(`/api/watched?league_id=${leagueId}&manager_id=${myManagerId}`);
                const data = await res.json();
                if (data.success && data.watchedIds) {
                    setWatchedPlayerIds(new Set(data.watchedIds));
                }
            } catch (e) {
                console.error('Failed to fetch watched players:', e);
            }
        };
        fetchWatched();
    }, [leagueId, myManagerId]);

    // Toggle watch handler
    const handleToggleWatch = async (player, isCurrentlyWatched) => {
        if (!myManagerId || !player?.player_id) return;
        try {
            if (isCurrentlyWatched) {
                await fetch('/api/watched', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ league_id: leagueId, manager_id: myManagerId, player_id: player.player_id })
                });
                setWatchedPlayerIds(prev => {
                    const next = new Set(prev);
                    next.delete(player.player_id);
                    return next;
                });
            } else {
                await fetch('/api/watched', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ league_id: leagueId, manager_id: myManagerId, player_id: player.player_id })
                });
                setWatchedPlayerIds(prev => new Set(prev).add(player.player_id));
            }
        } catch (e) {
            console.error('Failed to toggle watch:', e);
        }
    };

    // Fetch schedule (for availableDates) + league settings on mount
    useEffect(() => {
        if (!leagueId) return;
        const fetchInit = async () => {
            try {
                // Schedule → availableDates
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
                }
            } catch (e) { console.error('Failed to fetch league settings:', e); }
        };
        fetchInit();
    }, [leagueId]);

    // Fetch Roster
    useEffect(() => {
        const fetchRoster = async () => {
            if (!leagueId || !selectedManagerId) {
                setRosterData({ batters: [], pitchers: [] });
                setActualDate('');
                return;
            }

            setLoading(true);
            try {
                const response = await fetch(`/api/league/${leagueId}/roster?manager_id=${selectedManagerId}&game_date=${selectedDate}`);
                const data = await response.json();

                if (data.success) {
                    const sortedRoster = data.roster || [];
                    // Save actual date returned (may differ if clamped)
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

    // Fetch stats — derive timeWindow from selectedDate, re-fetch on date or manager change
    useEffect(() => {
        if (!selectedManagerId || !selectedDate) {
            setPlayerStats({});
            return;
        }
        const taiwanNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
        const todayStr = taiwanNow.toISOString().split('T')[0];
        const timeWindow = selectedDate === todayStr ? 'Today' : selectedDate;

        const fetchStats = async () => {
            setStatsLoading(true);
            try {
                const [batterRes, pitcherRes] = await Promise.all([
                    fetch(`/api/playerStats/batting-summary?time_window=${encodeURIComponent(timeWindow)}`),
                    fetch(`/api/playerStats/pitching-summary?time_window=${encodeURIComponent(timeWindow)}`)
                ]);
                const batterData = await batterRes.json();
                const pitcherData = await pitcherRes.json();
                const statsMap = {};
                if (batterData.success && Array.isArray(batterData.stats)) {
                    batterData.stats.forEach(s => { if (s.name) statsMap[s.name] = s; });
                }
                if (pitcherData.success && Array.isArray(pitcherData.stats)) {
                    pitcherData.stats.forEach(s => { if (s.name) statsMap[s.name] = s; });
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

    const getStatValue = (playerName, statKey) => {
        if (!playerName || !playerStats[playerName]) return '-';
        const key = parseStatKey(statKey).toLowerCase();
        const val = playerStats[playerName][key];
        if (val === undefined || val === null) return '-';
        if (Number(val) === 0) return <span className="text-slate-600">0</span>;
        return val;
    };

    const renderPlayerRow = (p) => {
        const isEmpty = !p.player_id || p.player_id === 'empty';
        const name = p.name || (isEmpty ? 'Empty' : 'Unknown');
        const teamAbbr = toAbbr(p.team);
        const isPitcher = p.batter_or_pitcher === 'pitcher' || ['SP', 'RP', 'P'].includes(p.position);
        const statCats = isPitcher ? pitcherStatCategories : batterStatCategories;

        // Game info — vivid inline display
        let gameInfoEl = null;
        if (!isEmpty && p.game_info) {
            const timeStr = formatTime(p.game_info.time);
            const vsAt = p.game_info.is_home ? 'vs' : '@';
            const opp = p.game_info.opponent || '';
            const datePrefix = actualDate && actualDate !== selectedDate ? `${formatDate(actualDate)} ` : '';
            gameInfoEl = (
                <span className="flex items-center gap-1 flex-shrink-0 ml-1">
                    {datePrefix && <span className="text-[10px] text-slate-400 font-mono">{datePrefix}</span>}
                    <span className="text-[11px] text-cyan-300 font-mono font-bold">{timeStr}</span>
                    <span className="text-[10px] text-slate-300 font-semibold">{vsAt}</span>
                    <span className="text-[11px] text-white font-bold">{opp}</span>
                </span>
            );
        } else if (!isEmpty && !p.game_info) {
            gameInfoEl = <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">No game</span>;
        }

        // Stats — horizontal scroll, vertical chip layout
        const statsRow = !isEmpty && statCats.length > 0 ? (
            <div className="overflow-x-auto mt-1.5 pb-0.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
                <div className="flex items-end gap-x-4 flex-nowrap min-w-max">
                    {statCats.map((cat) => {
                        const abbr = parseStatKey(cat);
                        const val = getStatValue(p.name, cat);
                        const isZeroOrDash = val === '-' || val === 0 || val === '0';
                        return (
                            <div key={abbr} className="flex flex-col items-center flex-shrink-0">
                                <span className="text-[9px] text-slate-500 font-semibold leading-none tracking-wide">{abbr}</span>
                                <span className={`text-xs font-mono font-bold leading-tight mt-0.5 ${isZeroOrDash ? 'text-slate-600' : 'text-cyan-200'}`}>{val}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        ) : null;

        return (
            <div key={p.id || `empty-${p.position}-${Math.random()}`} className="py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 transition-colors">
                <div className="flex items-start gap-3">
                    {/* Position badge */}
                    <span className={`w-8 flex-shrink-0 text-center text-xs font-bold mt-0.5 ${['BN', 'NA', 'IL'].includes(p.position) ? 'text-slate-500' : 'text-purple-400'}`}>
                        {p.position}
                    </span>

                    <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                        {/* Row 1: Name + Team + Game Info */}
                        <div className="flex items-center gap-1 flex-wrap">
                            <span
                                className={`text-sm font-bold ${isEmpty ? 'text-slate-600 italic' : 'text-slate-100 cursor-pointer hover:text-purple-300 transition-colors'}`}
                                onClick={() => !isEmpty && setSelectedPlayerModal(p)}
                            >
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
        <div className="bg-gradient-to-br from-slate-900/50 to-purple-900/20 backdrop-blur-md rounded-3xl border border-white/5 p-6 shadow-xl w-full">
            <h3 className="text-xl font-black text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
                Daily Roster
            </h3>

            {/* Controls — Date + Manager on same row */}
            <div className="flex items-center gap-2 mb-6">
                {/* Date Selector */}
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-white/10 flex-shrink-0">
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

                        {/* Calendar — opens UPWARD */}
                        {showDatePicker && (
                            <>
                                <div className="fixed inset-0 z-[890]" onClick={() => setShowDatePicker(false)} />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[900] bg-slate-900 border border-purple-500/50 rounded-xl shadow-2xl p-4 w-[280px]">
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
                            </>
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
                <div className="space-y-6 max-h-[700px] overflow-y-auto pr-1 custom-scrollbar">
                    {/* Batters */}
                    <div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-white/10 pb-1 flex justify-between">
                            <span>Batters</span>
                            <span className="text-[10px] opacity-70">{rosterData.batters.length} Players</span>
                        </h4>
                        <div className="flex flex-col">
                            {rosterData.batters.length === 0 ? (
                                <div className="text-slate-600 text-xs italic py-2">No batters found</div>
                            ) : rosterData.batters.map(renderPlayerRow)}
                        </div>
                    </div>

                    {/* Pitchers */}
                    <div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-white/10 pb-1 flex justify-between">
                            <span>Pitchers</span>
                            <span className="text-[10px] opacity-70">{rosterData.pitchers.length} Players</span>
                        </h4>
                        <div className="flex flex-col">
                            {rosterData.pitchers.length === 0 ? (
                                <div className="text-slate-600 text-xs italic py-2">No pitchers found</div>
                            ) : rosterData.pitchers.map(renderPlayerRow)}
                        </div>
                    </div>
                </div>
            )}

            <PlayerDetailModal
                isOpen={!!selectedPlayerModal}
                onClose={() => setSelectedPlayerModal(null)}
                player={selectedPlayerModal}
                leagueId={leagueId}
                myManagerId={myManagerId}
                isWatched={selectedPlayerModal ? watchedPlayerIds.has(selectedPlayerModal.player_id) : false}
                onToggleWatch={handleToggleWatch}
            />
        </div>
    );
}
