'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import LegendModal from '../../../../components/LegendModal';
import MoveModal from './MoveModal';

export default function RosterPage() {
    const params = useParams();
    const leagueId = params.leagueId;

    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [date, setDate] = useState(''); // 伺服器回傳的 Game Date

    // Stats State
    const [timeWindow, setTimeWindow] = useState('Today');
    const [playerStats, setPlayerStats] = useState({}); // player_id -> stats
    const [batterStatCategories, setBatterStatCategories] = useState([]);
    const [pitcherStatCategories, setPitcherStatCategories] = useState([]);

    // Settings State for Empty Slots Logic
    const [rosterPositionsConfig, setRosterPositionsConfig] = useState({});

    // Modals & Move Logic
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showLegendModal, setShowLegendModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [playerToMove, setPlayerToMove] = useState(null);

    // Roster Helpers
    const getTeamAbbr = (team) => {
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

    const getPlayerPhotoPaths = (player) => {
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

    // 解析每位球員可用的圖片一次並快取
    const [photoSrcMap, setPhotoSrcMap] = useState({});
    const failedImages = useRef(new Set());

    // Refresh Trigger
    const refreshRoster = () => {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const managerId = cookie?.split('=')[1];
        if (!managerId) return;

        setLoading(true);
        fetch(`/api/league/${leagueId}/roster?manager_id=${managerId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setRoster(data.roster || []);
                    setDate(data.date);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    const handleSlotClick = (player) => {
        if (player.isEmpty) return;
        setPlayerToMove(player);
        setShowMoveModal(true);
    };

    const handleMovePlayer = async (targetPos) => {
        if (!playerToMove) return;

        setShowMoveModal(false);
        setLoading(true);

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
                    gameDate: date
                })
            });

            const data = await res.json();
            if (data.success) {
                refreshRoster();
            } else {
                setError(data.error || 'Move failed');
                setLoading(false);
                setPlayerToMove(null);
                setTimeout(() => setError(''), 3000);
            }

        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    // Roster fetch
    useEffect(() => {
        const fetchRoster = async () => {
            try {
                setLoading(true);

                const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
                const managerId = cookie?.split('=')[1];

                if (!managerId) {
                    setError('Please log in.');
                    setLoading(false);
                    return;
                }

                const res = await fetch(`/api/league/${leagueId}/roster?manager_id=${managerId}`);
                const data = await res.json();

                if (data.success) {
                    setRoster(data.roster || []);
                    setDate(data.date);
                } else {
                    setError(data.error || 'Failed to load roster.');
                }
            } catch (err) {
                console.error('Error fetching roster:', err);
                setError('An unexpected error occurred.');
            } finally {
                setLoading(false);
            }
        };

        fetchRoster();
    }, [leagueId]);

    // Fetch League Settings
    useEffect(() => {
        const fetchSettings = async () => {
            const settingsRes = await fetch(`/api/league-settings?league_id=${leagueId}`);
            const settingsData = await settingsRes.json();
            if (settingsData.success && settingsData.data) {
                setBatterStatCategories(settingsData.data.batter_stat_categories || []);
                setPitcherStatCategories(settingsData.data.pitcher_stat_categories || []);
                setRosterPositionsConfig(settingsData.data.roster_positions || {});
            }
        };
        fetchSettings();
    }, [leagueId]);

    // Fetch Player Stats
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

                if (batterData.success && batterData.stats) {
                    batterData.stats.forEach(s => newStats[s.player_id] = s);
                }
                if (pitcherData.success && pitcherData.stats) {
                    pitcherData.stats.forEach(s => newStats[s.player_id] = s);
                }

                setPlayerStats(newStats);

            } catch (err) {
                console.error('Failed to fetch stats:', err);
            }
        };

        fetchStats();
    }, [timeWindow]);

    const getPlayerStat = (playerId, statKey) => {
        if (!playerId || playerId === 'empty') return '-';
        const stats = playerStats[playerId];
        if (!stats) return '-';

        let fieldName = statKey;
        const matches = statKey.match(/\(([^)]+)\)/g);
        if (matches) {
            fieldName = matches[matches.length - 1].replace(/[()]/g, '');
        }

        const value = stats[fieldName.toLowerCase()];
        return value !== undefined && value !== null ? value : '-';
    };

    // Photo resolution
    useEffect(() => {
        let cancelled = false;
        const resolvePhotos = async () => {
            if (!roster || roster.length === 0) return;

            const batchPayload = roster.map(item => ({
                id: item.player_id,
                candidates: getPlayerPhotoPaths({
                    name: item.name,
                    player_id: item.player_id
                }).filter(p => !p.endsWith('/defaultPlayer.png'))
            }));

            try {
                const res = await fetch('/api/photo/resolve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ players: batchPayload })
                });
                const data = await res.json();
                if (!cancelled && data.results) {
                    setPhotoSrcMap(data.results);
                }
            } catch {
                // Ignore
            }
        };

        resolvePhotos();
        return () => { cancelled = true; };
    }, [roster]);

    const getPlayerPhoto = (player) => {
        if (player.player_id === 'empty') return null;
        return photoSrcMap[player.player_id] || '/photo/defaultPlayer.png';
    };

    const handleImageError = (e, player) => {
        e.target.onerror = null;
        e.target.src = window.location.origin + '/photo/defaultPlayer.png';
    };

    // Badge Helper
    const renderPlayerBadges = (player) => {
        if (player.player_id === 'empty') return null;

        const badges = [];
        // F Flag
        if (player.identity && player.identity.toLowerCase() === 'foreigner') {
            badges.push(
                <span key="foreigner" title="Foreign Player" className="w-5 h-5 flex items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">F</span>
            );
        }

        const status = (player.real_life_status || '').toUpperCase();

        // NA: Minor League
        if (status.includes('MN') || status.includes('MINOR') || status === 'NA') {
            badges.push(
                <span key="na" title="Minor League Status" className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">NA</span>
            );
        }

        // DR: Deregistered
        if (status.includes('DEREGISTERED') || status === 'DR' || status === 'D') {
            badges.push(
                <span key="dr" title="Deregistered" className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">DR</span>
            );
        }

        // NR: Unregistered
        if (status.includes('UNREGISTERED') || status === 'NR') {
            badges.push(
                <span key="nr" title="Unregistered" className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">NR</span>
            );
        }

        return <div className="flex items-center gap-1">{badges}</div>;
    };

    // --- Logic to Generate Empty Slots ---
    const ACTIVE_POSITIONS_ORDER = [
        'C', '1B', '2B', '3B', 'SS', 'CI', 'MI', 'LF', 'CF', 'RF', 'OF', 'Util',
        'SP', 'RP', 'P'
    ];

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
        const orderA = orderConfig[a.position] || 99;
        const orderB = orderConfig[b.position] || 99;
        return orderA - orderB;
    });

    const pitcherRoster = fullRoster.filter(p => {
        if (isPitcherPos(p.position)) return true;
        if (isBatterPos(p.position)) return false;
        return p.batter_or_pitcher === 'pitcher';
    }).sort((a, b) => {
        const orderConfig = { 'SP': 1, 'RP': 2, 'P': 3, 'BN': 20, 'NA': 21 };
        const orderA = orderConfig[a.position] || 99;
        const orderB = orderConfig[b.position] || 99;
        return orderA - orderB;
    });

    const parseStatName = (stat) => {
        const matches = stat.match(/\(([^)]+)\)/g);
        return matches ? matches[matches.length - 1].replace(/[()]/g, '') : stat;
    };

    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-300 bg-red-900/20 rounded-xl border border-red-500/30 mx-8 mt-8">
                {error}
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                    My Roster
                </h1>
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

                    <button
                        onClick={() => setShowLegendModal(true)}
                        className="px-3 py-1 rounded-full bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/50 text-blue-300 flex items-center justify-center transition-colors text-xs font-bold tracking-wider"
                        title="View Legend"
                    >
                        LEGEND
                    </button>
                    <button
                        onClick={() => setShowInfoModal(true)}
                        className="px-3 py-1 rounded-full bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/50 text-purple-300 flex items-center justify-center transition-colors text-xs font-bold tracking-wider"
                        title="Position Eligibility Rules"
                    >
                        POS RULES
                    </button>
                    <div className="text-purple-200 font-mono bg-purple-900/30 px-4 py-2 rounded-lg border border-purple-500/30">
                        Game Date: <span className="text-white font-bold">{date}</span>
                    </div>
                </div>
            </div>

            {/* Batters Table */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-purple-300 mb-2 flex items-center gap-2">
                    <span className="w-2 h-6 bg-pink-500 rounded-full"></span>
                    Batter Roster
                </h2>
                <div className="bg-gradient-to-br from-slate-900/80 to-purple-900/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl overflow-hidden shadow-xl">
                    <table className="w-full">
                        <thead className="bg-purple-900/40 border-b border-purple-500/30">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-bold text-purple-200 w-24">Slot</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-purple-200">Player</th>
                                {batterStatCategories.map(stat => (
                                    <th key={stat} className="px-4 py-4 text-center text-sm font-bold text-purple-300 w-16">
                                        {parseStatName(stat)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-500/10">
                            {batterRoster.length === 0 ? (
                                <tr>
                                    <td colSpan={2 + batterStatCategories.length} className="px-6 py-12 text-center text-purple-300/50">
                                        No batters in roster.
                                    </td>
                                </tr>
                            ) : (
                                batterRoster.map((player) => (
                                    <tr key={player.id} className="hover:bg-purple-500/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleSlotClick(player)}
                                                disabled={player.isEmpty}
                                                className={`inline-block px-2 py-1 rounded text-xs font-bold w-12 text-center transition-transform active:scale-95 ${player.isEmpty ? 'bg-slate-800 text-slate-500 cursor-default' :
                                                    ['BN', 'IL', 'NA'].includes(player.position)
                                                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer shadow-sm'
                                                        : 'bg-purple-600 text-white hover:bg-purple-500 cursor-pointer shadow-sm'
                                                    }`}>
                                                {player.position}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            {player.isEmpty ? (
                                                <div className="flex items-center gap-4 text-slate-500 font-bold italic">
                                                    Empty
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-4">
                                                    {/* Photo */}
                                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800 flex-shrink-0">
                                                        {getPlayerPhoto(player) && (
                                                            <img
                                                                src={getPlayerPhoto(player)}
                                                                alt={player.name}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => handleImageError(e, player)}
                                                            />
                                                        )}
                                                    </div>

                                                    <div>
                                                        <div className="font-bold text-white text-lg flex items-center">
                                                            {player.name}
                                                            <span className="text-purple-300/70 text-sm font-normal ml-2">
                                                                - {player.position_list}
                                                            </span>
                                                            <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>
                                                                {player.team ? `${getTeamAbbr(player.team)}` : ''}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1">
                                                            {/* Badges */}
                                                            {renderPlayerBadges(player)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        {/* Stats */}
                                        {batterStatCategories.map(stat => (
                                            <td key={stat} className="px-4 py-4 text-center text-purple-100 font-mono">
                                                {getPlayerStat(player.player_id, stat)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pitchers Table */}
            <div>
                <h2 className="text-xl font-bold text-purple-300 mb-2 flex items-center gap-2">
                    <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                    Pitcher Roster
                </h2>
                <div className="bg-gradient-to-br from-slate-900/80 to-purple-900/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl overflow-hidden shadow-xl">
                    <table className="w-full">
                        <thead className="bg-purple-900/40 border-b border-purple-500/30">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-bold text-purple-200 w-24">Slot</th>
                                <th className="px-6 py-4 text-left text-sm font-bold text-purple-200">Player</th>
                                {pitcherStatCategories.map(stat => (
                                    <th key={stat} className="px-4 py-4 text-center text-sm font-bold text-purple-300 w-16">
                                        {parseStatName(stat)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-500/10">
                            {pitcherRoster.length === 0 ? (
                                <tr>
                                    <td colSpan={2 + pitcherStatCategories.length} className="px-6 py-12 text-center text-purple-300/50">
                                        No pitchers in roster.
                                    </td>
                                </tr>
                            ) : (
                                pitcherRoster.map((player) => (
                                    <tr key={player.id} className="hover:bg-purple-500/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleSlotClick(player)}
                                                disabled={player.isEmpty}
                                                className={`inline-block px-2 py-1 rounded text-xs font-bold w-12 text-center transition-transform active:scale-95 ${player.isEmpty ? 'bg-slate-800 text-slate-500 cursor-default' :
                                                    ['BN', 'IL', 'NA'].includes(player.position)
                                                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer shadow-sm'
                                                        : 'bg-purple-600 text-white hover:bg-purple-500 cursor-pointer shadow-sm'
                                                    }`}>
                                                {player.position}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            {player.isEmpty ? (
                                                <div className="flex items-center gap-4 text-slate-500 font-bold italic">
                                                    Empty
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-4">
                                                    {/* Photo */}
                                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800 flex-shrink-0">
                                                        {getPlayerPhoto(player) && (
                                                            <img
                                                                src={getPlayerPhoto(player)}
                                                                alt={player.name}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => handleImageError(e, player)}
                                                            />
                                                        )}
                                                    </div>

                                                    <div>
                                                        <div className="font-bold text-white text-lg flex items-center">
                                                            {player.name}
                                                            <span className="text-purple-300/70 text-sm font-normal ml-2">
                                                                - {player.position_list}
                                                            </span>
                                                            <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>
                                                                {player.team ? `${getTeamAbbr(player.team)}` : ''}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1">
                                                            {/* Badges */}
                                                            {renderPlayerBadges(player)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        {/* Stats */}
                                        {pitcherStatCategories.map(stat => (
                                            <td key={stat} className="px-4 py-4 text-center text-purple-100 font-mono">
                                                {getPlayerStat(player.player_id, stat)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend Modal */}
            <LegendModal
                isOpen={showLegendModal}
                onClose={() => setShowLegendModal(false)}
                batterStats={batterStatCategories}
                pitcherStats={pitcherStatCategories}
            />

            {/* Info Modal */}
            {showInfoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-purple-500/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
                        <button
                            onClick={() => setShowInfoModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="p-8">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm">?</span>
                                Position Eligibility Rules
                            </h2>

                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-xl font-bold text-purple-300 mb-4 border-b border-purple-500/20 pb-2">
                                        Batter Eligibility
                                    </h3>
                                    <div className="grid gap-4 text-gray-300">
                                        <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                            <div className="font-bold text-white mb-1">Standard Positions (C, 1B, 2B, 3B, SS, OF)</div>
                                            <div className="text-sm opacity-80">
                                                Player must have played at least <span className="text-green-400 font-bold">8 games</span> at that position in the current or previous season.
                                            </div>
                                        </div>

                                        <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                            <div className="font-bold text-white mb-1">Corner Infield (CI)</div>
                                            <div className="text-sm opacity-80">
                                                Automatically eligible if they qualify for <span className="text-purple-300">1B</span> or <span className="text-purple-300">3B</span>.
                                            </div>
                                        </div>

                                        <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                            <div className="font-bold text-white mb-1">Middle Infield (MI)</div>
                                            <div className="text-sm opacity-80">
                                                Automatically eligible if they qualify for <span className="text-purple-300">2B</span> or <span className="text-purple-300">SS</span>.
                                            </div>
                                        </div>

                                        <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                            <div className="font-bold text-white mb-1">Outfield Specific (LF, CF, RF)</div>
                                            <div className="text-sm opacity-80">
                                                Player must have made at least <span className="text-green-400 font-bold">8 appearances</span> at that specific outfield spot.
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-purple-300 mb-4 border-b border-purple-500/20 pb-2">
                                        Pitcher Eligibility
                                    </h3>
                                    <div className="grid gap-4 text-gray-300">
                                        <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                            <div className="font-bold text-white mb-1">Starting Pitcher (SP)</div>
                                            <div className="text-sm opacity-80">
                                                Player must have started at least <span className="text-green-400 font-bold">3 games</span> in the current or previous season.
                                            </div>
                                        </div>

                                        <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                            <div className="font-bold text-white mb-1">Relief Pitcher (RP)</div>
                                            <div className="text-sm opacity-80">
                                                Player must have made at least <span className="text-green-400 font-bold">5 relief appearances</span> in the current or previous season.
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-purple-300 mb-4 border-b border-purple-500/20 pb-2">
                                        Utility (Util) / Bench (BN)
                                    </h3>
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                        <div className="text-sm opacity-80 text-gray-300">
                                            Any batter can be placed in the <span className="text-white font-bold">Util</span> slot.<br />
                                            Any player can be placed on the <span className="text-white font-bold">Bench</span>.
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Move Modal */}
            <MoveModal
                isOpen={showMoveModal}
                onClose={() => {
                    setShowMoveModal(false);
                    setPlayerToMove(null);
                }}
                player={playerToMove}
                onMove={handleMovePlayer}
            />
        </div>
    );
}
