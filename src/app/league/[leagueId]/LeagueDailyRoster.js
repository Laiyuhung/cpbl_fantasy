import React, { useState, useEffect } from 'react';

function toAbbr(team) {
    switch (team) {
        case '統一獅': return 'UL';
        case '富邦悍將': return 'FG';
        case '樂天桃猿': return 'RM';
        case '中信兄弟': return 'B';
        case '味全龍': return 'W';
        case '台鋼雄鷹': return 'TSG';
        default: return team || '';
    }
}

function formatTime(timeStr) {
    // time may be "18:35:00", "18:35", or a full ISO like "2026-02-20T18:35:00"
    if (!timeStr) return '';
    // If ISO/datetime format, extract the HH:MM part
    if (timeStr.includes('T')) {
        // e.g. "2026-02-20T18:35:00+08:00"
        const timePart = timeStr.split('T')[1];
        return timePart.substring(0, 5);
    }
    // Already "HH:MM:SS" or "HH:MM"
    return timeStr.substring(0, 5);
}

function formatDate(dateStr) {
    // dateStr is "YYYY-MM-DD", format to M/D
    if (!dateStr) return '';
    const [, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
}

export default function LeagueDailyRoster({ leagueId, members }) {
    // State
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const taiwanTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
        return taiwanTime.toISOString().split('T')[0];
    });
    const [selectedManagerId, setSelectedManagerId] = useState('');
    const [rosterData, setRosterData] = useState({ batters: [], pitchers: [] });
    const [loading, setLoading] = useState(false);

    // Date Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());

    // Fetch Roster
    useEffect(() => {
        const fetchRoster = async () => {
            if (!leagueId || !selectedManagerId) {
                setRosterData({ batters: [], pitchers: [] });
                return;
            };

            setLoading(true);
            try {
                const response = await fetch(`/api/league/${leagueId}/roster?manager_id=${selectedManagerId}&game_date=${selectedDate}`);
                const data = await response.json();

                if (data.success) {
                    const sortedRoster = data.roster || [];

                    const batterPos = ['C', '1B', '2B', '3B', 'SS', 'OF', 'Util'];
                    const pitcherPos = ['SP', 'RP', 'P'];

                    const pRoster = [];
                    const bRoster = [];

                    sortedRoster.forEach(item => {
                        const isPitcherPos = pitcherPos.includes(item.position);
                        const isBatterPos = batterPos.includes(item.position);

                        if (isPitcherPos) {
                            pRoster.push(item);
                        } else if (isBatterPos) {
                            bRoster.push(item);
                        } else {
                            if (item.batter_or_pitcher === 'pitcher') {
                                pRoster.push(item);
                            } else {
                                bRoster.push(item);
                            }
                        }
                    });

                    setRosterData({ batters: bRoster, pitchers: pRoster });
                }
            } catch (error) {
                console.error('Error fetching daily roster:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRoster();
    }, [leagueId, selectedManagerId, selectedDate]);

    const handleDateChange = (days) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        const newDateStr = date.toISOString().split('T')[0];
        setSelectedDate(newDateStr);
    };

    const getTeamColor = (team) => {
        switch (team) {
            case '統一獅': return 'text-orange-400';
            case '富邦悍將': return 'text-blue-400';
            case '台鋼雄鷹': return 'text-green-400';
            case '味全龍': return 'text-red-400';
            case '樂天桃猿': return 'text-rose-400';
            case '中信兄弟': return 'text-yellow-400';
            default: return 'text-slate-400';
        }
    };

    const renderPlayerRow = (p) => {
        const isEmpty = !p.player_id || p.player_id === 'empty';
        const name = p.name || (isEmpty ? 'Empty' : 'Unknown');
        const teamAbbr = toAbbr(p.team);

        let gameInfoDisplay = 'No game';
        if (p.game_info) {
            const timeStr = formatTime(p.game_info.time);
            const vsAt = p.game_info.is_home ? 'vs' : '@';
            const oppAbbr = toAbbr(p.game_info.opponent);
            gameInfoDisplay = `${timeStr} ${vsAt} ${oppAbbr}`;
        }

        return (
            <div key={p.id || `empty-${p.position}-${Math.random()}`} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                    <span className={`w-8 flex-shrink-0 text-center text-xs font-bold ${['BN', 'NA', 'IL'].includes(p.position) ? 'text-slate-500' : 'text-purple-400'
                        }`}>{p.position}</span>

                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold truncate ${isEmpty ? 'text-slate-600 italic' : 'text-slate-200'}`}>
                                {name}
                            </span>
                            {!isEmpty && p.team && (
                                <span className={`${getTeamColor(p.team)} font-bold text-[10px] flex-shrink-0`}>{teamAbbr}</span>
                            )}
                        </div>
                        {!isEmpty && (
                            <div className={`text-[10px] whitespace-nowrap ${p.game_info ? 'text-slate-500' : 'text-slate-600 italic'}`}>
                                {gameInfoDisplay}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gradient-to-br from-slate-900/50 to-purple-900/20 backdrop-blur-md rounded-3xl border border-white/5 p-6 shadow-xl w-full">
            <h3 className="text-xl font-black text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
                Daily Roster
            </h3>

            {/* Controls */}
            <div className="flex flex-col gap-3 mb-6">
                {/* Manager Selector */}
                <select
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                >
                    <option value="">Select Manager...</option>
                    {members && members.map(m => (
                        <option key={m.manager_id} value={m.manager_id}>
                            {m.nickname}
                        </option>
                    ))}
                </select>

                {/* Date Selector (Custom UI) */}
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-white/10 justify-between">
                    <button
                        onClick={() => handleDateChange(-1)}
                        className="p-1.5 hover:bg-white/10 rounded text-slate-300 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>

                    <div className="relative flex-1 flex justify-center">
                        <button
                            onClick={() => {
                                if (!showDatePicker) {
                                    let initDate = new Date();
                                    if (selectedDate) {
                                        const [y, m, d] = selectedDate.split('-').map(Number);
                                        initDate = new Date(y, m - 1, d);
                                    }
                                    setViewDate(initDate);
                                }
                                setShowDatePicker(!showDatePicker);
                            }}
                            className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded transition-colors"
                        >
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm font-bold text-white font-mono">
                                {formatDate(selectedDate)}
                            </span>
                        </button>

                        {/* Dropdown Calendar — opens UPWARD */}
                        {showDatePicker && (
                            <>
                                <div className="fixed inset-0 z-[890]" onClick={() => setShowDatePicker(false)} />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[900] bg-slate-900 border border-purple-500/50 rounded-xl shadow-2xl p-4 w-[280px]">
                                    {/* Calendar Header */}
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
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <span className="text-white font-bold text-sm">
                                            {viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
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
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </button>
                                    </div>

                                    {/* Days Header */}
                                    <div className="grid grid-cols-7 mb-2">
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                            <div key={d} className="text-center text-xs font-bold text-slate-500">{d}</div>
                                        ))}
                                    </div>

                                    {/* Calendar Grid */}
                                    <div className="grid grid-cols-7 gap-1">
                                        {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() }).map((_, i) => (
                                            <div key={`empty-${i}`} />
                                        ))}

                                        {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                                            const day = i + 1;
                                            const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                            const isSelected = selectedDate === dateStr;
                                            const now = new Date();
                                            const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
                                            const todayStr = taiwanTime.toISOString().split('T')[0];
                                            const isToday = dateStr === todayStr;

                                            return (
                                                <button
                                                    key={dateStr}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedDate(dateStr);
                                                        setShowDatePicker(false);
                                                    }}
                                                    className={`
                                                        h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                                        ${isSelected ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50 scale-110' : ''}
                                                        ${!isSelected && isToday ? 'border border-green-500 text-green-400' : ''}
                                                        ${!isSelected && !isToday ? 'text-slate-300 hover:bg-purple-500/20 hover:text-white' : ''}
                                                    `}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => handleDateChange(1)}
                        className="p-1.5 hover:bg-white/10 rounded text-slate-300 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            {!selectedManagerId ? (
                <div className="h-48 flex items-center justify-center text-slate-500 text-sm italic">
                    Select a manager to view roster
                </div>
            ) : loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Batters */}
                    <div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-white/10 pb-1 flex justify-between">
                            <span>Batters</span>
                            <span className="text-[10px] opacity-70">{rosterData.batters.length} Players</span>
                        </h4>
                        <div className="flex flex-col">
                            {rosterData.batters.length === 0 ? (
                                <div className="text-slate-600 text-xs italic py-2">No batters found</div>
                            ) : (
                                rosterData.batters.map(renderPlayerRow)
                            )}
                        </div>
                    </div>

                    {/* Pitchers */}
                    <div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-white/10 pb-1 flex justify-between">
                            <span>Pitchers</span>
                            <span className="text-[10px] opacity-70">{rosterData.pitchers.length} Players</span>
                        </h4>
                        <div className="flex flex-col">
                            {rosterData.pitchers.length === 0 ? (
                                <div className="text-slate-600 text-xs italic py-2">No pitchers found</div>
                            ) : (
                                rosterData.pitchers.map(renderPlayerRow)
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
