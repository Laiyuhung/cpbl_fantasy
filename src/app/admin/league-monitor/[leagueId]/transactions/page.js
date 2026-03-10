'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function AdminTransactionsPage() {
    const params = useParams();
    const { leagueId } = params;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [memberMap, setMemberMap] = useState({});
    const [playersMap, setPlayersMap] = useState({});

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const res = await fetch(`/api/admin/leagues/${leagueId}/transactions`);
                if (!res.ok) throw new Error('Failed to load transactions');

                const data = await res.json();
                if (data.success) {
                    setTransactions(data.transactions);
                    setMemberMap(data.memberMap);
                    setPlayersMap(data.playersMap);
                } else {
                    throw new Error(data.error);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [leagueId]);

    const getActionColor = (type) => {
        switch (type) {
            case 'Add': return 'text-green-600 bg-green-50 border-green-200';
            case 'Drop': return 'text-red-600 bg-red-50 border-red-200';
            case 'Trade': return 'text-purple-600 bg-purple-50 border-purple-200';
            case 'Commish Edit': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const renderPlayerNames = (playerIds) => {
        if (!playerIds || playerIds.length === 0) return null;
        return playerIds.map(id => playersMap[id]?.name || id).join(', ');
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading transactions...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">League Transactions</h2>
                <div className="text-sm text-gray-500">{transactions.length} records found</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 whitespace-nowrap">Date (Taiwan Time)</th>
                                <th className="px-6 py-3">Manager</th>
                                <th className="px-6 py-3">Action Type</th>
                                <th className="px-6 py-3 w-1/2">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                        No transactions recorded.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx) => {
                                    const date = new Date(tx.timestamp);
                                    // Make sure it displays as local time (Taiwan usually since users are there)
                                    const formattedDate = date.toLocaleString('en-US', {
                                        timeZone: 'Asia/Taipei',
                                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                                    });

                                    const managerName = memberMap[tx.manager_id] || tx.manager_id || 'System';

                                    let detailsText = '';
                                    if (tx.type === 'Add' || tx.type === 'Drop') {
                                        detailsText = playersMap[tx.player_id]?.name || tx.player_id;
                                    } else if (tx.type === 'Trade') {
                                        // Simple string representation of trade
                                        if (tx.details) {
                                            detailsText = `Offered: ${renderPlayerNames(tx.details.offeredPlayers)} | Requested: ${renderPlayerNames(tx.details.requestedPlayers)} | With: ${memberMap[tx.details.to_manager_id] || tx.details.to_manager_id}`;
                                        } else {
                                            detailsText = 'Trade details imported/unknown';
                                        }
                                    } else {
                                        detailsText = JSON.stringify(tx.details || {});
                                    }

                                    return (
                                        <tr key={tx.transaction_id || tx.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                                                {formattedDate}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {managerName}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getActionColor(tx.type)}`}>
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 break-words">
                                                {detailsText}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
