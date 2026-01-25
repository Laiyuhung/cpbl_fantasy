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
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Swap with {pos} ({occupants.length}/{limit})</div>
                                    {occupants.map(occ => (
                                        <button
                                            key={`${pos}-${occ.id}`}
                                            onClick={() => onMove(pos, occ.player_id)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl border bg-slate-800/60 hover:bg-slate-700/80 border-purple-500/20 hover:border-orange-500/50 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm bg-orange-600 text-white group-hover:bg-orange-500">
                                                    {pos}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-bold text-white">
                                                        Swap: {occ.name}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-xs font-mono font-medium text-slate-400 max-w-[150px] truncate">
                                                {getStatsReview(occ.player_id)}
                                            </div>
                                        </button>
                                    ))}
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
                                // Should be handled by isFull block usually, unless limit not reached but has occupant? (e.g. limit 2, used 1)
                                const target = occupants[0]; // Just show first
                                infoLabel = `Swap: ${target.name}`;
                                infoColor = 'text-yellow-400';
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
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm ${pos === player.position ? 'bg-slate-700 text-slate-400' : buttonColor}`}>
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
                        }
                    })}
                </div>
            </div>
        </div>
    );
}
