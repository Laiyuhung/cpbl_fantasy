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

    // Fetch available weeks (assuming standard 23 weeks or fetch from schedule if possible)
    // For now we'll just generate 1-23. ideally we fetch from league_schedule
    useEffect(() => {
        const weeks = Array.from({ length: 23 }, (_, i) => i + 1);
        setAvailableWeeks(weeks);
        // TODO: Fetch current week from API or calculate it
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
    }, [leagueId, selectedWeek]);

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-64 bg-gray-200 rounded animate-pulse" />
            </div>
        );
    }

    // Display Helper for categories with custom formatting
    const formatStat = (val, cat) => {
        if (val === undefined || val === null) return '0';
        if (['b_avg', 'b_obp', 'b_slg', 'b_ops', 'p_era', 'p_whip', 'p_win%'].includes(cat)) {
            return Number(val).toFixed(3);
        }
        return val;
    };

    // Mapping display names to db columns
    const statMap = {
        // Batting
        'H/AB': 'b_avg', // Special handling usually, but here we use avg
        'AVG': 'b_avg',
        'R': 'b_r',
        'H': 'b_h',
        '1B': 'b_1b',
        '2B': 'b_2b',
        '3B': 'b_3b',
        'HR': 'b_hr',
        'XBH': 'b_xbh',
        'TB': 'b_tb',
        'RBI': 'b_rbi',
        'BB': 'b_bb',
        'IBB': 'b_ibb',
        'HBP': 'b_hbp',
        'K': 'b_k',
        'SB': 'b_sb',
        'CS': 'b_cs',
        'SH': 'b_sh',
        'SF': 'b_sf',
        'GIDP': 'b_gidp',
        'E': 'b_e',
        'CYC': 'b_cyc',
        'OBP': 'b_obp',
        'SLG': 'b_slg',
        'OPS': 'b_ops',

        // Pitching
        'IP': 'p_ip', // decimal
        'W': 'p_w',
        'L': 'p_l',
        'SV': 'p_sv',
        'HLD': 'p_hld',
        'SV+HLD': 'p_svhld',
        'K': 'p_k_pitching', // Disambiguate? DB cols are specific: p_k
        'ERA': 'p_era',
        'WHIP': 'p_whip',
        'K/9': 'p_k/9',
        'BB/9': 'p_bb/9',
        'K/BB': 'p_k/bb',
        'QS': 'p_qs',
        'CG': 'p_cg',
        'SHO': 'p_sho',
        'NH': 'p_nh',
        'PG': 'p_pg',
        'APP': 'p_app',
        'GS': 'p_gs',
    };

    const getDbCol = (cat, type) => {
        // Map frontend category label (e.g. "HR") to DB view column (e.g. "b_hr")
        if (type === 'batter') {
            // Simple mapping or lookup
            const key = cat.toLowerCase();
            return `b_${key}` in { b_r: 1, b_h: 1, b_hr: 1, b_rbi: 1, b_sb: 1, b_avg: 1, b_obp: 1, b_ops: 1 } ? `b_${key}` : statMap[cat] || `b_${key}`;
        } else {
            const key = cat.toLowerCase();
            return `p_${key}` in { p_w: 1, p_l: 1, p_sv: 1, p_k: 1, p_era: 1, p_whip: 1 } ? `p_${key}` : statMap[cat] || `p_${key}`;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Matchups</h1>
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Week:</span>
                    <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                        <SelectTrigger className="w-[120px]">
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

            {matchups.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                        <p>No matchups found for this week.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-8">
                    {matchups.map((match, idx) => (
                        <Card key={idx} className="overflow-hidden border-2">
                            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b p-4">
                                <div className="flex justify-between items-center px-4">
                                    <div className="text-xl font-bold flex items-center gap-2">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                            {/* Avatar placeholder */}
                                            {match.manager1.avatar_url ? (
                                                <img src={match.manager1.avatar_url} alt="Avt" />
                                            ) : (
                                                <span>{match.manager1.nickname?.[0]}</span>
                                            )}
                                        </div>
                                        <div>
                                            <div>{match.manager1.items?.team_name || match.manager1.nickname}</div>
                                            <div className='text-xs font-normal text-muted-foreground'>Manager</div>
                                        </div>
                                    </div>

                                    <div className="text-2xl font-black text-slate-300">VS</div>

                                    <div className="text-xl font-bold flex items-center gap-2 flex-row-reverse text-right">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                            {match.manager2.avatar_url ? (
                                                <img src={match.manager2.avatar_url} alt="Avt" />
                                            ) : (
                                                <span>{match.manager2.nickname?.[0]}</span>
                                            )}
                                        </div>
                                        <div>
                                            <div>{match.manager2.items?.team_name || match.manager2.nickname}</div>
                                            <div className='text-xs font-normal text-muted-foreground'>Manager</div>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {/* Stats Table */}
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[150px]">Category</TableHead>
                                                <TableHead className="text-center w-1/3 text-lg font-semibold bg-slate-50/50">{match.manager1.nickname}</TableHead>
                                                <TableHead className="text-center w-1/3 text-lg font-semibold bg-slate-50/50">{match.manager2.nickname}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {/* Batting Stats */}
                                            <TableRow className="bg-slate-100 dark:bg-slate-800"><TableCell colSpan={3} className="font-bold text-center text-xs uppercase tracking-widest text-muted-foreground p-1">Batting</TableCell></TableRow>
                                            {scroingSettings?.batter_categories?.map(cat => {
                                                const dbCol = getDbCol(cat, 'batter');
                                                const val1 = match.manager1_stats[dbCol];
                                                const val2 = match.manager2_stats[dbCol];
                                                // Simple win highlight logic? Maybe later.
                                                return (
                                                    <TableRow key={cat}>
                                                        <TableCell className="font-medium text-muted-foreground">{cat}</TableCell>
                                                        <TableCell className="text-center font-mono text-lg">{formatStat(val1, dbCol)}</TableCell>
                                                        <TableCell className="text-center font-mono text-lg">{formatStat(val2, dbCol)}</TableCell>
                                                    </TableRow>
                                                );
                                            })}

                                            {/* Pitching Stats */}
                                            <TableRow className="bg-slate-100 dark:bg-slate-800"><TableCell colSpan={3} className="font-bold text-center text-xs uppercase tracking-widest text-muted-foreground p-1">Pitching</TableCell></TableRow>
                                            {scroingSettings?.pitcher_categories?.map(cat => {
                                                const dbCol = getDbCol(cat, 'pitcher');
                                                const val1 = match.manager1_stats[dbCol];
                                                const val2 = match.manager2_stats[dbCol];
                                                return (
                                                    <TableRow key={cat}>
                                                        <TableCell className="font-medium text-muted-foreground">{cat}</TableCell>
                                                        <TableCell className="text-center font-mono text-lg">{formatStat(val1, dbCol)}</TableCell>
                                                        <TableCell className="text-center font-mono text-lg">{formatStat(val2, dbCol)}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
