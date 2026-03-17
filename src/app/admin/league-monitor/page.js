'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LeagueMonitorPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [leagues, setLeagues] = useState([]);
    const [error, setError] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

    const fetchData = useCallback(async (manual = false) => {
        if (manual) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError('');
        try {
            const res = await fetch('/api/admin/leagues');
            if (res.status === 401 || res.status === 403) {
                alert('You do not have admin privileges');
                router.push('/home');
                return;
            }
            const data = await res.json();
            if (data.success) {
                setLeagues(data.leagues || []);
            } else {
                setError(data.error || 'Failed to load leagues');
            }
        } catch (err) {
            console.error('Error:', err);
            setError('An unexpected error occurred');
        } finally {
            if (manual) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    }, [router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getScoringLabel = (type) => {
        switch (type) {
            case 'Head-to-Head': return 'H2H';
            case 'Head-to-Head One Win': return 'H2H 1W';
            case 'Head-to-Head Fantasy Points': return 'H2H PTS';
            default: return type || '-';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pre-draft': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'post-draft & pre-season': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'drafting now': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'in season': return 'bg-green-100 text-green-800 border-green-300';
            case 'playoffs': return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'finished': return 'bg-gray-100 text-gray-600 border-gray-300';
            default: return 'bg-gray-100 text-gray-500 border-gray-300';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pre-draft': return 'Pre-Draft';
            case 'post-draft & pre-season': return 'Post-Draft';
            case 'drafting now': return 'Drafting';
            case 'in season': return 'In Season';
            case 'playoffs': return 'Playoffs';
            case 'finished': return 'Finished';
            default: return status || 'Unknown';
        }
    };

    // Unique statuses for filter dropdown
    const allStatuses = [...new Set(leagues.map(l => l.status))].sort();

    // Filter and search
    const filteredLeagues = leagues.filter(l => {
        if (filterStatus !== 'all' && l.status !== filterStatus) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                l.league_name?.toLowerCase().includes(term) ||
                l.commissioner?.toLowerCase().includes(term) ||
                l.league_id?.toLowerCase().includes(term)
            );
        }
        return true;
    });

    // Sort
    const sortedLeagues = [...filteredLeagues].sort((a, b) => {
        const key = sortConfig.key;
        let aVal = a[key];
        let bVal = b[key];

        // Handle nulls
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Numeric
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // Boolean
        if (typeof aVal === 'boolean') {
            return sortConfig.direction === 'asc' ? (aVal === bVal ? 0 : aVal ? -1 : 1) : (aVal === bVal ? 0 : aVal ? 1 : -1);
        }

        // String / Date
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (sortConfig.direction === 'asc') return aStr.localeCompare(bStr);
        return bStr.localeCompare(aStr);
    });

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ field }) => {
        if (sortConfig.key !== field) return <span className="text-gray-300 ml-1">↕</span>;
        return <span className="text-blue-600 ml-1">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    // Summary stats
    const statusCounts = {};
    leagues.forEach(l => {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-gray-600">Loading league data...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white rounded-lg shadow-md p-8 max-w-md">
                    <div className="text-red-600 text-lg font-bold mb-2">Error</div>
                    <div className="text-gray-600">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-6">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/admin')}
                            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">League Monitor</h1>
                            <p className="text-sm text-gray-500">Overview of all leagues in the system</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-400">
                            {leagues.length} league{leagues.length !== 1 ? 's' : ''} total
                        </div>
                        <button
                            onClick={() => fetchData(true)}
                            disabled={refreshing}
                            className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total</div>
                        <div className="text-2xl font-black text-gray-900 mt-1">{leagues.length}</div>
                    </div>
                    {[
                        { status: 'pre-draft', label: 'Pre-Draft', color: 'text-yellow-600' },
                        { status: 'post-draft & pre-season', label: 'Post-Draft', color: 'text-orange-600' },
                        { status: 'drafting now', label: 'Drafting', color: 'text-blue-600' },
                        { status: 'in season', label: 'In Season', color: 'text-green-600' },
                        { status: 'playoffs', label: 'Playoffs', color: 'text-purple-600' },
                        { status: 'finished', label: 'Finished', color: 'text-gray-500' },
                    ].map(item => (
                        <div key={item.status} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{item.label}</div>
                            <div className={`text-2xl font-black mt-1 ${item.color}`}>{statusCounts[item.status] || 0}</div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6 flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="🔍 Search league name, commissioner, or ID..."
                        className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="all">All Statuses</option>
                        {allStatuses.map(s => (
                            <option key={s} value={s}>{getStatusLabel(s)}</option>
                        ))}
                    </select>
                    {(filterStatus !== 'all' || searchTerm) && (
                        <button
                            onClick={() => { setFilterStatus('all'); setSearchTerm(''); }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                            Clear
                        </button>
                    )}
                    <div className="text-xs text-gray-400">
                        Showing {sortedLeagues.length} of {leagues.length}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    {[
                                        { key: 'league_name', label: 'League Name', align: 'left' },
                                        { key: 'status', label: 'Status', align: 'center' },
                                        { key: 'current_members', label: 'Members', align: 'center' },
                                        { key: 'commissioner', label: 'Commissioner', align: 'left' },
                                        { key: 'scoring_type', label: 'Scoring', align: 'center' },
                                        { key: 'draft_type', label: 'Draft', align: 'center' },
                                        { key: 'live_draft_time', label: 'Draft Time', align: 'center' },
                                        { key: 'start_scoring_on', label: 'Start Date', align: 'center' },
                                        { key: 'current_week', label: 'Week', align: 'center' },
                                        { key: 'is_finalized', label: 'Finalized', align: 'center' },
                                        { key: 'created_at', label: 'Created', align: 'center' },
                                        { key: 'actions', label: 'Actions', align: 'center' },
                                    ].map(col => (
                                        <th
                                            key={col.key}
                                            onClick={() => col.key !== 'actions' && handleSort(col.key)}
                                            className={`px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider transition-colors select-none whitespace-nowrap ${col.key !== 'actions' ? 'cursor-pointer hover:text-gray-900' : ''} ${col.align === 'center' ? 'text-center' : 'text-left'}`}
                                        >
                                            {col.label}
                                            {col.key !== 'actions' && <SortIcon field={col.key} />}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sortedLeagues.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="px-6 py-12 text-center text-gray-400">
                                            No leagues found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedLeagues.map(league => {
                                        const isFull = league.current_members >= league.max_teams;
                                        const draftPassed = league.live_draft_time && new Date(league.live_draft_time) < new Date();

                                        return (
                                            <tr key={league.league_id} className="hover:bg-blue-50/50 transition-colors">
                                                {/* League Name */}
                                                <td className="px-3 py-3">
                                                    <button
                                                        onClick={() => router.push(`/league/${league.league_id}`)}
                                                        className="text-blue-600 hover:text-blue-800 font-semibold text-left hover:underline transition-colors max-w-[200px] truncate block"
                                                        title={league.league_name}
                                                    >
                                                        {league.league_name}
                                                    </button>
                                                    <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[200px]" title={league.league_id}>
                                                        {league.league_id.slice(0, 8)}...
                                                    </div>
                                                </td>

                                                {/* Status */}
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${getStatusColor(league.status)}`}>
                                                        {getStatusLabel(league.status)}
                                                    </span>
                                                </td>

                                                {/* Members */}
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`font-mono font-bold ${isFull ? 'text-red-600' : 'text-gray-700'}`}>
                                                        {league.current_members}/{league.max_teams}
                                                    </span>
                                                </td>

                                                {/* Commissioner */}
                                                <td className="px-3 py-3 text-gray-700 max-w-[120px] truncate" title={league.commissioner}>
                                                    {league.commissioner}
                                                </td>

                                                {/* Scoring */}
                                                <td className="px-3 py-3 text-center">
                                                    <span className="text-xs font-medium text-gray-600">{getScoringLabel(league.scoring_type)}</span>
                                                </td>

                                                {/* Draft Type */}
                                                <td className="px-3 py-3 text-center">
                                                    <span className="text-xs text-gray-600">{league.draft_type === 'Live Draft' ? 'Live' : 'Auto'}</span>
                                                </td>

                                                {/* Draft Time */}
                                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                                    {league.live_draft_time ? (
                                                        <span className={`text-xs ${draftPassed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                                            {new Date(league.live_draft_time).toLocaleString('en-US', {
                                                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                                                            })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-300">-</span>
                                                    )}
                                                </td>

                                                {/* Start Scoring */}
                                                <td className="px-3 py-3 text-center text-xs text-gray-600 whitespace-nowrap">
                                                    {league.start_scoring_on || '-'}
                                                </td>

                                                {/* Current Week */}
                                                <td className="px-3 py-3 text-center">
                                                    {league.current_week != null ? (
                                                        <span className="font-mono font-bold text-gray-700">W{league.current_week}</span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>

                                                {/* Finalized */}
                                                <td className="px-3 py-3 text-center">
                                                    {league.is_finalized ? (
                                                        <span className="text-green-600 font-bold">✓</span>
                                                    ) : (
                                                        <span className="text-gray-300">✗</span>
                                                    )}
                                                </td>

                                                {/* Created */}
                                                <td className="px-3 py-3 text-center text-xs text-gray-500 whitespace-nowrap">
                                                    {new Date(league.created_at).toLocaleDateString('en-US', {
                                                        month: 'short', day: 'numeric'
                                                    })}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <a href={`/admin/league-monitor/${league.league_id}/matchups`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline">賽程</a>
                                                        <span className="text-gray-300">|</span>
                                                        <a href={`/admin/league-monitor/${league.league_id}/rosters`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline">陣容</a>
                                                        <span className="text-gray-300">|</span>
                                                        <a href={`/admin/league-monitor/${league.league_id}/transactions`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline">異動</a>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
