import React, { useState, useEffect } from 'react';

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
                            // BN, NA, IL
                            // Use batter_or_pitcher if available
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

    // Handlers
    const handleDateChange = (days) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        const newDateStr = date.toISOString().split('T')[0];
        setSelectedDate(newDateStr);
    };

    const getTeamColor = (team) => {
        if (!team) return 'text-slate-400';
        const lower = team.toLowerCase();
        if (lower.includes('brother') || lower.includes('兄弟')) return 'text-yellow-500';
        if (lower.includes('lion') || lower.includes('統一')) return 'text-orange-500';
        if (lower.includes('guardian') || lower.includes('富邦') || lower.includes('fubon')) return 'text-blue-500';
        if (lower.includes('dragon') || lower.includes('味全')) return 'text-red-500';
        if (lower.includes('hawk') || lower.includes('台鋼') || lower.includes('tsg')) return 'text-green-500';
        if (lower.includes('monkey') || lower.includes('樂天') || lower.includes('rakuten')) return 'text-red-800';
        return 'text-slate-400';
    };

    const getTeamAbbr = (team) => {
        if (!team) return '';
        const lower = team.toLowerCase();
        // English mappings
        if (lower.includes('brothers')) return 'CTBC';
        if (lower.includes('lions')) return 'UNI';
        if (lower.includes('guardians')) return 'FBG';
        if (lower.includes('dragons')) return 'WCD';
        if (lower.includes('monkeys')) return 'RKM';
        if (lower.includes('hawks')) return 'TSG';

        // Chinese mappings
        if (lower.includes('兄弟')) return '兄弟';
        if (lower.includes('統一')) return '統一';
        if (lower.includes('富邦')) return '富邦';
        if (lower.includes('味全')) return '味全';
        if (lower.includes('樂天')) return '樂天';
        if (lower.includes('台鋼')) return '台鋼';

        // Fallback: if it looks like a full Chinese name (3+ chars), trim to 2 if possible, or 3.
        // Actually, just return specific length if English (3), else return as is or safe slice.
        // If it's English and long, slice 3. If Chinese, maybe ok to keep?
        // Let's stick to safe defaults.
        if (/[\u4e00-\u9fa5]/.test(team)) {
            // Chinese characters detected
            return team.length > 2 ? team.substring(0, 2) : team; // Try to act smartly, e.g. 台鋼雄鷹 -> 台鋼
        }

        return team.substring(0, 3).toUpperCase();
    };

    // Render Row
    const renderPlayerRow = (p) => {
        // p is the roster item. p.player_id might be 'empty'.
        const isEmpty = !p.player_id || p.player_id === 'empty';
        const name = p.name || (isEmpty ? 'Empty' : 'Unknown');

        return (
            <div key={p.id || `empty-${p.position}-${Math.random()}`} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                    <span className={`w-8 flex-shrink-0 text-center text-xs font-bold ${['BN', 'NA', 'IL'].includes(p.position) ? 'text-slate-500' : 'text-purple-400'
                        }`}>{p.position}</span>

                    <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-bold truncate ${isEmpty ? 'text-slate-600 italic' : 'text-slate-200'}`}>
                            {name}
                        </span>
                        {!isEmpty && (
                            <div className="flex items-center gap-2 text-[10px] whitespace-nowrap">
                                {p.team && (
                                    <span className={`${getTeamColor(p.team)} font-bold`}>{getTeamAbbr(p.team)}</span>
                                )}
                                {p.game_info && (
                                    <span className="text-slate-500">
                                        {p.game_info.is_home ? 'vs' : '@'} {getTeamAbbr(p.game_info.opponent)}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {!isEmpty && p.game_info && (
                    <div className="text-right flex-shrink-0">
                        <span className="text-[10px] font-mono text-slate-400 block">
                            {p.game_info.time.substring(0, 5)}
                        </span>
                    </div>
                )}
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
                <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-white/10 justify-between">
                    <button
                        onClick={() => handleDateChange(-1)}
                        className="p-1.5 hover:bg-white/10 rounded text-slate-300 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>

                    <div className="relative">
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
                                {selectedDate}
                            </span>
                        </button>

                        {/* Dropdown Calendar */}
                        {showDatePicker && (
                            <>
                                <div className="fixed inset-0 z-[890]" onClick={() => setShowDatePicker(false)} />
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[900] bg-slate-900 border border-purple-500/50 rounded-xl shadow-2xl p-4 w-[280px]">
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
                                        {/* Empty Cells */}
                                        {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() }).map((_, i) => (
                                            <div key={`empty-${i}`} />
                                        ))}

                                        {/* Days */}
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
                            {rosterData.batters.length === 0 ? <div className="text-slate-600 text-xs italic py-2">No batters found</div> : rosterData.batters.map(renderPlayerRow)}
                        </div>
                    </div>

                    {/* Pitchers */}
                    <div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-white/10 pb-1 flex justify-between">
                            <span>Pitchers</span>
                            <span className="text-[10px] opacity-70">{rosterData.pitchers.length} Players</span>
                        </h4>
                        <div className="flex flex-col">
                            {rosterData.pitchers.length === 0 ? <div className="text-slate-600 text-xs italic py-2">No pitchers found</div> : rosterData.pitchers.map(renderPlayerRow)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
