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
    const [priorityRankings, setPriorityRankings] = useState([]);
    const [totalManagers, setTotalManagers] = useState(0);
    const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'waivers'
    const [waiverSubTab, setWaiverSubTab] = useState('pending'); // 'pending' | 'completed'
    const [viewAll, setViewAll] = useState(false);

    const getPersonalPriority = (claim) => claim.personal_priority ?? claim.waiver_claims?.personal_priority ?? '-';

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
                    setPriorityRankings(data.priorityRankings || []);
                    setTotalManagers(data.totalManagers || 0);
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

    // Waiver grouping logic: separate pending vs completed, group by player_id and off_waiver date
    const groupedWaivers = useMemo(() => {
        const pending = [];
        const completed = [];

        // Separate by status
        waivers.forEach(w => {
            if (w.status === 'pending') {
                pending.push(w);
            } else {
                completed.push(w);
            }
        });

        // Group pending by off_waiver date, then by player_id
        const pendingGrouped = {};
        pending.forEach(w => {
            const offWaiverDate = w.off_waiver || 'No Date';
            if (!pendingGrouped[offWaiverDate]) {
                pendingGrouped[offWaiverDate] = {};
            }
            if (!pendingGrouped[offWaiverDate][w.player_id]) {
                pendingGrouped[offWaiverDate][w.player_id] = [];
            }
            pendingGrouped[offWaiverDate][w.player_id].push(w);
        });

        // Convert to array format with sorted dates
        const pendingArray = Object.entries(pendingGrouped)
            .sort(([dateA], [dateB]) => {
                if (dateA === 'No Date') return -1;
                if (dateB === 'No Date') return 1;
                return new Date(dateB) - new Date(dateA);
            })
            .map(([date, playerGroups]) => ({
                date,
                playerGroups: Object.entries(playerGroups).map(([playerId, claims]) => ({
                    playerId,
                    claims,
                    playerName: claims[0]?.player?.name || 'Unknown'
                }))
            }));

        // Group completed by player_id
        const completedGrouped = {};
        completed.forEach(w => {
            if (!completedGrouped[w.player_id]) {
                completedGrouped[w.player_id] = [];
            }
            completedGrouped[w.player_id].push(w);
        });

        const completedArray = Object.entries(completedGrouped)
            .sort(([, claimsA], [, claimsB]) => {
                const timeA = new Date(claimsA[0]?.updated_at || 0);
                const timeB = new Date(claimsB[0]?.updated_at || 0);
                return timeB - timeA;
            })
            .map(([playerId, claims]) => ({
                playerId,
                claims,
                playerName: claims[0]?.player?.name || 'Unknown'
            }));

        return {
            pending: pendingArray,
            completed: completedArray
        };
    }, [waivers]);


    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
            <div className="space-y-6 max-w-[1600px] mx-auto">
                <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wider">Transactions & Waivers Monitor</h2>

                {/* Transactions & Waivers Tabbed Section */}
                <div>
                    <div className="flex items-center gap-4 sm:gap-8 mb-4 sm:mb-6 border-b border-slate-700 pb-2 overflow-x-auto">
                    <button
                        onClick={() => { setActiveTab('transactions'); setViewAll(false); }}
                        className={`text-sm sm:text-xl font-black uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'transactions' ? 'text-blue-400 opacity-100' : 'text-slate-500 hover:text-slate-400'}`}
                    >
                        <span className={`w-1.5 sm:w-2 h-5 sm:h-6 rounded-full transition-all ${activeTab === 'transactions' ? 'bg-blue-500' : 'bg-transparent'}`}></span>
                        Transactions
                    </button>
                    <button
                        onClick={() => { setActiveTab('waivers'); setViewAll(false); }}
                        className={`text-sm sm:text-xl font-black uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'waivers' ? 'text-white opacity-100' : 'text-slate-500 hover:text-slate-400'}`}
                    >
                        <span className={`w-1.5 sm:w-2 h-5 sm:h-6 rounded-full transition-all ${activeTab === 'waivers' ? 'bg-emerald-400' : 'bg-transparent'}`}></span>
                        Waivers
                    </button>
                </div>

                <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden shadow-lg">
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
                        <div className="space-y-1">
                            {/* Sub-tab for pending/completed */}
                            <div className="flex items-center gap-4 border-b border-gray-200 px-3 sm:px-6 py-3">
                                <button
                                    onClick={() => { setWaiverSubTab('pending'); setViewAll(false); }}
                                    className={`text-sm font-bold uppercase tracking-wider transition-all ${waiverSubTab === 'pending' ? 'text-emerald-700 border-b-2 border-emerald-600 pb-3' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Pending
                                </button>
                                <button
                                    onClick={() => { setWaiverSubTab('completed'); setViewAll(false); }}
                                    className={`text-sm font-bold uppercase tracking-wider transition-all ${waiverSubTab === 'completed' ? 'text-emerald-700 border-b-2 border-emerald-600 pb-3' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Completed
                                </button>
                            </div>

                            <div className="px-3 sm:px-6 py-3 border-b border-emerald-200/60 bg-emerald-50/30">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-emerald-800">
                                        Waiver Priority Board
                                    </h3>
                                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                                        Managers: {totalManagers}
                                    </span>
                                </div>

                                {priorityRankings.length === 0 ? (
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">No waiver priority data.</div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {priorityRankings.map((row) => (
                                            <div
                                                key={`priority-${row.nickname}-${row.rank}`}
                                                className="flex items-center justify-between px-2.5 py-1.5 rounded-md border border-emerald-300 bg-white/80"
                                            >
                                                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">#{row.rank}</span>
                                                <span className="text-xs font-black text-gray-800 truncate ml-2">{row.nickname}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pending Waivers */}
                            {waiverSubTab === 'pending' && (
                                groupedWaivers.pending.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 text-sm">No pending waiver claims.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {(viewAll ? groupedWaivers.pending : groupedWaivers.pending.slice(0, 5)).map((dateGroup, dateIdx) => (
                                            <div key={`date-${dateIdx}`} className="border border-emerald-200/60 rounded-lg overflow-hidden bg-emerald-50/20">
                                                {/* Date Header */}
                                                <div className="bg-emerald-100/60 px-3 sm:px-6 py-2 border-b border-emerald-200/70">
                                                    <span className="text-sm font-bold text-emerald-800 uppercase tracking-widest">
                                                        Processes: {dateGroup.date}
                                                    </span>
                                                </div>

                                                {/* Player Groups */}
                                                <div className="divide-y divide-gray-100">
                                                    {dateGroup.playerGroups.map((playerGroup, playerIdx) => (
                                                        <div key={`player-${dateIdx}-${playerIdx}`}>
                                                            {/* Player Name Header */}
                                                            <div className="bg-teal-100/70 px-3 sm:px-6 py-2 border-b border-emerald-200/60">
                                                                <span className="text-sm font-black text-teal-900">{playerGroup.playerName}</span>
                                                            </div>

                                                            {/* Claims for this player */}
                                                            <div className="divide-y divide-gray-100">
                                                                {playerGroup.claims.map((claim) => (
                                                                    <div key={claim.id} className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-emerald-50/50 transition-all gap-4">
                                                                        {/* Left: Add/Drop Players */}
                                                                        <div className="flex flex-col gap-3 flex-1 min-w-0">
                                                                            {/* Add Player */}
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="w-6 flex justify-center flex-shrink-0">
                                                                                    <span className="text-xl font-black text-emerald-500 leading-none">+</span>
                                                                                </div>
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <span
                                                                                        className="text-base font-black text-gray-800 hover:text-emerald-700 cursor-pointer transition-colors leading-tight truncate"
                                                                                        onClick={() => claim.player && setSelectedPlayerModal(claim.player)}
                                                                                    >
                                                                                        {claim.player?.name}
                                                                                    </span>
                                                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mt-0.5">
                                                                                        Claim from Waivers
                                                                                    </span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Drop Player (if any) */}
                                                                            {claim.drop_player && (
                                                                                <div className="flex items-center gap-4">
                                                                                    <div className="w-6 flex justify-center flex-shrink-0">
                                                                                        <span className="text-xl font-black text-red-500 leading-none">-</span>
                                                                                    </div>
                                                                                    <div className="flex flex-col min-w-0">
                                                                                        <span
                                                                                            className="text-base font-black text-gray-800 hover:text-purple-600 cursor-pointer transition-colors leading-tight truncate"
                                                                                            onClick={() => claim.drop_player && setSelectedPlayerModal(claim.drop_player)}
                                                                                        >
                                                                                            {claim.drop_player?.name}
                                                                                        </span>
                                                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mt-0.5">
                                                                                            Condition Drop
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Right: Manager and Priority */}
                                                                        <div className="flex flex-col items-end gap-2 flex-shrink-0 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-gray-100 sm:border-0">
                                                                            <div className="text-sm sm:text-base font-black text-emerald-700 mb-0.5 text-right">
                                                                                {claim.manager?.nickname}
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="flex items-center gap-1.5 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-md">
                                                                                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Personal Priority: {getPersonalPriority(claim)}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        {groupedWaivers.pending.length > 5 && (
                                            <div className="text-center py-3">
                                                <button
                                                    onClick={() => setViewAll(!viewAll)}
                                                    className="text-xs font-bold text-emerald-700 hover:text-emerald-600 uppercase tracking-widest transition-colors"
                                                >
                                                    {viewAll ? 'View Less' : 'View All Pending'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            )}

                            {/* Completed Waivers */}
                            {waiverSubTab === 'completed' && (
                                groupedWaivers.completed.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 text-sm">No completed waiver claims.</div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {(viewAll ? groupedWaivers.completed : groupedWaivers.completed.slice(0, 10)).map((playerGroup, idx) => (
                                            <div key={`completed-${idx}`}>
                                                {/* Player Name Header */}
                                                <div className="px-3 sm:px-6 py-2 bg-teal-100/70 border-b border-emerald-200/60">
                                                    <span className="text-sm font-black text-teal-900">{playerGroup.playerName}</span>
                                                </div>

                                                {/* Claims for this player */}
                                                <div className="divide-y divide-gray-100">
                                                    {playerGroup.claims.map((claim) => (
                                                        <div key={claim.id} className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-emerald-50/50 transition-all gap-4">
                                                            {/* Left: Add/Drop Players */}
                                                            <div className="flex flex-col gap-3 flex-1 min-w-0">
                                                                {/* Add Player */}
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-6 flex justify-center flex-shrink-0">
                                                                        <span className="text-xl font-black text-emerald-500 leading-none">+</span>
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span
                                                                            className="text-base font-black text-gray-800 hover:text-emerald-700 cursor-pointer transition-colors leading-tight truncate"
                                                                            onClick={() => claim.player && setSelectedPlayerModal(claim.player)}
                                                                        >
                                                                            {claim.player?.name}
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mt-0.5">
                                                                            {claim.status === 'accepted' ? '✓ Accepted' : claim.status === 'rejected' ? '✗ Rejected' : 'Claim'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Drop Player (if any) */}
                                                                {claim.drop_player && (
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-6 flex justify-center flex-shrink-0">
                                                                            <span className="text-xl font-black text-red-500 leading-none">-</span>
                                                                        </div>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span
                                                                                className="text-base font-black text-gray-800 hover:text-purple-600 cursor-pointer transition-colors leading-tight truncate"
                                                                                onClick={() => claim.drop_player && setSelectedPlayerModal(claim.drop_player)}
                                                                            >
                                                                                {claim.drop_player?.name}
                                                                            </span>
                                                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mt-0.5">
                                                                                Condition Drop
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Right: Manager and Info */}
                                                            <div className="flex flex-col items-end gap-2 flex-shrink-0 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-gray-100 sm:border-0">
                                                                <div className="text-sm sm:text-base font-black text-emerald-700 mb-0.5 text-right">
                                                                    {claim.manager?.nickname}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-md">
                                                                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Personal Priority: {getPersonalPriority(claim)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        {groupedWaivers.completed.length > 10 && (
                                            <div className="px-6 py-3 text-center border-t border-gray-100">
                                                <button
                                                    onClick={() => setViewAll(!viewAll)}
                                                    className="text-xs font-bold text-emerald-700 hover:text-emerald-600 uppercase tracking-widest transition-colors"
                                                >
                                                    {viewAll ? 'View Less' : 'View All Completed'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
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
