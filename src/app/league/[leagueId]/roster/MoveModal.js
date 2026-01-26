import React from 'react';

export default function MoveModal({
    isOpen,
    onClose,
    player,
    roster,
    playerStats,
    batterStats, // Array of stat keys
    pitcherStats,
    rosterPositionsConfig,
    foreignerActiveLimit,
    onMove
}) {
    if (!isOpen || !player) return null;

    // Helper: Is Position Active (Non-NA/Minor)
    const isActivePos = (pos) => !['NA', 'Minor', 'IL'].includes(pos);

    // Helper: Check Foreigner Active Limit
    const validateMove = (targetPos, swapPlayerId) => {
        // Only check if we have a limit
        if (!foreignerActiveLimit || foreignerActiveLimit === 'No limit') return { isValid: true };

        const limit = parseInt(foreignerActiveLimit, 10);
        if (isNaN(limit)) return { isValid: true };

        // 1. Is Moving Player a Foreigner?
        const isPlayerForeigner = player.identity?.toLowerCase() === 'foreigner';

        // 2. Is Moving FROM NA/Minor TO Active?
        const currentPos = player.position;
        const isFromNa = !isActivePos(currentPos); // NA -> Active
        const isToActive = isActivePos(targetPos);

        // If not moving NA -> Active, we generally don't trigger NEW active count (unless we acquired from FA directly to active, handled elsewhere).
        // Spec: "NA欄位要主動移出時...Active Limit"
        if (!isFromNa || !isToActive) return { isValid: true };

        // 3. Calculate Current Active Foreigners
        // Filter roster for foreigners in active positions
        // Exclude the moving player (if they were already active, but we established they are NOT)
        const activeForeigners = roster.filter(p =>
            p.player_id !== player.player_id && // exclude self (though redundant if currently NA)
            !p.isEmpty &&
            p.identity?.toLowerCase() === 'foreigner' &&
            isActivePos(p.position)
        );

        let currentCount = activeForeigners.length;
        let netChange = 0;

        if (isPlayerForeigner) {
            netChange += 1;
        }

        // 4. Consider Swap
        if (swapPlayerId) {
            const swapPlayer = roster.find(p => p.player_id === swapPlayerId);
            if (swapPlayer && swapPlayer.identity?.toLowerCase() === 'foreigner') {
                // Swap player is being moved OUT of Active (to NA)
                netChange -= 1;
            }
        }

        if (currentCount + netChange > limit) {
            return { isValid: false, message: `Exceeds Active Foreigner Limit (${limit})` };
        }

        // 4. Validate Total Active Limit (New Logic)
        if (isFromNa && isToActive) {
            // Calculate Total Active Limit/Capacity
            const activeLimit = Object.entries(rosterPositionsConfig || {}).reduce((sum, [k, v]) => {
                return isActivePos(k) ? sum + (parseInt(v) || 0) : sum;
            }, 0);

            // Calculate Current Active Count
            // Note: Excluding the moving player is only necessary if they were active, but isFromNa is true, so they weren't.
            const currentActiveCount = roster.filter(p => isActivePos(p.position) && !p.isEmpty).length;

            let activeNetChange = 1; // Adding 1 to active
            if (swapPlayerId && isActivePos(roster.find(p => p.player_id === swapPlayerId)?.position)) {
                // Swapping with an active player (who presumably goes to NA/Minor)
                activeNetChange = 0;
            }

            console.log('[MoveModal] Validating Active Limit:', {
                isFromNa,
                isToActive,
                activeLimit,
                currentActiveCount,
                activeNetChange,
                totalAfterMove: currentActiveCount + activeNetChange,
                limitCheck: (currentActiveCount + activeNetChange > activeLimit) ? 'FAIL' : 'PASS',
                rosterConfig: rosterPositionsConfig
            });

            if (currentActiveCount + activeNetChange > activeLimit) {
                return { isValid: false, message: `Exceeds Total Active Roster Size (${activeLimit})` };
            }
        }

        return { isValid: true };
    };

    // Generate Available Positions
    const generateOptions = () => {
        // 1. Parse standard positions
        let distinctPositions = player.position_list ? player.position_list.split(',').map(p => p.trim()) : [];

        // 2. Add 'BN' (Always available)
        if (!distinctPositions.includes('BN')) distinctPositions.push('BN');

        // 3. Add 'Util'/ 'P'
        if (player.batter_or_pitcher === 'batter' && !distinctPositions.includes('Util')) distinctPositions.push('Util');
        if (player.batter_or_pitcher === 'pitcher' && !distinctPositions.includes('P')) distinctPositions.push('P');

        // 4. Add 'NA'
        const status = (player.real_life_status || '').toUpperCase();
        const isNA = status.includes('MN') || status.includes('MINOR') || status === 'NA';
        const isDR = status.includes('DEREGISTERED') || status === 'DR' || status === 'D';
        const isNR = status.includes('UNREGISTERED') || status === 'NR';

        if ((isNA || isDR || isNR) && !distinctPositions.includes('NA')) {
            distinctPositions.push('NA');
        }

        return [...new Set(distinctPositions)].sort((a, b) => {
            // Priority Sort: Standard -> Util -> NA -> BN
            const order = { 'C': 1, '1B': 2, '2B': 3, '3B': 4, 'SS': 5, 'OF': 6, 'Util': 10, 'SP': 11, 'RP': 12, 'P': 13, 'NA': 20, 'BN': 21 };
            return (order[a] || 99) - (order[b] || 99);
        });
    };

    const options = generateOptions();

    // Helper to get stats string
    const getStatsReview = (targetPlayerId) => {
        // If Empty
        if (targetPlayerId === 'empty' || !targetPlayerId) return 'Empty';

        const stats = playerStats[targetPlayerId];
        if (!stats) return 'No Stats';

        const target = roster.find(p => p.player_id === targetPlayerId);
        if (!target) return 'No Data';

        const isBatter = target.batter_or_pitcher === 'batter';
        const cats = isBatter ? batterStats : pitcherStats;
        const displayCats = cats.slice(0, 3); // Show first 3

        return displayCats.map(c => {
            let fieldName = c;
            const matches = c.match(/\(([^)]+)\)/g);
            if (matches) fieldName = matches[matches.length - 1].replace(/[()]/g, '');
            const val = stats[fieldName.toLowerCase()];
            return `${fieldName}: ${val !== undefined ? val : '-'}`;
        }).join(' / ');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative z-10" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white">Move Player</h3>
                        <p className="text-purple-300">
                            Moving <span className="font-bold text-white">{player.name}</span> ({player.position})
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {options.map(pos => {
                        // Prevent moving to same position (LF -> LF)
                        if (pos === player.position) return null;

                        // Find Occupant(s) at this position
                        const occupants = roster.filter(p => p.position === pos && !p.isEmpty);
                        const empties = roster.filter(p => p.position === pos && p.isEmpty);

                        // Check Limit
                        // For NA / Minor, keys might vary ('Minor' vs 'NA'). Usually settings use 'Minor'.
                        // rosterPositionsConfig usually has keys like 'C', '1B', ..., 'Minor'
                        let limitKey = pos;
                        if (pos === 'NA') limitKey = 'Minor'; // Map NA to Minor key
                        const limit = rosterPositionsConfig?.[limitKey] || 0;

                        const isFull = (pos !== 'BN') && (occupants.length >= limit);

                        // Render Logic
                        if (isFull && pos !== 'BN') {
                            // Full: Show Swap Options for EACH occupant
                            return (
                                <div key={pos} className="space-y-2">
                                    {occupants.map(occ => {
                                        const validation = validateMove(pos, occ.player_id);
                                        return (
                                            <button
                                                key={`${pos}-${occ.id}`}
                                                onClick={() => !validation.isValid ? null : onMove(pos, occ.player_id)}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all group ${!validation.isValid
                                                    ? 'bg-red-900/40 border-red-500/50 cursor-not-allowed opacity-80'
                                                    : 'bg-slate-800/60 hover:bg-slate-700/80 border-purple-500/20 hover:border-orange-500/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm ${!validation.isValid ? 'bg-red-800 text-red-200' : 'bg-orange-600 text-white group-hover:bg-orange-500'}`}>
                                                        {pos}
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-white">
                                                            Swap: {occ.name}
                                                        </div>
                                                        {!validation.isValid && (
                                                            <div className="text-xs text-red-300 font-bold mt-0.5">
                                                                ⚠️ {validation.message}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-xs font-mono font-medium text-slate-400 max-w-[150px] truncate">
                                                    {getStatsReview(occ.player_id)}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )
                        } else {
                            // Not Full (or BN), show single Move button
                            let infoLabel = 'Empty';
                            let infoColor = 'text-green-400';
                            let buttonColor = 'bg-purple-600 text-white group-hover:bg-purple-500';

                            if (pos === 'BN' || pos === 'NA') {
                                infoLabel = `${occupants.length} Player${occupants.length !== 1 ? 's' : ''}`;
                                infoColor = 'text-slate-400';
                                if (pos === 'BN') buttonColor = 'bg-slate-700 text-slate-200 group-hover:bg-slate-600';
                            } else if (empties.length > 0) {
                                infoLabel = 'Open Slot';
                                infoColor = 'text-green-400';
                            } else if (occupants.length > 0) {
                                const target = occupants[0]; // Just show first
                                infoLabel = `Swap: ${target.name}`;
                                infoColor = 'text-yellow-400';
                            }

                            const validation = validateMove(pos); // No swap target for simple move (or target is 'first occupant' logically but strictly 'move to slot')
                            // Wait, if moving to BN (which has occupants), it's NOT a swap with specific player usually, just "Add to BN". BN has unlimited? No, limited by `rosterPositionsConfig['BN']`.
                            // But handleMovePlayer API: if target BN and BN full? Modal logic says `isFull = (pos !== 'BN')`. So BN is treated as never full?
                            // Actually `rosterPositionsConfig['BN']` is usually 100 or something, but user set 6.
                            // If BN is full, we should probably force swap.
                            // But logic above `const isFull = (pos !== 'BN')` explicitly excludes BN from 'Full' logic?
                            // This means BN button is always singular "Target: BN".
                            // If BN is technically full, backend might error or logic handles it?
                            // Assuming BN is handled as "Add if space, Error if not? Or Swap if full?".
                            // The current logic implies 'BN' is infinite or handled differently.
                            // Let's assume validation applies.

                            return (
                                <button
                                    key={pos}
                                    onClick={() => !validation.isValid ? null : onMove(pos)}
                                    disabled={pos === player.position || !validation.isValid}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all group ${pos === player.position
                                        ? 'bg-slate-800/50 border-slate-700 opacity-50 cursor-default'
                                        : !validation.isValid
                                            ? 'bg-red-900/40 border-red-500/50 cursor-not-allowed opacity-80'
                                            : 'bg-slate-800/80 hover:bg-slate-700 border-purple-500/20 hover:border-purple-500/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm ${pos === player.position ? 'bg-slate-700 text-slate-400' : !validation.isValid ? 'bg-red-800 text-red-200' : buttonColor}`}>
                                            {pos}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-bold text-white">
                                                Target: {pos}
                                            </div>
                                            {!validation.isValid && (
                                                <div className="text-xs text-red-300 font-bold mt-0.5">
                                                    ⚠️ {validation.message}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`text-xs font-mono font-medium max-w-[200px] truncate ${infoColor}`}>
                                        {infoLabel}
                                    </div>
                                </button>
                            );
                        }
                    })}
                </div>
            </div>
        </div>
    );
}
