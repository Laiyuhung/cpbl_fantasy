'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import LegendModal from '../../../../components/LegendModal';

export default function DraftPage() {
    const params = useParams();
    const leagueId = params.leagueId;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [draftState, setDraftState] = useState(null);
    const [players, setPlayers] = useState([]);
    const [myManagerId, setMyManagerId] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [picking, setPicking] = useState(false);

    // UI States
    const [showLegend, setShowLegend] = useState(false);
    const [filterPos, setFilterPos] = useState('All');

    // New States for Logic Parity with Players Page
    const [rosterPositions, setRosterPositions] = useState({});
    const [photoSrcMap, setPhotoSrcMap] = useState({});
    const failedImages = useRef(new Set());

    // Fetch Manager ID
    useEffect(() => {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const userId = cookie?.split('=')[1];
        if (userId) setMyManagerId(userId);
    }, []);

    // Poll Draft State
    useEffect(() => {
        let interval;
        const fetchState = async () => {
            try {
                // Fetch ALL picks now
                const res = await fetch(`/api/league/${leagueId}/draft/state`);
                const data = await res.json();

                if (data.status === 'completed') {
                    // console.log('Draft Completed');
                }

                setDraftState(data);

                // Update Timer
                // Use Server Time to sync
                const now = new Date(data.serverTime).getTime();

                if (data.status === 'pre-draft' && data.startTime) {
                    const start = new Date(data.startTime).getTime();
                    const diff = Math.floor((start - now) / 1000);
                    setTimeLeft(diff > 0 ? diff : 0);
                } else if (data.currentPick?.deadline) {
                    const deadline = new Date(data.currentPick.deadline).getTime();
                    const diff = Math.floor((deadline - now) / 1000);
                    setTimeLeft(diff > 0 ? diff : 0);
                }

            } catch (e) {
                console.error(e);
            }
        };

        fetchState();
        interval = setInterval(fetchState, 2000); // Poll every 2s

        return () => clearInterval(interval);
    }, [leagueId, router]);

    // Count down timer locally smooth (every 1s)
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Initial Load Players & Settings (Run Once)
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [playersRes, settingsRes] = await Promise.all([
                    fetch('/api/playerslist?available=true'),
                    fetch(`/api/league-settings?league_id=${leagueId}`)
                ]);

                const playersData = await playersRes.json();
                const settingsData = await settingsRes.json();

                if (playersData.success) {
                    setPlayers(playersData.players || []);
                }

                if (settingsData.success && settingsData.data) {
                    setRosterPositions(settingsData.data.roster_positions || {});
                }

            } catch (e) {
                console.error('Failed to load draft resources', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [leagueId]);

    // ---------------------------------------------------------
    // Helper Logic (Copied/Adapted from Players Page)
    // ---------------------------------------------------------

    // Filter Positions based on League Settings
    const filterPositions = (player) => {
        let positionList = player.position_list;

        // Default if missing
        if (!positionList) {
            positionList = player.batter_or_pitcher === 'batter' ? 'Util' : 'P';
        }

        const positions = positionList.split(',').map(p => p.trim());

        // Filter out positions not in roster settings
        const validPositions = positions.filter(pos => {
            return rosterPositions[pos] && rosterPositions[pos] > 0;
        });

        return validPositions.length > 0 ? validPositions.join(', ') : 'NA';
    };

    const getPlayerPhotoPaths = (player) => {
        const paths = [];
        if (player.name) paths.push(`/photo/${player.name}.png`);
        if (player.original_name) {
            const aliases = player.original_name.split(',').map(alias => alias.trim());
            aliases.forEach(alias => {
                if (alias) paths.push(`/photo/${alias}.png`);
            });
        }
        if (player.player_id) paths.push(`/photo/${player.player_id}.png`);
        paths.push('/photo/defaultPlayer.png'); // Fallback
        return paths;
    };

    // Batch Resolve Photos (Performance)
    useEffect(() => {
        let cancelled = false;
        const resolvePhotos = async () => {
            if (!players || players.length === 0) return;

            // Only attempt to resolve if NOT already resolved? 
            // For now, resolve all initially loaded players.
            const batchPayload = players.map(player => ({
                id: player.player_id,
                candidates: getPlayerPhotoPaths(player).filter(p => !p.endsWith('/defaultPlayer.png'))
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
                if (!cancelled) {
                    // Fallback all
                    const fallback = Object.fromEntries(players.map(p => [p.player_id, '/photo/defaultPlayer.png']));
                    setPhotoSrcMap(fallback);
                }
            }
        };
        resolvePhotos();
        return () => { cancelled = true; };
    }, [players]);

    const getPlayerPhoto = (player) => {
        return photoSrcMap[player.player_id] || '/photo/defaultPlayer.png';
    };

    const handleImageError = (e, player) => {
        const currentSrc = e.target.src;
        const paths = getPlayerPhotoPaths(player);

        let currentIndex = -1;
        // Check current index
        for (let i = 0; i < paths.length; i++) {
            // Use simple include check (robust enough for relative/absolute)
            if (currentSrc.includes(encodeURI(paths[i])) || currentSrc.includes(paths[i])) {
                currentIndex = i;
                break;
            }
        }

        // If fail to find index (e.g. CDN mismatch), assume 0 and try next
        if (currentIndex === -1) currentIndex = 0;

        const nextIndex = currentIndex + 1;
        if (nextIndex < paths.length) {
            // Try next
            e.target.src = paths[nextIndex];
        } else {
            // Final Fallback
            e.target.src = '/photo/defaultPlayer.png';
            // Prevent loop
            e.target.onerror = null;
        }
    };

    // ---------------------------------------------------------
    // Draft Logic
    // ---------------------------------------------------------

    // Derived State
    const { takenIds, recentPicks, myTeam } = useMemo(() => {
        if (!draftState?.picks) return { takenIds: new Set(), recentPicks: [], myTeam: [] };

        const picks = draftState.picks;
        const taken = new Set(picks.map(p => p.player_id).filter(Boolean));

        // Recent: Sort by picked_at desc, exclude nulls
        const recent = picks
            .filter(p => p.player_id && p.picked_at)
            .sort((a, b) => new Date(b.picked_at) - new Date(a.picked_at))
            .slice(0, 10); // Show last 10

        // My Team
        const mine = picks
            .filter(p => p.manager_id === myManagerId && p.player_id)
            .map(p => ({
                ...p.player,
                round: p.round_number,
                pick: p.pick_number
            }));

        return { takenIds: taken, recentPicks: recent, myTeam: mine };
    }, [draftState, myManagerId]);


    const handlePick = async (playerId) => {
        if (picking) return;
        setPicking(true);
        // Optimistic UI? No, wait for verify.
        const res = await fetch(`/api/league/${leagueId}/draft/pick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ managerId: myManagerId, playerId })
        });
        const data = await res.json();
        if (!data.success) {
            alert('Pick failed: ' + data.error);
            setPicking(false);
        } else {
            // Success, force refresh immediately
            const stateRes = await fetch(`/api/league/${leagueId}/draft/state`);
            const stateData = await stateRes.json();
            setDraftState(stateData);
            setPicking(false);
        }
    };

    const filteredPlayers = useMemo(() => {
        return players.filter(p => {
            if (takenIds.has(p.player_id)) return false;

            if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !p.team?.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            if (filterPos !== 'All') {
                if (filterPos === 'Batter' && p.batter_or_pitcher === 'pitcher') return false;
                if (filterPos === 'Pitcher' && p.batter_or_pitcher === 'batter') return false;
            }

            return true;
        }).slice(0, 100);
    }, [players, takenIds, searchTerm, filterPos]);

    // Helpers (Values)
    const getTeamAbbr = (team) => {
        switch (team) {
            case '統一獅': return 'UL';
            case '富邦悍將': return 'FG';
            case '樂天桃猿': return 'RM';
            case '中信兄弟': return 'B';
            case '味全龍': return 'W';
            case '台鋼雄鷹': return 'TSG';
            default: return team?.substring(0, 2) || '-';
        }
    };

    const getTeamColor = (team) => {
        switch (team) {
            case '統一獅': return 'text-orange-400 bg-orange-900/20 border-orange-500/30';
            case '富邦悍將': return 'text-blue-400 bg-blue-900/20 border-blue-500/30';
            case '樂天桃猿': return 'text-rose-400 bg-rose-900/20 border-rose-500/30';
            case '中信兄弟': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
            case '味全龍': return 'text-red-400 bg-red-900/20 border-red-500/30';
            case '台鋼雄鷹': return 'text-green-400 bg-green-900/20 border-green-500/30';
            default: return 'text-slate-400 bg-slate-800 border-slate-700';
        }
    };

    const formatTime = (seconds) => {
        if (seconds > 86400) return `${Math.floor(seconds / 86400)}d`;
        if (seconds > 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
        if (seconds > 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        return seconds;
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="animate-spin text-purple-500 text-4xl">⚾</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 font-sans">
            {/* Legend Modal */}
            <LegendModal isOpen={showLegend} onClose={() => setShowLegend(false)} />

            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-xl mb-4 flex flex-col md:flex-row justify-between items-center border border-purple-500/30 shadow-lg gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-purple-900/50 rounded-full flex items-center justify-center border-2 border-purple-500">
                        <span className="text-2xl">🏆</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-blue-300">
                            Live Draft Room
                        </h1>
                        {draftState?.currentPick ? (
                            <div className="flex items-center gap-2 text-lg">
                                <span className="bg-slate-700 px-2 py-0.5 rounded text-sm text-slate-300">Rd {draftState.currentPick.round_number}</span>
                                <span className="text-purple-200 font-bold">Pick {draftState.currentPick.pick_number}</span>
                            </div>
                        ) : (
                            <div className="text-lg text-blue-300 animate-pulse">
                                {draftState?.status === 'pre-draft' ? 'Draft Room Open' : 'Draft Finished'}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <div className={`text-6xl font-mono font-black tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(0,0,0,0.5)] ${timeLeft < 10 && draftState?.status !== 'pre-draft' ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                        {formatTime(timeLeft)}
                    </div>
                    <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mt-1">
                        {draftState?.status === 'pre-draft' ? 'Until Start' : 'Time Remaining'}
                    </div>
                </div>

                <div className="flex flex-col items-end min-w-[200px]">
                    {!draftState?.currentPick ? (
                        <div className="text-right">
                            {draftState?.status === 'pre-draft' && draftState.startTime && (
                                <div className="text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                                    ⏰ Starts: {new Date(draftState.startTime).toLocaleString()}
                                </div>
                            )}
                            <button onClick={() => setShowLegend(true)} className="mt-2 text-xs text-purple-400 hover:text-purple-300 underline">
                                View Legend
                            </button>
                        </div>
                    ) : (
                        <div className="text-right bg-slate-800/80 p-3 rounded-lg border border-yellow-500/30 w-full">
                            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">On The Clock</div>
                            <div className="text-xl font-bold text-yellow-300 truncate">
                                {draftState.currentPick.manager_id === myManagerId ? '🟢 YOU' : '🔴 Opponent'}
                            </div>
                            <button onClick={() => setShowLegend(true)} className="text-[10px] text-slate-500 hover:text-slate-300 mt-1">
                                ? Legend
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-180px)]">
                {/* Center: Player Pool */}
                <div className="flex-[2] bg-slate-800/40 rounded-xl p-4 border border-slate-700 flex flex-col backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Available Players
                            <span className="text-xs bg-slate-700 px-2 py-1 rounded-full text-slate-300">{filteredPlayers.length}</span>
                        </h2>
                        <div className="flex gap-2">
                            <select
                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm"
                                value={filterPos}
                                onChange={e => setFilterPos(e.target.value)}
                            >
                                <option>All</option>
                                <option>Batter</option>
                                <option>Pitcher</option>
                            </select>
                            <input
                                className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm w-40 focus:w-60 transition-all outline-none focus:border-purple-500"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead className="bg-slate-900/90 sticky top-0 z-10 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                                <tr>
                                    <th className="p-3 rounded-l-lg">Player</th>
                                    <th className="p-3 text-center">Team</th>
                                    <th className="p-3 text-center">Pos</th>
                                    <th className="p-3 rounded-r-lg text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPlayers.map(player => (
                                    <tr key={player.player_id} className="group hover:bg-slate-700/40 transition-colors">
                                        <td className="p-3 bg-slate-800/50 rounded-l-lg group-hover:bg-slate-700/50 border-y border-l border-transparent group-hover:border-slate-600">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600 shadow-sm relative shrink-0">
                                                    <img
                                                        src={getPlayerPhoto(player)}
                                                        onError={(e) => handleImageError(e, player)}
                                                        alt={player.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-200">{player.name}</div>
                                                    <div className="text-[10px] text-slate-500">{player.original_name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center bg-slate-800/50 group-hover:bg-slate-700/50 border-y border-transparent group-hover:border-slate-600">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${getTeamColor(player.team)}`}>
                                                {getTeamAbbr(player.team)}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center bg-slate-800/50 group-hover:bg-slate-700/50 border-y border-transparent group-hover:border-slate-600">
                                            <span className="text-sm font-mono text-cyan-300">{filterPositions(player)}</span>
                                        </td>
                                        <td className="p-3 text-right bg-slate-800/50 rounded-r-lg group-hover:bg-slate-700/50 border-y border-r border-transparent group-hover:border-slate-600">
                                            <button
                                                onClick={() => handlePick(player.player_id)}
                                                disabled={picking || draftState?.currentPick?.manager_id !== myManagerId}
                                                className={`px-4 py-1.5 rounded text-xs font-bold shadow-md transition-all
                                                    ${draftState?.currentPick?.manager_id === myManagerId
                                                        ? 'bg-green-600 hover:bg-green-500 text-white hover:scale-105 active:scale-95'
                                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                                                    }`}
                                            >
                                                {picking && draftState?.currentPick?.manager_id === myManagerId ? '...' : 'DRAFT'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right: Info Panels */}
                <div className="flex-1 flex flex-col gap-4 min-w-[300px]">
                    {/* Recent Picks */}
                    <div className="h-1/2 bg-slate-800/40 rounded-xl p-4 border border-slate-700 flex flex-col backdrop-blur-sm">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-700/50 pb-2">Recent Picks</h2>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {recentPicks.length === 0 && <div className="text-slate-500 text-sm text-center py-4">No picks yet</div>}
                            {recentPicks.map(pick => (
                                <div key={pick.pick_id} className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 flex items-center gap-3">
                                    <div className="text-xs font-mono text-purple-400 font-bold bg-purple-900/20 px-1.5 py-0.5 rounded">
                                        #{pick.pick_number}
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-600 shrink-0">
                                        <img
                                            src={getPlayerPhoto(pick.player || {})}
                                            onError={(e) => handleImageError(e, pick.player || {})}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-slate-200 truncate">{pick.player?.name}</div>
                                        <div className="text-[10px] text-slate-500">{filterPositions(pick.player || {})} • {getTeamAbbr(pick.player?.team)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* My Team */}
                    <div className="h-1/2 bg-slate-800/40 rounded-xl p-4 border border-slate-700 flex flex-col backdrop-blur-sm">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-700/50 pb-2 flex justify-between">
                            My Team
                            <span className="text-slate-500">{myTeam.length}/??</span>
                        </h2>
                        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {myTeam.length === 0 && <div className="text-slate-500 text-sm text-center py-4">Your roster is empty</div>}
                            {myTeam.map((p, i) => (
                                <div key={i} className="flex justify-between items-center text-sm p-2 hover:bg-slate-800/50 rounded transition-colors group">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 font-mono w-4">{filterPositions(p).split(',')[0]}</span>
                                        <span className="text-slate-300 font-medium group-hover:text-white">{p.name}</span>
                                    </div>
                                    <span className={`text-[10px] px-1.5 rounded border ${getTeamColor(p.team)}`}>
                                        {getTeamAbbr(p.team)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(15, 23, 42, 0.5); 
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(139, 92, 246, 0.3); 
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(139, 92, 246, 0.5); 
                }
            `}</style>
        </div>
    );
}
