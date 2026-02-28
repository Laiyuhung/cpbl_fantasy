'use client';

import { useState, useEffect, useRef } from 'react';

export default function CpblScheduleWidget() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(false);

    // Calendar Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const datePickerRef = useRef(null);

    const teamColors = {
        '統一獅': 'text-orange-400',
        '中信兄弟': 'text-yellow-400',
        '樂天桃猿': 'text-red-400',
        '富邦悍將': 'text-blue-400',
        '味全龍': 'text-red-500',
        '台鋼雄鷹': 'text-green-500',
    };

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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

    // Close date picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const changeDate = (days) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + days);
        setCurrentDate(newDate);
    };

    const isToday = (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const displayDate = currentDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        weekday: 'short'
    });

    // Calendar Helpers
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    return (
        <div className="bg-slate-900/50 border border-purple-500/20 rounded-xl overflow-visible shadow-lg h-fit">
            {/* Header: Date Navigation */}
            <div className="bg-purple-900/20 p-3 flex items-center justify-between border-b border-purple-500/20 gap-2 relative">

                {/* Date Controls */}
                <div className="flex items-center gap-2 flex-1 justify-between bg-slate-800/50 rounded-lg p-1 border border-white/5" ref={datePickerRef}>
                    <button
                        onClick={() => changeDate(-1)}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <button
                        onClick={() => {
                            setViewDate(currentDate);
                            setShowDatePicker(!showDatePicker);
                        }}
                        className="text-white font-bold text-sm tracking-wide flex items-center gap-2 hover:text-purple-300 transition-colors"
                    >
                        {displayDate}
                        <svg className={`w-3 h-3 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <button
                        onClick={() => changeDate(1)}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                    {/* Date Picker Popup */}
                    {showDatePicker && (
                        <div className="absolute top-full left-0 mt-2 z-50 bg-slate-900 border border-purple-500/50 rounded-xl shadow-2xl p-4 w-[260px]">
                            {/* Month Nav */}
                            <div className="flex justify-between items-center mb-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newDate = new Date(viewDate);
                                        newDate.setMonth(newDate.getMonth() - 1);
                                        setViewDate(newDate);
                                    }}
                                    className="p-1 hover:bg-slate-700 rounded text-purple-300 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span className="text-white font-bold text-sm">
                                    {viewDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newDate = new Date(viewDate);
                                        newDate.setMonth(newDate.getMonth() + 1);
                                        setViewDate(newDate);
                                    }}
                                    className="p-1 hover:bg-slate-700 rounded text-purple-300 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>

                            {/* Days Grid */}
                            <div className="grid grid-cols-7 mb-2">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                                    <div key={d} className="text-center text-[10px] font-bold text-slate-500">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {Array.from({ length: getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}
                                {Array.from({ length: getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                                    const day = i + 1;
                                    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                                    const isSelected = date.toDateString() === currentDate.toDateString();
                                    const isTodayDate = isToday(date);

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => {
                                                setCurrentDate(date);
                                                setShowDatePicker(false);
                                            }}
                                            className={`
                                                h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                                ${isSelected ? 'bg-purple-600 text-white shadow' : ''}
                                                ${!isSelected && isTodayDate ? 'border border-green-500 text-green-400' : ''}
                                                ${!isSelected && !isTodayDate ? 'text-slate-300 hover:bg-purple-500/20 hover:text-white' : ''}
                                            `}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Today Button */}
                <button
                    onClick={() => setCurrentDate(new Date())}
                    className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/20 transition-all flex flex-col items-center justify-center gap-0.5 group"
                    title="Go to Today"
                >
                    <span className="text-[10px] font-bold uppercase leading-none">Today</span>
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
                            <div key={game.uuid || game.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:border-purple-500/30 transition-colors group">
                                <div className="flex justify-between text-[10px] text-slate-400 mb-2 font-mono">
                                    <span className="flex items-center gap-1.5">
                                        #{game.game_no}
                                        {game.stage === 'spring_training' && (
                                            <span className="text-[9px] font-bold bg-emerald-900/50 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider not-italic">
                                                Spring Training
                                            </span>
                                        )}
                                    </span>
                                    <span>
                                        {(() => {
                                            if (!game.time) return 'TBD';
                                            const gameDate = new Date(game.time);
                                            const timeStr = gameDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

                                            // Format game.time to YYYY-MM-DD in Taiwan Time
                                            const gameDateStr = gameDate.toLocaleDateString('zh-TW', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                timeZone: 'Asia/Taipei'
                                            }).replace(/\//g, '-'); // Expected format: YYYY-MM-DD

                                            // If the actual game time date differs from the scheduled date (game.date), show the date
                                            const isDifferentDate = game.date !== gameDateStr;

                                            return (
                                                <>
                                                    {timeStr}
                                                    {isDifferentDate && (
                                                        <span className="ml-1 text-[9px] text-purple-300">
                                                            ({gameDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })})
                                                        </span>
                                                    )}
                                                </>
                                            );
                                        })()} @ {game.stadium}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    {/* Away Team */}
                                    <div className="flex-1 text-left">
                                        <div className={`font-bold text-sm transition-transform group-hover:scale-105 ${teamColors[game.away] || 'text-white'}`}>
                                            {game.away}
                                        </div>
                                    </div>

                                    {/* Score / VS / Status */}
                                    <div className="px-2 text-xs font-bold">
                                        {game.is_postponed ? (
                                            <span className="text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded text-[10px]">PPD</span>
                                        ) : game.away_team_score != null && game.home_team_score != null ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-base font-black tabular-nums ${game.away_team_score > game.home_team_score ? 'text-green-400' : game.away_team_score < game.home_team_score ? 'text-slate-500' : 'text-cyan-300'}`}>
                                                    {game.away_team_score}
                                                </span>
                                                <span className="text-[10px] text-slate-600">:</span>
                                                <span className={`text-base font-black tabular-nums ${game.home_team_score > game.away_team_score ? 'text-green-400' : game.home_team_score < game.away_team_score ? 'text-slate-500' : 'text-cyan-300'}`}>
                                                    {game.home_team_score}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 group-hover:text-slate-400 transition-colors">VS</span>
                                        )}
                                    </div>

                                    {/* Home Team */}
                                    <div className="flex-1 text-right">
                                        <div className={`font-bold text-sm transition-transform group-hover:scale-105 ${teamColors[game.home] || 'text-white'}`}>
                                            {game.home}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="bg-slate-900/80 p-2 text-center border-t border-white/5">
                <a
                    href="https://www.cpbl.com.tw"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-500 hover:text-purple-400 transition-colors uppercase tracking-widest font-bold flex items-center justify-center gap-1"
                >
                    Official CPBL Site
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
            </div>
        </div>
    );
}
