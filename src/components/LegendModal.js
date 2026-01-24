export default function LegendModal({ isOpen, onClose, batterStats = [], pitcherStats = [] }) {
    if (!isOpen) return null;

    // Helper to parse "Stat Name (Abbr)" -> { abbr: "Abbr", name: "Stat Name" }
    const parseStat = (statString) => {
        const matches = statString.match(/(.+)\s+\(([^)]+)\)/);
        if (matches) {
            return { name: matches[1].trim(), abbr: matches[2].trim() };
        }
        return { name: statString, abbr: statString }; // Fallback
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70]" onClick={onClose}>
            <div
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-4xl w-full mx-4 border border-purple-500/30 shadow-2xl overflow-y-auto max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6 border-b border-purple-500/20 pb-4">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                        <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        System Legend & Definitions
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* Status & Indicators */}
                    <div className="space-y-6">
                        <section>
                            <h4 className="text-lg font-bold text-purple-300 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                                Player Status
                            </h4>
                            <div className="bg-slate-900/50 rounded-xl p-4 border border-purple-500/10 space-y-3">
                                <div className="flex items-center justify-between group">
                                    <span className="text-green-300 font-mono font-bold bg-green-900/30 px-2 py-1 rounded">| FA</span>
                                    <span className="text-gray-300 text-sm">Free Agent (Available to add)</span>
                                </div>
                                <div className="flex items-center justify-between group">
                                    <span className="text-yellow-300 font-mono font-bold bg-yellow-900/30 px-2 py-1 rounded">| W 10/25</span>
                                    <span className="text-gray-300 text-sm">On Waiver (Claimable until date)</span>
                                </div>
                                <div className="flex items-center justify-between group">
                                    <span className="text-blue-300 font-mono font-bold bg-blue-900/30 px-2 py-1 rounded">| Owner</span>
                                    <span className="text-gray-300 text-sm">Currently owned by a manager</span>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h4 className="text-lg font-bold text-purple-300 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                                Special Tags
                            </h4>
                            <div className="bg-slate-900/50 rounded-xl p-4 border border-purple-500/10 space-y-3">
                                <div className="flex items-center justify-between group">
                                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">F</span>
                                    <span className="text-gray-300 text-sm">Foreign Player</span>
                                </div>
                                <div className="flex items-center justify-between group">
                                    <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">NA</span>
                                    <span className="text-gray-300 text-sm">Minor League Status</span>
                                </div>
                                <div className="flex items-center justify-between group">
                                    <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">DR</span>
                                    <span className="text-gray-300 text-sm">Deregistered</span>
                                </div>
                                <div className="flex items-center justify-between group">
                                    <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">NR</span>
                                    <span className="text-gray-300 text-sm">Unregistered</span>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Stats Definitions */}
                    <div className="space-y-6">
                        {batterStats.length > 0 && (
                            <section>
                                <h4 className="text-lg font-bold text-purple-300 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-pink-400 rounded-full"></span>
                                    Batter Stats
                                </h4>
                                <div className="bg-slate-900/50 rounded-xl p-4 border border-purple-500/10 grid grid-cols-1 gap-y-2">
                                    {batterStats.map(stat => {
                                        const { name, abbr } = parseStat(stat);
                                        return (
                                            <div key={stat} className="flex justify-between items-center text-sm border-b border-purple-500/10 last:border-0 pb-1 last:pb-0">
                                                <span className="font-mono font-bold text-pink-200">{abbr}</span>
                                                <span className="text-gray-400">{name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {pitcherStats.length > 0 && (
                            <section>
                                <h4 className="text-lg font-bold text-purple-300 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                                    Pitcher Stats
                                </h4>
                                <div className="bg-slate-900/50 rounded-xl p-4 border border-purple-500/10 grid grid-cols-1 gap-y-2">
                                    {pitcherStats.map(stat => {
                                        const { name, abbr } = parseStat(stat);
                                        return (
                                            <div key={stat} className="flex justify-between items-center text-sm border-b border-purple-500/10 last:border-0 pb-1 last:pb-0">
                                                <span className="font-mono font-bold text-orange-200">{abbr}</span>
                                                <span className="text-gray-400">{name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </div>

                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors shadow-lg shadow-purple-900/20"
                    >
                        Close Legend
                    </button>
                </div>
            </div>
        </div>
    );
}
