import { useState, useEffect } from 'react';

export default function WaiverModal({ isOpen, onClose, leagueId, managerId }) {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && leagueId && managerId) {
            fetchClaims();
        }
    }, [isOpen, leagueId, managerId]);

    const fetchClaims = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/waiver_claims/manage?league_id=${leagueId}&manager_id=${managerId}`);
            const data = await res.json();
            if (data.success) {
                setClaims(data.claims || []);
            } else {
                setError(data.error || 'Failed to load claims');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelClaim = async (claimId) => {
        if (!confirm('Are you sure you want to cancel this waiver claim?')) return;

        setProcessing(true);
        try {
            const res = await fetch(`/api/waiver_claims/manage`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claim_id: claimId, manager_id: managerId })
            });
            const data = await res.json();
            if (data.success) {
                fetchClaims(); // Reload to update list and priorities
            } else {
                alert(data.error || 'Failed to cancel claim');
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleMovePriority = async (claim, direction) => {
        // direction: -1 (up/promote), 1 (down/demote)
        // Find claims with SAME off_waiver date
        const sameDateClaims = claims.filter(c => c.off_waiver === claim.off_waiver).sort((a, b) => a.personal_priority - b.personal_priority);

        const currentIndex = sameDateClaims.findIndex(c => c.id === claim.id);
        if (currentIndex === -1) return;

        const targetIndex = currentIndex + direction;
        if (targetIndex < 0 || targetIndex >= sameDateClaims.length) return; // Out of bounds

        const targetClaim = sameDateClaims[targetIndex];

        // Swap priorities
        // Construct new order for this group
        const newOrder = sameDateClaims.map(c => ({ id: c.id, priority: c.personal_priority }));

        // Swap values in newOrder array
        const temp = newOrder[currentIndex].priority;
        newOrder[currentIndex].priority = newOrder[targetIndex].priority;
        newOrder[targetIndex].priority = temp;

        setProcessing(true);
        try {
            const res = await fetch(`/api/waiver_claims/manage`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    manager_id: managerId,
                    claims_order: newOrder
                })
            });
            const data = await res.json();
            if (data.success) {
                fetchClaims();
            } else {
                console.error(data.error);
                alert('Failed to reorder');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    // Group claims by Date
    const groupedClaims = claims.reduce((acc, claim) => {
        const date = claim.off_waiver || 'Unknown Date';
        if (!acc[date]) acc[date] = [];
        acc[date].push(claim);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-[100050] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-purple-500/30 flex justify-between items-center bg-purple-900/20">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">📋</span>
                        Waiver Claims
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-purple-300 gap-3">
                            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                            Loading claims...
                        </div>
                    ) : claims.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2 border-2 border-dashed border-slate-700 rounded-xl">
                            <span className="text-4xl grayscale opacity-50">📭</span>
                            <p className="font-bold">No Pending Waiver Claims</p>
                            <p className="text-xs">Any claims you make will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedClaims).sort((a, b) => new Date(a[0]) - new Date(b[0])).map(([date, dateClaims]) => (
                                <div key={date} className="bg-slate-800/50 rounded-xl border border-purple-500/20 overflow-hidden">
                                    <div className="bg-purple-900/30 px-4 py-2 border-b border-purple-500/20 flex justify-between items-center">
                                        <span className="font-bold text-purple-200 text-sm">Processing Date: {date}</span>
                                        <span className="text-xs text-purple-400 bg-purple-900/50 px-2 py-0.5 rounded border border-purple-500/30">{dateClaims.length} Claims</span>
                                    </div>
                                    <div className="divide-y divide-purple-500/10">
                                        {dateClaims.sort((a, b) => a.personal_priority - b.personal_priority).map((claim, index) => {
                                            const isFirst = index === 0;
                                            const isLast = index === dateClaims.length - 1;

                                            return (
                                                <div key={claim.id} className="p-4 flex items-center gap-4 hover:bg-slate-800 transition-colors group">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="font-black text-2xl text-purple-500/50 w-8 text-center">{claim.personal_priority}</div>
                                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleMovePriority(claim, -1)}
                                                                disabled={isFirst || processing}
                                                                className="w-6 h-6 rounded bg-slate-700 hover:bg-purple-600 text-white flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed text-xs transition-colors"
                                                                title="Move Up"
                                                            >
                                                                ▲
                                                            </button>
                                                            <button
                                                                onClick={() => handleMovePriority(claim, 1)}
                                                                disabled={isLast || processing}
                                                                className="w-6 h-6 rounded bg-slate-700 hover:bg-purple-600 text-white flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed text-xs transition-colors"
                                                                title="Move Down"
                                                            >
                                                                ▼
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {/* Add */}
                                                        <div className="flex items-center gap-3 bg-green-900/10 p-2 rounded-lg border border-green-500/20">
                                                            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-green-400 border border-green-500/30 font-bold text-lg">+</div>
                                                            <div>
                                                                <div className="font-bold text-white text-sm">{claim.player ? claim.player.name : 'Unknown'}</div>
                                                                <div className="text-xs text-green-300/70">{claim.player ? claim.player.team : ''}</div>
                                                            </div>
                                                        </div>

                                                        {/* Drop */}
                                                        {claim.drop_player ? (
                                                            <div className="flex items-center gap-3 bg-red-900/10 p-2 rounded-lg border border-red-500/20">
                                                                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-red-400 border border-red-500/30 font-bold text-lg">-</div>
                                                                <div>
                                                                    <div className="font-bold text-white text-sm">{claim.drop_player.name}</div>
                                                                    <div className="text-xs text-red-300/70">{claim.drop_player.team}</div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-3 p-2 opacity-50">
                                                                <span className="text-xs text-slate-500 italic">No player to drop</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => handleCancelClaim(claim.id)}
                                                        disabled={processing}
                                                        className="px-3 py-1.5 bg-slate-800 hover:bg-red-600/80 text-slate-400 hover:text-white rounded-lg border border-slate-700 hover:border-red-500/50 transition-all text-sm font-bold flex items-center gap-2"
                                                    >
                                                        <span>✕</span>
                                                        <span className="hidden sm:inline">Cancel</span>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-900 border-t border-purple-500/30 text-center">
                    <p className="text-xs text-slate-500">
                        Claims are processed daily at 1AM - 2AM TW time.
                    </p>
                </div>
            </div>
        </div>
    );
}

// Add these styles to global CSS or component styles if needed: animate-fadeIn, custom-scrollbar
