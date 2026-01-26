'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function DraftPage() {
    const params = useParams();
    const leagueId = params.leagueId;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [initLoading, setInitLoading] = useState(false);
    const [draftState, setDraftState] = useState(null);
    const [players, setPlayers] = useState([]);
    const [myManagerId, setMyManagerId] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [picking, setPicking] = useState(false);
    const [myTeam, setMyTeam] = useState([]);

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
                const res = await fetch(`/api/league/${leagueId}/draft/state`);
                const data = await res.json();

                if (data.status === 'completed') {
                    alert('Draft Completed!');
                    router.push(`/league/${leagueId}`);
                    return;
                }

                setDraftState(data);

                // Update Timer
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

    // Count down timer locally smooth
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Initial Load Players
    useEffect(() => {
        const fetchPlayers = async () => {
            setLoading(true);
            const res = await fetch('/api/playerslist?available=true');
            const data = await res.json();
            if (data.success) {
                setPlayers(data.players || []);
            }
            setLoading(false);
        };
        fetchPlayers();
    }, []);

    // Filter logic removed from useEffect, but filteredPlayers is computed below.
    // We also removed handleInit which is fine.

    const handlePick = async (playerId) => {
        if (picking) return;
        setPicking(true);
        const res = await fetch(`/api/league/${leagueId}/draft/pick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ managerId: myManagerId, playerId })
        });
        const data = await res.json();
        if (!data.success) {
            alert('Pick failed: ' + data.error);
        }
        setPicking(false);
    };

    const filteredPlayers = players.filter(p => {
        const isTaken = draftState?.takenPlayerIds?.includes(p.player_id); // Will need to implement backend support
        if (isTaken) return false;
        if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    }).slice(0, 100); // Limit display

    if (loading) return <div className="text-white p-10">Loading Draft Room...</div>;

    const formatTime = (seconds) => {
        if (seconds > 86400) return `${Math.floor(seconds / 86400)}d`;
        if (seconds > 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
        if (seconds > 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        return seconds;
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4">
            {/* Header / Status */}
            <div className="bg-slate-800 p-4 rounded-xl mb-4 flex justify-between items-center border border-purple-500/30">
                <div>
                    <h1 className="text-2xl font-bold text-purple-300">Live Draft Room</h1>
                    {draftState?.currentPick ? (
                        <div className="text-lg">
                            Round {draftState.currentPick.round_number} / Pick {draftState.currentPick.pick_number}
                        </div>
                    ) : (
                        <div className="text-lg text-blue-300 animate-pulse">
                            {draftState?.status === 'pre-draft' ? 'Draft Room Open' : 'Draft Finished'}
                        </div>
                    )}
                </div>

                <div className="text-center">
                    <div className={`text-5xl font-mono font-black ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                        {formatTime(timeLeft)}
                    </div>
                    <div className="text-xs text-slate-400">
                        {draftState?.status === 'pre-draft' ? 'UNTIL START' : 'SECONDS LEFT'}
                    </div>
                </div>

                <div>
                    {!draftState?.currentPick && (
                        <div className="text-right">
                            {draftState?.status === 'pre-draft' && draftState.startTime && (
                                <div className="text-sm text-slate-400">
                                    Starts: {new Date(draftState.startTime).toLocaleString()}
                                </div>
                            )}
                        </div>
                    )}
                    {draftState?.currentPick && (
                        <div className="text-right">
                            <div className="text-sm text-slate-400">On The Clock:</div>
                            <div className="text-xl font-bold text-yellow-300">
                                {draftState.currentPick.manager_id === myManagerId ? 'YOU!' : 'Opponent'}
                                {/* Ideally nickname */}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-4 h-[75vh]">
                {/* Left: Player Pool */}
                <div className="flex-1 bg-slate-800/50 rounded-xl p-4 border border-slate-700 flex flex-col">
                    <h2 className="text-xl font-bold mb-4 text-purple-200">Available Players</h2>
                    <input
                        className="w-full bg-slate-900 p-2 rounded mb-2 border border-slate-600"
                        placeholder="Search players..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />

                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="text-slate-400 bg-slate-900 sticky top-0">
                                <tr>
                                    <th className="p-2">Name</th>
                                    <th className="p-2">Team</th>
                                    <th className="p-2">Pos</th>
                                    <th className="p-2">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPlayers.map(player => (
                                    <tr key={player.player_id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                        <td className="p-2 font-bold">{player.name}</td>
                                        <td className="p-2 text-sm">{player.team}</td>
                                        <td className="p-2 text-sm">{player.position}</td>
                                        <td className="p-2">
                                            {draftState?.currentPick?.manager_id === myManagerId ? (
                                                <button
                                                    onClick={() => handlePick(player.player_id)}
                                                    disabled={picking}
                                                    className="px-3 py-1 bg-green-600 rounded text-xs font-bold hover:bg-green-500 disabled:opacity-50"
                                                >
                                                    DRAFT
                                                </button>
                                            ) : (
                                                <span className="text-slate-500 text-xs">Wait</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right: Recent Picks & My Team */}
                <div className="w-1/3 flex flex-col gap-4">
                    {/* Recent Picks */}
                    <div className="h-1/2 bg-slate-800/50 rounded-xl p-4 border border-slate-700 overflow-hidden">
                        <h2 className="text-xl font-bold mb-2 text-blue-200">Recent Picks</h2>
                        <div className="space-y-2">
                            {draftState?.recentPicks?.length === 0 && <div className="text-slate-500">No picks yet</div>}
                            {draftState?.recentPicks?.map(pick => (
                                <div key={pick.pick_number} className="bg-slate-900 p-2 rounded border border-slate-600 flex justify-between items-center slide-in">
                                    <div>
                                        <span className="text-yellow-500 font-mono font-bold mr-2">#{pick.pick_number}</span>
                                        <span className="font-bold">{pick.player?.name}</span>
                                    </div>
                                    <div className="text-xs bg-slate-800 px-2 py-1 rounded">
                                        {pick.player?.position}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* My Team Placeholder */}
                    <div className="h-1/2 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <h2 className="text-xl font-bold mb-2 text-pink-200">My Team</h2>
                        <div className="text-slate-500 text-sm">
                            (List drafts here later)
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
