'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import LegendModal from '../../../../components/LegendModal';
import MoveModal from './MoveModal';
import MyTradesModal from '../../../../components/MyTradesModal';
import WaiverModal from '../../../../components/WaiverModal';
import PlayerDetailModal from '../../../../components/PlayerDetailModal';

function getTodayTW() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
}

export default function RosterPage() {
    const params = useParams();
    const leagueId = params.leagueId;

    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true); // Initial Load
    const [actionLoading, setActionLoading] = useState(false); // Action Load (Blur)
    const [error, setError] = useState('');
    const [notification, setNotification] = useState(null); // { type: 'success'|'error', message: '', details: [] }
    const [date, setDate] = useState('');

    // Date Selector State
    const [scheduleData, setScheduleData] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [availableDates, setAvailableDates] = useState([]);

    // Calendar Dropdown State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [viewDate, setViewDate] = useState(new Date()); // Controls the month being viewed

    // Stats State
    const [timeWindow, setTimeWindow] = useState('Today');
    const [playerStats, setPlayerStats] = useState({});
    const [dailyStatsForTotals, setDailyStatsForTotals] = useState({});
    const [batterStatCategories, setBatterStatCategories] = useState([]);
    const [pitcherStatCategories, setPitcherStatCategories] = useState([]);
    const [scoringType, setScoringType] = useState('');

    // Settings State
    const [rosterPositionsConfig, setRosterPositionsConfig] = useState({});
    const [foreignerActiveLimit, setForeignerActiveLimit] = useState(null);

    // Modals
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showLegendModal, setShowLegendModal] = useState(false);
    const [showWaiverModal, setShowWaiverModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showStartActiveModal, setShowStartActiveModal] = useState(false);
    const [playerToMove, setPlayerToMove] = useState(null);
    const [selectedPlayerModal, setSelectedPlayerModal] = useState(null);

    // Trade State
    const [showMyTradesModal, setShowMyTradesModal] = useState(false);
    const [tradeEndDate, setTradeEndDate] = useState(null);
    const [myManagerId, setMyManagerId] = useState(null);
    const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
    const [pendingTradeCount, setPendingTradeCount] = useState(0);

    // Drop State
    const [showConfirmDrop, setShowConfirmDrop] = useState(false);
    const [playerToDrop, setPlayerToDrop] = useState(null);
    const [isDropping, setIsDropping] = useState(false);
    const [isAutoStarting, setIsAutoStarting] = useState(false);
    const [activeTradePlayerIds, setActiveTradePlayerIds] = useState(new Set());
    const [leagueStatus, setLeagueStatus] = useState('unknown');

    // Watch State
    const [watchedPlayerIds, setWatchedPlayerIds] = useState(new Set());

    // Weekly IP & Add Limit State
    const [weeklyIP, setWeeklyIP] = useState(null);
    const [minIPRequired, setMinIPRequired] = useState(null);
    const [weeklyAddCount, setWeeklyAddCount] = useState(0);
    const [maxAcquisitions, setMaxAcquisitions] = useState(null);

    // Roster Percentage Map
    const [rosterPercentageMap, setRosterPercentageMap] = useState({});
    const [startingStatus, setStartingStatus] = useState({
        lineupByPlayerId: {},
        lineupTeams: new Set(),
        pitcherPlayerIds: new Set(),
    });

    // Helpers
    const parseStatName = (stat) => {
        const matches = stat.match(/\(([^)]+)\)/g);
        return matches ? matches[matches.length - 1].replace(/[()]/g, '') : stat;
    };

    const getTeamAbbr = (team) => { /* ... same ... */
        switch (team) {
            case '統一獅': return 'UL';
            case '富邦悍將': return 'FG';
            case '樂天桃猿': return 'RM';
            case '中信兄弟': return 'B';
            case '味全龍': return 'W';
            case '台鋼雄鷹': return 'TSG';
            default: return team;
        }
    };

    const getTeamColor = (team) => { /* ... same ... */
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

    const getPlayerPhotoPaths = (player) => { /* ... same ... */
        const paths = [];
        if (player.name) paths.push(`/photo/${player.name}.png`);
        if (player.original_name) {
            player.original_name.split(',').forEach(alias => {
                if (alias.trim()) paths.push(`/photo/${alias.trim()}.png`);
            });
        }
        if (player.player_id) paths.push(`/photo/${player.player_id}.png`);
        paths.push('/photo/defaultPlayer.png');
        return paths;
    };

    const [photoSrcMap, setPhotoSrcMap] = useState({});

    // Fetchers
    const refreshRoster = async () => {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const managerId = cookie?.split('=')[1];
        if (!managerId || !selectedDate) return;

        // Note: We don't verify success here, handled in try/catch if needed, but simple fetch is fine
        try {
            const res = await fetch(`/api/league/${leagueId}/roster?manager_id=${managerId}&game_date=${selectedDate}`);
            const data = await res.json();
            if (data.success) {
                setRoster(data.roster || []);
                setDate(data.date || selectedDate);
            }
        } catch (e) { console.error(e); }
        // Turn off loaders
        setLoading(false);
        setActionLoading(false);
    };

    // Actions
    const handleSlotClick = (player) => {
        if (player.isEmpty) return;
        setPlayerToMove(player);
        setShowMoveModal(true);
    };

    const handleMovePlayer = async (targetPos, swapWithPlayerId) => {
        if (!playerToMove) return;

        setShowMoveModal(false);
        setNotification(null); // Clear any existing notification
        setActionLoading(true); // Blur ON

        try {
            const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
            const managerId = cookie?.split('=')[1];
            if (!managerId) return;


            const res = await fetch(`/api/league/${leagueId}/roster/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    managerId,
                    playerId: playerToMove.player_id,
                    currentPosition: playerToMove.position,
                    targetPosition: targetPos,
                    swapWithPlayerId: swapWithPlayerId || null,
                    gameDate: selectedDate
                })
            });

            const data = await res.json();


            if (data.success) {
                // Construct Success Message
                const updates = data.updates || [];
                let msg = 'Roster Updated';
                let details = [];

                if (updates.length > 0) {
                    // Map updates to readable strings
                    details = updates.map(u => {
                        // Find player name from current roster state (before refresh)
                        // Note: If player was in roster, we find them.
                        const p = roster.find(rp => rp.player_id === u.player_id);
                        const pName = p ? p.name : 'Player';
                        return `${pName} ➔ ${u.new_position}`;
                    });

                    if (updates.length === 1) {
                        msg = details[0];
                        details = []; // Simple message
                    } else {
                        msg = 'Swap Successful';
                    }
                }

                setNotification({ type: 'success', message: msg, details: details });
                setTimeout(() => setNotification(null), 3000);

                await refreshRoster(); // Wait for refresh
            } else {
                console.error(data.error);
                setError(data.error || 'Move failed');
                setActionLoading(false);
                setPlayerToMove(null);
                setTimeout(() => setError(''), 3000);
            }

        } catch (err) {
            console.error(err);
            setActionLoading(false);
            setError('System Error');
            setTimeout(() => setError(''), 3000);
        }
    };

    // Handle Drop Player
    const handleDropPlayer = (player) => {
        if (!myManagerId) return;
        // Check if locked in trade
        if (activeTradePlayerIds.has(player.player_id)) {
            setNotification({ type: 'error', message: 'Player is locked in a pending trade' });
            setTimeout(() => setNotification(null), 3000);
            return;
        }
        setPlayerToDrop(player);
        setShowConfirmDrop(true);
    };

    const confirmDropPlayer = async () => {
        if (!playerToDrop) return;
        setIsDropping(true);
        try {
            const res = await fetch(`/api/league/${leagueId}/ownership`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: playerToDrop.player_id,
                    manager_id: myManagerId
                })
            });
            const data = await res.json();
            if (data.success) {
                setNotification({ type: 'success', message: `Dropped ${playerToDrop.name}` });
                setTimeout(() => setNotification(null), 3000);
                await refreshRoster();
            } else {
                setNotification({ type: 'error', message: data.error || 'Drop failed' });
                setTimeout(() => setNotification(null), 3000);
            }
        } catch (e) {
            console.error(e);
            setNotification({ type: 'error', message: 'System error' });
            setTimeout(() => setNotification(null), 3000);
        } finally {
            setIsDropping(false);
            setShowConfirmDrop(false);
            setPlayerToDrop(null);
        }
    };

    // Fetch Schedule and Initialize Date
    useEffect(() => {
        // Get Manager ID
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const id = cookie?.split('=')[1];
        if (id) setMyManagerId(id);

        const fetchSchedule = async () => {
            try {
                const response = await fetch(`/api/league/${leagueId}`);
                const result = await response.json();

                if (result.success && result.schedule) {
                    setScheduleData(result.schedule);
                    if (result.league) {
                        setTradeEndDate(result.league.trade_end_date);
                        // Try to parse season year from start_scoring_on if needed, default to current logic
                        if (result.league.start_scoring_on) {
                            const parts = result.league.start_scoring_on.split('.');
                            if (parts.length > 0) {
                                const parsedYear = parseInt(parts[0]);
                                if (!isNaN(parsedYear)) setSeasonYear(parsedYear);
                            }
                        }
                    }
                    // Set league status
                    if (result.status) {
                        setLeagueStatus(result.status);
                    }

                    // Calculate all available dates from schedule
                    const dates = [];
                    result.schedule.forEach(week => {
                        const start = new Date(week.week_start);
                        const end = new Date(week.week_end);

                        // Generate all dates in this week
                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                            dates.push(new Date(d).toISOString().split('T')[0]);
                        }
                    });

                    setAvailableDates(dates);

                    // Initialize selected date to today in Taiwan timezone
                    if (dates.length > 0) {
                        const now = new Date();
                        const todayStr = getTodayTW();

                        console.log('='.repeat(80));
                        console.log('📅 [Roster] Date Initialization');
                        console.log('UTC Time:', now.toISOString());
                        console.log('Today (Taiwan):', todayStr);
                        console.log('Available Dates Range:', dates[0], 'to', dates[dates.length - 1]);
                        console.log('Total Available Dates:', dates.length);

                        // Check if today is within available dates
                        if (dates.includes(todayStr)) {
                            console.log('✅ Today is within season, using:', todayStr);
                            setSelectedDate(todayStr);
                        } else if (todayStr < dates[0]) {
                            // Before season, use first date
                            console.log('⚠️  Today is before season, using first date:', dates[0]);
                            setSelectedDate(dates[0]);
                        } else {
                            // After season, use last date
                            console.log('⚠️  Today is after season, using last date:', dates[dates.length - 1]);
                            setSelectedDate(dates[dates.length - 1]);
                        }
                        console.log('='.repeat(80));
                    }
                }
            } catch (err) {
                console.error('Failed to fetch schedule:', err);
            }
        };

        fetchSchedule();
    }, [leagueId]);

    useEffect(() => {
        const fetchStartingStatus = async () => {
            const dateForStatus = selectedDate || getTodayTW();
            try {
                const res = await fetch(`/api/starting-status?date=${dateForStatus}`);
                const data = await res.json();
                if (!data.success) return;

                setStartingStatus({
                    lineupByPlayerId: data.lineup_by_player_id || {},
                    lineupTeams: new Set(data.lineup_teams || []),
                    pitcherPlayerIds: new Set((data.pitcher_player_ids || []).map(String)),
                });
            } catch (err) {
                console.error('Failed to fetch starting status:', err);
            }
        };

        fetchStartingStatus();
    }, [selectedDate]);

    // Fetch roster when selectedDate changes
    useEffect(() => {
        if (!selectedDate) return;

        const fetchRosterForDate = async () => {
            setLoading(true);
            await refreshRoster();
            setLoading(false);
        };

        fetchRosterForDate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate]);



    // Settings
    useEffect(() => {
        const fetchSettings = async () => {
            const settingsRes = await fetch(`/api/league-settings?league_id=${leagueId}`);
            const settingsData = await settingsRes.json();
            if (settingsData.success && settingsData.data) {
                setBatterStatCategories(settingsData.data.batter_stat_categories || []);
                setPitcherStatCategories(settingsData.data.pitcher_stat_categories || []);
                setScoringType(settingsData.data.scoring_type || '');

                setRosterPositionsConfig(settingsData.data.roster_positions || {});
                setForeignerActiveLimit(settingsData.data.foreigner_active_limit);

                // IP requirement & Add limit from settings
                const minIP = settingsData.data.min_innings_pitched_per_week;
                if (minIP && minIP !== 'No minimum') {
                    const parsed = parseFloat(minIP);
                    if (!isNaN(parsed)) setMinIPRequired(parsed);
                }
                const maxAcq = settingsData.data.max_acquisitions_per_week;
                if (maxAcq && maxAcq !== 'No limit') {
                    const parsed = parseInt(maxAcq);
                    if (!isNaN(parsed)) setMaxAcquisitions(parsed);
                }
            }
        };
        fetchSettings();
    }, [leagueId]);

    // Fetch Weekly IP & Add Count
    useEffect(() => {
        if (!myManagerId || !leagueId || !selectedDate) return;
        const fetchWeeklyIP = async () => {
            try {
                const res = await fetch(`/api/league/${leagueId}/weekly-ip?manager_id=${myManagerId}&date=${selectedDate}`);
                const data = await res.json();
                if (data.success) {
                    setWeeklyIP(data.ip);
                    setWeeklyAddCount(data.addCount || 0);
                }
            } catch (e) { console.error('Failed to fetch weekly IP:', e); }
        };
        fetchWeeklyIP();
    }, [leagueId, myManagerId, selectedDate]);

    // Fetch Roster Percentage
    useEffect(() => {
        const fetchRosterPercentage = async () => {
            try {
                const res = await fetch('/api/playerslist?available=true');
                const data = await res.json();
                if (data.success && data.players) {
                    const map = {};
                    data.players.forEach(p => {
                        if (p.player_id) map[p.player_id] = p.roster_percentage ?? 0;
                    });
                    setRosterPercentageMap(map);
                }
            } catch (e) { console.error('Failed to fetch roster percentage:', e); }
        };
        fetchRosterPercentage();
    }, []);

    // Fetch Active Trade Player IDs (for lock check)
    useEffect(() => {
        const fetchActiveTrades = async () => {
            if (!myManagerId) return;
            try {
                const res = await fetch(`/api/trade/list?league_id=${leagueId}&manager_id=${myManagerId}`);
                const data = await res.json();
                if (data.success && data.trades) {
                    const tradeIds = new Set();
                    data.trades.forEach(t => {
                        const status = t.status?.toLowerCase();
                        if (status === 'pending' || status === 'accepted') {
                            (t.initiator_player_ids || []).forEach(id => tradeIds.add(id));
                            (t.recipient_player_ids || []).forEach(id => tradeIds.add(id));
                        }
                    });
                    setActiveTradePlayerIds(tradeIds);
                }
            } catch (e) {
                console.error('Failed to fetch active trades:', e);
            }
        };
        fetchActiveTrades();
    }, [leagueId, myManagerId]);

    // Stats
    useEffect(() => {
        const fetchStats = async () => {
            if (!timeWindow) return;
            try {
                const newStats = {};

                if (timeWindow === 'Today') {
                    // Use daily APIs (POST, flat array response)
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
                    // Daily APIs return flat arrays (no {success, stats} wrapper)
                    if (Array.isArray(batterData)) batterData.forEach(s => { if (s.player_id) newStats[s.player_id] = s; });
                    if (Array.isArray(pitcherData)) pitcherData.forEach(s => { if (s.player_id) newStats[s.player_id] = s; });
                } else {
                    // Use summary APIs (GET, {success, stats} wrapper)
                    const batterUrl = `/api/playerStats/batting-summary?time_window=${encodeURIComponent(timeWindow)}&league_id=${encodeURIComponent(leagueId)}`;
                    const pitcherUrl = `/api/playerStats/pitching-summary?time_window=${encodeURIComponent(timeWindow)}&league_id=${encodeURIComponent(leagueId)}`;
                    const [batterRes, pitcherRes] = await Promise.all([
                        fetch(batterUrl),
                        fetch(pitcherUrl)
                    ]);
                    const batterData = await batterRes.json();
                    const pitcherData = await pitcherRes.json();
                    if (batterData.success && batterData.stats) batterData.stats.forEach(s => newStats[s.player_id] = s);
                    if (pitcherData.success && pitcherData.stats) pitcherData.stats.forEach(s => newStats[s.player_id] = s);
                }

                setPlayerStats(newStats);
            } catch (err) { console.error('Failed to fetch stats:', err); }
        };
        fetchStats();
    }, [timeWindow, selectedDate, leagueId]);

    // Daily stats for category totals (always based on selectedDate, independent of timeWindow)
    useEffect(() => {
        const fetchDailyStatsForTotals = async () => {
            if (!selectedDate || !leagueId) {
                setDailyStatsForTotals({});
                return;
            }

            try {
                const totalsMap = {};
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
                if (Array.isArray(batterData)) batterData.forEach((s) => { if (s.player_id) totalsMap[s.player_id] = s; });
                if (Array.isArray(pitcherData)) pitcherData.forEach((s) => { if (s.player_id) totalsMap[s.player_id] = s; });

                setDailyStatsForTotals(totalsMap);
            } catch (err) {
                console.error('Failed to fetch daily totals stats:', err);
                setDailyStatsForTotals({});
            }
        };

        fetchDailyStatsForTotals();
    }, [selectedDate, leagueId]);

    // Fetch Pending Trades Count
    useEffect(() => {
        if (!leagueId || !myManagerId) return;
        const fetchTrades = async () => {
            try {
                const res = await fetch(`/api/trade/count?league_id=${leagueId}&manager_id=${myManagerId}`);
                const data = await res.json();
                if (data.success) {
                    setPendingTradeCount(data.count);
                }
            } catch (err) { console.error('Failed to fetch pending trades count:', err); }
        };
        fetchTrades();
    }, [leagueId, myManagerId, showMyTradesModal]);

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

    const getPlayerStat = (playerId, statKey) => {
        if (!playerId || playerId === 'empty') return '-';
        const stats = playerStats[playerId];
        if (!stats) return '-';
        let fieldName = statKey;
        const matches = statKey.match(/\(([^)]+)\)/g);
        if (matches) fieldName = matches[matches.length - 1].replace(/[()]/g, '');
        const fieldKey = fieldName.toLowerCase();
        const value = stats[fieldKey];
        if (fieldKey === 'fp' && value !== undefined && value !== null) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed.toFixed(2) : '-';
        }
        return value !== undefined && value !== null ? value : '-';
    };

    const formatStat = (value) => {
        if (value === '-' || value === null || value === undefined) return '-';
        if (Number(value) === 0) return <span className="text-slate-500 font-bold">0</span>;
        return value;
    };

    // Photos
    useEffect(() => {
        let cancelled = false;
        const resolvePhotos = async () => {
            if (!roster || roster.length === 0) return;
            const batchPayload = roster.map(item => ({
                id: item.player_id,
                candidates: getPlayerPhotoPaths({ name: item.name, player_id: item.player_id }).filter(p => !p.endsWith('/defaultPlayer.png'))
            }));
            try {
                const res = await fetch('/api/photo/resolve', { method: 'POST', get headers() { return { 'Content-Type': 'application/json' }; }, body: JSON.stringify({ players: batchPayload }) });
                const data = await res.json();
                if (data.results) setPhotoSrcMap(data.results);
            } catch { /* Ignore */ }
        };
        resolvePhotos();
        return () => { cancelled = true; };
    }, [roster]);

    const getPlayerPhoto = (player) => {
        if (player.player_id === 'empty') return null;
        return photoSrcMap[player.player_id] || '/photo/defaultPlayer.png';
    };
    const handleImageError = (e) => {
        e.target.onerror = null;
        e.target.src = window.location.origin + '/photo/defaultPlayer.png';
    };

    // Move Restriction Helper
    const isMoveAllowedForDate = (player, gameDate) => {
        if (!gameDate) return true;

        // 1. Past Date Check
        const todayStr = getTodayTW();

        if (gameDate < todayStr) return false;

        // 2. Game Time Check (Only for Today)
        if (gameDate === todayStr && player.game_info && player.game_info.time) {
            // game_info.time is stored as timestamptz (e.g., '2026-03-09 10:35:00+00')
            // Compare directly using UTC
            const gameTimeUTC = new Date(player.game_info.time);
            const nowUTC = new Date();
            const isGameStarted = nowUTC >= gameTimeUTC;

            if (isGameStarted && !player.game_info.is_postponed) {
                // Starter Locked
                if (!['BN', 'NA'].includes(player.position)) {
                    return false;
                }
                // BN/NA are allowed to move (but target restricted)
            }
        }

        return true;
    };

    const isMoveAllowed = (player) => isMoveAllowedForDate(player, selectedDate);

    // Drop Lock Helper - Check if player cannot be dropped due to game start
    const isDropLockedByGameStart = (player) => {
        if (!player || !player.game_info) return false;

        // Only lock drop for starters (not BN/NA)
        if (['BN', 'NA'].includes(player.position)) return false;

        // Check if game has started (not postponed)
        if (player.game_info.is_postponed) return false;

        const todayStr = getTodayTW();

        // Only check for today's games
        if (selectedDate !== todayStr) return false;

        if (player.game_info.time) {
            // game_info.time is stored as timestamptz
            const gameTimeUTC = new Date(player.game_info.time);
            const nowUTC = new Date();
            const isGameStarted = nowUTC >= gameTimeUTC;
            return isGameStarted;
        }

        return false;
    };

    const hasPlayableGame = (player) => {
        return !!player?.game_info && !player.game_info.is_postponed;
    };

    // Start Active priority:
    // 1) Has game + confirmed starter
    // 2) Has game
    // 3) Has game + confirmed non-starter (batters only)
    // 4) No game
    const getStartActivePriority = (player) => {
        if (!hasPlayableGame(player)) return 4;

        const playerType = String(player?.batter_or_pitcher || '').toLowerCase();
        const pid = String(player?.player_id || '');

        if (playerType === 'pitcher') {
            return startingStatus.pitcherPlayerIds.has(pid) ? 1 : 2;
        }

        if (playerType === 'batter') {
            const teamLineupPublished = startingStatus.lineupTeams.has(player.team);
            if (!teamLineupPublished) return 2;

            const battingNo = startingStatus.lineupByPlayerId[pid];
            return battingNo ? 1 : 3;
        }

        return 2;
    };

    const getEligibleActivePositions = (player) => {
        const positions = player.position_list
            ? player.position_list.split(',').map(pos => pos.trim()).filter(Boolean)
            : [];

        if (player.position && ACTIVE_POSITIONS_ORDER.includes(player.position)) {
            positions.push(player.position);
        }

        if (player.batter_or_pitcher === 'batter') {
            positions.push('Util');
        }

        if (player.batter_or_pitcher === 'pitcher') {
            positions.push('P');
        }

        return [...new Set(positions)].filter(pos => ACTIVE_POSITIONS_ORDER.includes(pos) && (parseInt(rosterPositionsConfig[pos], 10) || 0) > 0);
    };

    const buildAutoStartPlan = (rosterForDate, gameDate) => {
        const rosterPlayers = rosterForDate.filter(player => !player.isEmpty && player.player_id !== 'empty');
        const fixedPlayerIds = new Set(
            rosterPlayers
                .filter(player => ACTIVE_POSITIONS_ORDER.includes(player.position) && !isMoveAllowedForDate(player, gameDate))
                .map(player => player.player_id)
        );

        const availableSlots = [];
        ACTIVE_POSITIONS_ORDER.forEach(position => {
            const total = parseInt(rosterPositionsConfig[position], 10) || 0;
            const fixedCount = rosterPlayers.filter(player => fixedPlayerIds.has(player.player_id) && player.position === position).length;
            const remaining = Math.max(0, total - fixedCount);
            for (let index = 0; index < remaining; index += 1) {
                availableSlots.push({ id: `${position}-${index}`, position });
            }
        });

        const candidates = rosterPlayers
            .filter(player => !fixedPlayerIds.has(player.player_id))
            .filter(player => !['NA', 'IL', 'MINOR', 'MN'].includes(String(player.position || '').toUpperCase()))
            .filter(player => !(player.position === 'BN' && !isMoveAllowedForDate(player, gameDate)))
            .map(player => {
                const eligibleSlots = getEligibleActivePositions(player)
                    .flatMap(position => availableSlots.filter(slot => slot.position === position))
                    .sort((left, right) => {
                        if (left.position === player.position && right.position !== player.position) return -1;
                        if (right.position === player.position && left.position !== player.position) return 1;
                        return ACTIVE_POSITIONS_ORDER.indexOf(left.position) - ACTIVE_POSITIONS_ORDER.indexOf(right.position);
                    });

                return { player, eligibleSlots };
            })
            .filter(entry => entry.eligibleSlots.length > 0)
            .sort((left, right) => {
                const leftPriority = getStartActivePriority(left.player);
                const rightPriority = getStartActivePriority(right.player);
                if (leftPriority !== rightPriority) {
                    return leftPriority - rightPriority;
                }
                if (left.eligibleSlots.length !== right.eligibleSlots.length) {
                    return left.eligibleSlots.length - right.eligibleSlots.length;
                }
                const leftStarts = ACTIVE_POSITIONS_ORDER.includes(left.player.position) ? 0 : 1;
                const rightStarts = ACTIVE_POSITIONS_ORDER.includes(right.player.position) ? 0 : 1;
                if (leftStarts !== rightStarts) {
                    return leftStarts - rightStarts;
                }
                return left.player.name.localeCompare(right.player.name);
            });

        const candidateById = new Map(candidates.map(entry => [entry.player.player_id, entry]));
        const slotMatches = new Map();

        const tryMatch = (candidate, visited) => {
            for (const slot of candidate.eligibleSlots) {
                if (visited.has(slot.id)) continue;
                visited.add(slot.id);

                const matchedPlayerId = slotMatches.get(slot.id);
                if (!matchedPlayerId || tryMatch(candidateById.get(matchedPlayerId), visited)) {
                    slotMatches.set(slot.id, candidate.player.player_id);
                    return true;
                }
            }

            return false;
        };

        candidates.forEach(candidate => {
            tryMatch(candidate, new Set());
        });

        const desiredPositions = new Map();

        rosterPlayers.forEach(player => {
            if (fixedPlayerIds.has(player.player_id)) {
                desiredPositions.set(player.player_id, player.position);
            }
        });

        for (const [slotId, playerId] of slotMatches.entries()) {
            const slot = availableSlots.find(entry => entry.id === slotId);
            if (slot) {
                desiredPositions.set(playerId, slot.position);
            }
        }

        const assignedCounts = ACTIVE_POSITIONS_ORDER.reduce((acc, position) => {
            acc[position] = 0;
            return acc;
        }, {});

        desiredPositions.forEach(position => {
            if (assignedCounts[position] !== undefined) {
                assignedCounts[position] += 1;
            }
        });

        ACTIVE_POSITIONS_ORDER.forEach(position => {
            const capacity = parseInt(rosterPositionsConfig[position], 10) || 0;
            if (capacity <= 0) return;

            const keepers = rosterPlayers
                .filter(player => player.position === position)
                .filter(player => !desiredPositions.has(player.player_id))
                .sort((left, right) => {
                    const leftPriority = getStartActivePriority(left);
                    const rightPriority = getStartActivePriority(right);
                    if (leftPriority !== rightPriority) {
                        return leftPriority - rightPriority;
                    }
                    return left.name.localeCompare(right.name);
                });

            for (const keeper of keepers) {
                if (assignedCounts[position] >= capacity) break;
                desiredPositions.set(keeper.player_id, position);
                assignedCounts[position] += 1;
            }
        });

        rosterPlayers.forEach(player => {
            if (!desiredPositions.has(player.player_id)) {
                desiredPositions.set(player.player_id, ACTIVE_POSITIONS_ORDER.includes(player.position) ? 'BN' : player.position);
            }
        });

        return { desiredPositions, fixedPlayerIds };
    };

    const applyRosterMove = async (playerId, currentPosition, targetPosition, gameDate) => {
        const response = await fetch(`/api/league/${leagueId}/roster/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                managerId: myManagerId,
                playerId,
                currentPosition,
                targetPosition,
                gameDate,
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to update roster');
        }

        return data;
    };

    const resolveStartActiveDates = (mode) => {
        const today = getTodayTW();
        const preferredStart = availableDates.includes(today) ? today : selectedDate;
        const startIdx = Math.max(0, availableDates.indexOf(preferredStart));

        if (mode === 'five-days') {
            return availableDates.slice(startIdx, startIdx + 5);
        }

        return preferredStart ? [preferredStart] : [];
    };

    const executeStartActiveForDate = async (gameDate) => {
        const res = await fetch(`/api/league/${leagueId}/roster?manager_id=${myManagerId}&game_date=${gameDate}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || `Failed to load roster for ${gameDate}`);
        }

        const rosterForDate = data.roster || [];
        const { desiredPositions, fixedPlayerIds } = buildAutoStartPlan(rosterForDate, gameDate);
        const rosterPlayers = rosterForDate.filter(player => !player.isEmpty && player.player_id !== 'empty');
        const currentPositions = new Map(rosterPlayers.map(player => [player.player_id, player.position]));

        const playersToBench = rosterPlayers
            .filter(player => ACTIVE_POSITIONS_ORDER.includes(player.position))
            .filter(player => !fixedPlayerIds.has(player.player_id))
            .filter(player => isMoveAllowedForDate(player, gameDate))
            .filter(player => desiredPositions.get(player.player_id) !== player.position)
            .sort((left, right) => ACTIVE_POSITIONS_ORDER.indexOf(left.position) - ACTIVE_POSITIONS_ORDER.indexOf(right.position));

        const playersToActivate = rosterPlayers
            .filter(player => desiredPositions.get(player.player_id))
            .filter(player => ACTIVE_POSITIONS_ORDER.includes(desiredPositions.get(player.player_id)))
            .filter(player => desiredPositions.get(player.player_id) !== player.position)
            .sort((left, right) => {
                const leftTarget = ACTIVE_POSITIONS_ORDER.indexOf(desiredPositions.get(left.player_id));
                const rightTarget = ACTIVE_POSITIONS_ORDER.indexOf(desiredPositions.get(right.player_id));
                return leftTarget - rightTarget;
            });

        const moveDetails = [];

        for (const player of playersToBench) {
            const currentPosition = currentPositions.get(player.player_id);
            if (currentPosition === 'BN') continue;

            await applyRosterMove(player.player_id, currentPosition, 'BN', gameDate);
            currentPositions.set(player.player_id, 'BN');
            moveDetails.push(`${player.name} -> BN`);
        }

        for (const player of playersToActivate) {
            const targetPosition = desiredPositions.get(player.player_id);
            const currentPosition = currentPositions.get(player.player_id);

            if (!targetPosition || currentPosition === targetPosition) continue;

            await applyRosterMove(player.player_id, currentPosition, targetPosition, gameDate);
            currentPositions.set(player.player_id, targetPosition);
            moveDetails.push(`${player.name} -> ${targetPosition}`);
        }

        return moveDetails;
    };

    const handleStartActive = async (mode = 'today') => {
        if (!myManagerId || !selectedDate || isAutoStarting || loading || actionLoading) return;
        if (Object.keys(rosterPositionsConfig).length === 0) return;

        const datesToRun = resolveStartActiveDates(mode);
        if (datesToRun.length === 0) {
            setNotification({ type: 'error', message: 'Start Active Failed', details: ['No valid schedule date found.'] });
            setTimeout(() => setNotification(null), 3000);
            return;
        }

        setIsAutoStarting(true);
        setActionLoading(true);
        setNotification(null);
        setShowStartActiveModal(false);

        try {
            const isMultiDay = mode === 'five-days';
            let todayMoveDetails = [];
            let anyMove = false;

            for (let i = 0; i < datesToRun.length; i += 1) {
                const gameDate = datesToRun[i];
                const moveDetails = await executeStartActiveForDate(gameDate);
                if (moveDetails.length > 0) {
                    anyMove = true;
                    if (!isMultiDay && i === 0) {
                        todayMoveDetails = moveDetails;
                    }
                }
            }

            await refreshRoster();

            if (!anyMove) {
                setNotification({ type: 'success', message: 'Already optimized', details: ['All playable non-NA players are already in the best active slots.'] });
                setTimeout(() => setNotification(null), 2500);
                return;
            }

            if (isMultiDay) {
                setNotification({ type: 'success', message: 'Success', details: [] });
                setTimeout(() => setNotification(null), 2500);
            } else {
                setNotification({
                    type: 'success',
                    message: 'Start Active Complete',
                    details: todayMoveDetails
                });
                setTimeout(() => setNotification(null), 3500);
            }
        } catch (err) {
            console.error('Failed to auto-start roster:', err);
            await refreshRoster();
            setNotification({
                type: 'error',
                message: 'Start Active Failed',
                details: [err.message || 'Unable to optimize active roster.']
            });
            setTimeout(() => setNotification(null), 4000);
        } finally {
            setActionLoading(false);
            setIsAutoStarting(false);
        }
    };

    // Badge Helper
    const renderPlayerBadges = (player) => {
        if (player.player_id === 'empty') return null;
        const badges = [];

        if (player.identity && player.identity.toLowerCase() === 'foreigner') {
            badges.push(<span key="f" title="Foreign Player" className="w-5 h-5 flex items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">F</span>);
        }
        const status = (player.real_life_status || '').toUpperCase();
        if (status.includes('MN') || status.includes('MINOR') || status === 'NA') {
            badges.push(<span key="na" className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">NA</span>);
        }
        if (status.includes('DEREGISTERED') || status === 'DR' || status === 'D') {
            badges.push(<span key="dr" className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">DR</span>);
        }
        if (status.includes('UNREGISTERED') || status === 'NR') {
            badges.push(<span key="nr" className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">NR</span>);
        }
        return <div className="flex items-center gap-1">{badges}</div>;
    };

    const renderStartingBadge = (player) => {
        if (!player || player.player_id === 'empty') return null;

        const playerType = (player.batter_or_pitcher || '').toLowerCase();
        const pid = String(player.player_id || '');
        if (!pid) return null;

        if (playerType === 'batter' && startingStatus.lineupTeams.has(player.team)) {
            const battingNo = startingStatus.lineupByPlayerId[pid];
            if (battingNo) {
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-600 text-white" title="In starting lineup">{battingNo}</span>;
            }
            return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white" title="Not in starting lineup">X</span>;
        }

        if (playerType === 'pitcher' && startingStatus.pitcherPlayerIds.has(pid)) {
            return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-600 text-white" title="Today's starting pitcher">V</span>;
        }

        return null;
    };

    // Roster Construction
    const ACTIVE_POSITIONS_ORDER = ['C', '1B', '2B', '3B', 'SS', 'CI', 'MI', 'LF', 'CF', 'RF', 'OF', 'Util', 'SP', 'RP', 'P'];

    // Generate Full Roster with Empties
    const generateRosterWithEmptySlots = (currentRoster, config) => {
        const result = [...currentRoster];
        const positionsToCheck = ACTIVE_POSITIONS_ORDER.filter(pos => config[pos] > 0);
        positionsToCheck.forEach(pos => {
            const limit = config[pos] || 0;
            const currentCount = currentRoster.filter(p => p.position === pos).length;
            if (currentCount < limit) {
                const needed = limit - currentCount;
                for (let i = 0; i < needed; i++) {
                    result.push({
                        id: `empty-${pos}-${i}`,
                        player_id: 'empty',
                        position: pos,
                        name: 'Empty',
                        isEmpty: true
                    });
                }
            }
        });
        return result;
    };

    const isBatterPos = (pos) => ['C', '1B', '2B', '3B', 'SS', 'CI', 'MI', 'LF', 'CF', 'RF', 'OF', 'Util'].includes(pos);
    const isPitcherPos = (pos) => ['SP', 'RP', 'P'].includes(pos);
    const isEnabledLeaguePosition = (pos) => {
        if (!ACTIVE_POSITIONS_ORDER.includes(pos)) return true;
        return (parseInt(rosterPositionsConfig[pos], 10) || 0) > 0;
    };

    const getDisplayPositionList = (player) => {
        const rawPositions = player?.position_list
            ? player.position_list.split(',').map(pos => pos.trim()).filter(Boolean)
            : [];

        const enabledPositions = new Set(
            Object.entries(rosterPositionsConfig || {})
                .filter(([, count]) => (parseInt(count, 10) || 0) > 0)
                .map(([pos]) => pos)
        );

        const filtered = rawPositions.filter(pos => enabledPositions.has(pos));
        return filtered.length > 0 ? filtered.join(',') : '-';
    };

    const fullRoster = generateRosterWithEmptySlots(roster, rosterPositionsConfig);

    const batterRoster = fullRoster.filter(p => {
        if (isBatterPos(p.position)) return isEnabledLeaguePosition(p.position);
        if (isPitcherPos(p.position)) return false;
        return p.batter_or_pitcher === 'batter';
    }).sort((a, b) => {
        const orderConfig = { 'C': 1, '1B': 2, '2B': 3, '3B': 4, 'SS': 5, 'CI': 6, 'MI': 7, 'LF': 8, 'CF': 9, 'RF': 10, 'OF': 11, 'Util': 12, 'BN': 20, 'NA': 21 };
        return (orderConfig[a.position] || 99) - (orderConfig[b.position] || 99);
    });

    const pitcherRoster = fullRoster.filter(p => {
        if (isPitcherPos(p.position)) return isEnabledLeaguePosition(p.position);
        if (isBatterPos(p.position)) return false;
        return p.batter_or_pitcher === 'pitcher';
    }).sort((a, b) => {
        const orderConfig = { 'SP': 1, 'RP': 2, 'P': 3, 'BN': 20, 'NA': 21 };
        return (orderConfig[a.position] || 99) - (orderConfig[b.position] || 99);
    });

    const isFantasyPoints = scoringType === 'Head-to-Head Fantasy Points';

    const displayBatterCats = (() => {
        const base = batterStatCategories.length > 0 && !batterStatCategories.some(c => parseStatName(c) === 'AB')
            ? ['At Bats (AB)', ...batterStatCategories]
            : batterStatCategories;
        return isFantasyPoints ? ['Fantasy Points (FP)', ...base] : base;
    })();

    const displayPitcherCats = (() => {
        const base = pitcherStatCategories.length > 0 && !pitcherStatCategories.some(c => parseStatName(c) === 'IP')
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

    const computeCategoryTotals = (players, categories) => {
        const validPlayers = (players || []).filter((p) => {
            if (!p || p.isEmpty || !p.player_id || p.player_id === 'empty') return false;
            const slot = String(p.position || '').toUpperCase();
            return slot !== 'BN' && slot !== 'NA';
        });

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
            const row = dailyStatsForTotals[p.player_id];
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
                // Batting rate stats (must be calculated from totals)
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

                // Pitching rate stats (must be calculated from totals)
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

                // Special stats
                case 'sv+hld': return sums.sv + sums.hld;
                case 'ip': return sums.outs;
                case 'out': return sums.outs;
                case 'outs': return sums.outs;

                // Common counting stats
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
            const abbr = parseStatName(cat);
            const key = abbr.toLowerCase();
            const computed = resolveValue(key);

            return {
                abbr,
                value: formatCategoryTotal(abbr, computed)
            };
        });
    };

    const batterCategoryTotals = computeCategoryTotals(batterRoster, displayBatterCats);
    const pitcherCategoryTotals = computeCategoryTotals(pitcherRoster, displayPitcherCats);





    const isTradeDeadlinePassed = () => {
        if (!tradeEndDate || tradeEndDate.trim().toLowerCase() === 'no trade deadline') {
            console.log('Trade Deadline Check: No deadline set');
            return false;
        }

        try {
            const trimmedDate = tradeEndDate.trim();
            let dateStr = trimmedDate;
            if (!/\d{4}/.test(trimmedDate)) {
                dateStr = `${trimmedDate}, ${seasonYear}`;
            }

            const deadline = new Date(dateStr);
            if (isNaN(deadline.getTime())) return false;

            deadline.setHours(23, 59, 59, 999);
            const now = new Date();
            const passed = now > deadline;

            console.log(`Trade Deadline Check: ${passed ? 'Passed' : 'Active'} (Deadline: ${deadline.toISOString()}, Now: ${now.toISOString()})`);
            return passed;
        } catch (e) {
            console.error('Error checking trade deadline:', e);
            return false;
        }
    };

    if (error) {
        return (
            <div className="p-4 sm:p-8 text-center text-red-300 bg-red-900/20 rounded-xl border border-red-500/30 mx-4 sm:mx-8 mt-4 sm:mt-8">
                {error}
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Blur Overlay Loader */}
            {actionLoading && (
                <div className="fixed inset-0 z-[100010] bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="text-white font-bold tracking-widest animate-pulse">UPDATING ROSTER...</div>
                    </div>
                </div>
            )}

            {/* Notification Toast - Centered */}
            {notification && (
                <div className="fixed inset-0 z-[100020] flex items-center justify-center pointer-events-none">
                    <div className="pointer-events-auto animate-fade-in-down">
                        <div className={`px-4 sm:px-8 py-3 sm:py-6 rounded-2xl shadow-2xl border-2 backdrop-blur-md flex flex-col gap-1.5 sm:gap-2 items-center min-w-[260px] sm:min-w-[400px] max-w-[92vw] sm:max-w-none
                            ${notification.type === 'success'
                                ? 'bg-green-900/90 border-green-500/70 text-white'
                                : 'bg-red-900/90 border-red-500/70 text-white'}
                        `}>
                            <div className="flex items-center gap-2 sm:gap-4">
                                {notification.type === 'success' ? (
                                    <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-green-500/30 flex items-center justify-center text-green-300">
                                        <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-red-500/30 flex items-center justify-center text-red-300">
                                        <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </div>
                                )}
                                <span className="font-bold text-base sm:text-2xl tracking-wide">{notification.message}</span>
                            </div>
                            {notification.details && notification.details.length > 0 && (
                                <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2 w-full border-t border-white/20 pt-2 sm:pt-3">
                                    {notification.details.map((line, idx) => (
                                        <div key={idx} className="text-xs sm:text-base font-mono opacity-90 flex items-center gap-2 sm:gap-3">
                                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white/60"></span>
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 sm:p-8 max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                        My Roster
                    </h1>
                    <div className="flex flex-col items-start sm:items-end gap-2 sm:gap-3">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                            <select
                                value={timeWindow}
                                onChange={(e) => setTimeWindow(e.target.value)}
                                className="px-3 py-1 bg-slate-800/60 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                            >
                                <option value="Today">Today</option>
                                <option value="Yesterday">Yesterday</option>
                                <option value="Last 7 Days">Last 7 Days</option>
                                <option value="Last 14 Days">Last 14 Days</option>
                                <option value="Last 30 Days">Last 30 Days</option>
                                <option value="2026 Season">2026 Season</option>
                                <option value="2026 Spring Training">2026 Spring Training</option>
                                <option value="2025 Season">2025 Season</option>
                            </select>

                            {/* Date Selector */}
                            <div className="flex items-center gap-1.5 sm:gap-2 bg-purple-900/30 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-purple-500/30">
                                <button
                                    onClick={() => {
                                        const currentIndex = availableDates.indexOf(selectedDate);
                                        if (currentIndex > 0) {
                                            setSelectedDate(availableDates[currentIndex - 1]);
                                        }
                                    }}
                                    disabled={!selectedDate || availableDates.indexOf(selectedDate) === 0}
                                    className="p-1 rounded bg-purple-600/50 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white transition-colors"
                                    title="Previous Day"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>

                                <div className="relative">
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
                                        className="flex items-center gap-2 px-3 py-1 hover:bg-purple-600/30 rounded transition-colors cursor-pointer group"
                                    >
                                        <svg className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-white font-bold font-mono min-w-[80px] sm:min-w-[100px] text-center text-xs sm:text-sm group-hover:text-purple-100 transition-colors relative">
                                            {selectedDate || date}
                                        </span>
                                        {(() => {
                                            const todayStr = getTodayTW();
                                            const isToday = selectedDate === todayStr;
                                            return isToday ? (
                                                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 text-xs font-bold">
                                                    TODAY
                                                </span>
                                            ) : null;
                                        })()}
                                    </button>

                                    {showDatePicker && (
                                        <>
                                            <div className="fixed inset-0 z-[890]" onClick={() => setShowDatePicker(false)} />
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[900] bg-slate-900 border border-purple-500/50 rounded-xl shadow-2xl p-4 w-[280px]">
                                                {/* Header */}
                                                <div className="flex justify-between items-center mb-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newDate = new Date(viewDate);
                                                            newDate.setMonth(newDate.getMonth() - 1);
                                                            setViewDate(newDate);
                                                        }}
                                                        className="p-1 hover:bg-slate-700 rounded text-purple-300 transition-colors"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                                    </button>
                                                    <span className="text-white font-bold text-sm">
                                                        {viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newDate = new Date(viewDate);
                                                            newDate.setMonth(newDate.getMonth() + 1);
                                                            setViewDate(newDate);
                                                        }}
                                                        className="p-1 hover:bg-slate-700 rounded text-purple-300 transition-colors"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                    </button>
                                                </div>

                                                {/* Days Header */}
                                                <div className="grid grid-cols-7 mb-2">
                                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                                        <div key={d} className="text-center text-xs font-bold text-slate-500">{d}</div>
                                                    ))}
                                                </div>

                                                {/* Calendar Grid */}
                                                <div className="grid grid-cols-7 gap-1">
                                                    {/* Empty Cells */}
                                                    {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() }).map((_, i) => (
                                                        <div key={`empty-${i}`} />
                                                    ))}

                                                    {/* Days */}
                                                    {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                                                        const day = i + 1;
                                                        const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                        const isAvailable = availableDates.includes(dateStr);
                                                        const isSelected = selectedDate === dateStr;
                                                        const todayStr = getTodayTW();
                                                        const isToday = dateStr === todayStr;

                                                        return (
                                                            <button
                                                                key={dateStr}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (isAvailable) {
                                                                        setSelectedDate(dateStr);
                                                                        setShowDatePicker(false);
                                                                    }
                                                                }}
                                                                disabled={!isAvailable}
                                                                className={`
                                                                    h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                                                    ${isSelected ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50 scale-110' : ''}
                                                                    ${!isSelected && isToday ? 'border border-green-500 text-green-400' : ''}
                                                                    ${!isSelected && !isToday && isAvailable ? 'text-slate-300 hover:bg-purple-500/20 hover:text-white' : ''}
                                                                    ${!isAvailable ? 'text-slate-700 cursor-not-allowed opacity-50' : ''}
                                                                `}
                                                            >
                                                                {day}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        const currentIndex = availableDates.indexOf(selectedDate);
                                        if (currentIndex < availableDates.length - 1) {
                                            setSelectedDate(availableDates[currentIndex + 1]);
                                        }
                                    }}
                                    disabled={!selectedDate || availableDates.indexOf(selectedDate) === availableDates.length - 1}
                                    className="p-1 rounded bg-purple-600/50 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white transition-colors"
                                    title="Next Day"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Buttons Row */}
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                            {/* IP Requirement Badge */}
                            {minIPRequired !== null && weeklyIP !== null && (
                                <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wider flex items-center gap-1 ${weeklyIP < minIPRequired ? 'bg-red-600 text-white' : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'}`}>
                                    IP: {weeklyIP}/{minIPRequired}
                                </span>
                            )}
                            {/* Add Limit Badge */}
                            {maxAcquisitions !== null && (
                                <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wider flex items-center gap-1 ${weeklyAddCount >= maxAcquisitions ? 'bg-red-600 text-white' : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'}`}>
                                    ADD: {weeklyAddCount}/{maxAcquisitions}
                                </span>
                            )}
                            {!isTradeDeadlinePassed() && (
                                <button
                                    onClick={() => setShowMyTradesModal(true)}
                                    className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-pink-500/30 hover:bg-pink-500/50 border border-pink-400/50 text-pink-300 flex items-center justify-center gap-1 sm:gap-2 transition-colors text-[10px] sm:text-xs font-bold tracking-wider"
                                >
                                    <span>TRADES</span>
                                    {pendingTradeCount > 0 && (
                                        <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-pink-500 text-white flex items-center justify-center text-[7px] sm:text-[8px] font-bold shadow-lg">
                                            {pendingTradeCount}
                                        </span>
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => setShowWaiverModal(true)}
                                className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-orange-500/30 hover:bg-orange-500/50 border border-orange-400/50 text-orange-300 flex items-center justify-center transition-colors text-[10px] sm:text-xs font-bold tracking-wider"
                            >
                                WAIVER
                            </button>
                            <button
                                onClick={() => setShowStartActiveModal(true)}
                                disabled={isAutoStarting || loading || actionLoading || !selectedDate || Object.keys(rosterPositionsConfig).length === 0}
                                className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border flex items-center justify-center transition-colors text-[10px] sm:text-xs font-bold tracking-wider ${isAutoStarting || loading || actionLoading || !selectedDate || Object.keys(rosterPositionsConfig).length === 0
                                    ? 'bg-slate-700/50 border-slate-600/50 text-slate-400 cursor-not-allowed'
                                    : 'bg-emerald-500/30 hover:bg-emerald-500/50 border-emerald-400/50 text-emerald-300'
                                    }`}
                            >
                                {isAutoStarting ? 'STARTING...' : 'START ACTIVE'}
                            </button>
                            <button
                                onClick={() => setShowLegendModal(true)}
                                className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/50 text-blue-300 flex items-center justify-center transition-colors text-[10px] sm:text-xs font-bold tracking-wider"
                            >
                                LEGEND
                            </button>
                            <button
                                onClick={() => setShowInfoModal(true)}
                                className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/50 text-purple-300 flex items-center justify-center transition-colors text-[10px] sm:text-xs font-bold tracking-wider"
                            >
                                POS RULES
                            </button>
                        </div>

                        {/* Daily Category Totals (based on selectedDate, independent of timeWindow) */}
                        <div className="w-full mt-1 space-y-2">
                            <div className="overflow-x-auto pb-1">
                                <div className="text-xs sm:text-sm font-black text-pink-300 mb-1">Batters Total</div>
                                <table className="min-w-max text-xs sm:text-sm text-slate-100">
                                    <thead>
                                        <tr>
                                            {batterCategoryTotals.map((item) => (
                                                <th key={`b-total-head-${item.abbr}`} className="px-2 sm:px-3 py-1 text-center font-bold text-pink-200 whitespace-nowrap">
                                                    {item.abbr}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-t border-slate-500/60">
                                            {batterCategoryTotals.map((item) => (
                                                <td key={`b-total-val-${item.abbr}`} className="px-2 sm:px-3 py-1.5 text-center font-mono font-bold whitespace-nowrap text-purple-100">
                                                    {item.value}
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="overflow-x-auto pb-1">
                                <div className="text-xs sm:text-sm font-black text-orange-300 mb-1">Pitchers Total</div>
                                <table className="min-w-max text-xs sm:text-sm text-slate-100">
                                    <thead>
                                        <tr>
                                            {pitcherCategoryTotals.map((item) => (
                                                <th key={`p-total-head-${item.abbr}`} className="px-2 sm:px-3 py-1 text-center font-bold text-orange-200 whitespace-nowrap">
                                                    {item.abbr}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-t border-slate-500/60">
                                            {pitcherCategoryTotals.map((item) => (
                                                <td key={`p-total-val-${item.abbr}`} className="px-2 sm:px-3 py-1.5 text-center font-mono font-bold whitespace-nowrap text-purple-100">
                                                    {item.value}
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Batter Table */}
                <div className="mb-6 sm:mb-8">
                    <h2 className="text-lg sm:text-xl font-bold text-purple-300 mb-2 flex items-center gap-2">
                        <span className="w-2 h-6 bg-pink-500 rounded-full"></span>
                        Batter Roster
                    </h2>
                    <div className="relative bg-gradient-to-br from-slate-900/80 to-purple-900/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl overflow-hidden shadow-xl overflow-x-auto">
                        {loading && (
                            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-20">
                                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                        <table className="w-full">
                            <thead className="bg-purple-900/40 border-b border-purple-500/30">
                                <tr>
                                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-purple-200 w-16 sm:w-24">Slot</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold text-purple-200 hidden sm:table-cell">Player</th>
                                    {displayBatterCats.map(stat => {
                                        const isFp = parseStatName(stat) === 'FP';
                                        const isForced = !batterStatCategories.includes(stat);
                                        return (
                                            <th key={stat} className={`px-2 sm:px-4 py-3 sm:py-4 text-center text-xs sm:text-sm font-bold ${isFp ? 'text-amber-300' : isForced ? 'text-purple-300/60' : 'text-purple-300'} w-12 sm:w-16`}>
                                                {parseStatName(stat)}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-purple-500/10">
                                {batterRoster.length === 0 ? (
                                    <tr><td colSpan={10} className="p-4 text-center text-purple-300">No Batters</td></tr>
                                ) : batterRoster.map(player => (
                                    <React.Fragment key={player.id}>
                                        <tr className="hover:bg-purple-500/5 transition">
                                            {/* 桌面版：Slot (無 rowSpan) */}
                                            <td className="px-6 py-4 align-middle text-center hidden sm:table-cell">
                                                <button
                                                    onClick={() => handleSlotClick(player)}
                                                    disabled={player.isEmpty || !isMoveAllowed(player)}
                                                    className={`inline-block px-2 py-1 rounded text-xs font-bold w-12 text-center transition-transform active:scale-95 ${player.isEmpty ? 'bg-slate-800 text-slate-500 cursor-default' :
                                                        !isMoveAllowed(player) ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60' :
                                                            ['BN', 'IL', 'NA'].includes(player.position)
                                                                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer shadow-sm'
                                                                : 'bg-purple-600 text-white hover:bg-purple-500 cursor-pointer shadow-sm'
                                                        }`}>
                                                    {player.position}
                                                </button>
                                            </td>
                                            {/* 手機版：Slot (有 rowSpan) */}
                                            <td className="px-3 py-2 align-middle text-center sm:hidden" rowSpan={player.isEmpty ? 1 : 2}>
                                                <button
                                                    onClick={() => handleSlotClick(player)}
                                                    disabled={player.isEmpty || !isMoveAllowed(player)}
                                                    className={`inline-block px-2 py-1 rounded text-xs font-bold w-12 text-center transition-transform active:scale-95 ${player.isEmpty ? 'bg-slate-800 text-slate-500 cursor-default' :
                                                        !isMoveAllowed(player) ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60' :
                                                            ['BN', 'IL', 'NA'].includes(player.position)
                                                                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer shadow-sm'
                                                                : 'bg-purple-600 text-white hover:bg-purple-500 cursor-pointer shadow-sm'
                                                        }`}>
                                                    {player.position}
                                                </button>
                                            </td>
                                            {/* 桌面版：Player info (單欄) */}
                                            <td className="px-6 py-4 hidden sm:table-cell">
                                                {player.isEmpty ? (
                                                    <div className="flex items-center gap-4 text-slate-500 font-bold italic">Empty</div>
                                                ) : (
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800 flex-shrink-0">
                                                            {getPlayerPhoto(player) && <img src={getPlayerPhoto(player)} alt={player.name} className="w-full h-full object-cover" onError={handleImageError} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-lg flex items-center gap-x-2 whitespace-nowrap">
                                                                <button
                                                                    onClick={() => setSelectedPlayerModal(player)}
                                                                    className="hover:text-purple-300 transition-colors cursor-pointer"
                                                                >
                                                                    {player.name}
                                                                </button>
                                                                <span className="text-purple-300/70 text-sm font-normal ml-2">- {getDisplayPositionList(player)}</span>
                                                                <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>{player.team ? getTeamAbbr(player.team) : ''}</span>
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-2">
                                                                {player.original_name && player.original_name !== player.name && (
                                                                    <span className="text-purple-300/70 text-[11px] font-sans border-r border-slate-600 pr-2">
                                                                        {player.original_name}
                                                                    </span>
                                                                )}
                                                                <span className="text-xs text-slate-400 font-mono">
                                                                    {player.game_info ? (
                                                                        player.game_info.is_postponed ? (
                                                                            <span className="text-red-400">PPD</span>
                                                                        ) : player.game_info.away_team_score != null && player.game_info.home_team_score != null ? (
                                                                            (() => {
                                                                                const myScore = player.game_info.is_home ? player.game_info.home_team_score : player.game_info.away_team_score;
                                                                                const oppScore = player.game_info.is_home ? player.game_info.away_team_score : player.game_info.home_team_score;
                                                                                const result = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
                                                                                const resultColor = result === 'W' ? 'text-green-400' : result === 'L' ? 'text-red-400' : 'text-cyan-300';
                                                                                return (
                                                                                    <>
                                                                                        <span className={`font-bold ${resultColor}`}>{myScore}:{oppScore} {result}</span>
                                                                                        {' '}
                                                                                        {player.game_info.is_home ? 'vs' : '@'}
                                                                                        {' '}
                                                                                        {player.game_info.opponent}
                                                                                    </>
                                                                                );
                                                                            })()
                                                                        ) : (
                                                                            <>
                                                                                {new Date(player.game_info.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                                {' '}
                                                                                {player.game_info.is_home ? 'vs' : '@'}
                                                                                {' '}
                                                                                {player.game_info.opponent}
                                                                            </>
                                                                        )
                                                                    ) : (
                                                                        'No game'
                                                                    )}
                                                                </span>
                                                                {renderStartingBadge(player)}
                                                                {renderPlayerBadges(player)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            {/* 手機版：Player info (colSpan 跨所有 stat 欄位) */}
                                            <td className="px-3 py-2 sm:hidden" colSpan={displayBatterCats.length}>
                                                {player.isEmpty ? (
                                                    <div className="flex items-center gap-2 text-slate-500 font-bold italic">Empty</div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800 flex-shrink-0">
                                                            {getPlayerPhoto(player) && <img src={getPlayerPhoto(player)} alt={player.name} className="w-full h-full object-cover" onError={handleImageError} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-sm flex items-center whitespace-nowrap">
                                                                <button
                                                                    onClick={() => setSelectedPlayerModal(player)}
                                                                    className="hover:text-purple-300 transition-colors cursor-pointer"
                                                                >
                                                                    {player.name}
                                                                </button>
                                                                <span className="text-purple-300/70 text-sm font-normal ml-2">- {getDisplayPositionList(player)}</span>
                                                                <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>{player.team ? getTeamAbbr(player.team) : ''}</span>
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-2">
                                                                {player.original_name && player.original_name !== player.name && (
                                                                    <span className="text-purple-300/70 text-[11px] font-sans border-r border-slate-600 pr-2">
                                                                        {player.original_name}
                                                                    </span>
                                                                )}
                                                                <span className="text-xs text-slate-400 font-mono">
                                                                    {player.game_info ? (
                                                                        player.game_info.is_postponed ? (
                                                                            <span className="text-red-400">PPD</span>
                                                                        ) : player.game_info.away_team_score != null && player.game_info.home_team_score != null ? (
                                                                            (() => {
                                                                                const myScore = player.game_info.is_home ? player.game_info.home_team_score : player.game_info.away_team_score;
                                                                                const oppScore = player.game_info.is_home ? player.game_info.away_team_score : player.game_info.home_team_score;
                                                                                const result = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
                                                                                const resultColor = result === 'W' ? 'text-green-400' : result === 'L' ? 'text-red-400' : 'text-cyan-300';
                                                                                return (
                                                                                    <>
                                                                                        <span className={`font-bold ${resultColor}`}>{myScore}:{oppScore} {result}</span>
                                                                                        {' '}
                                                                                        {player.game_info.is_home ? 'vs' : '@'}
                                                                                        {' '}
                                                                                        {player.game_info.opponent}
                                                                                    </>
                                                                                );
                                                                            })()
                                                                        ) : (
                                                                            <>
                                                                                {new Date(player.game_info.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                                {' '}
                                                                                {player.game_info.is_home ? 'vs' : '@'}
                                                                                {' '}
                                                                                {player.game_info.opponent}
                                                                            </>
                                                                        )
                                                                    ) : (
                                                                        'No game'
                                                                    )}
                                                                </span>
                                                                {renderStartingBadge(player)}
                                                                {renderPlayerBadges(player)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            {displayBatterCats.map(stat => {
                                                const isFp = parseStatName(stat) === 'FP';
                                                const isForced = !batterStatCategories.includes(stat);
                                                return (
                                                    <td key={stat} className={`px-4 py-4 text-center font-mono hidden sm:table-cell ${isFp ? 'text-amber-300 font-black' : isForced ? 'text-slate-500' : 'text-purple-100'}`}>
                                                        {formatStat(getPlayerStat(player.player_id, stat))}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        {/* 手機版：stats 第二行 (Slot 已 rowSpan，不需留白) */}
                                        {!player.isEmpty && (
                                            <tr className="sm:hidden border-b border-purple-500/10 bg-slate-800/20">
                                                {displayBatterCats.map(stat => {
                                                    const isFp = parseStatName(stat) === 'FP';
                                                    const isForced = !batterStatCategories.includes(stat);
                                                    return (
                                                        <td key={stat} className="px-2 py-2 text-center text-[11px] font-mono whitespace-nowrap">
                                                            <span className={`font-bold ${isFp ? 'text-amber-300' : isForced ? 'text-slate-500' : 'text-purple-100'}`}>{formatStat(getPlayerStat(player.player_id, stat))}</span>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pitcher Table */}
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-purple-300 mb-2 flex items-center gap-2">
                        <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                        Pitcher Roster
                    </h2>
                    <div className="relative bg-gradient-to-br from-slate-900/80 to-purple-900/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl overflow-hidden shadow-xl overflow-x-auto">
                        {loading && (
                            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-20">
                                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                        <table className="w-full">
                            <thead className="bg-purple-900/40 border-b border-purple-500/30">
                                <tr>
                                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-purple-200 w-16 sm:w-24">Slot</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold text-purple-200 hidden sm:table-cell">Player</th>
                                    {displayPitcherCats.map(stat => {
                                        const isFp = parseStatName(stat) === 'FP';
                                        const isForced = !pitcherStatCategories.includes(stat);
                                        return (
                                            <th key={stat} className={`px-2 sm:px-4 py-3 sm:py-4 text-center text-xs sm:text-sm font-bold ${isFp ? 'text-amber-300' : isForced ? 'text-purple-300/60' : 'text-purple-300'} w-12 sm:w-16`}>
                                                {parseStatName(stat)}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-purple-500/10">
                                {pitcherRoster.length === 0 ? (
                                    <tr><td colSpan={10} className="p-4 text-center text-purple-300">No Pitchers</td></tr>
                                ) : pitcherRoster.map(player => (
                                    <React.Fragment key={player.id}>
                                        <tr className="hover:bg-purple-500/5 transition">
                                            {/* 桌面版：Slot (無 rowSpan) */}
                                            <td className="px-6 py-4 align-middle text-center hidden sm:table-cell">
                                                <button
                                                    onClick={() => handleSlotClick(player)}
                                                    disabled={player.isEmpty || !isMoveAllowed(player)}
                                                    className={`inline-block px-2 py-1 rounded text-xs font-bold w-12 text-center transition-transform active:scale-95 ${player.isEmpty ? 'bg-slate-800 text-slate-500 cursor-default' :
                                                        !isMoveAllowed(player) ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60' :
                                                            ['BN', 'IL', 'NA'].includes(player.position)
                                                                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer shadow-sm'
                                                                : 'bg-purple-600 text-white hover:bg-purple-500 cursor-pointer shadow-sm'
                                                        }`}>
                                                    {player.position}
                                                </button>
                                            </td>
                                            {/* 手機版：Slot (有 rowSpan) */}
                                            <td className="px-3 py-2 align-middle text-center sm:hidden" rowSpan={player.isEmpty ? 1 : 2}>
                                                <button
                                                    onClick={() => handleSlotClick(player)}
                                                    disabled={player.isEmpty || !isMoveAllowed(player)}
                                                    className={`inline-block px-2 py-1 rounded text-xs font-bold w-12 text-center transition-transform active:scale-95 ${player.isEmpty ? 'bg-slate-800 text-slate-500 cursor-default' :
                                                        !isMoveAllowed(player) ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60' :
                                                            ['BN', 'IL', 'NA'].includes(player.position)
                                                                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer shadow-sm'
                                                                : 'bg-purple-600 text-white hover:bg-purple-500 cursor-pointer shadow-sm'
                                                        }`}>
                                                    {player.position}
                                                </button>
                                            </td>
                                            {/* 桌面版：Player info (單欄) */}
                                            <td className="px-6 py-4 hidden sm:table-cell">
                                                {player.isEmpty ? (
                                                    <div className="flex items-center gap-4 text-slate-500 font-bold italic">Empty</div>
                                                ) : (
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800 flex-shrink-0">
                                                            {getPlayerPhoto(player) && <img src={getPlayerPhoto(player)} alt={player.name} className="w-full h-full object-cover" onError={handleImageError} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-lg flex items-center gap-x-2 whitespace-nowrap">
                                                                <button
                                                                    onClick={() => setSelectedPlayerModal(player)}
                                                                    className="hover:text-purple-300 transition-colors cursor-pointer"
                                                                >
                                                                    {player.name}
                                                                </button>
                                                                <span className="text-purple-300/70 text-sm font-normal ml-2">- {getDisplayPositionList(player)}</span>
                                                                <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>{player.team ? getTeamAbbr(player.team) : ''}</span>
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-2">
                                                                {player.original_name && player.original_name !== player.name && (
                                                                    <span className="text-purple-300/70 text-[11px] font-sans border-r border-slate-600 pr-2">
                                                                        {player.original_name}
                                                                    </span>
                                                                )}
                                                                <span className="text-xs text-slate-400 font-mono">
                                                                    {player.game_info ? (
                                                                        player.game_info.is_postponed ? (
                                                                            <span className="text-red-400">PPD</span>
                                                                        ) : player.game_info.away_team_score != null && player.game_info.home_team_score != null ? (
                                                                            (() => {
                                                                                const myScore = player.game_info.is_home ? player.game_info.home_team_score : player.game_info.away_team_score;
                                                                                const oppScore = player.game_info.is_home ? player.game_info.away_team_score : player.game_info.home_team_score;
                                                                                const result = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
                                                                                const resultColor = result === 'W' ? 'text-green-400' : result === 'L' ? 'text-red-400' : 'text-cyan-300';
                                                                                return (
                                                                                    <>
                                                                                        <span className={`font-bold ${resultColor}`}>{myScore}:{oppScore} {result}</span>
                                                                                        {' '}
                                                                                        {player.game_info.is_home ? 'vs' : '@'}
                                                                                        {' '}
                                                                                        {player.game_info.opponent}
                                                                                    </>
                                                                                );
                                                                            })()
                                                                        ) : (
                                                                            <>
                                                                                {new Date(player.game_info.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                                {' '}
                                                                                {player.game_info.is_home ? 'vs' : '@'}
                                                                                {' '}
                                                                                {player.game_info.opponent}
                                                                            </>
                                                                        )
                                                                    ) : (
                                                                        'No game'
                                                                    )}
                                                                </span>
                                                                {renderStartingBadge(player)}
                                                                {renderPlayerBadges(player)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            {/* 手機版：Player info (colSpan 跨所有 stat 欄位) */}
                                            <td className="px-3 py-2 sm:hidden" colSpan={displayPitcherCats.length}>
                                                {player.isEmpty ? (
                                                    <div className="flex items-center gap-2 text-slate-500 font-bold italic">Empty</div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800 flex-shrink-0">
                                                            {getPlayerPhoto(player) && <img src={getPlayerPhoto(player)} alt={player.name} className="w-full h-full object-cover" onError={handleImageError} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-sm flex items-center whitespace-nowrap">
                                                                <button
                                                                    onClick={() => setSelectedPlayerModal(player)}
                                                                    className="hover:text-purple-300 transition-colors cursor-pointer"
                                                                >
                                                                    {player.name}
                                                                </button>
                                                                <span className="text-purple-300/70 text-sm font-normal ml-2">- {getDisplayPositionList(player)}</span>
                                                                <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>{player.team ? getTeamAbbr(player.team) : ''}</span>
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-2">
                                                                {player.original_name && player.original_name !== player.name && (
                                                                    <span className="text-purple-300/70 text-[11px] font-sans border-r border-slate-600 pr-2">
                                                                        {player.original_name}
                                                                    </span>
                                                                )}
                                                                <span className="text-xs text-slate-400 font-mono">
                                                                    {player.game_info ? (
                                                                        player.game_info.is_postponed ? (
                                                                            <span className="text-red-400">PPD</span>
                                                                        ) : player.game_info.away_team_score != null && player.game_info.home_team_score != null ? (
                                                                            (() => {
                                                                                const myScore = player.game_info.is_home ? player.game_info.home_team_score : player.game_info.away_team_score;
                                                                                const oppScore = player.game_info.is_home ? player.game_info.away_team_score : player.game_info.home_team_score;
                                                                                const result = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
                                                                                const resultColor = result === 'W' ? 'text-green-400' : result === 'L' ? 'text-red-400' : 'text-cyan-300';
                                                                                return (
                                                                                    <>
                                                                                        <span className={`font-bold ${resultColor}`}>{myScore}:{oppScore} {result}</span>
                                                                                        {' '}
                                                                                        {player.game_info.is_home ? 'vs' : '@'}
                                                                                        {' '}
                                                                                        {player.game_info.opponent}
                                                                                    </>
                                                                                );
                                                                            })()
                                                                        ) : (
                                                                            <>
                                                                                {new Date(player.game_info.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                                {' '}
                                                                                {player.game_info.is_home ? 'vs' : '@'}
                                                                                {' '}
                                                                                {player.game_info.opponent}
                                                                            </>
                                                                        )
                                                                    ) : (
                                                                        'No game'
                                                                    )}
                                                                </span>
                                                                {renderStartingBadge(player)}
                                                                {renderPlayerBadges(player)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            {displayPitcherCats.map(stat => {
                                                const isFp = parseStatName(stat) === 'FP';
                                                const isForced = !pitcherStatCategories.includes(stat);
                                                return (
                                                    <td key={stat} className={`px-4 py-4 text-center font-mono hidden sm:table-cell ${isFp ? 'text-amber-300 font-black' : isForced ? 'text-slate-500' : 'text-purple-100'}`}>
                                                        {formatStat(getPlayerStat(player.player_id, stat))}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        {/* 手機版：stats 第二行 (Slot 已 rowSpan，不需留白) */}
                                        {!player.isEmpty && (
                                            <tr className="sm:hidden border-b border-purple-500/10 bg-slate-800/20">
                                                {displayPitcherCats.map(stat => {
                                                    const isFp = parseStatName(stat) === 'FP';
                                                    const isForced = !pitcherStatCategories.includes(stat);
                                                    return (
                                                        <td key={stat} className="px-2 py-2 text-center text-[11px] font-mono whitespace-nowrap">
                                                            <span className={`font-bold ${isFp ? 'text-amber-300' : isForced ? 'text-slate-500' : 'text-purple-100'}`}>{formatStat(getPlayerStat(player.player_id, stat))}</span>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <LegendModal isOpen={showLegendModal} onClose={() => setShowLegendModal(false)} batterStats={batterStatCategories} pitcherStats={pitcherStatCategories} />

                {
                    showInfoModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]" onClick={() => setShowInfoModal(false)}>
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-0 max-w-2xl w-full mx-4 border border-purple-500/30 shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-between p-6 border-b border-purple-500/20 flex-shrink-0">
                                    <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                                        <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Position Eligibility Rules
                                    </h3>
                                    <button
                                        onClick={() => setShowInfoModal(false)}
                                        className="text-gray-400 hover:text-white transition-colors"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-4 sm:space-y-5 text-purple-100">
                                    <div className="bg-purple-500/10 rounded-lg p-5 border border-purple-500/20">
                                        <h4 className="text-lg font-bold text-purple-300 mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                            Batter Position Eligibility
                                        </h4>

                                        <p className="text-purple-200 leading-relaxed">
                                            Players must appear in <span className="font-bold text-green-300">8 or more games</span> at a position to be eligible for that position.
                                        </p>
                                    </div>

                                    <div className="bg-purple-500/10 rounded-lg p-5 border border-purple-500/20">
                                        <h4 className="text-lg font-bold text-purple-300 mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                                            Pitcher Position Eligibility
                                        </h4>
                                        <div className="space-y-2 text-purple-200">
                                            <p className="leading-relaxed">
                                                <span className="font-bold text-orange-300">SP (Starting Pitcher):</span> Must have <span className="font-bold text-orange-300">3 or more</span> starting appearances.
                                            </p>
                                            <p className="leading-relaxed">
                                                <span className="font-bold text-orange-300">RP (Relief Pitcher):</span> Must have <span className="font-bold text-orange-300">5 or more</span> relief appearances.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-blue-500/10 rounded-lg p-5 border border-blue-500/20">
                                        <h4 className="text-lg font-bold text-blue-300 mb-3 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                            Data Coverage
                                        </h4>
                                        <p className="text-blue-200 leading-relaxed">
                                            Position eligibility is calculated using <span className="font-bold text-blue-300">2025 OR 2026</span> season statistics (union of both seasons).
                                        </p>
                                    </div>
                                </div>

                                <div className="p-6 border-t border-purple-500/20 flex justify-end flex-shrink-0">
                                    <button
                                        onClick={() => setShowInfoModal(false)}
                                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                                    >
                                        Got it
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {showStartActiveModal && (
                    <div className="fixed inset-0 z-[100050] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowStartActiveModal(false)} />
                        <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 border border-emerald-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                            <h3 className="text-lg font-bold text-white mb-2">Start Active Range</h3>
                            <p className="text-sm text-slate-300 mb-5">Choose how far to apply Start Active.</p>
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => handleStartActive('today')}
                                    className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                                >
                                    Today
                                </button>
                                <button
                                    onClick={() => handleStartActive('five-days')}
                                    className="w-full px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors"
                                >
                                    5 Days (include today)
                                </button>
                                <button
                                    onClick={() => setShowStartActiveModal(false)}
                                    className="w-full px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <MoveModal
                    isOpen={showMoveModal}
                    onClose={() => setShowMoveModal(false)}
                    player={playerToMove}
                    roster={fullRoster}
                    playerStats={playerStats}
                    batterStats={batterStatCategories}
                    pitcherStats={pitcherStatCategories}
                    rosterPositionsConfig={rosterPositionsConfig}
                    foreignerActiveLimit={foreignerActiveLimit}
                    onMove={handleMovePlayer}
                />

                <MyTradesModal
                    isOpen={showMyTradesModal}
                    onClose={() => setShowMyTradesModal(false)}
                    leagueId={leagueId}
                    managerId={myManagerId}
                />

                <PlayerDetailModal
                    isOpen={!!selectedPlayerModal}
                    onClose={() => setSelectedPlayerModal(null)}
                    player={selectedPlayerModal ? { ...selectedPlayerModal, roster_percentage: rosterPercentageMap[selectedPlayerModal.player_id] ?? 0 } : null}
                    leagueId={leagueId}
                    // Transaction Props (for Drop button)
                    myManagerId={myManagerId}
                    ownership={selectedPlayerModal ? { manager_id: myManagerId, status: 'on team' } : null}
                    leagueStatus={leagueStatus}
                    tradeEndDate={tradeEndDate}
                    seasonYear={seasonYear}
                    statusDate={selectedDate || getTodayTW()}
                    isPlayerLocked={selectedPlayerModal ? activeTradePlayerIds.has(selectedPlayerModal.player_id) : false}
                    isDropLockedByGameStart={selectedPlayerModal ? isDropLockedByGameStart(selectedPlayerModal) : false}
                    onDrop={(player) => handleDropPlayer(player)}
                    // Watch Props
                    isWatched={selectedPlayerModal ? watchedPlayerIds.has(selectedPlayerModal.player_id) : false}
                    onToggleWatch={handleToggleWatch}
                />

                {/* Drop Confirmation Modal */}
                {
                    showConfirmDrop && playerToDrop && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmDrop(false)} />
                            <div className="relative bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                                <h3 className="text-xl font-bold text-white mb-4">Confirm Drop</h3>
                                <p className="text-slate-300 mb-6">
                                    Are you sure you want to drop <span className="font-bold text-red-400">{playerToDrop.name}</span>?
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setShowConfirmDrop(false)}
                                        className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDropPlayer}
                                        disabled={isDropping}
                                        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                                    >
                                        {isDropping ? 'Dropping...' : 'Drop'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
            {/* Waiver Modal */}
            < WaiverModal
                isOpen={showWaiverModal}
                onClose={() => setShowWaiverModal(false)
                }
                leagueId={leagueId}
                managerId={myManagerId}
            />
        </div >
    );
}