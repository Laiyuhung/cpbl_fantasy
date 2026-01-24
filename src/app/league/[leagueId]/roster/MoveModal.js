import React from 'react';

export default function MoveModal({ isOpen, onClose, player, onMove }) {
    if (!isOpen || !player) return null;

    // Generate Available Positions
    const generateOptions = () => {
        // 1. Parse standard positions
        let options = player.position_list ? player.position_list.split(',').map(p => p.trim()) : [];

        // 2. Add 'BN' (Always available)
        if (!options.includes('BN')) options.push('BN');

        // 3. Add 'Util' if Batter and not already there
        if (player.batter_or_pitcher === 'batter' && !options.includes('Util')) {
            options.push('Util');
        }
        // Add 'P' if Pitcher (usually captured in position_list but ensuring safety)
        if (player.batter_or_pitcher === 'pitcher' && !options.includes('P')) {
            options.push('P');
        }

        // 4. Add 'NA' based on Status/Badges
        // Check Status logic (replicated from RosterPage/Badges)
        const status = (player.real_life_status || '').toUpperCase();
        const identity = (player.identity || '').toLowerCase();

        const isNA = status.includes('MN') || status.includes('MINOR') || status === 'NA';
        const isDR = status.includes('DEREGISTERED') || status === 'DR' || status === 'D';
        const isNR = status.includes('UNREGISTERED') || status === 'NR';
        // const isForeigner = identity === 'foreigner'; // Foreigner doesn't inherently grant NA, usually just the status ones.
        // User said: "挂NA NR DR badge的可以多一個NA的位置"

        if (isNA || isDR || isNR) {
            if (!options.includes('NA')) options.push('NA');
        }

        // Dedupe
        return [...new Set(options)].sort();
    };

    const options = generateOptions();

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={onClose}>
            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-2">Move Player</h3>
                <p className="text-purple-300 mb-6">
                    Move <span className="font-bold text-white">{player.name}</span> to:
                </p>

                <div className="grid grid-cols-3 gap-3">
                    {options.map(pos => (
                        <button
                            key={pos}
                            onClick={() => onMove(pos)}
                            disabled={pos === player.position}
                            className={`px-3 py-2 rounded-lg font-bold text-sm transition-colors ${pos === player.position
                                    ? 'bg-slate-700 text-slate-500 cursor-default'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg border border-indigo-400/30'
                                }`}
                        >
                            {pos}
                        </button>
                    ))}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white text-sm"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
