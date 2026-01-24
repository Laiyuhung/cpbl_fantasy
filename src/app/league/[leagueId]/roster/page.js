'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import LegendModal from '../../../../components/LegendModal';
import MoveModal from './MoveModal';

export default function RosterPage() {
    const params = useParams();
    const leagueId = params.leagueId;

    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true); // Initial Load
    const [actionLoading, setActionLoading] = useState(false); // Action Load (Blur)
    const [error, setError] = useState('');
    const [date, setDate] = useState('');

    // Stats State
    const [timeWindow, setTimeWindow] = useState('Today');
    const [playerStats, setPlayerStats] = useState({});
    const [batterStatCategories, setBatterStatCategories] = useState([]);
    const [pitcherStatCategories, setPitcherStatCategories] = useState([]);

    // Settings State
    const [rosterPositionsConfig, setRosterPositionsConfig] = useState({});

    // Modals
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showLegendModal, setShowLegendModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [playerToMove, setPlayerToMove] = useState(null);

    // Helpers
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
        if (!managerId) return;

        // Note: We don't verify success here, handled in try/catch if needed, but simple fetch is fine
        try {
            const res = await fetch(`/api/league/${leagueId}/roster?manager_id=${managerId}`);
            const data = await res.json();
            if (data.success) {
                setRoster(data.roster || []);
                setDate(data.date);
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

    const handleMovePlayer = async (targetPos) => {
        if (!playerToMove) return;

        setShowMoveModal(false);
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
                    gameDate: date
                })
            });

            const data = await res.json();
            if (data.success) {
                await refreshRoster(); // Wait for refresh
            } else {
                setError(data.error || 'Move failed');
                setActionLoading(false);
                setPlayerToMove(null);
                setTimeout(() => setError(''), 3000);
            }

        } catch (err) {
            console.error(err);
            setActionLoading(false);
        }
    };

    // Initial Load
    useEffect(() => {
        const init = async () => {
            await refreshRoster();
            setLoading(false);
        };
        init();
    }, [leagueId]);

    // Settings
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
        <div className="relative">
            {/* Blur Overlay Loader */}
            {actionLoading && (
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="text-white font-bold tracking-widest animate-pulse">UPDATING ROSTER...</div>
                    </div>
                </div>
            )}

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
                        {/* Other buttons updated with shorter syntax for brevity but functionally same */}
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
                        <div className="text-purple-200 font-mono bg-purple-900/30 px-4 py-2 rounded-lg border border-purple-500/30">
                            Game Date: <span className="text-white font-bold">{date}</span>
                        </div>
                    </div>
                </div>

                {/* Batter Table */}
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
                                    <tr><td colSpan={10} className="p-4 text-center text-purple-300">No Batters</td></tr>
                                ) : batterRoster.map(player => (
                                    <tr key={player.id} className="hover:bg-purple-500/5 transition">
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
                                                <div className="flex items-center gap-4 text-slate-500 font-bold italic">Empty</div>
                                            ) : (
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800 flex-shrink-0">
                                                        {getPlayerPhoto(player) && <img src={getPlayerPhoto(player)} alt={player.name} className="w-full h-full object-cover" onError={handleImageError} />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white text-lg flex items-center">
                                                            {player.name}
                                                            <span className="text-purple-300/70 text-sm font-normal ml-2">- {player.position_list}</span>
                                                            <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>{player.team ? getTeamAbbr(player.team) : ''}</span>
                                                        </div>
                                                        <div className="mt-1">{renderPlayerBadges(player)}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        {batterStatCategories.map(stat => (
                                            <td key={stat} className="px-4 py-4 text-center text-purple-100 font-mono">
                                                {getPlayerStat(player.player_id, stat)}
                                            </td>
                                        ))}
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
                                    <tr><td colSpan={10} className="p-4 text-center text-purple-300">No Pitchers</td></tr>
                                ) : pitcherRoster.map(player => (
                                    <tr key={player.id} className="hover:bg-purple-500/5 transition">
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
                                                <div className="flex items-center gap-4 text-slate-500 font-bold italic">Empty</div>
                                            ) : (
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800 flex-shrink-0">
                                                        {getPlayerPhoto(player) && <img src={getPlayerPhoto(player)} alt={player.name} className="w-full h-full object-cover" onError={handleImageError} />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white text-lg flex items-center">
                                                            {player.name}
                                                            <span className="text-purple-300/70 text-sm font-normal ml-2">- {player.position_list}</span>
                                                            <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>{player.team ? getTeamAbbr(player.team) : ''}</span>
                                                        </div>
                                                        <div className="mt-1">{renderPlayerBadges(player)}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        {pitcherStatCategories.map(stat => (
                                            <td key={stat} className="px-4 py-4 text-center text-purple-100 font-mono">
                                                {getPlayerStat(player.player_id, stat)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <LegendModal isOpen={showLegendModal} onClose={() => setShowLegendModal(false)} batterStats={batterStatCategories} pitcherStats={pitcherStatCategories} />

                {showInfoModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-slate-900 border border-purple-500/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative p-8">
                            <button
                                onClick={() => setShowInfoModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm">?</span>
                                Position Eligibility Rules
                            </h2>

                            <div className="space-y-6">
                                {/* Standard Batters */}
                                {['C', '1B', '2B', '3B', 'SS', 'OF', 'LF', 'CF', 'RF'].some(p => rosterPositionsConfig[p] > 0) && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                        <div className="font-bold text-white mb-1">Standard Positions (C, 1B, 2B, 3B, SS, OF, LF, CF, RF)</div>
                                        <div className="text-sm opacity-80 text-gray-300">
                                            Player must have played at least <span className="text-green-400 font-bold">8 games</span> at that position in the current or previous season.
                                        </div>
                                    </div>
                                )}

                                {/* CI */}
                                {rosterPositionsConfig['CI'] > 0 && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                        <div className="font-bold text-white mb-1">Corner Infield (CI)</div>
                                        <div className="text-sm opacity-80 text-gray-300">
                                            Player must have played at least <span className="text-green-400 font-bold">8 games</span> at <span className="text-purple-300">1B</span> or <span className="text-purple-300">3B</span>.
                                        </div>
                                    </div>
                                )}

                                {/* MI */}
                                {rosterPositionsConfig['MI'] > 0 && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                        <div className="font-bold text-white mb-1">Middle Infield (MI)</div>
                                        <div className="text-sm opacity-80 text-gray-300">
                                            Player must have played at least <span className="text-green-400 font-bold">8 games</span> at <span className="text-purple-300">2B</span> or <span className="text-purple-300">SS</span>.
                                        </div>
                                    </div>
                                )}

                                {/* Util */}
                                {rosterPositionsConfig['Util'] > 0 && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                        <div className="font-bold text-white mb-1">Utility (Util)</div>
                                        <div className="text-sm opacity-80 text-gray-300">
                                            Any <span className="text-white font-bold">Batter</span> can be placed in the Util slot.
                                        </div>
                                    </div>
                                )}

                                {/* SP */}
                                {rosterPositionsConfig['SP'] > 0 && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                        <div className="font-bold text-white mb-1">Starting Pitcher (SP)</div>
                                        <div className="text-sm opacity-80 text-gray-300">
                                            Player must have started at least <span className="text-green-400 font-bold">3 games</span> in the current or previous season.
                                        </div>
                                    </div>
                                )}

                                {/* RP */}
                                {rosterPositionsConfig['RP'] > 0 && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                        <div className="font-bold text-white mb-1">Relief Pitcher (RP)</div>
                                        <div className="text-sm opacity-80 text-gray-300">
                                            Player must have made at least <span className="text-green-400 font-bold">5 relief appearances</span> in the current or previous season.
                                        </div>
                                    </div>
                                )}

                                {/* P */}
                                {rosterPositionsConfig['P'] > 0 && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                        <div className="font-bold text-white mb-1">Pitcher (P)</div>
                                        <div className="text-sm opacity-80 text-gray-300">
                                            Any <span className="text-white font-bold">Pitcher</span> can be placed in the P slot.
                                        </div>
                                    </div>
                                )}

                                {/* BN */}
                                <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                    <div className="font-bold text-white mb-1">Bench (BN)</div>
                                    <div className="text-sm opacity-80 text-gray-300">
                                        Any player can be placed on the Bench.
                                    </div>
                                </div>

                                {/* NA */}
                                {(rosterPositionsConfig['NA'] > 0 || rosterPositionsConfig['Minor'] > 0) && (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-purple-500/10">
                                        <div className="font-bold text-white mb-1">Minor League (NA)</div>
                                        <div className="text-sm opacity-80 text-gray-300">
                                            Only players with <span className="text-yellow-300 font-bold">NA / Minor</span>, <span className="text-red-300 font-bold">Deregistered (DR)</span>, or <span className="text-slate-300 font-bold">Unregistered (NR)</span> status can be placed here.
                                        </div>
                                    </div>
                                )}
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
                    onMove={handleMovePlayer}
                />
            </div>
        </div>
    );
}
