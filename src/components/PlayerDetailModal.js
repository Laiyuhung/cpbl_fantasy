import React, { useState, useEffect } from 'react';

const TIME_WINDOWS = [
    'Today',
    'Yesterday',
    'Last 7 Days',
    'Last 14 Days',
    'Last 30 Days',
    '2026 Season',
    '2025 Season'
];

export default function PlayerDetailModal({ isOpen, onClose, player, leagueId }) {
    const [stats, setStats] = useState({ batting: {}, pitching: {} });
    const [loading, setLoading] = useState(true);
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [error, setError] = useState('');

    const [batterStatCategories, setBatterStatCategories] = useState([]);
    const [pitcherStatCategories, setPitcherStatCategories] = useState([]);

    // Decide which stats to show based on player.batter_or_pitcher 
    // or fall back to position if undefined
    const isPitcher = player?.batter_or_pitcher === 'pitcher' || ['SP', 'RP', 'P'].includes(player?.position);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setSettingsLoading(true);
            setError('');
            setStats({ batting: {}, pitching: {} });
        }
    }, [isOpen, player?.player_id]);

    useEffect(() => {
        const fetchLeagueSettings = async () => {
            if (!leagueId) {
                setSettingsLoading(false);
                return;
            }
            try {
                const res = await fetch(`/api/league-settings?league_id=${leagueId}`);
                const data = await res.json();
                if (data.success && data.data) {
                    setBatterStatCategories(data.data.batter_stat_categories || []);
                    setPitcherStatCategories(data.data.pitcher_stat_categories || []);
                }
            } catch (err) {
                console.error('Failed to fetch league settings', err);
            } finally {
                setSettingsLoading(false);
            }
        };
        if (isOpen && leagueId) {
            fetchLeagueSettings();
        }
    }, [isOpen, leagueId]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!player?.player_id) {
                setLoading(false);
                return;
            }
            try {
                // Pass type (batter or pitcher) to API to help it query the right view
                const type = player.batter_or_pitcher;
                const res = await fetch(`/api/playerStats/player/${player.player_id}${type ? `?type=${type}` : ''}`);
                const data = await res.json();
                if (data.success) {
                    setStats({ batting: data.batting, pitching: data.pitching });
                } else {
                    setError(data.error || 'Failed to load stats');
                }
            } catch (err) {
                setError('Error fetching player stats');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (isOpen) {
            fetchStats();
        }
    }, [isOpen, player]);

    if (!isOpen || !player) return null;

    // Show loading until both settings and stats are loaded
    const isFullyLoaded = !loading && !settingsLoading;

    // We need to parse categorical arrays to abbreviations
    const parseStatKey = (cat) => {
        const matches = cat.match(/\(([^)]+)\)/g);
        return matches ? matches[matches.length - 1].replace(/[()]/g, '') : cat;
    };

    const displayBatterCats = (() => {
        const forced = 'At Bats (AB)';
        const hasForced = batterStatCategories.some(c => parseStatKey(c) === 'AB');
        return hasForced ? batterStatCategories : [forced, ...batterStatCategories];
    })();

    const displayPitcherCats = (() => {
        const forced = 'Innings Pitched (IP)';
        const hasForced = pitcherStatCategories.some(c => parseStatKey(c) === 'IP');
        return hasForced ? pitcherStatCategories : [forced, ...pitcherStatCategories];
    })();

    const displayCats = isPitcher ? displayPitcherCats : displayBatterCats;
    const abbreviations = displayCats.map(parseStatKey);
    const dataByWindow = isPitcher ? stats.pitching : stats.batting;

    // Render row for a specific time window
    const renderRow = (tw) => {
        const windowStats = dataByWindow[tw];

        // If no stats at all for the window
        if (!windowStats) {
            return (
                <tr key={tw} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 text-sm font-semibold text-slate-300 whitespace-nowrap sticky left-0 bg-slate-800/90 z-10 border-r border-white/10">{tw}</td>
                    {abbreviations.map((abbr, i) => (
                        <td key={i} className="py-2.5 px-3 text-center text-sm font-mono text-slate-600">-</td>
                    ))}
                </tr>
            );
        }

        return (
            <tr key={tw} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-2.5 px-3 text-sm font-semibold text-slate-300 whitespace-nowrap sticky left-0 bg-slate-800/90 z-10 border-r border-white/10">{tw}</td>
                {abbreviations.map((abbr, i) => {
                    const val = windowStats[abbr.toLowerCase()];
                    const displayVal = val === null || val === undefined ? '-' : val;
                    const isZeroOrDash = displayVal === '-' || displayVal === 0 || displayVal === '0';
                    const isRefStat = abbr === 'AB' || abbr === 'IP';

                    return (
                        <td key={i} className={`py-2.5 px-3 text-center text-sm font-mono ${isZeroOrDash ? 'text-slate-600' : isRefStat ? 'text-slate-400' : 'text-cyan-300'
                            }`}>
                            {displayVal}
                        </td>
                    );
                })}
            </tr>
        );
    };

    const teamColor = (() => {
        switch (player.team) {
            case '統一獅': return 'text-orange-400';
            case '富邦悍將': return 'text-blue-400';
            case '台鋼雄鷹': return 'text-green-400';
            case '味全龍': return 'text-red-400';
            case '樂天桃猿': return 'text-rose-400';
            case '中信兄弟': return 'text-yellow-400';
            default: return 'text-slate-400';
        }
    })();

    const teamAbbr = (() => {
        switch (player.team) {
            case '統一獅': return 'UL';
            case '富邦悍將': return 'FG';
            case '樂天桃猿': return 'RM';
            case '中信兄弟': return 'B';
            case '味全龍': return 'W';
            case '台鋼雄鷹': return 'TSG';
            default: return player.team;
        }
    })();

    const positionStr = player.position_list || player.position || (isPitcher ? 'P' : 'Util');

    // Fallback to determine best player photo
    let bestPhotoStr = '/photo/defaultPlayer.png';
    if (player.player_id) {
        // Basic fallback to local photo if generic approach works
        // E.g., via their original_name or id, but here we can just do name or id
        bestPhotoStr = `/photo/${player.name || player.player_id}.png`;
    }

    const handleImageError = (e) => {
        if (!e.target.src.endsWith('/photo/defaultPlayer.png')) {
            e.target.src = '/photo/defaultPlayer.png';
        }
    };

    // Render player badges (DR, NR, NA, F)
    const renderBadges = () => {
        const badges = [];
        if (player.identity && player.identity.toLowerCase() === 'foreigner') {
            badges.push(<span key="f" title="Foreign Player" className="w-6 h-6 flex items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">F</span>);
        }
        const status = (player.real_life_status || '').toUpperCase();
        if (status.includes('MN') || status.includes('MINOR') || status === 'NA') {
            badges.push(<span key="na" className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">NA</span>);
        }
        if (status.includes('DEREGISTERED') || status === 'DR' || status === 'D') {
            badges.push(<span key="dr" className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">DR</span>);
        }
        if (status.includes('UNREGISTERED') || status === 'NR') {
            badges.push(<span key="nr" className="px-2 py-0.5 rounded text-xs font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">NR</span>);
        }
        return badges.length > 0 ? <div className="flex items-center gap-1.5 ml-2">{badges}</div> : null;
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-4xl bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900/40 rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-4 p-5 sm:p-6 border-b border-white/10 bg-black/20 shrink-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-slate-800 border-2 border-purple-500/50 shrink-0 shadow-lg">
                        <img
                            src={bestPhotoStr}
                            alt={player.name}
                            className="w-full h-full object-cover"
                            onError={handleImageError}
                        />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center">
                                <h2 className="text-2xl sm:text-3xl font-black text-white truncate drop-shadow-md">
                                    {player.name}
                                </h2>
                                {renderBadges()}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 -mr-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors self-start shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-sm font-semibold flex-wrap">
                            <span className={`${teamColor} bg-white/5 py-1 px-2.5 rounded shadow-sm border border-white/5`}>
                                {teamAbbr}
                            </span>
                            <span className="text-purple-300">|</span>
                            <span className="text-slate-300 tracking-wider">
                                {positionStr}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stats Table Area */}
                <div className="flex-1 overflow-hidden bg-black/10 p-5 sm:p-6">
                    {!isFullyLoaded ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-4">
                            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-purple-300 font-semibold tracking-wide animate-pulse">Loading Stats...</div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="text-red-400 bg-red-400/10 px-4 py-3 rounded-lg border border-red-500/20 shadow-inner">
                                {error}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-white/5 bg-slate-900/50 shadow-inner overflow-x-auto max-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                            <table className="text-left border-collapse min-w-max">
                                <thead>
                                    <tr className="bg-slate-800/80 border-b border-white/10 shadow-sm">
                                        <th className="py-3 px-3 text-xs font-black text-purple-300 uppercase tracking-widest sticky left-0 top-0 bg-slate-800 z-20 border-r border-white/10 shadow-[2px_0_4px_rgba(0,0,0,0.3)] whitespace-nowrap">
                                            Split
                                        </th>
                                        {abbreviations.map((abbr, i) => (
                                            <th key={i} className="py-3 px-3 text-center text-xs font-black text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-800/80 z-10 backdrop-blur-sm">
                                                {abbr}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {TIME_WINDOWS.map(renderRow)}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
