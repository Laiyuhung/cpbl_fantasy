'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import LegendModal from '../../../../components/LegendModal';
import MoveModal from './MoveModal';
import MyTradesModal from '../../../../components/MyTradesModal';
import WaiverModal from '../../../../components/WaiverModal';
import PlayerDetailModal from '../../../../components/PlayerDetailModal';

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
    const [batterStatCategories, setBatterStatCategories] = useState([]);
    const [pitcherStatCategories, setPitcherStatCategories] = useState([]);

    // Settings State
    const [rosterPositionsConfig, setRosterPositionsConfig] = useState({});
    const [foreignerActiveLimit, setForeignerActiveLimit] = useState(null);

    // Modals
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showLegendModal, setShowLegendModal] = useState(false);
    const [showWaiverModal, setShowWaiverModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
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
    const [activeTradePlayerIds, setActiveTradePlayerIds] = useState(new Set());
    const [leagueStatus, setLeagueStatus] = useState('unknown');

    // Watch State
    const [watchedPlayerIds, setWatchedPlayerIds] = useState(new Set());

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
                        const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
                        const todayStr = taiwanTime.toISOString().split('T')[0];

                        console.log('='.repeat(80));
                        console.log('📅 [Roster] Date Initialization');
                        console.log('UTC Time:', now.toISOString());
                        console.log('Taiwan Time (UTC+8):', taiwanTime.toISOString());
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

    // Fetch roster when selectedDate changes
    useEffect(() => {
        if (!selectedDate) return;

        const fetchRosterForDate = async () => {
            setLoading(true);
            await refreshRoster();
            setLoading(false);
        };

        fetchRosterForDate();
    }, [selectedDate]);

    // Derive timeWindow from selectedDate — re-fetches stats when date changes
    useEffect(() => {
        if (!selectedDate) return;
        const taiwanNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
        const todayStr = taiwanNow.toISOString().split('T')[0];
        setTimeWindow(selectedDate === todayStr ? 'Today' : selectedDate);
    }, [selectedDate]);

    // Settings
    useEffect(() => {
        const fetchSettings = async () => {
            const settingsRes = await fetch(`/api/league-settings?league_id=${leagueId}`);
            const settingsData = await settingsRes.json();
            if (settingsData.success && settingsData.data) {
                setBatterStatCategories(settingsData.data.batter_stat_categories || []);
                setPitcherStatCategories(settingsData.data.pitcher_stat_categories || []);

                setRosterPositionsConfig(settingsData.data.roster_positions || {});
                setForeignerActiveLimit(settingsData.data.foreigner_active_limit);
            }
        };
        fetchSettings();
    }, [leagueId]);

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
                const [batterRes, pitcherRes] = await Promise.all([
                    fetch(`/api/playerStats/batting-summary?time_window=${encodeURIComponent(timeWindow)}`),
                    fetch(`/api/playerStats/pitching-summary?time_window=${encodeURIComponent(timeWindow)}`)
                ]);
                const batterData = await batterRes.json();
                const pitcherData = await pitcherRes.json();
                const newStats = {};
                if (batterData.success && batterData.stats) batterData.stats.forEach(s => newStats[s.player_id] = s);
                if (pitcherData.success && pitcherData.stats) pitcherData.stats.forEach(s => newStats[s.player_id] = s);
                setPlayerStats(newStats);
            } catch (err) { console.error('Failed to fetch stats:', err); }
        };
        fetchStats();
    }, [timeWindow]);

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

    const getPlayerStat = (playerId, statKey) => {
        if (!playerId || playerId === 'empty') return '-';
        const stats = playerStats[playerId];
        if (!stats) return '-';
        let fieldName = statKey;
        const matches = statKey.match(/\(([^)]+)\)/g);
        if (matches) fieldName = matches[matches.length - 1].replace(/[()]/g, '');
        const value = stats[fieldName.toLowerCase()];
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
                if (!cancelled && data.results) setPhotoSrcMap(data.results);
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
    const isMoveAllowed = (player) => {
        if (!selectedDate) return true;

        // 1. Past Date Check
        const now = new Date();
        const taiwanTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
        const todayStr = taiwanTime.toISOString().split('T')[0];

        if (selectedDate < todayStr) return false;

        // 2. Game Time Check (Only for Today)
        if (selectedDate === todayStr && player.game_info && player.game_info.time) {
            // Parse Game Time
            const [gHour, gMin] = player.game_info.time.split(':').map(Number);
            const gameDateObj = new Date(taiwanTime);
            gameDateObj.setHours(gHour, gMin, 0, 0);

            const isGameStarted = taiwanTime >= gameDateObj;
            // TODO: Add PPD check if available in game_info, currently assuming not PPD if valid time

            if (isGameStarted) {
                // Starter Locked
                if (!['BN', 'NA'].includes(player.position)) {
                    return false;
                }
                // BN/NA are allowed to move (but target restricted)
            }
        }

        return true;
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

    const fullRoster = generateRosterWithEmptySlots(roster, rosterPositionsConfig);

    const batterRoster = fullRoster.filter(p => {
        if (isBatterPos(p.position)) return true;
        if (isPitcherPos(p.position)) return false;
        return p.batter_or_pitcher === 'batter';
    }).sort((a, b) => {
        const orderConfig = { 'C': 1, '1B': 2, '2B': 3, '3B': 4, 'SS': 5, 'CI': 6, 'MI': 7, 'LF': 8, 'CF': 9, 'RF': 10, 'OF': 11, 'Util': 12, 'BN': 20, 'NA': 21 };
        return (orderConfig[a.position] || 99) - (orderConfig[b.position] || 99);
    });

    const pitcherRoster = fullRoster.filter(p => {
        if (isPitcherPos(p.position)) return true;
        if (isBatterPos(p.position)) return false;
        return p.batter_or_pitcher === 'pitcher';
    }).sort((a, b) => {
        const orderConfig = { 'SP': 1, 'RP': 2, 'P': 3, 'BN': 20, 'NA': 21 };
        return (orderConfig[a.position] || 99) - (orderConfig[b.position] || 99);
    });

    const displayBatterCats = batterStatCategories.length > 0 && !batterStatCategories.some(c => parseStatName(c) === 'AB')
        ? ['At Bats (AB)', ...batterStatCategories]
        : batterStatCategories;

    const displayPitcherCats = pitcherStatCategories.length > 0 && !pitcherStatCategories.some(c => parseStatName(c) === 'IP')
        ? ['Innings Pitched (IP)', ...pitcherStatCategories]
        : pitcherStatCategories;





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
            <div className="p-8 text-center text-red-300 bg-red-900/20 rounded-xl border border-red-500/30 mx-8 mt-8">
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
                        <div className={`px-8 py-6 rounded-2xl shadow-2xl border-2 backdrop-blur-md flex flex-col gap-2 items-center min-w-[400px]
                            ${notification.type === 'success'
                                ? 'bg-green-900/90 border-green-500/70 text-white'
                                : 'bg-red-900/90 border-red-500/70 text-white'}
                        `}>
                            <div className="flex items-center gap-4">
                                {notification.type === 'success' ? (
                                    <div className="w-12 h-12 rounded-full bg-green-500/30 flex items-center justify-center text-green-300">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-red-500/30 flex items-center justify-center text-red-300">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </div>
                                )}
                                <span className="font-bold text-2xl tracking-wide">{notification.message}</span>
                            </div>
                            {notification.details && notification.details.length > 0 && (
                                <div className="mt-3 space-y-2 w-full border-t border-white/20 pt-3">
                                    {notification.details.map((line, idx) => (
                                        <div key={idx} className="text-base font-mono opacity-90 flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full bg-white/60"></span>
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="p-8 max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                        My Roster
                    </h1>
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-4">
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
                                <option value="2025 Season">2025 Season</option>
                            </select>

                            {/* Date Selector */}
                            <div className="flex items-center gap-2 bg-purple-900/30 px-4 py-2 rounded-lg border border-purple-500/30">
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
                                        <span className="text-white font-bold font-mono min-w-[100px] text-center group-hover:text-purple-100 transition-colors relative">
                                            {selectedDate || date}
                                        </span>
                                        {(() => {
                                            const now = new Date();
                                            const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
                                            const todayStr = taiwanTime.toISOString().split('T')[0];
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
                                                        const now = new Date();
                                                        const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
                                                        const todayStr = taiwanTime.toISOString().split('T')[0];
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
                        <div className="flex items-center gap-2">
                            {!isTradeDeadlinePassed() && (
                                <button
                                    onClick={() => setShowMyTradesModal(true)}
                                    className="px-3 py-1 rounded-full bg-pink-500/30 hover:bg-pink-500/50 border border-pink-400/50 text-pink-300 flex items-center justify-center gap-2 transition-colors text-xs font-bold tracking-wider"
                                >
                                    <span>TRADES</span>
                                    {pendingTradeCount > 0 && (
                                        <span className="w-4 h-4 rounded-full bg-pink-500 text-white flex items-center justify-center text-[8px] font-bold shadow-lg">
                                            {pendingTradeCount}
                                        </span>
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => setShowWaiverModal(true)}
                                className="px-3 py-1 rounded-full bg-orange-500/30 hover:bg-orange-500/50 border border-orange-400/50 text-orange-300 flex items-center justify-center transition-colors text-xs font-bold tracking-wider"
                            >
                                WAIVER
                            </button>
                            <button
                                onClick={() => setShowLegendModal(true)}
                                className="px-3 py-1 rounded-full bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/50 text-blue-300 flex items-center justify-center transition-colors text-xs font-bold tracking-wider"
                            >
                                LEGEND
                            </button>
                            <button
                                onClick={() => setShowInfoModal(true)}
                                className="px-3 py-1 rounded-full bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/50 text-purple-300 flex items-center justify-center transition-colors text-xs font-bold tracking-wider"
                            >
                                POS RULES
                            </button>
                        </div>
                    </div>
                </div>

                {/* Batter Table */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-purple-300 mb-2 flex items-center gap-2">
                        <span className="w-2 h-6 bg-pink-500 rounded-full"></span>
                        Batter Roster
                    </h2>
                    <div className="relative bg-gradient-to-br from-slate-900/80 to-purple-900/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl overflow-hidden shadow-xl">
                        {loading && (
                            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-20">
                                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                        <table className="w-full">
                            <thead className="bg-purple-900/40 border-b border-purple-500/30">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-bold text-purple-200 w-24">Slot</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold text-purple-200">Player</th>
                                    {displayBatterCats.map(stat => {
                                        const isForced = !batterStatCategories.includes(stat);
                                        return (
                                            <th key={stat} className={`px-4 py-4 text-center text-sm font-bold ${isForced ? 'text-purple-300/60' : 'text-purple-300'} w-16`}>
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
                                    <tr key={player.id} className="hover:bg-purple-500/5 transition">
                                        <td className="px-6 py-4">
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
                                        <td className="px-6 py-4">
                                            {player.isEmpty ? (
                                                <div className="flex items-center gap-4 text-slate-500 font-bold italic">Empty</div>
                                            ) : (
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800 flex-shrink-0">
                                                        {getPlayerPhoto(player) && <img src={getPlayerPhoto(player)} alt={player.name} className="w-full h-full object-cover" onError={handleImageError} />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white text-lg flex items-center">
                                                            <button
                                                                onClick={() => setSelectedPlayerModal(player)}
                                                                className="hover:text-purple-300 transition-colors cursor-pointer"
                                                            >
                                                                {player.name}
                                                            </button>
                                                            {player.original_name && player.original_name !== player.name && (
                                                                <span className="text-purple-300/60 text-sm font-normal ml-2">({player.original_name})</span>
                                                            )}
                                                            <span className="text-purple-300/70 text-sm font-normal ml-2">- {player.position_list}</span>
                                                            <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>{player.team ? getTeamAbbr(player.team) : ''}</span>
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <span className="text-xs text-slate-400 font-mono">
                                                                {player.game_info ? (
                                                                    <>
                                                                        {new Date(player.game_info.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                        {' '}
                                                                        {player.game_info.is_home ? 'vs' : '@'}
                                                                        {' '}
                                                                        {player.game_info.opponent}
                                                                    </>
                                                                ) : (
                                                                    'No game'
                                                                )}
                                                            </span>
                                                            {renderPlayerBadges(player)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        {displayBatterCats.map(stat => {
                                            const isForced = !batterStatCategories.includes(stat);
                                            return (
                                                <td key={stat} className={`px-4 py-4 text-center font-mono ${isForced ? 'text-slate-500' : 'text-purple-100'}`}>
                                                    {formatStat(getPlayerStat(player.player_id, stat))}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pitcher Table */}
                <div>
                    <h2 className="text-xl font-bold text-purple-300 mb-2 flex items-center gap-2">
                        <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                        Pitcher Roster
                    </h2>
                    <div className="relative bg-gradient-to-br from-slate-900/80 to-purple-900/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl overflow-hidden shadow-xl">
                        {loading && (
                            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-20">
                                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                        <table className="w-full">
                            <thead className="bg-purple-900/40 border-b border-purple-500/30">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-bold text-purple-200 w-24">Slot</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold text-purple-200">Player</th>
                                    {displayPitcherCats.map(stat => {
                                        const isForced = !pitcherStatCategories.includes(stat);
                                        return (
                                            <th key={stat} className={`px-4 py-4 text-center text-sm font-bold ${isForced ? 'text-purple-300/60' : 'text-purple-300'} w-16`}>
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
                                    <tr key={player.id} className="hover:bg-purple-500/5 transition">
                                        <td className="px-6 py-4">
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
                                        <td className="px-6 py-4">
                                            {player.isEmpty ? (
                                                <div className="flex items-center gap-4 text-slate-500 font-bold italic">Empty</div>
                                            ) : (
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800 flex-shrink-0">
                                                        {getPlayerPhoto(player) && <img src={getPlayerPhoto(player)} alt={player.name} className="w-full h-full object-cover" onError={handleImageError} />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white text-lg flex items-center">
                                                            <button
                                                                onClick={() => setSelectedPlayerModal(player)}
                                                                className="hover:text-purple-300 transition-colors cursor-pointer"
                                                            >
                                                                {player.name}
                                                            </button>
                                                            {player.original_name && player.original_name !== player.name && (
                                                                <span className="text-purple-300/60 text-sm font-normal ml-2">({player.original_name})</span>
                                                            )}
                                                            <span className="text-purple-300/70 text-sm font-normal ml-2">- {player.position_list}</span>
                                                            <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>{player.team ? getTeamAbbr(player.team) : ''}</span>
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <span className="text-xs text-slate-400 font-mono">
                                                                {player.game_info ? (
                                                                    <>
                                                                        {new Date(player.game_info.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                        {' '}
                                                                        {player.game_info.is_home ? 'vs' : '@'}
                                                                        {' '}
                                                                        {player.game_info.opponent}
                                                                    </>
                                                                ) : (
                                                                    'No game'
                                                                )}
                                                            </span>
                                                            {renderPlayerBadges(player)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        {displayPitcherCats.map(stat => {
                                            const isForced = !pitcherStatCategories.includes(stat);
                                            return (
                                                <td key={stat} className={`px-4 py-4 text-center font-mono ${isForced ? 'text-slate-500' : 'text-purple-100'}`}>
                                                    {formatStat(getPlayerStat(player.player_id, stat))}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <LegendModal isOpen={showLegendModal} onClose={() => setShowLegendModal(false)} batterStats={batterStatCategories} pitcherStats={pitcherStatCategories} />

                {showInfoModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]" onClick={() => setShowInfoModal(false)}>
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-0 max-w-2xl w-full mx-4 border border-purple-500/30 shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-6 border-b border-purple-500/20 flex-shrink-0">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
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

                            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-5 text-purple-100">
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
                    player={selectedPlayerModal}
                    leagueId={leagueId}
                    // Transaction Props (for Drop button)
                    myManagerId={myManagerId}
                    ownership={selectedPlayerModal ? { manager_id: myManagerId, status: 'on team' } : null}
                    leagueStatus={leagueStatus}
                    tradeEndDate={tradeEndDate}
                    seasonYear={seasonYear}
                    isPlayerLocked={selectedPlayerModal ? activeTradePlayerIds.has(selectedPlayerModal.player_id) : false}
                    onDrop={(player) => handleDropPlayer(player)}
                    // Watch Props
                    isWatched={selectedPlayerModal ? watchedPlayerIds.has(selectedPlayerModal.player_id) : false}
                    onToggleWatch={handleToggleWatch}
                />

                {/* Drop Confirmation Modal */}
                {showConfirmDrop && playerToDrop && (
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
                )}
            </div>
            {/* Waiver Modal */}
            <WaiverModal
                isOpen={showWaiverModal}
                onClose={() => setShowWaiverModal(false)}
                leagueId={leagueId}
                managerId={myManagerId}
            />
        </div >
    );
}