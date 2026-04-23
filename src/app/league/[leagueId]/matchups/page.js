'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatStatDisplayValue } from '@/lib/statDisplayFormat';

export default function MatchupsPage() {
    const params = useParams();
    const leagueId = params.leagueId;

    const [loading, setLoading] = useState(true);
    const [matchups, setMatchups] = useState([]);
    const [scroingSettings, setScoringSettings] = useState(null);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [availableWeeks, setAvailableWeeks] = useState([]);
    const [currentManagerId, setCurrentManagerId] = useState(null);
    const [selectedMatchupIndex, setSelectedMatchupIndex] = useState(0);
    const [scheduleData, setScheduleData] = useState([]);
    const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('categories'); // 'categories' or 'stats'
    const [playerStats, setPlayerStats] = useState({ batting: [], pitching: [] });
    const [playerStatsLoading, setPlayerStatsLoading] = useState(false);
    const [bootstrapReady, setBootstrapReady] = useState(false);
    const [loadedWeek, setLoadedWeek] = useState('');

    // Get current user's manager ID
    useEffect(() => {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        if (cookie) {
            setCurrentManagerId(cookie.split('=')[1]);
        }
    }, []);

    // Fetch bootstrap data and determine current week
    useEffect(() => {
        if (!leagueId) return;

        const fetchLeagueData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/league/${leagueId}/matchups/stats?metaOnly=1`);
                const result = await response.json();

                if (result.success) {
                    setScheduleData(result.schedule || []);

                    const weeks = Array.isArray(result.availableWeeks)
                        ? result.availableWeeks
                        : (result.schedule || []).map(w => w.week_number);
                    setAvailableWeeks(weeks);

                    if (result.selectedWeek) {
                        const initialWeek = String(result.selectedWeek);
                        setSelectedWeek(initialWeek);
                        setLoadedWeek('');
                    }
                }
            } catch (error) {
                console.error("Error loading matchup bootstrap:", error);
            } finally {
                setLoading(false);
                setBootstrapReady(true);
            }
        };

        fetchLeagueData();
    }, [leagueId]);

    useEffect(() => {
        if (!bootstrapReady || !leagueId || !selectedWeek) return;
        if (selectedWeek === loadedWeek) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/league/${leagueId}/matchups/stats?week=${selectedWeek}`);
                const data = await res.json();

                if (data.success) {
                    setMatchups(data.matchups);
                    setScoringSettings(data.settings);
                    setLoadedWeek(String(selectedWeek));
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
    }, [bootstrapReady, leagueId, selectedWeek, loadedWeek]);

    // Fetch player stats when tab switches to 'stats' or matchup changes
    useEffect(() => {
        if (activeTab !== 'stats' || !leagueId || !selectedWeek || !matchups[selectedMatchupIndex]) return;

        const fetchPlayerStats = async () => {
            setPlayerStatsLoading(true);
            try {
                const res = await fetch(`/api/league/${leagueId}/matchups/player-stats?week=${selectedWeek}`);
                const data = await res.json();
                if (data.success) {
                    setPlayerStats({ batting: data.batting || [], pitching: data.pitching || [] });
                }
            } catch (error) {
                console.error('Error fetching player stats:', error);
            } finally {
                setPlayerStatsLoading(false);
            }
        };
        fetchPlayerStats();
    }, [activeTab, leagueId, selectedWeek, selectedMatchupIndex, matchups]);

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

    // Display Helper - 直接顯示後端的值
    const formatStat = (val, cat, stats = null) => {
        // K/BB: BB=0 且 K>0 時顯示 INF
        if (cat === 'p_k/bb') {
            const k = Number(stats?.p_k);
            const bb = Number(stats?.p_bb);
            if (Number.isFinite(k) && Number.isFinite(bb) && bb === 0 && k > 0) {
                return 'INF';
            }
            if (val === null || val === undefined) {
                return 'INF';
            }
        }

        // 如果值為 undefined 或 null，顯示 0
        if (val === undefined || val === null) {
            return '0';
        }

        const formatted = formatStatDisplayValue(val, cat);
        return formatted !== val ? formatted : val;
    };

    const getAbbr = (cat) => {
        const match = cat.match(/\(([^)]+)\)[^(]*$/);
        return match ? match[1] : cat;
    };


    const getDbCol = (cat, type) => {
        // 提取縮寫並轉小寫
        const abbr = getAbbr(cat).toLowerCase();

        const mappedAbbr = {
            'sv+hld': 'svhld',
            'out': 'outs',
        }[abbr] || abbr;

        // 直接加上前綴
        const prefix = type === 'batter' ? 'b_' : 'p_';
        return `${prefix}${mappedAbbr}`;
    };

    // Team abbreviation helper
    const getTeamAbbr = (team) => {
        switch (team) {
            case '統一獅': return 'UL';
            case '富邦悍將': return 'FG';
            case '樂天桃猿': return 'RM';
            case '中信兄弟': return 'B';
            case '味全龍': return 'W';
            case '台鋼雄鷹': return 'TSG';
            default: return team?.substring(0, 2) || '-';
        }
    };

    const getTeamColor = (team) => {
        switch (team) {
            case '統一獅': return 'text-orange-400';
            case '富邦悍將': return 'text-blue-400';
            case '樂天桃猿': return 'text-rose-400';
            case '中信兄弟': return 'text-yellow-400';
            case '味全龍': return 'text-red-400';
            case '台鋼雄鷹': return 'text-green-400';
            default: return 'text-slate-400';
        }
    };

    // Get stat value from player data
    const getStatValue = (stat, abbr) => {
        const key = abbr.toLowerCase();
        if (key === 'fp') {
            if (stat.fp === null || stat.fp === undefined) return '-';
            const parsed = Number(stat.fp);
            return Number.isFinite(parsed) ? parsed.toFixed(2) : '-';
        }
        const val = key === 'out' ? (stat.outs ?? stat.out) : stat[key];
        if (key === 'ip') {
            return stat.ip_display ?? '0.0';
        }
        if (key === 'k/bb') {
            const k = Number(stat.k);
            const bb = Number(stat.bb);
            if (Number.isFinite(k) && Number.isFinite(bb) && bb === 0 && k > 0) {
                return 'INF';
            }
            return val === null || val === undefined ? 'INF' : val;
        }

        if (val === null || val === undefined) {
            return 0;
        }

        const formatted = formatStatDisplayValue(val, abbr);
        return formatted !== val ? formatted : val;
    };

    // Build batter columns: AB + league categories
    const isFantasyPoints = scroingSettings?.scoring_type === 'Head-to-Head Fantasy Points';
    const hasABCategory = (scroingSettings?.batter_categories || []).some(
        (cat) => getAbbr(cat).toLowerCase() === 'ab'
    );
    const batterColumns = [
        ...(isFantasyPoints ? ['FP'] : []),
        ...(hasABCategory ? [] : ['AB']),
        ...(scroingSettings?.batter_categories?.map(cat => getAbbr(cat)) || []),
    ];

    // Build pitcher columns: IP + league categories  
    const hasIPCategory = (scroingSettings?.pitcher_categories || []).some(
        (cat) => getAbbr(cat).toLowerCase() === 'ip'
    );
    const pitcherColumns = [
        ...(isFantasyPoints ? ['FP'] : []),
        ...(hasIPCategory ? [] : ['IP']),
        ...(scroingSettings?.pitcher_categories?.map(cat => getAbbr(cat)) || []),
    ];

    const activeMatchup = matchups[selectedMatchupIndex];

    const parseBaseballInnings = (value) => {
        if (value === null || value === undefined || value === '') return 0;
        const raw = String(value).trim();
        const [inningPartRaw, outPartRaw = '0'] = raw.split('.');
        const innings = Number(inningPartRaw);
        const outs = Number(outPartRaw);
        if (!Number.isFinite(innings)) return 0;
        if (!Number.isFinite(outs)) return innings;
        const safeOuts = Math.max(0, Math.min(2, outs));
        return innings + safeOuts / 3;
    };

    const minPitchingInnings = Number(scroingSettings?.min_innings_pitched_per_week || 0);
    const selectedWeekSchedule = scheduleData.find((w) => w.week_number === parseInt(selectedWeek));
    const isPastWeek = (() => {
        if (!selectedWeekSchedule?.week_end) return false;
        const now = new Date();
        const weekEnd = new Date(selectedWeekSchedule.week_end);
        weekEnd.setHours(23, 59, 59, 999);
        return now > weekEnd;
    })();

    const manager1IPValue = parseBaseballInnings(activeMatchup?.manager1_stats?.p_ip);
    const manager2IPValue = parseBaseballInnings(activeMatchup?.manager2_stats?.p_ip);
    const manager1PitchingJudged = isPastWeek && minPitchingInnings > 0 && manager1IPValue < minPitchingInnings;
    const manager2PitchingJudged = isPastWeek && minPitchingInnings > 0 && manager2IPValue < minPitchingInnings;

    const getPitchingValueCellClass = ({ side, dbCol, winner }) => {
        const isIPCategory = dbCol?.toLowerCase() === 'p_ip';
        const sideJudged = side === 1 ? manager1PitchingJudged : manager2PitchingJudged;
        const opponentJudged = side === 1 ? manager2PitchingJudged : manager1PitchingJudged;

        if (sideJudged) {
            if (isIPCategory) return 'bg-red-600 text-white font-black rounded px-2';
            return 'text-gray-400';
        }

        if (!sideJudged && !opponentJudged && winner === side) {
            return 'text-yellow-300 font-bold';
        }

        if (opponentJudged && !sideJudged) {
            return 'text-yellow-300 font-bold';
        }

        return 'text-purple-100';
    };

    // Helper to determine if higher is better for a stat
    const isHigherBetter = (dbCol) => {
        const col = dbCol.toLowerCase();
        
        // Pitcher stats where LOWER is better
        const pitcherLowerIsBetter = {
            'p_l': true,        // Losses
            'p_rl': true,       // Relief Losses
            'p_h': true,        // Hits
            'p_hr': true,       // Home Runs
            'p_bb': true,       // Walks
            'p_ibb': true,      // Intentional Walks
            'p_hbp': true,      // Hit Batters
            'p_ra': true,       // Runs Allowed
            'p_er': true,       // Earned Runs
            'p_era': true,      // ERA
            'p_whip': true,     // WHIP
            'p_bb/9': true,     // Walks Per 9 Innings
            'p_h/9': true,      // Hits Per 9 Innings
            'p_obpa': true      // On-base Percentage Against
        };
        
        // Batter stats where LOWER is better
        const batterLowerIsBetter = {
            'b_k': true,        // Strikeouts
            'b_so': true,       // Strikeouts (alternate)
            'b_cs': true,       // Caught Stealing
            'b_gidp': true      // Ground Into Double Play
        };
        
        return !(pitcherLowerIsBetter[col] || batterLowerIsBetter[col]);
    };

    // Helper to determine category winner (handles INF values)
    const isInfValue = (val, dbCol, stats = null) => {
        if (val === 'INF') return true;

        // K/BB can be represented as INF even when backend value is null.
        if (dbCol?.toLowerCase() === 'p_k/bb') {
            const k = Number(stats?.p_k);
            const bb = Number(stats?.p_bb);
            if (Number.isFinite(k) && Number.isFinite(bb) && bb === 0 && k > 0) {
                return true;
            }
            if (val === null || val === undefined) {
                return true;
            }
        }

        return false;
    };

    const getWinningValue = (val1, val2, dbCol, stats1 = null, stats2 = null) => {
        const col = dbCol.toLowerCase();
        
        // Handle INF values - INF is always the best (only for K/BB)
        const isINF1 = isInfValue(val1, dbCol, stats1);
        const isINF2 = isInfValue(val2, dbCol, stats2);
        
        if (isINF1 && !isINF2) return 1;
        if (isINF2 && !isINF1) return 2;
        if (isINF1 && isINF2) return null; // Tie
        
        const parsed1 = Number(val1);
        const parsed2 = Number(val2);
        const num1 = Number.isFinite(parsed1) ? parsed1 : 0;
        const num2 = Number.isFinite(parsed2) ? parsed2 : 0;
        
        if (num1 === num2) return null; // Tie
        
        if (isHigherBetter(col)) {
            return num1 > num2 ? 1 : (num2 > num1 ? 2 : null);
        } else {
            return num1 < num2 ? 1 : (num2 < num1 ? 2 : null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8">
                <div className="flex items-center justify-between gap-2">
                    <h1 className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Matchups</h1>
                    <div className="relative flex items-center bg-slate-800/80 rounded-full p-1.5 border border-white/10 shadow-lg">
                        <button
                            onClick={() => {
                                const currentIndex = availableWeeks.indexOf(parseInt(selectedWeek));
                                if (currentIndex > 0) {
                                    setSelectedWeek(availableWeeks[currentIndex - 1].toString());
                                }
                            }}
                            disabled={availableWeeks.indexOf(parseInt(selectedWeek)) <= 0 || loading}
                            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>

                        <button
                            onClick={() => setWeekDropdownOpen(!weekDropdownOpen)}
                            className="flex flex-col items-center min-w-[100px] sm:min-w-[160px] px-2 sm:px-4 hover:bg-white/5 rounded-2xl py-1 transition-all group"
                        >
                            <div className="flex items-center gap-1 sm:gap-2">
                                <span className="text-sm sm:text-lg font-black text-white tracking-wide group-hover:text-cyan-300 transition-colors">
                                    WEEK {selectedWeek || '-'}
                                </span>
                                <svg className={`w-4 h-4 text-white/50 transition-transform duration-300 ${weekDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                            {scheduleData.find(w => w.week_number === parseInt(selectedWeek)) && (
                                <span className="text-[10px] sm:text-xs font-bold text-cyan-300/80 uppercase tracking-widest">
                                    {new Date(scheduleData.find(w => w.week_number === parseInt(selectedWeek)).week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(scheduleData.find(w => w.week_number === parseInt(selectedWeek)).week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => {
                                const currentIndex = availableWeeks.indexOf(parseInt(selectedWeek));
                                if (currentIndex < availableWeeks.length - 1) {
                                    setSelectedWeek(availableWeeks[currentIndex + 1].toString());
                                }
                            }}
                            disabled={availableWeeks.indexOf(parseInt(selectedWeek)) >= availableWeeks.length - 1 || loading}
                            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>

                        {/* Custom Dropdown Content */}
                        {weekDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-[100]" onClick={() => setWeekDropdownOpen(false)}></div>
                                <div className="fixed sm:absolute top-1/2 sm:top-full left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-y-0 sm:mt-4 w-[calc(100vw-2rem)] sm:w-[280px] max-w-[320px] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[101] overflow-hidden animate-in fade-in zoom-in duration-200">
                                    <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto py-2 px-2 custom-scrollbar">
                                        {scheduleData.map((week) => (
                                            <button
                                                key={week.week_number}
                                                onClick={() => {
                                                    setSelectedWeek(week.week_number.toString());
                                                    setWeekDropdownOpen(false);
                                                }}
                                                className={`w-full flex flex-col items-start px-4 py-3 rounded-xl transition-all mb-1 ${parseInt(selectedWeek) === week.week_number
                                                    ? 'bg-purple-600/30 border border-purple-500/50'
                                                    : 'hover:bg-white/5 border border-transparent'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className={`text-sm font-black ${parseInt(selectedWeek) === week.week_number ? 'text-white' : 'text-white/70'}`}>
                                                        WEEK {week.week_number}
                                                    </span>
                                                    {parseInt(selectedWeek) === week.week_number && (
                                                        <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {new Date(week.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(week.week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase ${week.week_type === 'playoffs' ? 'bg-purple-500/20 text-purple-400' :
                                                        week.week_type === 'makeup' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            'bg-blue-500/10 text-blue-400'
                                                        }`}>
                                                        {week.week_type === 'regular_season' ? 'Reg' : week.week_type === 'playoffs' ? 'Post' : 'Mkp'}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Score Update Hint */}
                <div className="flex items-center justify-center gap-2 text-sm text-slate-300/60">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    <span>Score updates every 5 minutes</span>
                </div>

                {/* Matchup Carousel */}
                {loading ? (
                    <div className="w-full h-64 bg-white/5 rounded-3xl animate-pulse border border-white/5 flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-purple-300 font-bold tracking-widest uppercase text-sm">Loading Matchups...</span>
                    </div>
                ) : matchups.length > 0 && (
                    <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-thin scrollbar-thumb-purple-500/50">
                        {matchups.map((match, idx) => {
                            const isSelected = idx === selectedMatchupIndex;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedMatchupIndex(idx)}
                                    className={`
                                    min-w-[220px] sm:min-w-[280px] cursor-pointer rounded-lg border p-2.5 sm:p-3 flex flex-col justify-center transition-all
                                    ${isSelected
                                            ? 'bg-purple-600/30 border-purple-400 shadow-md ring-1 ring-purple-400'
                                            : 'bg-slate-800/60 border-purple-500/30 hover:border-purple-400/50 hover:bg-slate-800/80'
                                        }
                                `}
                                >
                                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
                                        <div className="min-w-0 flex flex-col gap-0.5 text-left">
                                            <span className="text-purple-100 font-semibold text-xs sm:text-sm break-words leading-tight">{match.manager1.nickname}</span>
                                            <span className="truncate text-cyan-300 text-xs font-bold">{match.manager1.record}</span>
                                        </div>
                                        <div className="flex flex-col items-center px-1 sm:px-2 min-w-[72px]">
                                            <span className="text-purple-400 text-xs">vs</span>
                                            <div className="flex items-center gap-1 text-purple-100 font-bold text-sm">
                                                <span>{match.score_a || 0}</span>
                                                <span className="text-purple-400">-</span>
                                                <span>{match.score_b || 0}</span>
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex flex-col gap-0.5 text-right items-end">
                                            <span className="text-purple-100 font-semibold text-xs sm:text-sm break-words leading-tight">{match.manager2.nickname}</span>
                                            <span className="truncate text-cyan-300 text-xs font-bold">{match.manager2.record}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!loading && matchups.length === 0 ? (
                    <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl p-12">
                        <p className="text-center text-purple-300">No matchups found for this week.</p>
                    </div>
                ) : !loading && activeMatchup && (
                    <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600/80 to-blue-600/80 backdrop-blur-sm p-3 sm:p-6 border-b border-purple-400/30">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4 px-2 md:px-8">
                                {/* Manager 1 */}
                                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                            <div className="font-bold text-xs sm:text-base md:text-xl break-words leading-tight text-white">{activeMatchup.manager1.nickname}</div>
                                            <div className="text-[10px] sm:text-sm font-bold text-cyan-300 bg-cyan-500/10 px-1.5 sm:px-2 py-0.5 rounded border border-cyan-500/20">{activeMatchup.manager1.record}</div>
                                        </div>
                                        <div className="text-[10px] sm:text-xs md:text-sm text-purple-200 break-words leading-tight">{activeMatchup.manager1.team_name}</div>
                                    </div>
                                </div>

                                <div className="px-2 sm:px-4 text-center shrink-0">
                                    <div className="flex items-center gap-1.5 sm:gap-3">
                                        <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white">{activeMatchup.score_a || 0}</div>
                                        <div className="text-base sm:text-xl md:text-2xl font-bold text-white/70">VS</div>
                                        <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white">{activeMatchup.score_b || 0}</div>
                                    </div>
                                </div>

                                {/* Manager 2 */}
                                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 justify-end text-right">
                                    <div className="min-w-0 flex flex-col items-end">
                                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
                                            <div className="text-[10px] sm:text-sm font-bold text-cyan-300 bg-cyan-500/10 px-1.5 sm:px-2 py-0.5 rounded border border-cyan-500/20">{activeMatchup.manager2.record}</div>
                                            <div className="font-bold text-xs sm:text-base md:text-xl break-words leading-tight text-white">{activeMatchup.manager2.nickname}</div>
                                        </div>
                                        <div className="text-[10px] sm:text-xs md:text-sm text-purple-200 break-words leading-tight">{activeMatchup.manager2.team_name}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex justify-center border-b border-purple-500/20 bg-slate-900/50">
                            <button
                                onClick={() => setActiveTab('categories')}
                                className={`px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'categories'
                                    ? 'text-purple-300 border-b-2 border-purple-500 bg-purple-500/10'
                                    : 'text-slate-400 hover:text-purple-300 hover:bg-purple-500/5'
                                    }`}
                            >
                                Categories
                            </button>
                            <button
                                onClick={() => setActiveTab('stats')}
                                className={`px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'stats'
                                    ? 'text-cyan-300 border-b-2 border-cyan-500 bg-cyan-500/10'
                                    : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/5'
                                    }`}
                            >
                                Player Stats
                            </button>
                        </div>

                        {/* Categories Tab Content */}
                        {activeTab === 'categories' && (
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
                                            {/* AB - 只在不是計分項目時顯示 */}
                                            {!scroingSettings?.batter_categories?.some(cat => getAbbr(cat).toLowerCase() === 'ab') && (
                                                <TableRow className="hover:bg-slate-800/30 border-0">
                                                    <TableCell className="w-[40%] text-right font-mono text-base sm:text-lg md:text-xl font-medium text-gray-400 py-2 sm:py-3 pr-4 sm:pr-8 md:pr-12">{activeMatchup.manager1_stats.b_ab || 0}</TableCell>
                                                    <TableCell className="w-[20%] text-center font-bold text-xs sm:text-sm text-gray-400 uppercase tracking-wider py-2 sm:py-3">AB</TableCell>
                                                    <TableCell className="w-[40%] text-left font-mono text-base sm:text-lg md:text-xl font-medium text-gray-400 py-2 sm:py-3 pl-4 sm:pl-8 md:pl-12">{activeMatchup.manager2_stats.b_ab || 0}</TableCell>
                                                </TableRow>
                                            )}
                                            {scroingSettings?.batter_categories?.map(cat => {
                                                const dbCol = getDbCol(cat, 'batter');
                                                const val1 = activeMatchup.manager1_stats[dbCol];
                                                const val2 = activeMatchup.manager2_stats[dbCol];
                                                const abbr = getAbbr(cat);
                                                const weight = scroingSettings?.category_weights?.batter?.[cat];
                                                const isFantasyPoints = scroingSettings?.scoring_type === 'Head-to-Head Fantasy Points';
                                                const winner = getWinningValue(val1, val2, dbCol, activeMatchup.manager1_stats, activeMatchup.manager2_stats);
                                                return (
                                                    <TableRow key={cat} className="hover:bg-slate-800/30 border-0">
                                                        <TableCell className={`w-[40%] text-right font-mono text-base sm:text-lg md:text-xl font-medium py-2 sm:py-3 pr-4 sm:pr-8 md:pr-12 ${winner === 1 ? 'text-yellow-300 font-bold' : 'text-purple-100'}`}>{formatStat(val1, dbCol, activeMatchup.manager1_stats)}</TableCell>
                                                        <TableCell className="w-[20%] text-center py-2 sm:py-3">
                                                            <span className="font-bold text-xs sm:text-sm text-purple-300 uppercase tracking-wider">{abbr}</span>
                                                            {isFantasyPoints && weight !== undefined && (
                                                                <span className="ml-1 text-xs text-yellow-300 font-bold">x{weight}</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className={`w-[40%] text-left font-mono text-base sm:text-lg md:text-xl font-medium py-2 sm:py-3 pl-4 sm:pl-8 md:pl-12 ${winner === 2 ? 'text-yellow-300 font-bold' : 'text-purple-100'}`}>{formatStat(val2, dbCol, activeMatchup.manager2_stats)}</TableCell>
                                                    </TableRow>
                                                );
                                            })}


                                            {/* Pitching Stats */}
                                            <TableRow className="bg-slate-900/40 hover:bg-slate-900/40">
                                                <TableCell colSpan={3} className="font-bold text-center text-xs uppercase tracking-widest text-purple-400 py-2 mt-4">Pitching</TableCell>
                                            </TableRow>
                                            {/* IP - 只在不是計分項目時顯示 */}
                                            {!scroingSettings?.pitcher_categories?.some(cat => getAbbr(cat).toLowerCase() === 'ip') && (
                                                <TableRow className="hover:bg-slate-800/30 border-0">
                                                    <TableCell className={`w-[40%] text-right font-mono text-base sm:text-lg md:text-xl font-medium py-2 sm:py-3 pr-4 sm:pr-8 md:pr-12 ${manager1PitchingJudged ? 'bg-red-600 text-white font-black rounded px-2' : 'text-gray-400'}`}>{activeMatchup.manager1_stats.p_ip || '0.0'}</TableCell>
                                                    <TableCell className="w-[20%] text-center font-bold text-xs sm:text-sm text-gray-400 uppercase tracking-wider py-2 sm:py-3">IP</TableCell>
                                                    <TableCell className={`w-[40%] text-left font-mono text-base sm:text-lg md:text-xl font-medium py-2 sm:py-3 pl-4 sm:pl-8 md:pl-12 ${manager2PitchingJudged ? 'bg-red-600 text-white font-black rounded px-2' : 'text-gray-400'}`}>{activeMatchup.manager2_stats.p_ip || '0.0'}</TableCell>
                                                </TableRow>
                                            )}
                                            {scroingSettings?.pitcher_categories?.map(cat => {
                                                const dbCol = getDbCol(cat, 'pitcher');
                                                const val1 = activeMatchup.manager1_stats[dbCol];
                                                const val2 = activeMatchup.manager2_stats[dbCol];
                                                const abbr = getAbbr(cat);
                                                const weight = scroingSettings?.category_weights?.pitcher?.[cat];
                                                const isFantasyPoints = scroingSettings?.scoring_type === 'Head-to-Head Fantasy Points';
                                                let winner = getWinningValue(val1, val2, dbCol, activeMatchup.manager1_stats, activeMatchup.manager2_stats);

                                                if (isPastWeek) {
                                                    if (manager1PitchingJudged && manager2PitchingJudged) {
                                                        winner = null;
                                                    } else if (manager1PitchingJudged && !manager2PitchingJudged) {
                                                        winner = 2;
                                                    } else if (manager2PitchingJudged && !manager1PitchingJudged) {
                                                        winner = 1;
                                                    }
                                                }

                                                const cellClass1 = getPitchingValueCellClass({ side: 1, dbCol, winner });
                                                const cellClass2 = getPitchingValueCellClass({ side: 2, dbCol, winner });
                                                return (
                                                    <TableRow key={cat} className="hover:bg-slate-800/30 border-0">
                                                        <TableCell className={`w-[40%] text-right font-mono text-base sm:text-lg md:text-xl font-medium py-2 sm:py-3 pr-4 sm:pr-8 md:pr-12 ${cellClass1}`}>{formatStat(val1, dbCol, activeMatchup.manager1_stats)}</TableCell>
                                                        <TableCell className="w-[20%] text-center py-2 sm:py-3">
                                                            <span className="font-bold text-xs sm:text-sm text-purple-300 uppercase tracking-wider">{abbr}</span>
                                                            {isFantasyPoints && weight !== undefined && (
                                                                <span className="ml-1 text-xs text-yellow-300 font-bold">x{weight}</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className={`w-[40%] text-left font-mono text-base sm:text-lg md:text-xl font-medium py-2 sm:py-3 pl-4 sm:pl-8 md:pl-12 ${cellClass2}`}>{formatStat(val2, dbCol, activeMatchup.manager2_stats)}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Stats Tab Content - Player Level Stats */}
                        {activeTab === 'stats' && (
                            <div className="p-4">
                                {playerStatsLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                        <span className="text-cyan-300 font-bold">Loading Player Stats...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {/* Manager 1 Batting */}
                                        <div>
                                            <h3 className="text-base sm:text-lg font-bold text-purple-300 mb-2 sm:mb-3 flex items-center gap-2">
                                                <span className="w-2 h-5 bg-purple-500 rounded-full"></span>
                                                {activeMatchup.manager1.nickname} - Batting
                                            </h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-800/60 text-purple-300 text-xs uppercase">
                                                            <th className="px-3 py-2 text-left">Player</th>
                                                            {batterColumns.map(col => (
                                                                <th key={col} className={`px-2 py-2 text-center ${col === 'FP' ? 'text-amber-300' : ''}`}>{col}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {playerStats.batting
                                                            .filter(s => s.manager_id === activeMatchup.manager1_id && s.gp > 0)
                                                            .sort((a, b) => (b.ab || 0) - (a.ab || 0))
                                                            .map((stat, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-800/40">
                                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                                        <span className="text-white font-medium">{stat.player_name}</span>
                                                                        <span className={`ml-1 text-xs font-bold ${getTeamColor(stat.player_team)}`}>{getTeamAbbr(stat.player_team)}</span>
                                                                    </td>
                                                                    {batterColumns.map(col => (
                                                                        <td key={col} className={`px-2 py-2 text-center font-mono ${col === 'FP' ? 'text-amber-300 font-black' : 'text-slate-300'}`}>{getStatValue(stat, col)}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        {playerStats.batting.filter(s => s.manager_id === activeMatchup.manager1_id && s.gp > 0).length === 0 && (
                                                            <tr><td colSpan={batterColumns.length + 1} className="text-center py-4 text-slate-500 italic">No batting stats recorded</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Manager 2 Batting */}
                                        <div>
                                            <h3 className="text-base sm:text-lg font-bold text-cyan-300 mb-2 sm:mb-3 flex items-center gap-2">
                                                <span className="w-2 h-5 bg-cyan-500 rounded-full"></span>
                                                {activeMatchup.manager2.nickname} - Batting
                                            </h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-800/60 text-cyan-300 text-xs uppercase">
                                                            <th className="px-3 py-2 text-left">Player</th>
                                                            {batterColumns.map(col => (
                                                                <th key={col} className={`px-2 py-2 text-center ${col === 'FP' ? 'text-amber-300' : ''}`}>{col}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {playerStats.batting
                                                            .filter(s => s.manager_id === activeMatchup.manager2_id && s.gp > 0)
                                                            .sort((a, b) => (b.ab || 0) - (a.ab || 0))
                                                            .map((stat, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-800/40">
                                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                                        <span className="text-white font-medium">{stat.player_name}</span>
                                                                        <span className={`ml-1 text-xs font-bold ${getTeamColor(stat.player_team)}`}>{getTeamAbbr(stat.player_team)}</span>
                                                                    </td>
                                                                    {batterColumns.map(col => (
                                                                        <td key={col} className={`px-2 py-2 text-center font-mono ${col === 'FP' ? 'text-amber-300 font-black' : 'text-slate-300'}`}>{getStatValue(stat, col)}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        {playerStats.batting.filter(s => s.manager_id === activeMatchup.manager2_id && s.gp > 0).length === 0 && (
                                                            <tr><td colSpan={batterColumns.length + 1} className="text-center py-4 text-slate-500 italic">No batting stats recorded</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Manager 1 Pitching */}
                                        <div>
                                            <h3 className="text-base sm:text-lg font-bold text-purple-300 mb-2 sm:mb-3 flex items-center gap-2">
                                                <span className="w-2 h-5 bg-purple-500 rounded-full"></span>
                                                {activeMatchup.manager1.nickname} - Pitching
                                            </h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-800/60 text-purple-300 text-xs uppercase">
                                                            <th className="px-3 py-2 text-left">Player</th>
                                                            {pitcherColumns.map(col => (
                                                                <th key={col} className={`px-2 py-2 text-center ${col === 'FP' ? 'text-amber-300' : ''}`}>{col}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {playerStats.pitching
                                                            .filter(s => s.manager_id === activeMatchup.manager1_id && s.app > 0)
                                                            .sort((a, b) => (b.outs || 0) - (a.outs || 0))
                                                            .map((stat, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-800/40">
                                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                                        <span className="text-white font-medium">{stat.player_name}</span>
                                                                        <span className={`ml-1 text-xs font-bold ${getTeamColor(stat.player_team)}`}>{getTeamAbbr(stat.player_team)}</span>
                                                                    </td>
                                                                    {pitcherColumns.map(col => (
                                                                        <td key={col} className={`px-2 py-2 text-center font-mono ${col === 'FP' ? 'text-amber-300 font-black' : 'text-slate-300'}`}>{getStatValue(stat, col)}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        {playerStats.pitching.filter(s => s.manager_id === activeMatchup.manager1_id && s.app > 0).length === 0 && (
                                                            <tr><td colSpan={pitcherColumns.length + 1} className="text-center py-4 text-slate-500 italic">No pitching stats recorded</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Manager 2 Pitching */}
                                        <div>
                                            <h3 className="text-base sm:text-lg font-bold text-cyan-300 mb-2 sm:mb-3 flex items-center gap-2">
                                                <span className="w-2 h-5 bg-cyan-500 rounded-full"></span>
                                                {activeMatchup.manager2.nickname} - Pitching
                                            </h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-800/60 text-cyan-300 text-xs uppercase">
                                                            <th className="px-3 py-2 text-left">Player</th>
                                                            {pitcherColumns.map(col => (
                                                                <th key={col} className={`px-2 py-2 text-center ${col === 'FP' ? 'text-amber-300' : ''}`}>{col}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {playerStats.pitching
                                                            .filter(s => s.manager_id === activeMatchup.manager2_id && s.app > 0)
                                                            .sort((a, b) => (b.outs || 0) - (a.outs || 0))
                                                            .map((stat, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-800/40">
                                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                                        <span className="text-white font-medium">{stat.player_name}</span>
                                                                        <span className={`ml-1 text-xs font-bold ${getTeamColor(stat.player_team)}`}>{getTeamAbbr(stat.player_team)}</span>
                                                                    </td>
                                                                    {pitcherColumns.map(col => (
                                                                        <td key={col} className={`px-2 py-2 text-center font-mono ${col === 'FP' ? 'text-amber-300 font-black' : 'text-slate-300'}`}>{getStatValue(stat, col)}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        {playerStats.pitching.filter(s => s.manager_id === activeMatchup.manager2_id && s.app > 0).length === 0 && (
                                                            <tr><td colSpan={pitcherColumns.length + 1} className="text-center py-4 text-slate-500 italic">No pitching stats recorded</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
