'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import PlayerDetailModal from '@/components/PlayerDetailModal';

export default function AdminTransactionsPage() {
    const params = useParams();
    const { leagueId } = params;

    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [waivers, setWaivers] = useState([]);
    const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'waivers'
    const [viewAll, setViewAll] = useState(false);

    // Modal State
    const [selectedPlayerModal, setSelectedPlayerModal] = useState(null);

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const res = await fetch(`/api/admin/leagues/${leagueId}/transactions`);
                if (!res.ok) throw new Error('Failed to load transactions');

                const data = await res.json();
                if (data.success) {
                    setTransactions(data.transactions || []);
                    setWaivers(data.waivers || []);
                } else {
                    console.error("API error:", data.error);
                }
            } catch (err) {
                console.error('Error fetching transactions:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [leagueId]);

    // Grouping logic (Mimicking Page.js)
    const groupedTransactions = useMemo(() => {
        const groups = [];
        const processedIds = new Set();

        transactions.forEach((t) => {
            if (processedIds.has(t.transaction_id)) return;

            // If trade group id exists, bundle by trade group id
            if (t.trade_group_id) {
                const group = transactions.filter(item => item.trade_group_id === t.trade_group_id);
                group.forEach(item => processedIds.add(item.transaction_id));
                groups.push({
                    id: `trade-${t.trade_group_id}`,
                    type: 'trade',
                    time: t.transaction_time,
                    manager: t.manager,
                    items: group
                });
                return;
            }

            // Otherwise, bundle by exact same time and manager
            const sameGroup = transactions.filter(item =>
                !item.trade_group_id &&
                item.manager_id === t.manager_id &&
                item.transaction_time === t.transaction_time
            );

            sameGroup.forEach(item => processedIds.add(item.transaction_id));
            groups.push({
                id: `group-${t.transaction_id}`,
                type: 'standard',
                time: t.transaction_time,
                manager: t.manager,
                items: sameGroup
            });
        });

        // Ensure sorted by time
        return groups.sort((a, b) => new Date(b.time) - new Date(a.time));
    }, [transactions]);


    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Transactions & Waivers Monitor</h2>

            {/* Transactions & Waivers Tabbed Section */}
            <div>
                <div className="flex items-center gap-4 sm:gap-8 mb-4 sm:mb-6 border-b border-gray-200 pb-2 overflow-x-auto">
                    <button
                        onClick={() => { setActiveTab('transactions'); setViewAll(false); }}
                        className={`text-sm sm:text-xl font-black uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'transactions' ? 'text-gray-900 opacity-100' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <span className={`w-1.5 sm:w-2 h-5 sm:h-6 rounded-full transition-all ${activeTab === 'transactions' ? 'bg-blue-500' : 'bg-transparent'}`}></span>
                        Transactions
                    </button>
                    <button
                        onClick={() => { setActiveTab('waivers'); setViewAll(false); }}
                        className={`text-sm sm:text-xl font-black uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'waivers' ? 'text-gray-900 opacity-100' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <span className={`w-1.5 sm:w-2 h-5 sm:h-6 rounded-full transition-all ${activeTab === 'waivers' ? 'bg-orange-500' : 'bg-transparent'}`}></span>
                        Waivers
                    </button>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    {activeTab === 'transactions' && (
                        groupedTransactions.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 text-sm">No recent transactions.</div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {(viewAll ? groupedTransactions : groupedTransactions.slice(0, 10)).map((group) => (
                                    <div key={group.id} className="px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-all duration-300">
                                        {/* Left: Icons and Players */}
                                        <div className="flex flex-col gap-4">
                                            {group.items.map((item) => {
                                                const isTrade = item.transaction_type === 'TRADE';
                                                const recipientNickname = isTrade ? item.manager?.nickname : null;

                                                return (
                                                    <div key={item.transaction_id} className="flex items-center gap-5">
                                                        <div className="w-6 flex justify-center flex-shrink-0">
                                                            {(item.transaction_type === 'ADD' || item.transaction_type === 'WAIVER ADD') ? (
                                                                <span className={`text-2xl font-black leading-none ${item.transaction_type === 'WAIVER ADD' ? 'text-yellow-500' : 'text-green-500'}`}>+</span>
                                                            ) : (item.transaction_type === 'DROP' || item.transaction_type === 'WAIVER DROP') ? (
                                                                <span className="text-2xl font-black text-red-500 leading-none">-</span>
                                                            ) : isTrade ? (
                                                                <span className="text-2xl font-normal text-blue-400 leading-none">⇌</span>
                                                            ) : (
                                                                <span className="text-2xl font-black text-gray-300 leading-none">•</span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span
                                                                    className="text-base font-black text-gray-800 hover:text-purple-600 cursor-pointer transition-colors leading-tight"
                                                                    onClick={() => item.player && setSelectedPlayerModal(item.player)}
                                                                >
                                                                    {item.player?.name}
                                                                </span>
                                                                {isTrade && recipientNickname && (
                                                                    <span className="text-xs font-bold text-gray-500 tracking-tight italic flex items-center gap-1">
                                                                        <span className="text-blue-500/50">⇌</span>
                                                                        to {recipientNickname}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mt-0.5">
                                                                {item.transaction_type === 'DROP' || item.transaction_type === 'WAIVER DROP' ? 'To Waivers' :
                                                                    item.transaction_type === 'ADD' ? 'From FA' :
                                                                        item.transaction_type === 'WAIVER ADD' ? 'From Waivers' : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Right: Manager and Time */}
                                        <div className="text-right flex-shrink-0 ml-3 sm:ml-8">
                                            <div className="text-sm sm:text-base font-black text-blue-600 hover:text-blue-500 transition-colors mb-0.5">
                                                {(() => {
                                                    const nicknames = [...new Set(group.items.map(i => i.manager?.nickname).filter(Boolean))];
                                                    if (nicknames.length > 1) {
                                                        return (
                                                            <span className="flex items-center gap-2 justify-end">
                                                                {nicknames[0]}
                                                                <span className="text-gray-400 font-normal">⇌</span>
                                                                {nicknames[1]}
                                                            </span>
                                                        );
                                                    }
                                                    return group.manager?.nickname;
                                                })()}
                                            </div>
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-tighter">
                                                {new Date(group.time).toLocaleString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {groupedTransactions.length > 10 && (
                                    <div className="px-6 py-3 text-center border-t border-gray-100">
                                        <button
                                            onClick={() => setViewAll(!viewAll)}
                                            className="text-xs font-bold text-purple-600 hover:text-purple-500 uppercase tracking-widest transition-colors"
                                        >
                                            {viewAll ? 'View Less' : 'View All Transactions'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    )}

                    {activeTab === 'waivers' && (
                        waivers.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 text-sm">No active waiver claims.</div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {(viewAll ? waivers : waivers.slice(0, 10)).map((waiver) => (
                                    <div key={waiver.id} className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition-all duration-300 gap-4">

                                        <div className="flex flex-col gap-3 flex-1 min-w-0">
                                            {/* Add Player */}
                                            <div className="flex items-center gap-4">
                                                <div className="w-6 flex justify-center flex-shrink-0">
                                                    <span className="text-xl font-black text-yellow-500 leading-none">+</span>
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span
                                                        className="text-base font-black text-gray-800 hover:text-purple-600 cursor-pointer transition-colors leading-tight truncate"
                                                        onClick={() => setSelectedPlayerModal(waiver.player)}
                                                    >
                                                        {waiver.player?.name}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mt-0.5">
                                                        Claim from Waivers
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Drop Player (if any) */}
                                            {waiver.drop_player && (
                                                <div className="flex items-center gap-4">
                                                    <div className="w-6 flex justify-center flex-shrink-0">
                                                        <span className="text-xl font-black text-red-500 leading-none">-</span>
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span
                                                            className="text-base font-black text-gray-800 hover:text-purple-600 cursor-pointer transition-colors leading-tight truncate"
                                                            onClick={() => setSelectedPlayerModal(waiver.drop_player)}
                                                        >
                                                            {waiver.drop_player?.name}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mt-0.5">
                                                            Condition Drop
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 flex-shrink-0 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-gray-100 sm:border-0">
                                            <div className="text-sm sm:text-base font-black text-orange-600 mb-0.5 text-right">
                                                {waiver.manager?.nickname}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md">
                                                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                                                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Pending</span>
                                                </div>
                                                <div className="text-xs font-bold text-gray-500 uppercase tracking-tighter text-right">
                                                    Processes: {waiver.off_waiver}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {waivers.length > 10 && (
                                    <div className="px-6 py-3 text-center border-t border-gray-100">
                                        <button
                                            onClick={() => setViewAll(!viewAll)}
                                            className="text-xs font-bold text-orange-600 hover:text-orange-500 uppercase tracking-widest transition-colors"
                                        >
                                            {viewAll ? 'View Less' : 'View All Waivers'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Player modal */}
            {selectedPlayerModal && (
                <PlayerDetailModal
                    player={selectedPlayerModal}
                    leagueId={leagueId}
                    isOpen={!!selectedPlayerModal}
                    onClose={() => setSelectedPlayerModal(null)}
                />
            )}
        </div>
    );
}
