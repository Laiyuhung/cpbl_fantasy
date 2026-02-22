import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

    // Trade Modal State
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [tradeTargetManagerId, setTradeTargetManagerId] = useState(null);
    const [selectedMyPlayers, setSelectedMyPlayers] = useState([]);
    const [selectedTheirPlayers, setSelectedTheirPlayers] = useState([]);
    const [tradeLoading, setTradeLoading] = useState(false);
    const [isFetchingTradeData, setIsFetchingTradeData] = useState(false);
    const [tradeMyRoster, setTradeMyRoster] = useState([]);
    const [tradeTheirRoster, setTradeTheirRoster] = useState([]);
    const [leagueSettings, setLeagueSettings] = useState({});
    const [ownerships, setOwnerships] = useState([]);
    const [tradeEndDate, setTradeEndDate] = useState(null);
    const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
    const [leagueStatus, setLeagueStatus] = useState('');
    const [showTradeSuccessNotification, setShowTradeSuccessNotification] = useState(false);
    const [showTradeErrorNotification, setShowTradeErrorNotification] = useState(false);
    const [tradeSuccessMessage, setTradeSuccessMessage] = useState({ title: '', description: '' });
    const [tradeErrorMessage, setTradeErrorMessage] = useState({ title: '', description: '' });

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

    // Toggle watch handler (optimistic update)
    const handleToggleWatch = async (player, isCurrentlyWatched) => {
        if (!myManagerId || !player?.player_id) return;

        // Optimistic update - update UI immediately
        if (isCurrentlyWatched) {
            setWatchedPlayerIds(prev => {
                const next = new Set(prev);
                next.delete(player.player_id);
                return next;
            });
        } else {
            setWatchedPlayerIds(prev => new Set(prev).add(player.player_id));
        }

        try {
            const res = await fetch('/api/watched', {
                method: isCurrentlyWatched ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ league_id: leagueId, manager_id: myManagerId, player_id: player.player_id })
            });
            const data = await res.json();
            if (!data.success) {
                // Rollback on failure
                if (isCurrentlyWatched) {
                    setWatchedPlayerIds(prev => new Set(prev).add(player.player_id));
                } else {
                    setWatchedPlayerIds(prev => {
                        const next = new Set(prev);
                        next.delete(player.player_id);
                        return next;
                    });
                }
            }
        } catch (e) {
            console.error('Failed to toggle watch:', e);
            // Rollback on error
            if (isCurrentlyWatched) {
                setWatchedPlayerIds(prev => new Set(prev).add(player.player_id));
            } else {
                setWatchedPlayerIds(prev => {
                    const next = new Set(prev);
                    next.delete(player.player_id);
                    return next;
                });
            }
        }
    };

    // Fetch rosters for trade validation when trade modal opens
    useEffect(() => {
        if (showTradeModal && myManagerId && tradeTargetManagerId) {
            const fetchTradeRosters = async () => {
                setIsFetchingTradeData(true);
                try {
                    const [myRes, theirRes] = await Promise.all([
                        fetch(`/api/league/${leagueId}/roster?manager_id=${myManagerId}`),
                        fetch(`/api/league/${leagueId}/roster?manager_id=${tradeTargetManagerId}`)
                    ]);
                    const myData = await myRes.json();
                    const theirData = await theirRes.json();
                    if (myData.success) setTradeMyRoster(myData.roster || []);
                    if (theirData.success) setTradeTheirRoster(theirData.roster || []);
                } catch (e) {
                    console.error("Failed to fetch trade rosters", e);
                } finally {
                    setIsFetchingTradeData(false);
                }
            };
            fetchTradeRosters();
        }
    }, [showTradeModal, myManagerId, tradeTargetManagerId, leagueId]);

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
                // League settings → stat categories + trade settings
                const settRes = await fetch(`/api/league-settings?league_id=${leagueId}`);
                const settData = await settRes.json();
                if (settData.success && settData.data) {
                    setBatterStatCategories(settData.data.batter_stat_categories || []);
                    setPitcherStatCategories(settData.data.pitcher_stat_categories || []);
                    setLeagueSettings(settData.data);
                    setTradeEndDate(settData.data.trade_end_date || null);
                    setSeasonYear(settData.data.season_year || new Date().getFullYear());
                    // status comes from league_statuses table, returned at top level
                    setLeagueStatus(settData.status || '');
                }
            } catch (e) { console.error('Failed to fetch league settings:', e); }

            // Fetch ownerships for trade
            try {
                const ownRes = await fetch(`/api/league/${leagueId}/ownership`);
                const ownData = await ownRes.json();
                if (ownData.success) {
                    setOwnerships(ownData.ownerships || []);
                }
            } catch (e) { console.error('Failed to fetch ownerships:', e); }
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
                        body: JSON.stringify({ date: selectedDate })
                    }),
                    fetch('/api/playerStats/daily-pitching', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: selectedDate })
                    })
                ]);
                const batterData = await batterRes.json();
                const pitcherData = await pitcherRes.json();
                if (Array.isArray(batterData)) batterData.forEach(s => { if (s.player_name) statsMap[s.player_name] = s; });
                if (Array.isArray(pitcherData)) pitcherData.forEach(s => { if (s.player_name) statsMap[s.player_name] = s; });
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

    // Trade helper functions
    const getMyPlayers = () => ownerships.filter(o => o.manager_id === myManagerId && o.status?.toLowerCase() === 'on team');
    const getTheirPlayers = () => ownerships.filter(o => o.manager_id === tradeTargetManagerId && o.status?.toLowerCase() === 'on team');

    const filterPositions = (player) => {
        const positionList = player.position || player.position_list;
        if (!positionList) return 'NA';
        const positions = positionList.split(',').map(p => p.trim());
        const validPositions = positions.filter(pos => leagueSettings.roster_positions && leagueSettings.roster_positions[pos] > 0);
        return validPositions.length > 0 ? validPositions.join(', ') : 'NA';
    };

    const getPlayerPhoto = (player) => `/photo/${player.name || player.player_id}.png`;
    const handleImageError = (e, player) => {
        if (!e.target.src.endsWith('/photo/defaultPlayer.png')) {
            e.target.src = '/photo/defaultPlayer.png';
        }
    };

    // Trade Validation - matches players page logic
    const validateTradeRoster = (currentRoster, losingPlayerIds, gainingPlayerIds, settings, gainingRoster) => {
        if (!settings || !settings.roster_positions) return [];

        // 1. Calculate future roster
        const losingSet = new Set(losingPlayerIds);
        const futureRoster = currentRoster.filter(p => !losingSet.has(p.player_id));

        // Get gaining players from the other roster
        const gainingPlayers = gainingRoster ? gainingRoster.filter(p => gainingPlayerIds.includes(p.player_id)) : [];

        // Add gaining players to future roster. Assume they go to BN (Active).
        const futureRosterWithIncoming = [
            ...futureRoster,
            ...gainingPlayers.map(p => ({ ...p, position: 'BN', identity: p.identity || 'local' }))
        ];

        // 2. Counts
        const rosterConfig = settings.roster_positions || {};
        const totalLimit = Object.values(rosterConfig).reduce((sum, count) => sum + count, 0);

        const foreigners = futureRosterWithIncoming.filter(p => p.identity?.toLowerCase() === 'foreigner');
        const foreignerCount = foreigners.length;
        const foreignerLimit = parseInt(settings.foreigner_on_team_limit) || 999;

        // Active Counts (Exclude NA and Minor)
        const activePlayers = futureRosterWithIncoming.filter(p => {
            const pos = (p.position || '').toUpperCase();
            return !['NA', 'MINOR', 'MN', 'DL', 'IL'].includes(pos);
        });
        const activeCount = activePlayers.length;

        // Calculate Active Limit (Sum of all slots except NA/Minor/DL/IL)
        const activeLimit = Object.entries(rosterConfig)
            .filter(([key]) => {
                const k = key.toUpperCase();
                return !['MINOR', 'NA', 'MN', 'DL', 'IL'].includes(k);
            })
            .reduce((sum, [_, count]) => sum + count, 0);

        const activeForeigners = activePlayers.filter(p => p.identity?.toLowerCase() === 'foreigner');
        const activeForeignerCount = activeForeigners.length;
        const activeForeignerLimit = parseInt(settings.foreigner_active_limit) || 999;

        // 3. Check violations
        const violations = [];
        if (futureRosterWithIncoming.length > totalLimit) violations.push(`Total Players: ${futureRosterWithIncoming.length}/${totalLimit}`);
        if (activeCount > activeLimit) violations.push(`Active Players: ${activeCount}/${activeLimit}`);
        if (foreignerCount > foreignerLimit) violations.push(`Foreign Players: ${foreignerCount}/${foreignerLimit}`);
        if (activeForeignerCount > activeForeignerLimit) violations.push(`Active Foreigners: ${activeForeignerCount}/${activeForeignerLimit}`);

        return violations;
    };

    const handleOpenTrade = (player, ownerManagerId) => {
        setTradeTargetManagerId(ownerManagerId);
        setSelectedMyPlayers([]);
        setSelectedTheirPlayers([player.player_id]);
        setShowTradeModal(true);
    };

    const handleSubmitTrade = async () => {
        setTradeLoading(true);
        if (!selectedMyPlayers.length || !selectedTheirPlayers.length) {
            setTradeErrorMessage({ title: 'Validation Error', description: 'Both sides must select at least one player.' });
            setShowTradeErrorNotification(true);
            setTimeout(() => setShowTradeErrorNotification(false), 4000);
            setTradeLoading(false);
            return;
        }
        // Final roster validation before submit
        const myViolations = validateTradeRoster(tradeMyRoster, selectedMyPlayers, selectedTheirPlayers, leagueSettings, tradeTheirRoster);
        const theirViolations = validateTradeRoster(tradeTheirRoster, selectedTheirPlayers, selectedMyPlayers, leagueSettings, tradeMyRoster);
        if (myViolations.length > 0 || theirViolations.length > 0) {
            const allViolations = [...myViolations.map(v => `You: ${v}`), ...theirViolations.map(v => `Opponent: ${v}`)];
            setTradeErrorMessage({ title: 'Roster Violation', description: allViolations.join('; ') });
            setShowTradeErrorNotification(true);
            setTimeout(() => setShowTradeErrorNotification(false), 4000);
            setTradeLoading(false);
            return;
        }
        try {
            const res = await fetch('/api/trade/pending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    league_id: leagueId,
                    initiator_manager_id: myManagerId,
                    recipient_manager_id: tradeTargetManagerId,
                    initiator_player_ids: selectedMyPlayers,
                    recipient_player_ids: selectedTheirPlayers
                })
            });
            const data = await res.json();
            if (data.success) {
                setTradeSuccessMessage({ title: 'Trade Proposal Sent!', description: 'Your trade request has been submitted.' });
                setShowTradeSuccessNotification(true);
                setShowTradeModal(false);
                setTimeout(() => setShowTradeSuccessNotification(false), 4000);
            } else {
                setTradeErrorMessage({ title: 'Trade Failed', description: data.error || 'Failed to submit trade.' });
                setShowTradeErrorNotification(true);
                setTimeout(() => setShowTradeErrorNotification(false), 4000);
            }
        } catch (err) {
            setTradeErrorMessage({ title: 'Trade Failed', description: 'Please try again later' });
            setShowTradeErrorNotification(true);
            setTimeout(() => setShowTradeErrorNotification(false), 4000);
        } finally {
            setTradeLoading(false);
        }
    };

    const renderTradeModal = () => {
        if (!showTradeModal) return null;
        // Use roster data instead of ownerships to get full player info
        const myPlayers = tradeMyRoster.filter(p => !['IL', 'NA', 'MN'].includes(p.position));
        const theirPlayers = tradeTheirRoster.filter(p => !['IL', 'NA', 'MN'].includes(p.position));
        const myNick = members.find(m => m.manager_id === myManagerId)?.nickname || 'You';
        const theirNick = members.find(m => m.manager_id === tradeTargetManagerId)?.nickname || 'Opponent';
        // Validate before submit - pass gaining roster for player info lookup
        const myViolations = validateTradeRoster(tradeMyRoster, selectedMyPlayers, selectedTheirPlayers, leagueSettings, tradeTheirRoster);
        const theirViolations = validateTradeRoster(tradeTheirRoster, selectedTheirPlayers, selectedMyPlayers, leagueSettings, tradeMyRoster);
        const isValid = myViolations.length === 0 && theirViolations.length === 0 && selectedMyPlayers.length > 0 && selectedTheirPlayers.length > 0;

        return createPortal(
            <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-gradient-to-br from-purple-700/90 to-blue-800/90 border border-purple-400/40 rounded-2xl shadow-2xl w-full max-w-2xl relative max-h-[85vh] flex flex-col">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-purple-400/20 bg-gradient-to-r from-purple-600/80 to-blue-700/80 rounded-t-2xl shrink-0">
                        <h2 className="text-2xl font-black text-white flex items-center gap-2">
                            <span className="text-3xl">⇌</span> Trade Proposal
                        </h2>
                        <button className="text-purple-200 hover:text-white text-2xl font-bold" onClick={() => setShowTradeModal(false)}>×</button>
                    </div>

                    {isFetchingTradeData ? (
                        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
                            <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <div className="text-purple-200 font-bold">Loading rosters...</div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between px-6 pt-4 pb-2 shrink-0">
                                <div className="font-bold text-purple-200">{myNick}</div>
                                <div className="font-bold text-pink-200">{theirNick}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 px-6 pb-2 flex-1 min-h-0 overflow-hidden">
                                <div className="flex flex-col h-full overflow-hidden">
                                    <h3 className="text-purple-300 font-bold mb-2 sticky top-0 bg-slate-900/90 z-10 px-1 backdrop-blur-sm">My Players</h3>
                                    <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                                        {myPlayers.length === 0 && <div className="text-gray-400 p-2 italic">No tradable players</div>}
                                        {myPlayers.map(player => {
                                            const isSelected = selectedMyPlayers.includes(player.player_id);
                                            const currentSlot = player.position || '-';
                                            return (
                                                <label key={player.player_id} className={`flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-purple-600/20 border-purple-400' : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/80'}`}>
                                                    <input type="checkbox" className="hidden" checked={isSelected} onChange={e => setSelectedMyPlayers(val => e.target.checked ? [...val, player.player_id] : val.filter(id => id !== player.player_id))} />
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-500'}`}>
                                                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                    <div className="w-10 h-10 rounded-full bg-slate-900 overflow-hidden border border-slate-600 shrink-0">
                                                        <img src={getPlayerPhoto(player)} alt={player.name || 'Player'} className="w-full h-full object-cover" onError={(e) => handleImageError(e, player)} />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <div className={`font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>{player.name || 'Unknown'}</div>
                                                        <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                                                            <span className={`${getTeamColor(player.team)} font-bold`}>{toAbbr(player.team)}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                            <span>{filterPositions(player)}</span>
                                                            <span className="text-yellow-400 font-bold ml-1">({currentSlot})</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex flex-col h-full overflow-hidden">
                                    <h3 className="text-pink-300 font-bold mb-2 sticky top-0 bg-slate-900/90 z-10 px-1 backdrop-blur-sm">Their Players</h3>
                                    <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                                        {theirPlayers.length === 0 && <div className="text-gray-400 p-2 italic">No tradable players</div>}
                                        {theirPlayers.map(player => {
                                            const isSelected = selectedTheirPlayers.includes(player.player_id);
                                            const currentSlot = player.position || '-';
                                            return (
                                                <label key={player.player_id} className={`flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-pink-600/20 border-pink-400' : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/80'}`}>
                                                    <input type="checkbox" className="hidden" checked={isSelected} onChange={e => setSelectedTheirPlayers(val => e.target.checked ? [...val, player.player_id] : val.filter(id => id !== player.player_id))} />
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-pink-500 border-pink-500' : 'border-slate-500'}`}>
                                                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                    <div className="w-10 h-10 rounded-full bg-slate-900 overflow-hidden border border-slate-600 shrink-0">
                                                        <img src={getPlayerPhoto(player)} alt={player.name || 'Player'} className="w-full h-full object-cover" onError={(e) => handleImageError(e, player)} />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <div className={`font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>{player.name || 'Unknown'}</div>
                                                        <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                                                            <span className={`${getTeamColor(player.team)} font-bold`}>{toAbbr(player.team)}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                            <span>{filterPositions(player)}</span>
                                                            <span className="text-yellow-400 font-bold ml-1">({currentSlot})</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {(myViolations.length > 0 || theirViolations.length > 0) && (
                                <div className="px-6 pb-2">
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                        <h4 className="text-red-300 font-bold text-sm mb-1">⚠ Roster Violations</h4>
                                        <ul className="text-xs text-red-200 list-disc list-inside space-y-0.5">
                                            {myViolations.map((v, i) => <li key={`my-${i}`}>You: {v}</li>)}
                                            {theirViolations.map((v, i) => <li key={`their-${i}`}>{theirNick}: {v}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center px-6 py-4 border-t border-purple-400/20 bg-gradient-to-r from-purple-700/60 to-blue-800/60 rounded-b-2xl shrink-0">
                                <div className="text-xs text-purple-200/60 italic">* Received players are assumed to occupy Active (BN) slots.</div>
                                <div className="flex gap-3">
                                    <button className="px-6 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold" onClick={() => setShowTradeModal(false)} disabled={tradeLoading}>Cancel</button>
                                    <button className={`px-6 py-2 rounded-lg font-bold shadow flex items-center gap-2 ${isValid && !tradeLoading ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`} onClick={handleSubmitTrade} disabled={tradeLoading || !isValid}>
                                        {tradeLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                        {tradeLoading ? 'Submitting...' : 'Submit Trade'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>,
            document.body
        );
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

            // Check if game date differs from selected date (cross-day game)
            let datePrefix = '';
            if (p.game_info.time) {
                try {
                    const gameDate = new Date(p.game_info.time);
                    const gameDateStr = gameDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }); // YYYY-MM-DD format
                    if (gameDateStr !== selectedDate) {
                        const month = gameDate.getMonth() + 1;
                        const day = gameDate.getDate();
                        datePrefix = `${month}/${day} `;
                    }
                } catch (e) {
                    // Ignore date parsing errors
                }
            }

            gameInfoEl = (
                <span className="flex items-center gap-1 flex-shrink-0 ml-1 text-cyan-400 font-mono text-[11px]">
                    {datePrefix && <span>{datePrefix}</span>}
                    <span className="font-bold">{timeStr}</span>
                    <span>{vsAt}</span>
                    <span className="font-bold">{opp}</span>
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
                ownership={selectedPlayerModal ? ownerships.find(o => o.player_id === selectedPlayerModal.player_id) : null}
                leagueStatus={leagueStatus}
                tradeEndDate={tradeEndDate}
                seasonYear={seasonYear}
                onTrade={handleOpenTrade}
                isWatched={selectedPlayerModal ? watchedPlayerIds.has(selectedPlayerModal.player_id) : false}
                onToggleWatch={handleToggleWatch}
            />

            {renderTradeModal()}

            {/* Trade Success Notification */}
            {showTradeSuccessNotification && (
                <div className="fixed bottom-4 right-4 z-[2000] bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl border border-green-400/30 animate-slideIn">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">✓</span>
                        <div>
                            <div className="font-bold">{tradeSuccessMessage.title}</div>
                            <div className="text-sm text-green-100">{tradeSuccessMessage.description}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trade Error Notification */}
            {showTradeErrorNotification && (
                <div className="fixed bottom-4 right-4 z-[2000] bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl border border-red-400/30 animate-slideIn">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">✕</span>
                        <div>
                            <div className="font-bold">{tradeErrorMessage.title}</div>
                            <div className="text-sm text-red-100">{tradeErrorMessage.description}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
