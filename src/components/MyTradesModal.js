import { useState, useEffect } from 'react';

export default function MyTradesModal({ isOpen, onClose, leagueId, managerId, members = [] }) {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processingAction, setProcessingAction] = useState(null); // 'tradeId-action'
    const [timeWindow, setTimeWindow] = useState('2026 Season');
    const [settings, setSettings] = useState({ roster_positions: {}, batter_stat_categories: [], pitcher_stat_categories: [] });
    const [viewerRole, setViewerRole] = useState('member');
    const [tradeReviewSetting, setTradeReviewSetting] = useState('League votes');
    const [tradeRejectPercentage, setTradeRejectPercentage] = useState('50%');
    const [totalMemberCount, setTotalMemberCount] = useState(0);
    const [vetoConfirmId, setVetoConfirmId] = useState(null);
    const [validationError, setValidationError] = useState(null);

    // Fetch trades when modal opens or timeWindow changes
    useEffect(() => {
        if (isOpen && leagueId && managerId) {
            fetchTrades();
        }
    }, [isOpen, leagueId, managerId, timeWindow]);

    const fetchTrades = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/trade/pending?league_id=${leagueId}&manager_id=${managerId}&time_window=${encodeURIComponent(timeWindow)}`);
            const data = await res.json();
            if (data.success) {
                setTrades(data.trades);
                if (data.settings) {
                    setSettings(data.settings);
                }
                if (data.viewer_role) setViewerRole(data.viewer_role);
                if (data.trade_review) setTradeReviewSetting(data.trade_review);
                if (data.trade_reject_percentage) setTradeRejectPercentage(data.trade_reject_percentage);
                if (data.total_member_count) setTotalMemberCount(data.total_member_count);
            }
        } catch (error) {
            console.error('Failed to fetch trades:', error);
        } finally {
            setLoading(false);
        }
    };

    const validateAcceptRoster = async (trade) => {
        // Fetch current rosters for both parties
        try {
            const [initRes, recRes] = await Promise.all([
                fetch(`/api/league/${leagueId}/roster?manager_id=${trade.initiator_manager_id}`),
                fetch(`/api/league/${leagueId}/roster?manager_id=${trade.recipient_manager_id}`)
            ]);
            const initData = await initRes.json();
            const recData = await recRes.json();

            if (!initData.success || !recData.success) {
                return 'Failed to fetch roster data for validation.';
            }

            const initRoster = initData.roster || [];
            const recRoster = recData.roster || [];

            // Helper to calculate limits
            const checkRosterLimits = (currentRoster, incomingPlayers, outgoingPlayers, sideName) => {
                const incomingIds = incomingPlayers.map(p => p.player_id);
                const outgoingIds = outgoingPlayers.map(p => p.player_id);

                // 1. Filter out outgoing players
                let projectedRoster = currentRoster.filter(p => !outgoingIds.includes(p.player_id));

                // 2. Add incoming players (Assume they go to BN for safety, unless we want to be smarter)
                // However, detailed validation logic in PlacePage uses BN assumption for checking Total Limit.
                // For Active Limit, we only count non-NA/Minor slots.
                // Incoming players are NEW to the roster, so they don't have a slot yet.
                // We must assume they TAKE UP A SLOT.
                // If the user has empty active slots, they might go there.
                // If full, they go to BN.
                // The safest check for "Active Limit" is:
                // Count current Active players (excluding outgoing).
                // Incoming players are assumed ACTIVE (BN is active) for the purpose of limit checking?
                // Wait, if I receive a player, he goes to BN (or Empty).
                // BN counts towards Active Limit?
                // Let's look at PlayersPage logic:
                // "Active Limit" counts all positions EXCEPT NA, Minor, DL, IL.
                // BN IS an active position.
                // So incoming players (assigned to BN by default) WILL count towards Active Limit.

                const newPlayers = incomingPlayers.map(p => ({
                    ...p,
                    position: 'BN' // Default to BN (Active)
                }));

                projectedRoster = [...projectedRoster, ...newPlayers];

                // Check Limits
                const rosterConfig = settings.roster_positions || {};

                // A. Total Limit
                const totalLimit = Object.values(rosterConfig).reduce((sum, count) => sum + count, 0);
                if (projectedRoster.length > totalLimit) {
                    return `${sideName} Roster Size Exceeded (${projectedRoster.length}/${totalLimit})`;
                }

                // B. Active Limit
                // Active = All slots except NA/Minor/DL/IL
                const activeLimit = Object.entries(rosterConfig)
                    .filter(([key]) => !['NA', 'MINOR', 'DL', 'IL'].includes(key.toUpperCase()))
                    .reduce((sum, [_, count]) => sum + count, 0);

                const activeCount = projectedRoster.filter(p => {
                    const pos = (p.position || '').toUpperCase();
                    return !['NA', 'MINOR', 'DL', 'IL'].includes(pos);
                }).length;

                if (activeCount > activeLimit) {
                    return `${sideName} Active Roster Limit Exceeded (${activeCount}/${activeLimit}).`;
                }

                // C. Foreigner Limits
                const foreignerOnTeamLimit = parseInt(settings.foreigner_on_team_limit) || 999;
                const foreignerActiveLimit = parseInt(settings.foreigner_active_limit) || 999;

                const foreigners = projectedRoster.filter(p => p.identity === 'Foreigner' || p.identity === 'foreign');
                const foreignerCount = foreigners.length;

                if (foreignerCount > foreignerOnTeamLimit) {
                    return `${sideName} Foreigner (On Team) Limit Exceeded (${foreignerCount}/${foreignerOnTeamLimit})`;
                }

                const activeForeigners = foreigners.filter(p => {
                    const pos = (p.position || '').toUpperCase();
                    return !['NA', 'MINOR', 'DL', 'IL'].includes(pos);
                });
                const activeForeignerCount = activeForeigners.length;

                if (activeForeignerCount > foreignerActiveLimit) {
                    return `${sideName} Active Foreigner Limit Exceeded (${activeForeignerCount}/${foreignerActiveLimit})`;
                }

                return null;
            };

            // Resolve nicknames for error messages
            const initMember = members.find(m => m.manager_id === trade.initiator_manager_id);
            const recMember = members.find(m => m.manager_id === trade.recipient_manager_id);
            const initNick = trade.initiator?.nickname || initMember?.nickname || trade.initiator?.name || 'Initiator';
            const recNick = trade.recipient?.nickname || recMember?.nickname || trade.recipient?.name || 'Recipient';

            // Check Initiator (receives recipient_players, loses initiator_players)
            const initError = checkRosterLimits(initRoster, trade.recipient_players, trade.initiator_players, initNick);
            if (initError) return initError;

            // Check Recipient (receives initiator_players, loses recipient_players)
            const recError = checkRosterLimits(recRoster, trade.initiator_players, trade.recipient_players, recNick);
            if (recError) return recError;

            return null; // Valid

        } catch (e) {
            console.error(e);
            return 'Validation Error';
        }
    };

    const handleAction = async (tradeId, action) => {
        if (processingAction) return;
        setProcessingAction(`${tradeId}-${action}`);

        if (action === 'accept') {
            const trade = trades.find(t => t.id === tradeId);
            if (trade) {
                const error = await validateAcceptRoster(trade);
                if (error) {
                    setValidationError(error);
                    setProcessingAction(null);
                    return;
                }
            }
        }

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
            setProcessingAction(null);
        }
    };

    const handleVeto = (tradeId) => {
        setVetoConfirmId(tradeId);
    };

    const executeVeto = async () => {
        if (!vetoConfirmId || processingAction) return;
        setProcessingAction(`${vetoConfirmId}-veto`);

        try {
            const res = await fetch('/api/trade/veto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trade_id: vetoConfirmId,
                    manager_id: managerId
                })
            });
            const data = await res.json();
            if (data.success) {
                // Refresh to update votes
                fetchTrades();
                setVetoConfirmId(null);
            } else {
                alert(data.error || 'Veto failed');
            }
        } catch (error) {
            console.error('Veto error:', error);
            alert('Veto error');
        } finally {
            setProcessingAction(null);
        }
    };

    const getStatAbbr = (cat) => {
        const matches = cat.match(/\(([^)]+)\)/g);
        return matches ? matches[matches.length - 1].replace(/[()]/g, '') : cat;
    };

    const getStatKey = (cat) => {
        return getStatAbbr(cat).toLowerCase();
    };

    const filterPositions = (player) => {
        let positionList = player.position;
        if (!positionList) return 'NA';

        const positions = positionList.split(',').map(p => p.trim());
        const validPositions = positions.filter(pos => {
            return settings.roster_positions && settings.roster_positions[pos] > 0;
        });

        return validPositions.length > 0 ? validPositions.join(', ') : 'NA';
    };

    const renderStats = (player) => {
        const stats = player.stats || {};
        const isPitcher = player.batter_or_pitcher === 'pitcher';
        const originalCategories = isPitcher ? settings.pitcher_stat_categories : settings.batter_stat_categories;

        if (!originalCategories) return null;

        // Clone and ensure AB/IP are present
        let categories = [...originalCategories];
        if (isPitcher) {
            if (!categories.some(c => c.includes('(IP)'))) {
                categories.unshift('Innings Pitched (IP)');
            }
        } else {
            if (!categories.some(c => c.includes('(AB)'))) {
                categories.unshift('At Bats (AB)');
            }
        }

        return (
            <div className="flex flex-wrap gap-2 mt-1 pb-1">
                {categories.map(cat => {
                    const key = getStatKey(cat);
                    const val = stats[key] !== undefined && stats[key] !== null ? stats[key] : '-';
                    // Highlight AB and IP as non-scoring if they were added
                    const isAdded = (isPitcher && cat.includes('(IP)') && !originalCategories.includes(cat)) ||
                        (!isPitcher && cat.includes('(AB)') && !originalCategories.includes(cat));

                    return (
                        <div key={cat} className="flex flex-col items-center min-w-[30px]">
                            <span className={`text-[9px] uppercase ${isAdded ? 'text-slate-600' : 'text-slate-500'}`}>{getStatAbbr(cat)}</span>
                            <span className={`text-[10px] font-mono ${val === 0 || val === '0' ? 'text-slate-600' : isAdded ? 'text-slate-500' : 'text-slate-300'}`}>
                                {val}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]" onClick={onClose}>
            <div
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-0 max-w-2xl w-full mx-4 border border-purple-500/30 shadow-2xl max-h-[85vh] flex flex-col relative overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-purple-500/20 flex-shrink-0">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">⇌</span> Trades
                    </h3>
                    <div className="flex items-center gap-4">
                        <select
                            value={timeWindow}
                            onChange={(e) => setTimeWindow(e.target.value)}
                            className="bg-slate-900/50 text-white text-xs border border-purple-500/30 rounded px-2 py-1 outline-none focus:border-purple-400"
                        >
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="last_7">Last 7 Days</option>
                            <option value="last_14">Last 14 Days</option>
                            <option value="last_30">Last 30 Days</option>
                            <option value="2026 Season">2026 Season</option>
                            <option value="2025 Season">2025 Season</option>
                        </select>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
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

                            // Resolve nicknames (Prioritize backend enriched nickname, then local members)
                            const initMember = members.find(m => m.manager_id === trade.initiator_manager_id);
                            const recMember = members.find(m => m.manager_id === trade.recipient_manager_id);

                            const initNick = trade.initiator?.nickname || initMember?.nickname || trade.initiator?.name || 'Unknown';
                            const recNick = trade.recipient?.nickname || recMember?.nickname || trade.recipient?.name || 'Unknown';

                            return (
                                <div key={trade.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 flex flex-col gap-3">
                                    <div className="flex justify-between items-center text-sm text-slate-300">
                                        <div>
                                            <span className="font-bold text-purple-300">{initNick}</span>
                                            <span className="mx-2 text-slate-500">➜</span>
                                            <span className="font-bold text-pink-300">{recNick}</span>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {new Date(trade.updated_at || trade.created_at).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </div>
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
                                                    {isInitiator ? 'You sending' :
                                                        trade.recipient_manager_id === managerId ? 'You receiving' :
                                                            `${recNick} received`} ({trade.initiator_players?.length || 0})
                                                </div>
                                                <div className="space-y-3 pt-1">
                                                    {trade.initiator_players?.map(p => (
                                                        <div key={p.player_id}>
                                                            <div className="text-purple-200 text-xs flex justify-between items-center">
                                                                <span className="font-semibold">{p.name}</span>
                                                                <span className="text-purple-400/70 text-[10px]">{p.team} - {filterPositions(p)}</span>
                                                            </div>
                                                            {renderStats(p)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex-1 bg-pink-900/10 p-2 rounded">
                                                <div className="text-xs font-bold text-pink-400 mb-1 border-b border-pink-500/20 pb-1">
                                                    {isInitiator ? 'You receiving' :
                                                        trade.recipient_manager_id === managerId ? 'You sending' :
                                                            `${initNick} received`} ({trade.recipient_players?.length || 0})
                                                </div>
                                                <div className="space-y-3 pt-1">
                                                    {trade.recipient_players?.map(p => (
                                                        <div key={p.player_id}>
                                                            <div className="text-pink-200 text-xs flex justify-between items-center">
                                                                <span className="font-semibold">{p.name}</span>
                                                                <span className="text-pink-400/70 text-[10px]">{p.team} - {filterPositions(p)}</span>
                                                            </div>
                                                            {renderStats(p)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center justify-end gap-2">
                                            {trade.status === 'processed' && trade.updated_at && (
                                                <span className="text-[10px] text-slate-400">
                                                    Executed: {new Date(trade.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </span>
                                            )}
                                            <span className={`text-xs px-2 py-0.5 rounded border ${(trade.status === 'accepted' || trade.status === 'processed') ? 'bg-green-500/10 text-green-500 border-green-500/30' :
                                                trade.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                                                    'bg-red-500/10 text-red-500 border-red-500/30'
                                                }`}>
                                                {trade.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>

                                    {trade.status === 'pending' && (
                                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
                                            {isInitiator ? (
                                                <button
                                                    onClick={() => handleAction(trade.id, 'cancel')}
                                                    disabled={!!processingAction}
                                                    className={`px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors shadow-lg shadow-red-900/20 ${processingAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {processingAction === `${trade.id}-cancel` ? 'Processing...' : 'Cancel Request'}
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleAction(trade.id, 'reject')}
                                                        disabled={!!processingAction}
                                                        className={`px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors shadow-lg shadow-red-900/20 ${processingAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {processingAction === `${trade.id}-reject` ? 'Processing...' : 'Reject'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(trade.id, 'accept')}
                                                        disabled={!!processingAction}
                                                        className={`px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors shadow-lg shadow-green-900/20 ${processingAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {processingAction === `${trade.id}-accept` ? 'Processing...' : 'Accept Trade'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Veto Button for Accepted Trades */}
                                    {trade.status === 'accepted' && tradeReviewSetting !== 'No review' && (
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                                            <div className="text-xs text-slate-500">
                                                Proceed at {new Date(new Date(trade.accepted_at).getTime() + 48 * 60 * 60 * 1000).toLocaleString('en-US')} if there are not enough vetoes
                                            </div>
                                            {(() => {
                                                const hasVoted = (trade.veto_votes || []).includes(managerId);
                                                const voteCount = (trade.veto_votes || []).length;

                                                // Check Permission
                                                let canVote = false;
                                                if (tradeReviewSetting === 'League votes') {
                                                    canVote = true; // Everyone can vote
                                                } else if (tradeReviewSetting === 'Commissioner reviews') {
                                                    canVote = viewerRole === 'Commissioner';
                                                }

                                                if (!canVote) return null;

                                                // Calculate Veto Target
                                                let vetoTargetDisplay = '';
                                                if (tradeReviewSetting === 'League votes') {
                                                    const percentage = parseFloat(tradeRejectPercentage) || 50;
                                                    const target = Math.ceil((totalMemberCount || 0) * (percentage / 100));
                                                    vetoTargetDisplay = ` / ${target}`;
                                                }

                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400">Votes: {voteCount}{vetoTargetDisplay}</span>
                                                        <button
                                                            onClick={() => handleVeto(trade.id)}
                                                            disabled={hasVoted || !!processingAction}
                                                            className={`px-3 py-1 text-xs rounded border transition-colors ${hasVoted
                                                                ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-default'
                                                                : 'bg-red-900/30 text-red-300 border-red-500/30 hover:bg-red-900/50'
                                                                }`}
                                                        >
                                                            {hasVoted ? 'Vetoed' : 'Vote Veto'}
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Veto Confirmation Overlay */}
                {vetoConfirmId && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-[50] animate-fadeIn">
                        <div className="bg-slate-800 rounded-xl p-6 border border-red-500/30 shadow-2xl max-w-sm w-full text-center relative overflow-hidden">
                            {/* Warning glow */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600"></div>

                            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                                <span className="text-3xl">🗳️</span>
                            </div>

                            <h4 className="text-xl font-bold text-white mb-2">Confirm Veto Vote</h4>
                            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                                Are you sure you want to vote to <span className="text-red-400 font-bold">veto</span> this trade?
                                <br />If enough votes are cast, the trade will be cancelled.
                            </p>

                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setVetoConfirmId(null)}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors font-medium text-sm w-24"
                                    disabled={!!processingAction}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeVeto}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg shadow-red-900/20 transition-all transform active:scale-95 text-sm w-32 flex justify-center items-center"
                                    disabled={!!processingAction}
                                >
                                    {processingAction ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        'Confirm Veto'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* Validation Error Modal */}
            {validationError && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-[60] animate-fadeIn">
                    <div className="bg-slate-800 rounded-xl p-6 border border-red-500/50 shadow-2xl max-w-sm w-full text-center relative overflow-hidden">
                        {/* Error glow */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-pink-600 to-red-600"></div>

                        <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                            <span className="text-3xl">⚠️</span>
                        </div>

                        <h4 className="text-xl font-bold text-white mb-2">Trade Validation Failed</h4>
                        <p className="text-slate-300 text-sm mb-6 leading-relaxed whitespace-pre-line">
                            {validationError}
                        </p>

                        <button
                            onClick={() => setValidationError(null)}
                            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium text-sm w-full"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
