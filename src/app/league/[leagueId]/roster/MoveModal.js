import React from 'react';

export default function MoveModal({
    isOpen,
    onClose,
    player,
    roster,
    playerStats,
    batterStats, // Array of stat keys
    pitcherStats,
    onMove
}) {
    if (!isOpen || !player) return null;

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

        // Pick top 2 categories based on Batter/Pitcher
        // We assume we can look up the player's type from stats or roster? 
        // Safest: Use the passed categories.
        // But we don't know easily if targetOccupant is B or P just from ID without lookup.
        // We can find them in roster.
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
            {/* Backdrop handled by parent or this div? This div covers screen. */}
            {/* But RosterPage might have its own blur spinner. User said "Movement Spinner changed to blur". 
          This modal is for SELECTION. The blur spinner is for LOADING (after selection). 
          So this modal just needs to look good. */}
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
                        // Find Occupant(s) at this position
                        // Note: 'BN' and 'NA' can have multiple. 'OF' can have multiple.
                        // If moving to 'OF', and there is an Empty slot, show "Available / Empty".
                        // If all full, show "Swap with [Name]".
                        // If multiple full slots (e.g. 3 OFs), which one do we swap with? 
                        // The API currently auto-swaps with the first one. 
                        // For UI display, if there are multiple occupants, we should ideally list them or show "Swap with..."
                        // Simplified: Show the *status* of the target position.

                        // Get all roster entries for this position
                        const occupants = roster.filter(p => p.position === pos && !p.isEmpty);
                        const empties = roster.filter(p => p.position === pos && p.isEmpty);

                        // Determine Label
                        let infoLabel = 'Empty';
                        let infoColor = 'text-green-400';

                        if (pos === 'BN' || pos === 'NA') {
                            // Special Handling for Unlimited/Bucket slots
                            // Just show count? "Current: 5 players"
                            infoLabel = `${occupants.length} Player${occupants.length !== 1 ? 's' : ''}`;
                            infoColor = 'text-slate-400';
                        } else if (empties.length > 0) {
                            // Has empty slot
                            infoLabel = 'Open Slot';
                            infoColor = 'text-green-400';
                        } else if (occupants.length > 0) {
                            // Full - Show Occupant Name (Use first one for now as API swaps with first)
                            // If multiple, maybe just show first?
                            const target = occupants[0];
                            infoLabel = `Swap: ${target.name} (${getStatsReview(target.player_id)})`;
                            infoColor = 'text-orange-400';
                        }

                        return (
                            <button
                                key={pos}
                                onClick={() => onMove(pos)}
                                disabled={pos === player.position}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all group ${pos === player.position
                                        ? 'bg-slate-800/50 border-slate-700 opacity-50 cursor-default'
                                        : 'bg-slate-800/80 hover:bg-slate-700 border-purple-500/20 hover:border-purple-500/50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm ${pos === player.position ? 'bg-slate-700 text-slate-400' : 'bg-purple-600 text-white group-hover:bg-purple-500'
                                        }`}>
                                        {pos}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-white">
                                            Target: {pos}
                                        </div>
                                    </div>
                                </div>

                                <div className={`text-xs font-mono font-medium max-w-[200px] truncate ${infoColor}`}>
                                    {infoLabel}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
