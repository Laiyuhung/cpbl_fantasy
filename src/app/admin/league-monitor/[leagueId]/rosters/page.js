'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';

export default function AdminRostersPage() {
    const params = useParams();
    const { leagueId } = params;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [members, setMembers] = useState([]);
    const [rosters, setRosters] = useState([]);
    const [positions, setPositions] = useState([]);
    const [players, setPlayers] = useState([]);
    const [selectedManager, setSelectedManager] = useState('all');

    useEffect(() => {
        const fetchRosters = async () => {
            try {
                const res = await fetch(`/api/admin/leagues/${leagueId}/rosters`);
                if (!res.ok) throw new Error('Failed to load rosters');

                const data = await res.json();
                if (data.success) {
                    setMembers(data.members);
                    setRosters(data.rosters);
                    setPositions(data.positions);
                    setPlayers(data.players);
                } else {
                    throw new Error(data.error);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRosters();
    }, [leagueId]);

    const displayManagerIds = selectedManager === 'all'
        ? members.map(m => m.manager_id)
        : [selectedManager];

    const getPlayerInfo = (playerId) => {
        return players.find(p => p.player_id === playerId);
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading rosters...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">League Rosters</h2>
                <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 max-w-xs"
                >
                    <option value="all">All Teams</option>
                    {members.map(m => (
                        <option key={m.manager_id} value={m.manager_id}>
                            {m.nickname || m.manager_id}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {displayManagerIds.map(managerId => {
                    const manager = members.find(m => m.manager_id === managerId);
                    const managerRoster = rosters.filter(r => r.manager_id === managerId);
                    const managerPositions = positions.filter(p => p.manager_id === managerId);

                    return (
                        <div key={managerId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-gray-100">
                                <h3 className="font-bold text-gray-900">
                                    {manager?.nickname || managerId}
                                </h3>
                                <p className="text-xs text-gray-500 font-mono mt-1">{managerId}</p>
                            </div>

                            <div className="p-0">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-500 uppercase text-xs font-bold">
                                        <tr>
                                            <th className="px-4 py-2">Pos</th>
                                            <th className="px-4 py-2">Player</th>
                                            <th className="px-4 py-2 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {/* Sort starters first, then bench */}
                                        {managerRoster.sort((a, b) => {
                                            const posA = managerPositions.find(p => p.player_id === a.player_id)?.position || 'BN';
                                            const posB = managerPositions.find(p => p.player_id === b.player_id)?.position || 'BN';
                                            if (posA === 'BN' && posB !== 'BN') return 1;
                                            if (posB === 'BN' && posA !== 'BN') return -1;
                                            return 0;
                                        }).map(rosterSpot => {
                                            const posData = managerPositions.find(p => p.player_id === rosterSpot.player_id);
                                            const position = posData?.position || 'BN';
                                            const isStarter = position !== 'BN';
                                            const playerInfo = getPlayerInfo(rosterSpot.player_id);

                                            return (
                                                <tr key={rosterSpot.player_id} className={`hover:bg-gray-50 ${isStarter ? '' : 'opacity-70 bg-gray-50/50'}`}>
                                                    <td className="px-4 py-2">
                                                        <span className={`inline-block w-8 text-center font-bold text-xs rounded px-1 py-0.5 ${isStarter ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                                                            {position}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-2">
                                                            {playerInfo?.photo_url ? (
                                                                <img src={playerInfo.photo_url} alt={playerInfo.name} className="w-8 h-8 rounded-full object-cover bg-gray-200" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                                                    IMG
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div className="font-semibold text-gray-900">{playerInfo?.name || rosterSpot.player_id}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    {playerInfo?.team || '-'} • {playerInfo?.primary_position || '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <span className={`text-xs px-2 py-1 rounded-full border ${rosterSpot.status === 'active' ? 'border-green-200 text-green-700 bg-green-50' : 'border-red-200 text-red-700 bg-red-50'}`}>
                                                            {rosterSpot.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {managerRoster.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                                                    Empty Roster
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
