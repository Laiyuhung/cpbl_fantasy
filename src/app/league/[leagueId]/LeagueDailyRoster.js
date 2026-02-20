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

    const getTeamColor = (team) => {
        const colors = {
            'Tigers': 'text-yellow-400',
            'Brothers': 'text-yellow-500',
            'Lions': 'text-orange-500',
            'Guardians': 'text-blue-500',
            'Dragons': 'text-red-500',
            'Hawks': 'text-green-500',
            'Monkeys': 'text-red-800' // Rakuten usually red/dark red
        };
        return colors[team] || 'text-slate-400';
    };

    const getTeamAbbr = (team) => {
        if (!team) return '';
        const lower = team.toLowerCase();
        if (lower.includes('brothers')) return 'CTBC';
        if (lower.includes('lions')) return 'UNI';
        if (lower.includes('guardians')) return 'FBG';
        if (lower.includes('dragons')) return 'WCD';
        if (lower.includes('monkeys')) return 'RKM';
        if (lower.includes('hawks')) return 'TSG';
        if (lower.includes('tigers')) return 'TSG'; // Sometimes Tigers/Hawks mixed up in older data?
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
                            <div className="flex items-center gap-2 text-[10px]">
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

                {/* Date Selector */}
                <div className="relative flex items-center justify-between bg-slate-800 rounded-lg p-1 border border-white/10">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full bg-transparent text-white font-mono text-center focus:outline-none p-1 uppercase cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                    />
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
