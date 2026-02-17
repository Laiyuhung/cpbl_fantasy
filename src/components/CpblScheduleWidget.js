'use client';

import { useState, useEffect } from 'react';

export default function CpblScheduleWidget() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(false);

    const teamColors = {
        '統一獅': 'text-orange-400',
        '中信兄弟': 'text-yellow-400',
        '樂天桃猿': 'text-red-400',
        '富邦悍將': 'text-blue-400',
        '味全龍': 'text-red-500',
        '台鋼雄鷹': 'text-green-500',
    };

    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    const fetchGames = async (date) => {
        setLoading(true);
        try {
            const dateStr = formatDate(date);
            const res = await fetch(`/api/cpbl-schedule?date=${dateStr}`);
            const data = await res.json();
            if (data.success) {
                setGames(data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGames(currentDate);
    }, [currentDate]);

    const changeDate = (days) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + days);
        setCurrentDate(newDate);
    };

    const displayDate = currentDate.toLocaleDateString('zh-TW', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
    });

    return (
        <div className="bg-slate-900/50 border border-purple-500/20 rounded-xl overflow-hidden shadow-lg h-fit">
            {/* Header: Date Navigation */}
            <div className="bg-purple-900/20 p-3 flex items-center justify-between border-b border-purple-500/20">
                <button
                    onClick={() => changeDate(-1)}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors text-purple-300"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <div className="text-center">
                    <h3 className="text-white font-bold text-lg tracking-wide">{displayDate}</h3>
                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="text-xs text-purple-400/70 hover:text-purple-300 uppercase font-semibold tracking-wider"
                    >
                        Today
                    </button>
                </div>

                <button
                    onClick={() => changeDate(1)}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors text-purple-300"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Body: Game List */}
            <div className="p-4 min-h-[150px]">
                {loading ? (
                    <div className="flex justify-center items-center h-full py-8">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : games.length === 0 ? (
                    <div className="text-center text-slate-500 py-8 text-sm">
                        No games scheduled
                    </div>
                ) : (
                    <div className="space-y-3">
                        {games.map((game) => (
                            <div key={game.uuid || game.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                                <div className="flex justify-between text-[10px] text-slate-400 mb-2 font-mono">
                                    <span>#{game.game_no}</span>
                                    <span>{game.time} @ {game.stadium}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    {/* Away Team */}
                                    <div className="flex-1 text-left">
                                        <div className={`font-bold text-sm ${teamColors[game.away] || 'text-white'}`}>
                                            {game.away}
                                        </div>
                                    </div>

                                    {/* VS / Status */}
                                    <div className="px-2 text-xs font-bold text-slate-600">
                                        {game.is_postponed ? (
                                            <span className="text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded text-[10px]">PPD</span>
                                        ) : (
                                            'VS'
                                        )}
                                    </div>

                                    {/* Home Team */}
                                    <div className="flex-1 text-right">
                                        <div className={`font-bold text-sm ${teamColors[game.home] || 'text-white'}`}>
                                            {game.home}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer: Live Scores Link? (Optional) */}
            <div className="bg-slate-900/80 p-2 text-center border-t border-white/5">
                <a
                    href="https://www.cpbl.com.tw"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-500 hover:text-purple-400 transition-colors uppercase tracking-widest font-bold"
                >
                    Official CPBL Site &rarr;
                </a>
            </div>
        </div>
    );
}
