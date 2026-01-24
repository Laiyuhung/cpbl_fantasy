'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import LegendModal from '../../../../components/LegendModal';

export default function RosterPage() {
    const params = useParams();
    const leagueId = params.leagueId;

    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [date, setDate] = useState('');

    useEffect(() => {
        const fetchRoster = async () => {
            try {
                const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
                const managerId = cookie?.split('=')[1];

                if (!managerId) {
                    setError('Please log in first');
                    setLoading(false);
                    return;
                }

                const res = await fetch(`/api/league/${leagueId}/roster?manager_id=${managerId}`);
                const data = await res.json();

                if (data.success) {
                    setRoster(data.roster);
                    setDate(data.date);
                } else {
                    setError(data.error || 'Failed to fetch roster');
                }
            } catch (err) {
                console.error(err);
                setError('An unexpected error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchRoster();
    }, [leagueId]);

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
                <div className="text-purple-200 font-mono bg-purple-900/30 px-4 py-2 rounded-lg border border-purple-500/30">
                    Game Date: <span className="text-white font-bold">{date}</span>
                </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900/80 to-purple-900/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full">
                    <thead className="bg-purple-900/40 border-b border-purple-500/30">
                        <tr>
                            <th className="px-6 py-4 text-left text-sm font-bold text-purple-200 w-24">Slot</th>
                            <th className="px-6 py-4 text-left text-sm font-bold text-purple-200">Player</th>
                            <th className="px-6 py-4 text-left text-sm font-bold text-purple-200">Team</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/10">
                        {roster.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="px-6 py-12 text-center text-purple-300/50">
                                    No roster data found for today.
                                </td>
                            </tr>
                        ) : (
                            roster.map((player) => (
                                <tr key={player.id} className="hover:bg-purple-500/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold w-12 text-center ${['BN', 'IL', 'NA'].includes(player.position)
                                            ? 'bg-slate-700 text-slate-300'
                                            : 'bg-purple-600 text-white'
                                            }`}>
                                            {player.position}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white text-lg">
                                            {player.name}
                                            <span className="text-purple-300/70 text-sm font-normal ml-2">
                                                - {player.position_list}
                                            </span>
                                        </div>
                                        <div className="text-xs text-purple-300/60 font-mono mt-0.5">ID: {player.player_id.split('-')[0]}...</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-purple-200">{player.team || 'FA'}</span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
