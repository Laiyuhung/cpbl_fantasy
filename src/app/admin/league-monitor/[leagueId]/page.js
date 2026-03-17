'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AdminLeagueOverviewPage() {
    const params = useParams();
    const router = useRouter();
    const leagueId = params.leagueId;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [league, setLeague] = useState(null);
    const [members, setMembers] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [status, setStatus] = useState('');
    const [categoryWeights, setCategoryWeights] = useState({ batter: {}, pitcher: {} });

    useEffect(() => {
        if (!leagueId) return;
        const fetchData = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`/api/league/${leagueId}`);
                if (res.status === 401 || res.status === 403) {
                    alert('Admin access required');
                    router.push('/admin');
                    return;
                }
                const data = await res.json();
                if (data.success) {
                    setLeague(data.league);
                    setMembers(data.members || []);
                    setSchedule(data.schedule || []);
                    setStatus(data.status || 'unknown');

                    // Fetch weights if H2H Fantasy Points
                    if (data.league?.scoring_type === 'Head-to-Head Fantasy Points') {
                        try {
                            const wRes = await fetch(`/api/league-settings/weights?league_id=${leagueId}`);
                            const wData = await wRes.json();
                            if (wData.success && wData.data) {
                                const batter = {};
                                const pitcher = {};
                                wData.data.forEach(w => {
                                    if (w.category_type === 'batter') batter[w.category_name] = w.weight;
                                    else pitcher[w.category_name] = w.weight;
                                });
                                setCategoryWeights({ batter, pitcher });
                            }
                        } catch (e) {
                            console.error('Failed to fetch weights:', e);
                        }
                    }
                } else {
                    setError(data.error || 'Failed to load league data');
                }
            } catch (err) {
                console.error(err);
                setError('An unexpected error occurred');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [leagueId, router]);

    const getStatusColor = (s) => {
        switch (s) {
            case 'pre-draft': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'post-draft & pre-season': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'drafting now': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'in season': return 'bg-green-100 text-green-800 border-green-300';
            case 'playoffs': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'finished': return 'bg-gray-100 text-gray-600 border-gray-300';
            default: return 'bg-gray-100 text-gray-500 border-gray-300';
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'Commissioner': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'Co-Commissioner': return 'bg-orange-100 text-orange-800 border-orange-300';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    const getWeekTypeColor = (type) => {
        switch (type) {
            case 'regular_season': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'playoffs': return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'makeup': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
            default: return 'bg-gray-50 text-gray-600 border-gray-200';
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
                <div className="font-bold mb-1">Error</div>
                <div className="text-sm">{error}</div>
            </div>
        );
    }

    if (!league) return null;

    const settingsRows = [
        { label: 'League ID', value: <span className="font-mono text-xs text-gray-500">{leagueId}</span> },
        { label: 'Status', value: <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(status)}`}>{status}</span> },
        { label: 'Finalized', value: league.is_finalized ? <span className="text-green-600 font-bold">Yes ✓</span> : <span className="text-gray-400">No</span> },
        { label: 'Scoring Type', value: league.scoring_type || '-' },
        { label: 'Draft Type', value: league.draft_type || '-' },
        { label: 'Live Draft Time', value: formatDateTime(league.live_draft_time) },
        { label: 'Max Teams', value: `${members.length} / ${league.max_teams}` },
        { label: 'Invite Permissions', value: league.invite_permissions || '-' },
        { label: 'Start Scoring On', value: league.start_scoring_on || '-' },
        { label: 'Playoffs', value: league.playoffs || '-' },
        { label: 'Playoff Reseeding', value: league.playoff_reseeding || '-' },
        { label: 'Trade Deadline', value: league.trade_deadline || '-' },
        { label: 'Waiver Type', value: league.waiver_type || '-' },
        { label: 'FA Acquisition', value: league.fa_acquisition || '-' },
        { label: 'Created At', value: formatDateTime(league.created_at) },
    ];

    return (
        <div className="space-y-6">
            {/* Header: league name + quick link */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900">{league.league_name}</h2>
                    <p className="text-sm text-gray-400 mt-0.5">League Overview — Admin Read-Only View</p>
                </div>
                <a
                    href={`/league/${leagueId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open League Page
                </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* League Settings */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">League Settings</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {settingsRows.map(({ label, value }) => (
                            <div key={label} className="flex items-center px-5 py-2.5">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-44 flex-shrink-0">{label}</span>
                                <span className="text-sm text-gray-800">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Members */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Members ({members.length})</h3>
                    </div>
                    {members.length === 0 ? (
                        <div className="px-5 py-12 text-center text-gray-400 text-sm">No members yet.</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {members.map((m, idx) => (
                                <div key={m.manager_id} className="flex items-center px-5 py-3 gap-3">
                                    <span className="text-xs font-bold text-gray-300 w-5 text-right flex-shrink-0">{idx + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-gray-800 text-sm truncate">{m.nickname || m.managers?.name || '-'}</div>
                                        <div className="text-xs text-gray-400 font-mono truncate">{m.manager_id}</div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${getRoleColor(m.role)}`}>
                                        {m.role || 'Member'}
                                    </span>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap hidden sm:block">
                                        {new Date(m.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Stat Categories + Roster Positions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stat Categories */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Stat Categories</h3>
                    </div>
                    <div className="p-5 space-y-5">
                        {/* Batter */}
                        <div>
                            <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">
                                Batter ({(league.batter_stat_categories || []).length})
                            </div>
                            {(league.batter_stat_categories || []).length === 0 ? (
                                <p className="text-xs text-gray-400">None selected.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {(league.batter_stat_categories || []).map((cat) => (
                                        <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 border border-green-200 text-xs text-green-800 font-medium">
                                            {cat}
                                            {league.scoring_type === 'Head-to-Head Fantasy Points' && categoryWeights.batter[cat] !== undefined && (
                                                <span className="text-green-500 font-bold">×{categoryWeights.batter[cat]}</span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Pitcher */}
                        <div>
                            <div className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">
                                Pitcher ({(league.pitcher_stat_categories || []).length})
                            </div>
                            {(league.pitcher_stat_categories || []).length === 0 ? (
                                <p className="text-xs text-gray-400">None selected.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {(league.pitcher_stat_categories || []).map((cat) => (
                                        <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-xs text-orange-800 font-medium">
                                            {cat}
                                            {league.scoring_type === 'Head-to-Head Fantasy Points' && categoryWeights.pitcher[cat] !== undefined && (
                                                <span className="text-orange-500 font-bold">×{categoryWeights.pitcher[cat]}</span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Roster Positions */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Roster Positions</h3>
                    </div>
                    {!league.roster_positions || Object.keys(league.roster_positions).length === 0 ? (
                        <div className="px-5 py-12 text-center text-gray-400 text-sm">No roster positions configured.</div>
                    ) : (
                        <div className="p-5">
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {Object.entries(league.roster_positions)
                                    .filter(([, count]) => Number(count) > 0)
                                    .map(([pos, count]) => (
                                        <div key={pos} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                                            <span className="text-sm font-bold text-gray-700">{pos}</span>
                                            <span className="text-sm font-black text-blue-600">{count}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Schedule */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Schedule ({schedule.length} weeks)</h3>
                </div>                {schedule.length === 0 ? (
                    <div className="px-5 py-12 text-center text-gray-400 text-sm">No schedule generated yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Week</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Label</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Start</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">End</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {schedule.map((w) => (
                                    <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2 font-mono font-bold text-gray-700">W{w.week_number}</td>
                                        <td className="px-4 py-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${getWeekTypeColor(w.week_type)}`}>
                                                {w.week_type === 'regular_season' ? 'Regular' : w.week_type === 'playoffs' ? 'Playoffs' : w.week_type || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-gray-500 text-xs">{w.week_label || '-'}</td>
                                        <td className="px-4 py-2 text-gray-600 text-xs whitespace-nowrap">{formatDate(w.week_start)}</td>
                                        <td className="px-4 py-2 text-gray-600 text-xs whitespace-nowrap">{formatDate(w.week_end)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
