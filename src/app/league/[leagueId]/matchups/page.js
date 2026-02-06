'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MatchupsPage() {
    const params = useParams();
    const leagueId = params.leagueId;

    const [loading, setLoading] = useState(true);
    const [matchups, setMatchups] = useState([]);
    const [scroingSettings, setScoringSettings] = useState(null);
    const [selectedWeek, setSelectedWeek] = useState('1'); // Default to Week 1 or current
    const [availableWeeks, setAvailableWeeks] = useState([]);
    const [currentManagerId, setCurrentManagerId] = useState(null);
    const [selectedMatchupIndex, setSelectedMatchupIndex] = useState(0);

    // Fetch available weeks
    useEffect(() => {
        const weeks = Array.from({ length: 23 }, (_, i) => i + 1);
        setAvailableWeeks(weeks);
    }, []);

    // Get current user's manager ID
    useEffect(() => {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        if (cookie) {
            setCurrentManagerId(cookie.split('=')[1]);
        }
    }, []);

    useEffect(() => {
        if (!leagueId || !selectedWeek) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/league/${leagueId}/matchups/stats?week=${selectedWeek}`);
                const data = await res.json();

                if (data.success) {
                    setMatchups(data.matchups);
                    setScoringSettings(data.settings);
                } else {
                    console.error("Failed to fetch matchups:", data.error);
                }
            } catch (error) {
                console.error("Error loading matchups:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [leagueId, selectedWeek]); // 移除 currentManagerId 避免雙重 fetch

    // 獨立處理 auto-select 用戶的對戰
    useEffect(() => {
        if (currentManagerId && matchups.length > 0) {
            const userIndex = matchups.findIndex(
                m => m.manager1_id === currentManagerId || m.manager2_id === currentManagerId
            );
            if (userIndex !== -1) {
                setSelectedMatchupIndex(userIndex);
            }
        }
    }, [currentManagerId, matchups]);

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="flex gap-4">
                    <div className="h-24 w-64 bg-gray-200 rounded animate-pulse" />
                    <div className="h-24 w-64 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="h-96 bg-gray-200 rounded animate-pulse" />
            </div>
        );
    }

    // Display Helper - 直接顯示後端的值
    const formatStat = (val, cat) => {
        // K/BB 為 null 代表無限大（BB=0 但 K>0）
        if (cat === 'p_k/bb' && (val === null || val === undefined)) {
            return 'INF';
        }

        // 如果值為 undefined 或 null，顯示 0
        if (val === undefined || val === null) return '0';

        // 直接返回後端提供的值（包括 "0.000" 這種字串）
        return val;
    };

    const getAbbr = (cat) => {
        const match = cat.match(/\(([^)]+)\)[^(]*$/);
        return match ? match[1] : cat;
    };

    // Mapping display names to db columns
    const statMap = {
        // Batting
        'H/AB': 'b_avg', 'AVG': 'b_avg', 'R': 'b_r', 'H': 'b_h', '1B': 'b_1b',
        '2B': 'b_2b', '3B': 'b_3b', 'HR': 'b_hr', 'XBH': 'b_xbh', 'TB': 'b_tb',
        'RBI': 'b_rbi', 'BB': 'b_bb', 'IBB': 'b_ibb', 'HBP': 'b_hbp', 'K': 'b_k',
        'SB': 'b_sb', 'CS': 'b_cs', 'SH': 'b_sh', 'SF': 'b_sf', 'GIDP': 'b_gidp',
        'E': 'b_e', 'CYC': 'b_cyc', 'OBP': 'b_obp', 'SLG': 'b_slg', 'OPS': 'b_ops',

        // Pitching
        'IP': 'p_ip', 'W': 'p_w', 'L': 'p_l', 'SV': 'p_sv', 'HLD': 'p_hld',
        'SV+HLD': 'p_svhld', 'K': 'p_k_pitching', 'ERA': 'p_era', 'WHIP': 'p_whip',
        'K/9': 'p_k/9', 'BB/9': 'p_bb/9', 'K/BB': 'p_k/bb', 'QS': 'p_qs',
        'CG': 'p_cg', 'SHO': 'p_sho', 'NH': 'p_nh', 'PG': 'p_pg', 'APP': 'p_app', 'GS': 'p_gs',
    };

    const getDbCol = (cat, type) => {
        if (type === 'batter') {
            const key = cat.toLowerCase();
            return `b_${key}` in { b_r: 1, b_h: 1, b_hr: 1, b_rbi: 1, b_sb: 1, b_avg: 1, b_obp: 1, b_ops: 1 } ? `b_${key}` : statMap[cat] || `b_${key}`;
        } else {
            const key = cat.toLowerCase();
            return `p_${key}` in { p_w: 1, p_l: 1, p_sv: 1, p_k: 1, p_era: 1, p_whip: 1 } ? `p_${key}` : statMap[cat] || `p_${key}`;
        }
    };

    const activeMatchup = matchups[selectedMatchupIndex];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Matchups</h1>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-purple-300">Week:</span>
                        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                            <SelectTrigger className="w-[120px] bg-slate-800/60 border-purple-500/30 text-white">
                                <SelectValue placeholder="Select Week" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableWeeks.map(w => (
                                    <SelectItem key={w} value={w.toString()}>Week {w}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Matchup Carousel */}
                {matchups.length > 0 && (
                    <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-thin scrollbar-thumb-purple-500/50">
                        {matchups.map((match, idx) => {
                            const isSelected = idx === selectedMatchupIndex;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedMatchupIndex(idx)}
                                    className={`
                                    min-w-[280px] cursor-pointer rounded-lg border p-3 flex flex-col justify-center transition-all
                                    ${isSelected
                                            ? 'bg-purple-600/30 border-purple-400 shadow-md ring-1 ring-purple-400'
                                            : 'bg-slate-800/60 border-purple-500/30 hover:border-purple-400/50 hover:bg-slate-800/80'
                                        }
                                `}
                                >
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex flex-col gap-0.5 truncate max-w-[100px]">
                                            <span className="truncate text-purple-100 font-semibold">{match.manager1.nickname}</span>
                                            <span className="truncate text-purple-300/70 text-xs">{match.manager1.team_name}</span>
                                        </div>
                                        <div className="flex flex-col items-center px-2">
                                            <span className="text-purple-400 text-xs">vs</span>
                                            <div className="flex items-center gap-1 text-purple-100 font-bold text-sm">
                                                <span>{match.score_a || 0}</span>
                                                <span className="text-purple-400">-</span>
                                                <span>{match.score_b || 0}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-0.5 truncate max-w-[100px] text-right">
                                            <span className="truncate text-purple-100 font-semibold">{match.manager2.nickname}</span>
                                            <span className="truncate text-purple-300/70 text-xs">{match.manager2.team_name}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {matchups.length === 0 ? (
                    <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl p-12">
                        <p className="text-center text-purple-300">No matchups found for this week.</p>
                    </div>
                ) : activeMatchup && (
                    <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600/80 to-blue-600/80 backdrop-blur-sm p-6 border-b border-purple-400/30">
                            <div className="flex justify-between items-center px-2 md:px-8">
                                {/* Manager 1 */}
                                <div className="flex items-center gap-3 md:gap-4 flex-1">
                                    <div className="min-w-0">
                                        <div className="font-bold text-lg md:text-xl truncate text-white">{activeMatchup.manager1.nickname}</div>
                                        <div className="text-xs md:text-sm text-purple-200 truncate">{activeMatchup.manager1.team_name}</div>
                                    </div>
                                </div>

                                <div className="px-4 text-center shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="text-3xl md:text-4xl font-black text-white">{activeMatchup.score_a || 0}</div>
                                        <div className="text-xl md:text-2xl font-bold text-white/70">VS</div>
                                        <div className="text-3xl md:text-4xl font-black text-white">{activeMatchup.score_b || 0}</div>
                                    </div>
                                </div>

                                {/* Manager 2 */}
                                <div className="flex items-center gap-3 md:gap-4 flex-1 justify-end text-right">
                                    <div className="min-w-0">
                                        <div className="font-bold text-lg md:text-xl truncate text-white">{activeMatchup.manager2.nickname}</div>
                                        <div className="text-xs md:text-sm text-purple-200 truncate">{activeMatchup.manager2.team_name}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Table */}
                        <div className="overflow-x-auto">
                            {/* Stats Table */}
                            <div className="w-full">
                                <Table>
                                    <TableHeader className="hidden">
                                        <TableRow>
                                            <TableHead className="w-[40%] text-right text-purple-300">Manager 1</TableHead>
                                            <TableHead className="w-[20%] text-center text-purple-300">Category</TableHead>
                                            <TableHead className="w-[40%] text-left text-purple-300">Manager 2</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="divide-y divide-purple-500/10">
                                        {/* Batting Stats */}
                                        <TableRow className="bg-slate-900/40 hover:bg-slate-900/40">
                                            <TableCell colSpan={3} className="font-bold text-center text-xs uppercase tracking-widest text-purple-400 py-2">Batting</TableCell>
                                        </TableRow>
                                        {scroingSettings?.batter_categories?.map(cat => {
                                            const dbCol = getDbCol(cat, 'batter');
                                            const val1 = activeMatchup.manager1_stats[dbCol];
                                            const val2 = activeMatchup.manager2_stats[dbCol];
                                            const abbr = getAbbr(cat);
                                            return (
                                                <TableRow key={cat} className="hover:bg-slate-800/30 border-0">
                                                    <TableCell className="w-[40%] text-right font-mono text-lg md:text-xl font-medium text-purple-100 py-3 pr-8 md:pr-12">{formatStat(val1, dbCol)}</TableCell>
                                                    <TableCell className="w-[20%] text-center font-bold text-sm text-purple-300 uppercase tracking-wider py-3">{abbr}</TableCell>
                                                    <TableCell className="w-[40%] text-left font-mono text-lg md:text-xl font-medium text-purple-100 py-3 pl-8 md:pl-12">{formatStat(val2, dbCol)}</TableCell>
                                                </TableRow>
                                            );
                                        })}

                                        {/* Pitching Stats */}
                                        <TableRow className="bg-slate-900/40 hover:bg-slate-900/40">
                                            <TableCell colSpan={3} className="font-bold text-center text-xs uppercase tracking-widest text-purple-400 py-2 mt-4">Pitching</TableCell>
                                        </TableRow>
                                        {scroingSettings?.pitcher_categories?.map(cat => {
                                            const dbCol = getDbCol(cat, 'pitcher');
                                            const val1 = activeMatchup.manager1_stats[dbCol];
                                            const val2 = activeMatchup.manager2_stats[dbCol];
                                            const abbr = getAbbr(cat);
                                            return (
                                                <TableRow key={cat} className="hover:bg-slate-800/30 border-0">
                                                    <TableCell className="w-[40%] text-right font-mono text-lg md:text-xl font-medium text-purple-100 py-3 pr-8 md:pr-12">{formatStat(val1, dbCol)}</TableCell>
                                                    <TableCell className="w-[20%] text-center font-bold text-sm text-purple-300 uppercase tracking-wider py-3">{abbr}</TableCell>
                                                    <TableCell className="w-[40%] text-left font-mono text-lg md:text-xl font-medium text-purple-100 py-3 pl-8 md:pl-12">{formatStat(val2, dbCol)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
