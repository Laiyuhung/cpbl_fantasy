'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PublicLeaguePage() {
    const router = useRouter();
    const [leagues, setLeagues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterScoring, setFilterScoring] = useState('all');
    const [filterDraftTime, setFilterDraftTime] = useState('all');

    useEffect(() => {
        const fetchPublicLeagues = async () => {
            try {
                const res = await fetch('/api/public-leagues');
                const data = await res.json();

                if (data.success) {
                    setLeagues(data.leagues || []);
                } else {
                    setError(data.error || 'Failed to load public leagues');
                }
            } catch (err) {
                console.error('Error fetching public leagues:', err);
                setError('An unexpected error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchPublicLeagues();
    }, []);

    const getScoringTypeLabel = (type) => {
        switch (type) {
            case 'Head-to-Head Categories':
                return 'H2H CAT';
            case 'Head-to-Head Fantasy Points':
                return 'H2H PTS';
            case 'Roto':
                return 'ROTO';
            default:
                return type || 'Unknown';
        }
    };

    const getDraftTypeLabel = (type) => {
        switch (type) {
            case 'live':
            case 'Live':
                return 'Live Draft';
            case 'autopick':
            case 'auto':
            case 'Auto':
                return 'Auto Draft';
            default:
                return type || 'TBD';
        }
    };

    // Filter leagues based on selected filters
    const filteredLeagues = leagues.filter(league => {
        // Scoring type filter
        if (filterScoring !== 'all') {
            const scoringLabel = getScoringTypeLabel(league.scoring_type);
            if (filterScoring === 'h2h' && !scoringLabel.startsWith('H2H')) return false;
            if (filterScoring === 'h2h-cat' && scoringLabel !== 'H2H CAT') return false;
            if (filterScoring === 'h2h-pts' && scoringLabel !== 'H2H PTS') return false;
            if (filterScoring === 'roto' && scoringLabel !== 'ROTO') return false;
        }

        // Draft time filter
        if (filterDraftTime !== 'all' && league.live_draft_time) {
            const draftDate = new Date(league.live_draft_time);
            const now = new Date();
            const daysDiff = (draftDate - now) / (1000 * 60 * 60 * 24);
            
            if (filterDraftTime === '3days' && daysDiff > 3) return false;
            if (filterDraftTime === '1week' && daysDiff > 7) return false;
            if (filterDraftTime === '2weeks' && daysDiff > 14) return false;
        }

        return true;
    });

    // Check deadline - disable page after 2026-04-16
    if (new Date() >= new Date('2026-04-16')) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
                <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-12 shadow-2xl max-w-md text-center">
                    <div className="w-20 h-20 mx-auto mb-6 bg-slate-700/50 rounded-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Join Period Ended</h2>
                    <p className="text-slate-400 mb-6">
                        The deadline for joining public leagues was April 15, 2026. New members can no longer join leagues for this season.
                    </p>
                    <button
                        onClick={() => router.push('/home')}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                    >
                        Return to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-3xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                            <span className="w-1.5 h-8 bg-green-400 rounded-full"></span>
                            Public Leagues
                        </h1>
                    </div>
                    <Link
                        href="/create_league"
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-lg hover:shadow-green-500/50 flex items-center gap-2 text-sm"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create League
                    </Link>
                </div>

                {/* Description */}
                <p className="text-slate-400 mb-4 text-sm">
                    Browse and join public leagues that are looking for members. These leagues are in pre-draft status and have open spots available.
                </p>

                {/* Filters */}
                <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Scoring:</label>
                        <select
                            value={filterScoring}
                            onChange={(e) => setFilterScoring(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="all">All Types</option>
                            <option value="h2h-cat">H2H Categories</option>
                            <option value="h2h-pts">H2H Fantasy Points</option>
                            <option value="roto">Roto</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Draft Within:</label>
                        <select
                            value={filterDraftTime}
                            onChange={(e) => setFilterDraftTime(e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="all">Any Time</option>
                            <option value="3days">3 Days</option>
                            <option value="1week">1 Week</option>
                            <option value="2weeks">2 Weeks</option>
                        </select>
                    </div>
                    {(filterScoring !== 'all' || filterDraftTime !== 'all') && (
                        <button
                            onClick={() => { setFilterScoring('all'); setFilterDraftTime('all'); }}
                            className="text-xs text-purple-400 hover:text-purple-300 underline"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="text-center py-16">
                        <div className="w-12 h-12 mx-auto mb-4 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="text-purple-300">Loading public leagues...</div>
                    </div>
                ) : error ? (
                    <div className="text-center py-16">
                        <div className="text-red-400 bg-red-400/10 px-6 py-4 rounded-xl border border-red-500/20 inline-block">
                            {error}
                        </div>
                    </div>
                ) : leagues.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                            <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <p className="text-slate-400 text-lg mb-2">No public leagues available</p>
                        <p className="text-slate-500 text-sm">Check back later or create your own league!</p>
                    </div>
                ) : filteredLeagues.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                            <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </div>
                        <p className="text-slate-400 text-lg mb-2">No leagues match your filters</p>
                        <p className="text-slate-500 text-sm">Try adjusting your filter criteria</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredLeagues.map((league) => (
                            <Link
                                key={league.league_id}
                                href={`/league/${league.league_id}/join`}
                                className="block group relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-white/10 hover:border-green-500/40 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(34,197,94,0.15)]"
                            >
                                <div className="p-5">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-black text-white group-hover:text-green-300 transition-colors truncate pr-4">
                                            {league.league_name}
                                        </h3>
                                        <span className="shrink-0 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">
                                            Open
                                        </span>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {/* Teams */}
                                        <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Teams</div>
                                            <div className="text-lg font-black text-white">
                                                {league.current_members} / {league.max_teams}
                                            </div>
                                            <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
                                                    style={{ width: `${(league.current_members / league.max_teams) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Scoring */}
                                        <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Scoring</div>
                                            <div className="text-sm font-bold text-purple-300">
                                                {getScoringTypeLabel(league.scoring_type)}
                                            </div>
                                        </div>

                                        {/* Live Draft Time */}
                                        <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Live Draft Time</div>
                                            <div className="text-sm font-bold text-blue-300">
                                                {league.live_draft_time ? new Date(league.live_draft_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'}
                                            </div>
                                        </div>

                                        {/* Playoffs */}
                                        <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Playoffs</div>
                                            <div className="text-sm font-bold text-amber-300">
                                                {league.playoffs || 'TBD'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-4 flex items-center justify-end">
                                        <span className="text-xs font-bold text-green-400 group-hover:text-green-300 flex items-center gap-1 transition-colors">
                                            View & Join
                                            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
