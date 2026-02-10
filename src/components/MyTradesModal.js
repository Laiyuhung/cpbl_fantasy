import { useState, useEffect } from 'react';

export default function MyTradesModal({ isOpen, onClose, leagueId, managerId, members = [] }) {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState(null);

    // Fetch trades when modal opens
    useEffect(() => {
        if (isOpen && leagueId && managerId) {
            fetchTrades();
        }
    }, [isOpen, leagueId, managerId]);

    const fetchTrades = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/trade/pending?league_id=${leagueId}&manager_id=${managerId}`);
            const data = await res.json();
            if (data.success) {
                setTrades(data.trades);
            }
        } catch (error) {
            console.error('Failed to fetch trades:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (tradeId, action) => {
        if (processingId) return;
        setProcessingId(tradeId);
        try {
            const res = await fetch('/api/trade/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trade_id: tradeId,
                    action,
                    manager_id: managerId
                })
            });
            const data = await res.json();
            if (data.success) {
                // Remove trade from list or refresh
                fetchTrades();
            } else {
                alert(data.error || 'Action failed');
            }
        } catch (error) {
            console.error('Action error:', error);
            alert('Action error');
        } finally {
            setProcessingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]" onClick={onClose}>
            <div
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-0 max-w-2xl w-full mx-4 border border-purple-500/30 shadow-2xl max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-purple-500/20 flex-shrink-0">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">⇌</span> My Pending Trades
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : trades.length === 0 ? (
                        <div className="text-center text-slate-400 py-8">No pending trades found.</div>
                    ) : (
                        trades.map(trade => {
                            const isInitiator = trade.initiator_manager_id === managerId;
                            const isProcessing = processingId === trade.id;

                            // Resolve nicknames
                            const initNick = trade.initiator?.nickname || trade.initiator?.name || members.find(m => m.manager_id === trade.initiator_manager_id)?.nickname || 'Unknown';
                            const recNick = trade.recipient?.nickname || trade.recipient?.name || members.find(m => m.manager_id === trade.recipient_manager_id)?.nickname || 'Unknown';

                            return (
                                <div key={trade.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 flex flex-col gap-3">
                                    <div className="flex justify-between items-center text-sm text-slate-300">
                                        <div>
                                            <span className="font-bold text-purple-300">{initNick}</span>
                                            <span className="mx-2 text-slate-500">➜</span>
                                            <span className="font-bold text-pink-300">{recNick}</span>
                                        </div>
                                        <div className="text-xs text-slate-500">{new Date(trade.created_at).toLocaleDateString()}</div>
                                    </div>

                                    {/* Players involved (simplified view) */}
                                    <div className="text-xs text-slate-400">
                                        {/* Fetching player details is complex without full player list. 
                         For now, show count or check if we can pass players map. 
                         The prompt doesn't strictly require player names in this list, but it's better.
                         We passed `members` but not `players`.
                         Let's just show "Click to view" or simplify actions for now.
                         Actually, user asked for ACTIONS mainly.
                         "如果是發起方，給予Cancel按鈕，如果是接收方，給予Accept或Reject按鈕"
                      */}
                                        <div className="flex gap-4 mt-2">
                                            <div className="flex-1 bg-purple-900/10 p-2 rounded">
                                                <div className="text-xs font-bold text-purple-400 mb-1 border-b border-purple-500/20 pb-1">
                                                    Sending ({trade.initiator_players?.length || 0})
                                                </div>
                                                <div className="space-y-1">
                                                    {trade.initiator_players?.map(p => (
                                                        <div key={p.player_id} className="text-purple-200 text-xs flex justify-between">
                                                            <span>{p.name}</span>
                                                            <span className="text-purple-400/70">{p.team} - {p.position}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex-1 bg-pink-900/10 p-2 rounded">
                                                <div className="text-xs font-bold text-pink-400 mb-1 border-b border-pink-500/20 pb-1">
                                                    Receiving ({trade.recipient_players?.length || 0})
                                                </div>
                                                <div className="space-y-1">
                                                    {trade.recipient_players?.map(p => (
                                                        <div key={p.player_id} className="text-pink-200 text-xs flex justify-between">
                                                            <span>{p.name}</span>
                                                            <span className="text-pink-400/70">{p.team} - {p.position}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 text-right">
                                            <span className={`text-xs px-2 py-0.5 rounded border ${trade.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                                                    trade.status === 'accepted' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                                                        'bg-red-500/10 text-red-500 border-red-500/30'
                                                }`}>
                                                {trade.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
                                        {isInitiator ? (
                                            <button
                                                onClick={() => handleAction(trade.id, 'cancel')}
                                                disabled={isProcessing}
                                                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {isProcessing ? 'Processing...' : 'Cancel Request'}
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleAction(trade.id, 'reject')}
                                                    disabled={isProcessing}
                                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {isProcessing ? '...' : 'Reject'}
                                                </button>
                                                <button
                                                    onClick={() => handleAction(trade.id, 'accept')}
                                                    disabled={isProcessing}
                                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {isProcessing ? 'Processing...' : 'Accept Trade'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
