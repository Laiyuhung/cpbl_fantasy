import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const TIME_WINDOWS = [
    'Today',
    'Yesterday',
    'Last 7 Days',
    'Last 14 Days',
    'Last 30 Days',
    '2026 Season',
    '2026 Spring Training',
    '2025 Season'
];

export default function PlayerDetailModal({
    isOpen,
    onClose,
    player,
    leagueId,
    // Transaction Props (optional - if provided, enables action buttons)
    myManagerId,
    ownership,          // { manager_id, status } for this player
    leagueStatus,       // 'in season', 'post-draft & pre-season', etc.
    tradeEndDate,
    seasonYear,
    isPlayerLocked,     // Boolean: is this player locked in a pending trade?
    isDropLockedByGameStart, // Boolean: is drop locked because game has started and player is in active lineup?
    onAdd,              // (player, isWaiver) => void
    onDrop,             // (player) => void
    onTrade,            // (player, ownerManagerId) => void
    // Watch Props (optional)
    isWatched,          // Boolean: is this player in watchlist?
    onToggleWatch,      // (player, isCurrentlyWatched) => void
}) {
    const [stats, setStats] = useState({ batting: {}, pitching: {} });
    const [splitRanks, setSplitRanks] = useState({});
    const [loading, setLoading] = useState(true);
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [rankLoading, setRankLoading] = useState(true);
    const [error, setError] = useState('');
    const [watchLoading, setWatchLoading] = useState(false);
    const [playerPhotoSrc, setPlayerPhotoSrc] = useState('/photo/defaultPlayer.png');
    const [scoringType, setScoringType] = useState('');

    const [batterStatCategories, setBatterStatCategories] = useState([]);
    const [pitcherStatCategories, setPitcherStatCategories] = useState([]);

    // Recent games state
    const [recentGames, setRecentGames] = useState([]);
    const [recentGamesLoading, setRecentGamesLoading] = useState(true);
    const [startingStatus, setStartingStatus] = useState({
        lineupByPlayerId: {},
        lineupTeams: new Set(),
        pitcherPlayerIds: new Set(),
    });

    // Tab state for Split vs Recent Games
    const [activeTab, setActiveTab] = useState('split');

    // Decide which stats to show based on player.batter_or_pitcher 
    // or fall back to position if undefined
    const isPitcher = player?.batter_or_pitcher === 'pitcher' || ['SP', 'RP', 'P'].includes(player?.position);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setSettingsLoading(true);
            setRecentGamesLoading(true);
            setRankLoading(true);
            setError('');
            setStats({ batting: {}, pitching: {} });
            setSplitRanks({});
            setRecentGames([]);
            setActiveTab('split');
            setPlayerPhotoSrc('/photo/defaultPlayer.png');
        }
    }, [isOpen, player?.player_id]);

    const getPlayerPhotoPaths = (targetPlayer) => {
        const paths = [];
        if (targetPlayer?.name) {
            paths.push(`/photo/${targetPlayer.name}.png`);
        }
        if (targetPlayer?.original_name) {
            const aliases = targetPlayer.original_name.split(',').map(alias => alias.trim());
            aliases.forEach(alias => {
                if (alias) {
                    paths.push(`/photo/${alias}.png`);
                }
            });
        }
        if (targetPlayer?.player_id) {
            paths.push(`/photo/${targetPlayer.player_id}.png`);
        }
        paths.push('/photo/defaultPlayer.png');
        return paths;
    };

    useEffect(() => {
        let cancelled = false;

        const resolvePlayerPhoto = async () => {
            if (!isOpen || !player) {
                setPlayerPhotoSrc('/photo/defaultPlayer.png');
                return;
            }

            try {
                const candidates = getPlayerPhotoPaths(player).filter(path => !path.endsWith('/defaultPlayer.png'));
                const res = await fetch('/api/photo/resolve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ candidates })
                });
                const data = await res.json();
                if (!cancelled) {
                    setPlayerPhotoSrc(data?.path || '/photo/defaultPlayer.png');
                }
            } catch {
                if (!cancelled) {
                    setPlayerPhotoSrc('/photo/defaultPlayer.png');
                }
            }
        };

        resolvePlayerPhoto();
        return () => {
            cancelled = true;
        };
    }, [isOpen, player]);

    useEffect(() => {
        const fetchLeagueSettings = async () => {
            if (!leagueId) {
                setSettingsLoading(false);
                return;
            }
            try {
                const res = await fetch(`/api/league-settings?league_id=${leagueId}`);
                const data = await res.json();
                if (data.success && data.data) {
                    setBatterStatCategories(data.data.batter_stat_categories || []);
                    setPitcherStatCategories(data.data.pitcher_stat_categories || []);
                    setScoringType(data.data.scoring_type || '');
                }
            } catch (err) {
                console.error('Failed to fetch league settings', err);
            } finally {
                setSettingsLoading(false);
            }
        };
        if (isOpen && leagueId) {
            fetchLeagueSettings();
        }
    }, [isOpen, leagueId]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!player?.player_id) {
                setLoading(false);
                return;
            }
            try {
                // Pass type (batter or pitcher) to API to help it query the right view
                const type = player.batter_or_pitcher;
                const params = new URLSearchParams();
                if (type) params.set('type', type);
                if (leagueId) params.set('league_id', leagueId);
                const query = params.toString();
                const res = await fetch(`/api/playerStats/player/${player.player_id}${query ? `?${query}` : ''}`);
                const data = await res.json();
                if (data.success) {
                    setStats({ batting: data.batting, pitching: data.pitching });
                } else {
                    setError(data.error || 'Failed to load stats');
                }
            } catch (err) {
                setError('Error fetching player stats');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (isOpen) {
            fetchStats();
        }
    }, [isOpen, player]);

    useEffect(() => {
        const getTodayTW = () => {
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
        };

        const fetchStartingStatus = async () => {
            if (!isOpen || !player?.player_id) return;
            const dateForStatus = getTodayTW();
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
    }, [isOpen, player]);

    // Fetch recent game stats
    useEffect(() => {
        const fetchRecentGames = async () => {
            if (!player?.player_id) {
                setRecentGamesLoading(false);
                return;
            }
            try {
                const type = isPitcher ? 'pitcher' : 'batter';
                const teamParam = player.team ? `&team=${encodeURIComponent(player.team)}` : '';
                const leagueParam = leagueId ? `&league_id=${encodeURIComponent(leagueId)}` : '';
                const res = await fetch(`/api/playerStats/recent-games?player_id=${player.player_id}&type=${type}${teamParam}${leagueParam}`);
                const data = await res.json();
                if (data.success) {
                    setRecentGames(data.games || []);
                }
            } catch (err) {
                console.error('Error fetching recent games:', err);
            } finally {
                setRecentGamesLoading(false);
            }
        };

        if (isOpen && player?.player_id) {
            fetchRecentGames();
        }
    }, [isOpen, player, isPitcher]);

    useEffect(() => {
        const fetchSplitRanks = async () => {
            if (!isOpen || !leagueId || !player?.player_id) {
                setRankLoading(false);
                return;
            }

            setRankLoading(true);
            try {
                const responses = await Promise.all(
                    TIME_WINDOWS.map(async (tw) => {
                        const res = await fetch(`/api/league/${leagueId}/rankings?time_window=${encodeURIComponent(tw)}`);
                        const data = await res.json();

                        if (!data?.success || !Array.isArray(data.rankings)) {
                            return [tw, null];
                        }

                        const found = data.rankings.find((r) => String(r.player_id) === String(player.player_id));
                        return [tw, found?.rank ?? null];
                    })
                );

                setSplitRanks(Object.fromEntries(responses));
            } catch (err) {
                console.error('Error fetching split ranks:', err);
                setSplitRanks({});
            } finally {
                setRankLoading(false);
            }
        };

        fetchSplitRanks();
    }, [isOpen, leagueId, player?.player_id]);

    if (!isOpen || !player) return null;

    // Show loading until settings, stats, and ranks are loaded
    const isFullyLoaded = !loading && !settingsLoading && !rankLoading;

    // We need to parse categorical arrays to abbreviations
    const parseStatKey = (cat) => {
        const matches = cat.match(/\(([^)]+)\)/g);
        return matches ? matches[matches.length - 1].replace(/[()]/g, '') : cat;
    };

    const displayBatterCats = (() => {
        const forced = 'At Bats (AB)';
        const hasForced = batterStatCategories.some(c => parseStatKey(c) === 'AB');
        return hasForced ? batterStatCategories : [forced, ...batterStatCategories];
    })();

    const displayPitcherCats = (() => {
        const forced = 'Innings Pitched (IP)';
        const hasForced = pitcherStatCategories.some(c => parseStatKey(c) === 'IP');
        return hasForced ? pitcherStatCategories : [forced, ...pitcherStatCategories];
    })();

    const displayCats = isPitcher ? displayPitcherCats : displayBatterCats;
    const isFantasyPoints = scoringType === 'Head-to-Head Fantasy Points';
    const abbreviations = [
        ...(isFantasyPoints ? ['FP'] : []),
        ...displayCats.map(parseStatKey),
    ];
    const dataByWindow = isPitcher ? stats.pitching : stats.batting;

    const formatFpValue = (value) => {
        if (value === null || value === undefined || value === '-') return '-';
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed.toFixed(2) : '-';
    };

    const formatRankValue = (rank) => {
        return Number.isFinite(rank) ? `#${rank}` : '-';
    };

    const seasonRank = splitRanks['2026 Season'];

    // Render row for a specific time window
    const renderRow = (tw) => {
        const windowStats = dataByWindow[tw];

        // If no stats at all for the window
        if (!windowStats) {
            return (
                <tr key={tw} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 text-sm font-semibold text-slate-300 whitespace-nowrap sticky left-0 bg-slate-800/90 z-10 border-r border-white/10 shadow-[2px_0_4px_rgba(0,0,0,0.2)] w-24">{tw}</td>
                    <td className="py-2.5 px-3 text-center text-sm font-black text-cyan-300 whitespace-nowrap">{formatRankValue(splitRanks[tw])}</td>
                    {abbreviations.map((abbr, i) => (
                        <td key={i} className="py-2.5 px-3 text-center text-sm font-mono text-slate-600 whitespace-nowrap">-</td>
                    ))}
                </tr>
            );
        }

        return (
            <tr key={tw} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-2.5 px-3 text-sm font-semibold text-slate-300 whitespace-nowrap sticky left-0 bg-slate-800/90 z-10 border-r border-white/10 shadow-[2px_0_4px_rgba(0,0,0,0.2)] w-24">{tw}</td>
                <td className="py-2.5 px-3 text-center text-sm font-black text-cyan-300 whitespace-nowrap">{formatRankValue(splitRanks[tw])}</td>
                {abbreviations.map((abbr, i) => {
                    const val = windowStats[abbr.toLowerCase()];
                    const displayVal = abbr === 'FP'
                        ? formatFpValue(val)
                        : (val === null || val === undefined ? '-' : val);
                    const isZeroOrDash = displayVal === '-' || displayVal === 0 || displayVal === '0';
                    const isRefStat = abbr === 'AB' || abbr === 'IP';
                    const isFp = abbr === 'FP';

                    return (
                        <td key={i} className={`py-2.5 px-3 text-center text-sm font-mono whitespace-nowrap ${isFp ? 'text-amber-300 font-black' : isZeroOrDash ? 'text-slate-600' : isRefStat ? 'text-slate-400' : 'text-cyan-300'
                            }`}>
                            {displayVal}
                        </td>
                    );
                })}
            </tr>
        );
    };

    const teamColor = (() => {
        switch (player.team) {
            case '統一獅': return 'text-orange-400';
            case '富邦悍將': return 'text-blue-400';
            case '台鋼雄鷹': return 'text-green-400';
            case '味全龍': return 'text-red-400';
            case '樂天桃猿': return 'text-rose-400';
            case '中信兄弟': return 'text-yellow-400';
            default: return 'text-slate-400';
        }
    })();

    const teamAbbr = (() => {
        switch (player.team) {
            case '統一獅': return 'UL';
            case '富邦悍將': return 'FG';
            case '樂天桃猿': return 'RM';
            case '中信兄弟': return 'B';
            case '味全龍': return 'W';
            case '台鋼雄鷹': return 'TSG';
            default: return player.team;
        }
    })();

    const positionStr = player.position_list || player.position || (isPitcher ? 'P' : 'Util');

    // Transaction Helpers
    const canShowActionButtons = myManagerId && (onAdd || onDrop || onTrade);

    const isTradeDeadlinePassed = () => {
        if (!tradeEndDate || tradeEndDate.trim().toLowerCase() === 'no trade deadline') return false;
        try {
            const trimmedDate = tradeEndDate.trim();
            let dateStr = trimmedDate;
            if (!/\d{4}/.test(trimmedDate)) {
                dateStr = `${trimmedDate}, ${seasonYear || new Date().getFullYear()}`;
            }
            const deadline = new Date(dateStr);
            if (isNaN(deadline.getTime())) return false;
            deadline.setHours(23, 59, 59, 999);
            return new Date() > deadline;
        } catch {
            return false;
        }
    };

    const isAllowedLeagueStatus = () => {
        const allowedStatuses = ['post-draft & pre-season', 'in season', 'playoffs'];
        const currentStatus = (leagueStatus || '').toLowerCase();
        return allowedStatuses.includes(currentStatus);
    };

    const renderActionButton = () => {
        if (!canShowActionButtons || !isAllowedLeagueStatus()) return null;

        // No ownership = Free Agent (green + button)
        if (!ownership) {
            if (!onAdd) return null;
            return (
                <button
                    onClick={() => { onClose(); onAdd(player, false); }}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold bg-green-600 hover:bg-green-500 text-white transition-all flex items-center gap-1 sm:gap-1.5 shadow-lg"
                >
                    <span className="text-base">+</span>
                    <span className="hidden sm:inline">Add</span>
                </button>
            );
        }

        const status = ownership.status?.toLowerCase();

        // Waiver status = yellow + button
        if (status === 'waiver') {
            if (!onAdd) return null;
            return (
                <button
                    onClick={() => { onClose(); onAdd(player, true); }}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold bg-yellow-500 hover:bg-yellow-400 text-white transition-all flex items-center gap-1 sm:gap-1.5 shadow-lg"
                    title="Claim via Waiver"
                >
                    <span className="text-base">+</span>
                    <span className="hidden sm:inline">Waiver</span>
                </button>
            );
        }

        // On team
        if (status === 'on team') {
            // My player
            if (ownership.manager_id === myManagerId) {
                // Check if locked in trade
                if (isPlayerLocked) {
                    return (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-600 text-slate-400 flex items-center gap-1.5 cursor-not-allowed" title="Locked in pending trade">
                            🔒 Locked
                        </span>
                    );
                }
                // Check if drop is locked due to game started
                if (isDropLockedByGameStart) {
                    return (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-600 text-slate-400 flex items-center gap-1.5 cursor-not-allowed" title="Cannot drop - game has started and player is in active lineup">
                            🔒 In Game
                        </span>
                    );
                }
                // Drop button
                if (!onDrop) return null;
                return (
                    <button
                        onClick={() => { onClose(); onDrop(player); }}
                        className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-all flex items-center gap-1 sm:gap-1.5 shadow-lg"
                        title="Drop Player"
                    >
                        <span className="text-base">−</span>
                        <span className="hidden sm:inline">Drop</span>
                    </button>
                );
            } else {
                // Other manager's player - Trade button
                if (isTradeDeadlinePassed() || !onTrade) return null;
                return (
                    <button
                        onClick={() => { onClose(); onTrade(player, ownership.manager_id); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-1.5 shadow-lg"
                        title="Propose Trade"
                    >
                        <span className="text-base">⇌</span> Trade
                    </button>
                );
            }
        }

        return null;
    };

    // Watch button handler
    const handleWatchClick = async () => {
        if (!onToggleWatch || watchLoading) return;
        setWatchLoading(true);
        try {
            await onToggleWatch(player, isWatched);
        } finally {
            setWatchLoading(false);
        }
    };

    // Render Watch button
    const renderWatchButton = () => {
        if (!onToggleWatch || !myManagerId) return null;

        return (
            <button
                onClick={handleWatchClick}
                disabled={watchLoading}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shadow-lg ${isWatched
                    ? 'bg-amber-500 hover:bg-amber-400 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white border border-slate-600'
                    }`}
                title={isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
            >
                <span className="text-base">{isWatched ? '★' : '☆'}</span>
                <span className="hidden sm:inline">{isWatched ? 'Watched' : 'Watch'}</span>
            </button>
        );
    };

    const handleImageError = (e) => {
        if (!e.target.src.endsWith('/photo/defaultPlayer.png')) {
            e.target.src = '/photo/defaultPlayer.png';
        }
    };

    // Render player badges (DR, NR, NA, F)
    const renderBadges = () => {
        const badges = [];
        if (player.identity && player.identity.toLowerCase() === 'foreigner') {
            badges.push(<span key="f" title="Foreign Player" className="w-6 h-6 flex items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">F</span>);
        }
        const status = (player.real_life_status || '').toUpperCase();
        if (status.includes('MN') || status.includes('MINOR') || status === 'NA') {
            badges.push(<span key="na" className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">NA</span>);
        }
        if (status.includes('DEREGISTERED') || status === 'DR' || status === 'D') {
            badges.push(<span key="dr" className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">DR</span>);
        }
        if (status.includes('UNREGISTERED') || status === 'NR') {
            badges.push(<span key="nr" className="px-2 py-0.5 rounded text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">NR</span>);
        }
        return badges.length > 0 ? <div className="flex items-center gap-1.5 ml-2">{badges}</div> : null;
    };

    const renderStartingBadge = () => {
        if (!player?.player_id) return null;

        const playerType = (player.batter_or_pitcher || '').toLowerCase();
        const pid = String(player.player_id);

        if (playerType === 'batter' && startingStatus.lineupTeams.has(player.team)) {
            const battingNo = startingStatus.lineupByPlayerId[pid];
            if (battingNo) {
                return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-600 text-white">{battingNo}</span>;
            }
            return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">X</span>;
        }

        if (playerType === 'pitcher' && startingStatus.pitcherPlayerIds.has(pid)) {
            return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-600 text-white">V</span>;
        }

        return null;
    };

    // Use portal to render modal directly under body to avoid positioning issues from parent transforms
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-4xl bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900/40 rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-2.5 sm:gap-4 p-3 sm:p-6 border-b border-white/10 bg-black/20 shrink-0">
                    <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-slate-800 border-2 border-purple-500/50 shrink-0 shadow-lg">
                        <img
                            src={playerPhotoSrc}
                            alt={player.name}
                            className="w-full h-full object-cover"
                            onError={handleImageError}
                        />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 sm:gap-4">
                            <div className="flex items-center">
                                <h2 className="text-lg sm:text-3xl font-black text-white truncate drop-shadow-md">
                                    {player.name}
                                </h2>
                                <span className="ml-2 text-sm sm:text-base font-black text-cyan-400 whitespace-nowrap">
                                    {formatRankValue(seasonRank)}
                                </span>
                                {renderBadges()}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 sm:p-2 -mr-1 sm:-mr-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors self-start shrink-0"
                            >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-3 mt-0.5 sm:mt-1 text-xs sm:text-sm font-semibold flex-wrap">
                            {renderStartingBadge()}
                            <span className={`${teamColor} bg-white/5 py-0.5 sm:py-1 px-2 sm:px-2.5 rounded shadow-sm border border-white/5`}>
                                {teamAbbr}
                            </span>
                            <span className="text-slate-300 tracking-wider">
                                {positionStr}
                            </span>
                            {player.game_info && (
                                player.game_info.is_postponed ? (
                                    <span className="text-red-400 font-mono text-xs font-bold">PPD</span>
                                ) : player.game_info.away_team_score != null && player.game_info.home_team_score != null ? (
                                    (() => {
                                        const myScore = player.game_info.is_home ? player.game_info.home_team_score : player.game_info.away_team_score;
                                        const oppScore = player.game_info.is_home ? player.game_info.away_team_score : player.game_info.home_team_score;
                                        const result = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
                                        const resultColor = result === 'W' ? 'text-green-400' : result === 'L' ? 'text-red-400' : 'text-cyan-300';
                                        return (
                                            <span className="text-slate-400 font-mono text-xs">
                                                <span className={`font-bold ${resultColor}`}>{myScore}:{oppScore} {result}</span>
                                                {' '}
                                                {player.game_info.is_home ? 'vs' : '@'}
                                                {' '}
                                                {player.game_info.opponent}
                                            </span>
                                        );
                                    })()
                                ) : (
                                    <span className="text-slate-400 font-mono text-xs">
                                        {new Date(player.game_info.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                        {' '}
                                        {player.game_info.is_home ? 'vs' : '@'}
                                        {' '}
                                        {player.game_info.opponent}
                                    </span>
                                )
                            )}
                            {!player.game_info && (
                                <span className="text-slate-400 text-xs">No game</span>
                            )}
                            {/* Roster % */}
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                {player.roster_percentage ?? 0}% Rostered
                            </span>
                            {/* Watch Button */}
                            {renderWatchButton()}
                            {/* Action Button (Add/Drop/Trade) */}
                            {renderActionButton()}
                        </div>
                    </div>
                </div>

                {/* Stats Table Area */}
                <div className="flex-1 overflow-y-auto bg-black/10 p-5 sm:p-6">
                    {/* Tab Switcher */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setActiveTab('split')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'split'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                                }`}
                        >
                            Split Stats
                        </button>
                        <button
                            onClick={() => setActiveTab('recent')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'recent'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                                }`}
                        >
                            Recent Games
                            <span className="ml-1 text-xs text-slate-400 font-normal">
                                ({isPitcher ? '8' : '10'})
                            </span>
                        </button>
                    </div>

                    {/* Split Stats Tab */}
                    {activeTab === 'split' && (
                        <>
                            {!isFullyLoaded ? (
                                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                                    <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="text-purple-300 font-semibold tracking-wide animate-pulse">Loading Stats...</div>
                                </div>
                            ) : error ? (
                                <div className="flex items-center justify-center h-48">
                                    <div className="text-red-400 bg-red-400/10 px-4 py-3 rounded-lg border border-red-500/20 shadow-inner">
                                        {error}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop table */}
                                    <div className="hidden sm:block rounded-xl border border-white/5 bg-slate-900/50 shadow-inner overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                                        <table className="w-full text-left border-collapse" style={{ minWidth: '100%' }}>
                                            <thead>
                                                <tr className="bg-slate-800/80 border-b border-white/10 shadow-sm">
                                                    <th className="py-3 px-3 text-xs font-black text-purple-300 uppercase tracking-widest sticky left-0 top-0 bg-slate-800 z-20 border-r border-white/10 shadow-[2px_0_4px_rgba(0,0,0,0.3)] whitespace-nowrap w-24">
                                                        Split
                                                    </th>
                                                    <th className="py-3 px-3 text-center text-xs font-black text-cyan-300 uppercase tracking-widest sticky top-0 bg-slate-800/80 z-10 backdrop-blur-sm whitespace-nowrap">
                                                        Rank
                                                    </th>
                                                    {abbreviations.map((abbr, i) => (
                                                        <th key={i} className={`py-3 px-3 text-center text-xs font-black uppercase tracking-widest sticky top-0 bg-slate-800/80 z-10 backdrop-blur-sm whitespace-nowrap ${abbr === 'FP' ? 'text-amber-300' : 'text-slate-400'}`}>
                                                            {abbr}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {TIME_WINDOWS.map(renderRow)}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile layout: fixed info row + horizontal stats row */}
                                    <div className="sm:hidden space-y-2">
                                        {TIME_WINDOWS.map((tw) => {
                                            const windowStats = dataByWindow[tw];
                                            return (
                                                <div key={tw} className="rounded-xl border border-white/5 bg-slate-900/50 shadow-inner overflow-hidden">
                                                    <div className="bg-slate-800/80 px-3 py-2 border-b border-white/10">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-black text-purple-300 uppercase tracking-widest">{tw}</span>
                                                            <span className="text-xs font-black text-cyan-300 uppercase tracking-widest">{formatRankValue(splitRanks[tw])}</span>
                                                        </div>
                                                    </div>

                                                    <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                                                        <div className="min-w-max">
                                                            <div className="grid grid-flow-col auto-cols-[56px] border-b border-white/5">
                                                                <div className="py-1.5 px-2 text-center text-[10px] font-black uppercase tracking-wider whitespace-nowrap text-cyan-300">
                                                                    Rank
                                                                </div>
                                                                {abbreviations.map((abbr, i) => (
                                                                    <div key={i} className={`py-1.5 px-2 text-center text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${abbr === 'FP' ? 'text-amber-300' : 'text-slate-500'}`}>
                                                                        {abbr}
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div className="grid grid-flow-col auto-cols-[56px]">
                                                                <div className="py-2 px-2 text-center text-sm font-mono font-black whitespace-nowrap text-cyan-300">
                                                                    {formatRankValue(splitRanks[tw])}
                                                                </div>
                                                                {abbreviations.map((abbr, i) => {
                                                                    const val = windowStats ? windowStats[abbr.toLowerCase()] : null;
                                                                    const displayVal = abbr === 'FP'
                                                                        ? formatFpValue(val)
                                                                        : (val === null || val === undefined ? '-' : val);
                                                                    const isZeroOrDash = displayVal === '-' || displayVal === 0 || displayVal === '0';
                                                                    const isRefStat = abbr === 'AB' || abbr === 'IP';
                                                                    const isFp = abbr === 'FP';
                                                                    return (
                                                                        <div key={i} className={`py-2 px-2 text-center text-sm font-mono whitespace-nowrap ${isFp ? 'text-amber-300 font-black' : isZeroOrDash ? 'text-slate-600' : isRefStat ? 'text-slate-400' : 'text-cyan-300'}`}>
                                                                            {displayVal}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Recent Games Tab */}
                    {activeTab === 'recent' && (
                        <>
                            {recentGamesLoading ? (
                                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                                    <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="text-purple-300 font-semibold tracking-wide animate-pulse">Loading Recent Games...</div>
                                </div>
                            ) : recentGames.length === 0 ? (
                                <div className="text-slate-400 text-sm text-center py-8">
                                    No recent game data available
                                </div>
                            ) : (
                                <>
                                    {/* Desktop table */}
                                    <div className="hidden sm:block rounded-xl border border-white/5 bg-slate-900/50 shadow-inner overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                                        <table className="w-full text-left border-collapse table-fixed" style={{ minWidth: '100%' }}>
                                            <thead>
                                                <tr className="bg-slate-800/80 border-b border-white/10 shadow-sm">
                                                    <th className="py-3 px-3 text-xs font-black text-purple-300 uppercase tracking-widest sticky left-0 top-0 bg-slate-800 z-20 border-r border-white/10 shadow-[2px_0_4px_rgba(0,0,0,0.3)] whitespace-nowrap w-32">Date</th>
                                                    {abbreviations.map((abbr, i) => (
                                                        <th key={i} className={`py-3 px-3 text-center text-xs font-black uppercase tracking-widest sticky top-0 bg-slate-800/80 z-10 backdrop-blur-sm whitespace-nowrap ${abbr === 'FP' ? 'text-amber-300' : 'text-slate-400'}`}>
                                                            {abbr}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {recentGames.map((game, idx) => {
                                                    const dateStr = game.game_date ? new Date(game.game_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '-';
                                                    const locationSymbol = game.is_home ? 'vs' : '@';
                                                    const displayLabel = `${dateStr}${locationSymbol}${game.opponent || ''}`;
                                                    return (
                                                        <tr key={idx} className={`hover:bg-white/5 transition-colors ${game.is_future ? 'opacity-60' : ''}`}>
                                                            <td className="py-2.5 px-3 text-sm font-semibold text-slate-300 whitespace-nowrap sticky left-0 bg-slate-800/90 z-10 border-r border-white/10 shadow-[2px_0_4px_rgba(0,0,0,0.2)] w-32">
                                                                {displayLabel}
                                                            </td>
                                                            {abbreviations.map((abbr, i) => {
                                                                const val = game[abbr];
                                                                const isRateCol = ['AVG', 'OBP', 'SLG', 'ERA', 'WHIP'].includes(abbr);
                                                                const displayVal = abbr === 'FP'
                                                                    ? formatFpValue(val)
                                                                    : (val == null || val === '-'
                                                                        ? '-'
                                                                        : isRateCol
                                                                            ? parseFloat(val).toFixed(abbr === 'ERA' || abbr === 'WHIP' ? 2 : 3)
                                                                            : val);
                                                                const isZeroOrDash = displayVal === '-' || displayVal === 0 || displayVal === '0';
                                                                const isRefStat = abbr === 'AB' || abbr === 'IP';
                                                                const isFp = abbr === 'FP';
                                                                return (
                                                                    <td key={i} className={`py-2.5 px-3 text-center text-sm font-mono whitespace-nowrap ${isFp ? 'text-amber-300 font-black' : isZeroOrDash ? 'text-slate-600' : isRefStat ? 'text-slate-400' : 'text-cyan-300'}`}>
                                                                        {displayVal}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile layout: fixed info row + horizontal stats row */}
                                    <div className="sm:hidden space-y-2">
                                        {recentGames.map((game, idx) => {
                                            const dateStr = game.game_date ? new Date(game.game_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '-';
                                            const locationSymbol = game.is_home ? 'vs' : '@';
                                            const displayLabel = `${dateStr} ${locationSymbol} ${game.opponent || ''}`;
                                            return (
                                                <div key={idx} className={`rounded-xl border border-white/5 bg-slate-900/50 shadow-inner overflow-hidden ${game.is_future ? 'opacity-60' : ''}`}>
                                                    <div className="bg-slate-800/80 px-3 py-2 border-b border-white/10">
                                                        <span className="text-xs font-black text-purple-300 uppercase tracking-widest">{displayLabel}</span>
                                                    </div>

                                                    <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                                                        <div className="min-w-max">
                                                            <div className="grid grid-flow-col auto-cols-[56px] border-b border-white/5">
                                                                {abbreviations.map((abbr, i) => (
                                                                    <div key={i} className={`py-1.5 px-2 text-center text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${abbr === 'FP' ? 'text-amber-300' : 'text-slate-500'}`}>
                                                                        {abbr}
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div className="grid grid-flow-col auto-cols-[56px]">
                                                                {abbreviations.map((abbr, i) => {
                                                                    const val = game[abbr];
                                                                    const isRateCol = ['AVG', 'OBP', 'SLG', 'ERA', 'WHIP'].includes(abbr);
                                                                    const displayVal = abbr === 'FP'
                                                                        ? formatFpValue(val)
                                                                        : (val == null || val === '-'
                                                                            ? '-'
                                                                            : isRateCol
                                                                                ? parseFloat(val).toFixed(abbr === 'ERA' || abbr === 'WHIP' ? 2 : 3)
                                                                                : val);
                                                                    const isZeroOrDash = displayVal === '-' || displayVal === 0 || displayVal === '0';
                                                                    const isRefStat = abbr === 'AB' || abbr === 'IP';
                                                                    const isFp = abbr === 'FP';
                                                                    return (
                                                                        <div key={i} className={`py-2 px-2 text-center text-sm font-mono whitespace-nowrap ${isFp ? 'text-amber-300 font-black' : isZeroOrDash ? 'text-slate-600' : isRefStat ? 'text-slate-400' : 'text-cyan-300'}`}>
                                                                            {displayVal}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
