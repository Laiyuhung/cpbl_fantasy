'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import LegendModal from '../../../../components/LegendModal';

export default function DraftPage() {
    const params = useParams();
    const leagueId = params.leagueId;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [draftState, setDraftState] = useState(null);
    const [players, setPlayers] = useState([]);
    const [myManagerId, setMyManagerId] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [pickingId, setPickingId] = useState(null);
    const [assigning, setAssigning] = useState(false);
    const [assigningId, setAssigningId] = useState(null); // Track specific ID being assigned/removed

    // UI States
    const [showLegend, setShowLegend] = useState(false);

    // Filters & Sorting
    const [filterType, setFilterType] = useState('batter');
    const [filterPos, setFilterPos] = useState('All');
    const [filterTeam, setFilterTeam] = useState('All');
    const [filterIdentity, setFilterIdentity] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });

    // Data Resources
    const [rosterPositions, setRosterPositions] = useState({});
    const [photoSrcMap, setPhotoSrcMap] = useState({});
    const failedImages = useRef(new Set());
    const prevPickIdRef = useRef(null);
    const resolvedIds = useRef(new Set());
    const [members, setMembers] = useState([]);

    // Stats State
    const [playerStats, setPlayerStats] = useState({});
    const [batterStatCategories, setBatterStatCategories] = useState([]);
    const [pitcherStatCategories, setPitcherStatCategories] = useState([]);
    const [playerRankings, setPlayerRankings] = useState({}); // playerId -> rank

    // Queue State
    const [queue, setQueue] = useState([]);
    const [queuingIds, setQueuingIds] = useState(new Set()); // Track IDs being added/removed
    const [activeTab, setActiveTab] = useState('team'); // 'team', 'queue', 'roster'

    // Sidebar State
    const [sidebarTab, setSidebarTab] = useState('history'); // 'history' (recent), 'future' (upcoming)
    const [isSidebarHistoryOpen, setSidebarHistoryOpen] = useState(true);
    const [isSidebarTeamOpen, setSidebarTeamOpen] = useState(true);

    // League Rosters State (Opponent View)
    const [draftRosterAssignments, setDraftRosterAssignments] = useState([]);
    const [assignModalPlayer, setAssignModalPlayer] = useState(null);
    const [assignModalSlot, setAssignModalSlot] = useState(null);
    const [mainTab, setMainTab] = useState('players');

    // Foreigner Limit
    const [foreignerLimit, setForeignerLimit] = useState(null);

    const [viewingManagerId, setViewingManagerId] = useState(null);
    const [viewingRosterAssignments, setViewingRosterAssignments] = useState([]);
    const [viewingLoading, setViewingLoading] = useState(false);

    // Fetch Manager ID
    useEffect(() => {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const userId = cookie?.split('=')[1];
        if (userId) setMyManagerId(userId);
    }, []);

    // Filter Reset Logic
    useEffect(() => {
        setFilterPos('All');
    }, [filterType]);

    // Fetch Queue (No Polling - Event Based)
    useEffect(() => {
        if (!myManagerId) return;

        const fetchQueue = async () => {
            try {
                const res = await fetch(`/api/league/${leagueId}/draft/queue?managerId=${myManagerId}`);
                const data = await res.json();
                if (data.success) {
                    setQueue(data.queue || []);
                }
            } catch (e) {
                console.error(e);
            }
        };

        fetchQueue();
    }, [leagueId, myManagerId]);

    // Fetch Draft Roster Assignments (On Load & Pick Change)
    useEffect(() => {
        if (!myManagerId) return;

        const fetchAssignments = async () => {
            try {
                const res = await fetch(`/api/league/${leagueId}/draft/roster?manager_id=${myManagerId}`);
                const data = await res.json();
                if (data.success) {
                    setDraftRosterAssignments(data.assignments || []);
                }
            } catch (e) {
                console.error(e);
            }
        };

        fetchAssignments();
    }, [leagueId, myManagerId, draftState?.picks?.length]);

    // Fetch Viewing Roster Assignments
    useEffect(() => {
        if (!viewingManagerId && members.length > 0 && myManagerId) {
            // Default to first member who is NOT me, or just first member
            const other = members.find(m => m.manager_id !== myManagerId);
            if (other) setViewingManagerId(other.manager_id);
            else if (members.length > 0) setViewingManagerId(members[0].manager_id);
        }

        if (!viewingManagerId) return;

        const fetchAssignments = async () => {
            setViewingLoading(true);
            setViewingRosterAssignments([]); // Clear previous data
            try {
                const res = await fetch(`/api/league/${leagueId}/draft/roster?manager_id=${viewingManagerId}`);
                const data = await res.json();
                if (data.success) {
                    setViewingRosterAssignments(data.assignments || []);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setViewingLoading(false);
            }
        };
        fetchAssignments();
    }, [leagueId, viewingManagerId, members, myManagerId]);

    const handleAddToQueue = async (player) => {
        setQueuingIds(prev => new Set(prev).add(player.player_id));
        try {
            const res = await fetch(`/api/league/${leagueId}/draft/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ managerId: myManagerId, playerId: player.player_id })
            });
            const data = await res.json();
            if (data.success) {
                const qRes = await fetch(`/api/league/${leagueId}/draft/queue?managerId=${myManagerId}`);
                const qData = await qRes.json();
                if (qData.success) setQueue(qData.queue);
            } else {
                alert('Add to queue failed');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setQueuingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(player.player_id);
                return newSet;
            });
        }
    };

    const handleRemoveFromQueue = async (queueId) => {
        const item = queue.find(q => q.queue_id === queueId);
        const pid = item?.player_id;
        if (pid) setQueuingIds(prev => new Set(prev).add(pid));

        try {
            await fetch(`/api/league/${leagueId}/draft/queue`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queueId })
            });
            setQueue(prev => prev.filter(i => i.queue_id !== queueId));
        } catch (e) {
            console.error(e);
        } finally {
            if (pid) setQueuingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(pid);
                return newSet;
            });
        }
    };

    const handleReorderQueue = async (index, direction) => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === queue.length - 1) return;

        const newQueue = [...queue];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newQueue[index], newQueue[swapIndex]] = [newQueue[swapIndex], newQueue[index]];

        // Update Ranks locally
        const updatedRanking = newQueue.map((item, i) => ({ ...item, rank_order: i + 1 }));
        setQueue(updatedRanking);

        try {
            const payload = updatedRanking.map(item => ({ queue_id: item.queue_id, rank_order: item.rank_order }));
            await fetch(`/api/league/${leagueId}/draft/queue`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: payload })
            });
        } catch (e) { console.error('Reorder failed', e); }
    };

    const isQueued = (playerId) => queue.some(q => q.player_id === playerId);

    // Auto-remove taken players from Queue
    useEffect(() => {
        if (!queue.length || !draftState?.picks) return;

        const takenSet = new Set(draftState.picks.map(p => p.player_id).filter(Boolean));
        // Find queue items that are now taken
        const toRemove = queue.filter(q => takenSet.has(q.player_id));

        if (toRemove.length > 0) {
            // Optimistic update locally to remove them immediately from UI
            const newQueue = queue.filter(q => !takenSet.has(q.player_id));
            setQueue(newQueue);

            // API cleanup (silent, no blocking)
            // We use a separate async operation for each because the API is designed for single delete usually
            // but we could also implement bulk delete if needed. For now simple loop is fine.
            toRemove.forEach(item => {
                fetch(`/api/league/${leagueId}/draft/queue`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ queueId: item.queue_id })
                }).catch(e => console.error('Silent queue cleanup failed', e));
            });
        }
    }, [draftState?.picks, queue, leagueId]);

    // Roster Assignment Handlers
    const handleAssignToSlot = async (playerId, rosterSlot) => {
        setAssigning(true);
        try {
            const res = await fetch(`/api/league/${leagueId}/draft/roster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ managerId: myManagerId, playerId, rosterSlot })
            });
            const data = await res.json();
            if (data.success) {
                // Refresh assignments
                const refreshRes = await fetch(`/api/league/${leagueId}/draft/roster?manager_id=${myManagerId}`);
                const refreshData = await refreshRes.json();
                if (refreshData.success) {
                    setDraftRosterAssignments(refreshData.assignments || []);
                }
                return true;
            } else {
                alert('Assignment failed: ' + data.error);
                return false;
            }
        } catch (e) {
            console.error('Assignment error:', e);
            return false;
        } finally {
            setAssigning(false);
        }
    };

    const handleRemoveAssignment = async (assignmentId) => {
        setAssigning(true);
        setAssigningId(assignmentId);
        try {
            await fetch(`/api/league/${leagueId}/draft/roster`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignmentId })
            });
            // Refresh assignments
            const refreshRes = await fetch(`/api/league/${leagueId}/draft/roster?manager_id=${myManagerId}`);
            const refreshData = await refreshRes.json();
            if (refreshData.success) {
                setDraftRosterAssignments(refreshData.assignments || []);
            }
        } catch (e) {
            console.error('Remove assignment error:', e);
        } finally {
            setAssigning(false);
            setAssigningId(null);
        }
    };

    const getAssignedPlayer = (slot) => {
        return draftRosterAssignments.find(a => a.roster_slot === slot);
    };

    const isPlayerAssigned = (playerId) => {
        return draftRosterAssignments.some(a => a.player_id === playerId);
    };

    const getAvailableSlotsForPlayer = (player) => {
        if (!player) return [];
        const playerPositions = filterPositions(player).split(', ');
        const availableSlots = [];

        Object.keys(rosterPositions)
            .filter(slot => !slot.includes('Minor'))
            .forEach(slot => {
                const count = rosterPositions[slot];
                for (let idx = 0; idx < count; idx++) {
                    const slotKey = count > 1 ? `${slot}${idx + 1}` : slot;
                    // Check if slot is compatible with player positions
                    // Util is strictly for Batters
                    if (playerPositions.includes(slot) ||
                        (slot === 'Util' && player.batter_or_pitcher === 'batter') ||
                        slot === 'BN' ||
                        (player.batter_or_pitcher === 'pitcher' && slot === 'P')) {
                        availableSlots.push({ key: slotKey, display: slot });
                    }
                }
            });
        return availableSlots;
    };

    const getAvailablePlayersForSlot = (slotKey) => {
        const baseSlot = slotKey.replace(/\d+$/, '');

        return myTeam.filter(player => {
            if (isPlayerAssigned(player.player_id)) return false;

            const playerPositions = filterPositions(player).split(', ');

            if (baseSlot === 'BN') return true;
            // Util restricted to Batters
            if (baseSlot === 'Util') return player.batter_or_pitcher === 'batter';
            if (baseSlot === 'P' && player.batter_or_pitcher === 'pitcher') return true;
            if (playerPositions.includes(baseSlot)) return true;

            return false;
        });
    };

    // Poll Draft State (Smart Polling)
    useEffect(() => {
        let active = true;
        let timeoutId;

        const fetchState = async () => {
            try {
                const res = await fetch(`/api/league/${leagueId}/draft/state`);
                if (!active) return; // Ignore if unmounted during fetch

                const data = await res.json();
                setDraftState(data);

                // Sync Time
                if (data.serverTime) {
                    const now = new Date(data.serverTime).getTime();
                    let diff = 0;
                    let logCalc = false;

                    // Check if pick changed or first load
                    const currentId = data.currentPick?.pick_id;
                    if (currentId !== prevPickIdRef.current) {
                        logCalc = true;
                        prevPickIdRef.current = currentId;
                    }

                    if (data.status === 'pre-draft' && data.startTime) {
                        const start = new Date(data.startTime).getTime();
                        diff = Math.floor((start - now) / 1000);
                        if (logCalc) {
                            console.log('%c[Timer Calc] Pre-Draft', 'color: cyan; font-weight: bold;', {
                                serverTime: data.serverTime,
                                startTime: data.startTime,
                                calculation: `${new Date(data.startTime).toLocaleTimeString()} - ${new Date(data.serverTime).toLocaleTimeString()}`,
                                secondsRemaining: diff
                            });
                        }
                        // Smooth Update
                        setTimeLeft(prev => {
                            // Always force update if pick changed or remaining time is large/new
                            // But if just ticking down, avoid jitter
                            const newTime = diff > 0 ? diff : 0;
                            if (Math.abs(prev - newTime) <= 2 && prev > 0) return prev;
                            return newTime;
                        });
                    } else if (data.currentPick?.deadline) {
                        // Simply: deadline - now
                        const deadline = new Date(data.currentPick.deadline).getTime();
                        diff = Math.floor((deadline - now) / 1000);

                        if (logCalc || !prevPickIdRef.current) {
                            console.log('%c[Timer Calc] Active Pick', 'color: lime; font-weight: bold;', {
                                pickInfo: `Pick ${data.currentPick.pick_number} (Rd ${data.currentPick.round_number})`,
                                nowTime: data.serverTime,
                                deadline: data.currentPick.deadline,
                                diff: `${diff} s`
                            });
                        }

                        // Smooth Update logic
                        // If the server says time is up (0 or less), pass 0.
                        // But if we are locally at -1 (showing Auto Picking), keep it at -1 unless server resets.
                        // Actually, if pickId changed (handled by effect dependency or data), we reset.
                        // Here we just handle the periodic sync.
                        setTimeLeft(prev => {
                            const newTime = diff > 0 ? diff : 0;
                            // If we are showing Auto Picking (-1) and server says 0, stay at -1
                            if (prev === -1 && newTime === 0) return -1;

                            // If difference is small, trust local timer
                            if (Math.abs(prev - newTime) <= 2 && prev > 0) return prev;

                            return newTime;
                        });

                    } else {
                        if (logCalc) console.log('[Timer Calc] No active timer', { status: data.status });
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (active) {
                    timeoutId = setTimeout(fetchState, 2000);
                }
            }
        };

        fetchState();
        return () => {
            active = false;
            clearTimeout(timeoutId);
        };
    }, [leagueId, router]);

    // Timer Tick
    useEffect(() => {
        const timer = setInterval(() => {
            // Allow ticking to -1 to trigger "Auto picking..." state after showing 0
            setTimeLeft(prev => prev > -1 ? prev - 1 : -1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Initial Load
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [playersRes, settingsRes, leagueRes] = await Promise.all([
                    fetch('/api/playerslist?available=true'),
                    fetch(`/api/league-settings?league_id=${leagueId}`),
                    fetch(`/api/league/${leagueId}`)
                ]);

                const playersData = await playersRes.json();
                const settingsData = await settingsRes.json();
                const leagueData = await leagueRes.json();

                if (playersData.success) setPlayers(playersData.players || []);
                if (settingsData.success && settingsData.data) {
                    setRosterPositions(settingsData.data.roster_positions || {});
                    setForeignerLimit(settingsData.data.foreigner_active_limit !== undefined ? settingsData.data.foreigner_active_limit : null);
                    setBatterStatCategories(settingsData.data.batter_stat_categories || []);
                    setPitcherStatCategories(settingsData.data.pitcher_stat_categories || []);
                }
                if (leagueData.success && leagueData.members) {
                    setMembers(leagueData.members);
                }

                const timeWindow = '2025 Season';
                const [battingRes, pitchingRes, rankingsRes] = await Promise.all([
                    fetch(`/api/playerStats/batting-summary?time_window=${encodeURIComponent(timeWindow)}`),
                    fetch(`/api/playerStats/pitching-summary?time_window=${encodeURIComponent(timeWindow)}`),
                    fetch(`/api/league/${leagueId}/rankings?time_window=${encodeURIComponent(timeWindow)}`)
                ]);

                const battingData = await battingRes.json();
                const pitchingData = await pitchingRes.json();
                const rankingsData = await rankingsRes.json();

                const statsMap = {};
                if (battingData.success && battingData.stats) battingData.stats.forEach(s => statsMap[s.player_id] = s);
                if (pitchingData.success && pitchingData.stats) pitchingData.stats.forEach(s => statsMap[s.player_id] = s);
                setPlayerStats(statsMap);

                const rankMap = {};
                if (rankingsData.success && rankingsData.rankings) {
                    rankingsData.rankings.forEach(r => {
                        rankMap[r.player_id] = r.rank;
                    });
                }
                setPlayerRankings(rankMap);

            } catch (e) {
                console.error('Failed to load draft resources', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [leagueId]);

    // Set default sort when categories are loaded - REMOVED override to keep Rank as default
    useEffect(() => {
        // Force sort by rank when switching between batter/pitcher to provide consistent starting point
        setSortConfig({ key: 'rank', direction: 'asc' });
    }, [filterType]); // Trigger when filterType changes

    // ---------------------------------------------------------
    // Helper Logic 
    // ---------------------------------------------------------

    const getMemberNickname = (managerId) => {
        if (!managerId) return '-';
        const m = members.find(m => m.manager_id === managerId);
        return m?.nickname || 'Unknown';
    };

    const filterPositions = (player) => {
        let positionList = player.position_list;
        if (!positionList) positionList = player.batter_or_pitcher === 'batter' ? 'Util' : 'P';

        const positions = positionList.split(',').map(p => p.trim());
        const validPositions = positions.filter(pos => rosterPositions[pos] && rosterPositions[pos] > 0);
        return validPositions.length > 0 ? validPositions.join(', ') : 'NA';
    };

    const getPlayerStat = (playerId, statKey) => {
        const stats = playerStats[playerId];
        if (!stats) return '-';
        let fieldName = statKey;
        const matches = statKey.match(/\(([^)]+)\)/g);
        if (matches) fieldName = matches[matches.length - 1].replace(/[()]/g, '');

        const val = stats[fieldName.toLowerCase()];
        return (val !== undefined && val !== null) ? val : '-';
    };

    const getStatAbbr = (cat) => {
        const matches = cat.match(/\(([^)]+)\)/g);
        if (matches && matches.length > 0) {
            return matches[matches.length - 1].replace(/[()]/g, '');
        }
        return cat;
    };

    const getPlayerStatRaw = (playerId, statKey) => {
        const val = getPlayerStat(playerId, statKey);
        return val === '-' ? -999 : Number(val) || 0;
    };

    const formatStat = (value) => {
        if (value === '-' || value === null || value === undefined) return '-';
        if (Number(value) === 0) return <span className="text-slate-500 font-bold">0</span>;
        return value;
    };

    const getPlayerPhotoPaths = (player) => {
        const paths = [];
        if (player.name) paths.push(`/photo/${player.name}.png`);
        if (player.original_name) player.original_name.split(',').forEach(a => a.trim() && paths.push(`/photo/${a.trim()}.png`));
        if (player.player_id) paths.push(`/photo/${player.player_id}.png`);
        paths.push('/photo/defaultPlayer.png');
        return paths;
    };

    useEffect(() => {
        let cancelled = false;
        const resolvePhotos = async () => {
            // Combine available players and picked players
            const pickedPlayers = draftState?.picks?.map(p => p.player).filter(Boolean) || [];
            const allPlayers = [...players, ...pickedPlayers];

            // Filter out players already in photoSrcMap or resolvedIds
            const unprocessed = allPlayers.filter(p => !photoSrcMap[p.player_id] && !resolvedIds.current.has(p.player_id));
            if (unprocessed.length === 0) return;

            // Deduplicate new batch
            const uniquePlayers = Array.from(new Map(unprocessed.map(p => [p.player_id, p])).values());

            const batchPayload = uniquePlayers.map(p => ({
                id: p.player_id,
                candidates: getPlayerPhotoPaths(p).filter(path => !path.endsWith('/defaultPlayer.png'))
            }));

            // Mark as processing immediately to avoid re-entry
            uniquePlayers.forEach(p => resolvedIds.current.add(p.player_id));

            try {
                const res = await fetch('/api/photo/resolve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ players: batchPayload })
                });
                const data = await res.json();
                if (!cancelled && data.results) {
                    setPhotoSrcMap(prev => ({ ...prev, ...data.results }));
                }
            } catch (e) {
                console.error("Photo resolve failed", e);
                if (!cancelled) {
                    // Fallback locally
                    const fallback = Object.fromEntries(uniquePlayers.map(p => [p.player_id, '/photo/defaultPlayer.png']));
                    setPhotoSrcMap(prev => ({ ...prev, ...fallback }));
                }
            }
        };
        resolvePhotos();
        return () => { cancelled = true; };
    }, [players, draftState?.picks]);

    const getPlayerPhoto = (player) => {
        // 使用預解析的路徑，沒有就回退為預設
        return photoSrcMap[player.player_id] || '/photo/defaultPlayer.png';
    };

    const handleImageError = (e, player) => {
        const currentSrc = e.target.src;
        const paths = getPlayerPhotoPaths(player);

        let currentIndex = -1;
        for (let i = 0; i < paths.length; i++) {
            if (currentSrc.includes(paths[i])) {
                currentIndex = i;
                break;
            }
        }

        const nextIndex = currentIndex + 1;
        if (nextIndex < paths.length) {
            const nextPath = paths[nextIndex];
            if (nextPath.startsWith('http')) {
                e.target.src = nextPath;
            } else {
                e.target.src = window.location.origin + nextPath;
            }
        } else {
            failedImages.current.add(player.player_id);
            e.target.onerror = null;
            e.target.src = window.location.origin + '/photo/defaultPlayer.png';
        }
    };

    // ---------------------------------------------------------
    // Draft & Filtering Logic
    // ---------------------------------------------------------

    const { takenIds, recentPicks, myTeam, upcomingPicks, viewingTeam, foreignerCount, managerForeignerCounts } = useMemo(() => {
        if (!draftState?.picks) return { takenIds: new Set(), recentPicks: [], myTeam: [], upcomingPicks: [] };
        const picks = draftState.picks;

        // Coerce player_id to string to ensure safe set properties
        const taken = new Set(picks.map(p => String(p.player_id)).filter(Boolean));

        // Recent Picks: "Draft History" order (Descending Pick Number - Newest First)
        // Ensure player object has identity accessible if it's nested or direct
        const recent = picks.filter(p => p.player_id).sort((a, b) => b.pick_number - a.pick_number);

        // My Team: Coerce manager_id to string for comparison
        const currentManagerId = String(myManagerId);
        const mine = picks.filter(p => String(p.manager_id) === currentManagerId && p.player_id).map(p => ({
            ...p.player,
            player_id: p.player_id,  // Ensure player_id is available for stats lookup
            round: p.round_number,
            pick: p.pick_number,
            name: p.player?.name || 'Unknown',
            team: p.player?.team || '',
            position_list: p.player?.position_list || '',
            batter_or_pitcher: p.player?.batter_or_pitcher || '',
            position_list: p.player?.position_list || '',
            batter_or_pitcher: p.player?.batter_or_pitcher || '',
            original_name: p.player?.original_name || '',
            identity: p.player?.identity || ''
        }));

        // Viewing Team (Opponent View)
        let viewingTeam = [];
        if (viewingManagerId) {
            const targetManagerId = String(viewingManagerId);
            viewingTeam = picks.filter(p => String(p.manager_id) === targetManagerId && p.player_id).map(p => ({
                ...p.player,
                player_id: p.player_id,
                round: p.round_number,
                pick: p.pick_number,
                name: p.player?.name || 'Unknown',
                team: p.player?.team || '',
                position_list: p.player?.position_list || '',
                batter_or_pitcher: p.player?.batter_or_pitcher || '',
                position_list: p.player?.position_list || '',
                batter_or_pitcher: p.player?.batter_or_pitcher || '',
                original_name: p.player?.original_name || '',
                identity: p.player?.identity || ''
            }));
        }

        // Upcoming
        let upcoming = draftState.nextPicks || [];
        if (draftState.currentPick && upcoming.length > 0 && upcoming[0].pick_id === draftState.currentPick.pick_id) {
            upcoming = upcoming.slice(1);
        }

        // Calculate Foreigner Counts for all managers
        const managerForeignerCounts = {};
        picks.forEach(p => {
            if (!p.player_id) return;
            const mid = String(p.manager_id);
            const id = (p.player?.identity || p.identity || '').toLowerCase();
            if (id === 'foreigner' || id === 'f') {
                managerForeignerCounts[mid] = (managerForeignerCounts[mid] || 0) + 1;
            }
        });

        const foreignerCount = managerForeignerCounts[String(myManagerId)] || 0;

        return { takenIds: taken, recentPicks: recent, myTeam: mine, upcomingPicks: upcoming, viewingTeam, foreignerCount, managerForeignerCounts };
    }, [draftState, myManagerId, viewingManagerId, foreignerLimit]);

    const handlePick = async (playerId) => {
        if (pickingId) return;
        setPickingId(playerId); // Disable and show spinner for this ID

        try {
            const res = await fetch(`/api/league/${leagueId}/draft/pick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ managerId: myManagerId, playerId })
            });
            const data = await res.json();

            if (!data.success) {
                alert('Pick failed: ' + data.error);
                setPickingId(null); // Re-enable on failure
            } else {
                // Force state update
                const stateRes = await fetch(`/api/league/${leagueId}/draft/state`);
                const stateData = await stateRes.json();
                setDraftState(stateData);

                // Remove from local queue
                const qItem = queue.find(q => q.player_id === playerId);
                if (qItem) handleRemoveFromQueue(qItem.queue_id);

                setPickingId(null);
            }
        } catch (e) {
            console.error(e);
            setPickingId(null);
        }
    };

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const filteredPlayers = useMemo(() => {
        let result = players.filter(p => {
            // Force string comparison for reliable filtering
            if (takenIds.has(String(p.player_id))) return false;

            if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !p.team?.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            if (filterType === 'batter' && p.batter_or_pitcher !== 'batter') return false;
            if (filterType === 'pitcher' && p.batter_or_pitcher !== 'pitcher') return false;

            if (filterPos !== 'All') {
                const posList = filterPositions(p);
                // Inclusive check for comma-separated positions (e.g. filter 'SS' matches '2B, SS')
                if (!posList.includes(filterPos)) return false;
            }

            if (filterTeam !== 'All' && p.team !== filterTeam) return false;

            if (filterIdentity !== 'All') {
                const isForeigner = p.identity?.toLowerCase() === 'foreigner';
                if (filterIdentity === 'Foreign' && !isForeigner) return false;
                if (filterIdentity === 'Local' && isForeigner) return false;
            }

            return true;
        });

        if (sortConfig.key) {
            result.sort((a, b) => {
                let valA, valB;
                if (sortConfig.key === 'rank') {
                    // Use 9999 for unranked players so they go to bottom in asc sort
                    valA = playerRankings[a.player_id] || 9999;
                    valB = playerRankings[b.player_id] || 9999;
                } else {
                    valA = getPlayerStatRaw(a.player_id, sortConfig.key);
                    valB = getPlayerStatRaw(b.player_id, sortConfig.key);
                }
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result.slice(0, 500);
    }, [players, takenIds, searchTerm, filterType, filterPos, filterTeam, filterIdentity, sortConfig, playerStats, playerRankings]);

    // Helpers
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
            case '統一獅': return 'text-orange-400 border-orange-500/50';
            case '富邦悍將': return 'text-blue-400 border-blue-500/50';
            case '樂天桃猿': return 'text-rose-400 border-rose-500/50';
            case '中信兄弟': return 'text-yellow-400 border-yellow-500/50';
            case '味全龍': return 'text-red-400 border-red-500/50';
            case '台鋼雄鷹': return 'text-green-400 border-green-500/50';
            default: return 'text-slate-400 border-slate-700';
        }
    };

    const formatTime = (seconds) => {
        if (seconds > 86400) return `${Math.floor(seconds / 86400)}d`;
        if (seconds > 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
        if (seconds > 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        return seconds;
    };

    const renderQueueItem = (item, index) => {
        const player = players.find(p => p.player_id === item.player_id) || item.player;
        if (!player) return null;
        const isBatter = player.batter_or_pitcher === 'batter';
        const baseCats = isBatter ? batterStatCategories : pitcherStatCategories;
        const forcedCat = isBatter ? 'At Bats (AB)' : 'Innings Pitched (IP)';
        const forcedAbbr = isBatter ? 'AB' : 'IP';
        const hasForced = baseCats.some(c => getStatAbbr(c) === forcedAbbr);
        const cats = hasForced ? baseCats : [forcedCat, ...baseCats];
        const showOriginalName = player.original_name && player.original_name !== player.name;

        return (
            <div key={item.queue_id} className="flex flex-col text-sm p-3 hover:bg-slate-800/50 rounded transition-colors group border-b border-slate-700/50">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                            <span className="text-purple-400 font-mono font-bold text-xs">{index + 1}</span>
                            <div className="flex flex-col gap-0.5 mt-1">
                                <button onClick={() => handleReorderQueue(index, 'up')} className="text-slate-500 hover:text-white px-1 leading-none text-xs">▲</button>
                                <button onClick={() => handleReorderQueue(index, 'down')} className="text-slate-500 hover:text-white px-1 leading-none text-xs">▼</button>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                {playerRankings[player.player_id] && (
                                    <span className="text-[10px] font-bold text-cyan-400">#{playerRankings[player.player_id]}</span>
                                )}
                                <span className="text-slate-200 font-bold group-hover:text-white text-base">{player.name}</span>
                                <span className="text-xs text-slate-400 font-mono">{filterPositions(player)}</span>
                                {player.identity?.toLowerCase() === 'foreigner' && (
                                    <span className="text-[9px] font-bold bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30">F</span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold border leading-none ${getTeamColor(player.team)}`}>
                                    {getTeamAbbr(player.team)}
                                </span>
                            </div>
                            {showOriginalName && (
                                <div className="text-[10px] text-slate-500 mt-0.5">{player.original_name}</div>
                            )}
                        </div>
                    </div>
                    <button disabled={queuingIds.has(item.player_id)} onClick={() => handleRemoveFromQueue(item.queue_id)} className="text-slate-500 hover:text-red-400 p-1 flex items-center justify-center w-6 h-6">
                        {queuingIds.has(item.player_id) ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-500"></div>
                        ) : '×'}
                    </button>
                </div>
                <div className="flex gap-2 mt-2 text-[10px] text-slate-400 overflow-x-auto scrollbar-hide">
                    {cats.map(cat => {
                        const isForced = !baseCats.includes(cat);
                        return (
                            <div key={cat} className="flex flex-col items-center min-w-[30px]">
                                <span className={`mb-0.5 ${isForced ? 'text-slate-600' : 'text-slate-600'}`}>{getStatAbbr(cat)}</span>
                                <span className={`${isForced ? 'text-slate-500' : 'text-slate-300'}`}>{formatStat(getPlayerStat(player.player_id, cat))}</span>
                            </div>
                        );
                    })}
                </div>
                <button
                    onClick={() => handlePick(player.player_id)}
                    disabled={!!pickingId || draftState?.currentPick?.manager_id !== myManagerId || takenIds.has(player.player_id)}
                    className={`mt-2 w-full py-1 rounded text-xs font-bold transition-all flex items-center justify-center gap-2
                        ${draftState?.currentPick?.manager_id === myManagerId && !takenIds.has(player.player_id)
                            ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                        }`}
                >
                    {pickingId === player.player_id && (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    )}
                    {pickingId === player.player_id ? 'Drafting...' : 'Draft'}
                </button>
            </div>
        );
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="animate-spin text-purple-500 text-4xl">⚾</div>
        </div>
    );

    const baseStatCats = filterType === 'batter' ? batterStatCategories : pitcherStatCategories;
    const forcedStatCat = filterType === 'batter' ? 'At Bats (AB)' : 'Innings Pitched (IP)';
    const forcedStatAbbr = filterType === 'batter' ? 'AB' : 'IP';
    const hasForcedStat = baseStatCats.some(c => getStatAbbr(c) === forcedStatAbbr);
    const currentStatCats = hasForcedStat ? baseStatCats : [forcedStatCat, ...baseStatCats];

    // Filter Positions Options
    const getPosOptions = () => {
        const pitcherPos = ['SP', 'RP', 'P'];
        return Object.keys(rosterPositions)
            .filter(k => k !== 'BN' && k !== 'IL') // Exclude Bench and IL if needed
            .filter(k => !k.includes('Minor')) // Exclude Minor explicitly as requested
            .filter(k => {
                if (filterType === 'pitcher') {
                    return pitcherPos.includes(k);
                } else {
                    return !pitcherPos.includes(k);
                }
            });
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 font-sans">
            <LegendModal
                isOpen={showLegend}
                onClose={() => setShowLegend(false)}
                batterStats={batterStatCategories}
                pitcherStats={pitcherStatCategories}
            />

            {/* Assignment Modal */}
            {assignModalPlayer && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => !assigning && setAssignModalPlayer(null)}>
                    <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-purple-500/30" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4 text-purple-300">Assign {assignModalPlayer.name} to Slot</h3>
                        {assigning ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
                                <div className="text-slate-400">Assigning...</div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                    {getAvailableSlotsForPlayer(assignModalPlayer).map(slotInfo => {
                                        const assignment = getAssignedPlayer(slotInfo.key);
                                        return (
                                            <button
                                                key={slotInfo.key}
                                                onClick={async () => {
                                                    setAssigningId(slotInfo.key);
                                                    const success = await handleAssignToSlot(assignModalPlayer.player_id, slotInfo.key);
                                                    setAssigningId(null);
                                                    if (success) setAssignModalPlayer(null);
                                                }}
                                                disabled={!!assignment || assigning}
                                                className={`w-full p-3 rounded border text-left transition-colors relative ${assignment
                                                    ? 'bg-slate-700/50 border-slate-600 text-slate-500 cursor-not-allowed'
                                                    : 'bg-slate-700 border-slate-600 hover:border-purple-500 hover:bg-purple-900/30'
                                                    }`}
                                            >
                                                {assigning && assigningId === slotInfo.key && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between">
                                                    <span className="font-mono font-bold text-purple-400">{slotInfo.display}</span>
                                                    {assignment && <span className="text-xs text-slate-500">Occupied by {assignment.name}</span>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => setAssignModalPlayer(null)}
                                    className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded transition-colors"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Assignment Modal - Select Player for Slot */}
            {assignModalSlot && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setAssignModalSlot(null)}>
                    <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full border border-purple-500/30 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4 text-purple-300">Select Player for {assignModalSlot.replace(/\d+$/, '')}</h3>
                        <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
                            {getAvailablePlayersForSlot(assignModalSlot).length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    No available players for this position
                                </div>
                            ) : (
                                getAvailablePlayersForSlot(assignModalSlot).map(player => (
                                    <button
                                        key={player.player_id}
                                        onClick={async () => {
                                            setAssigningId(player.player_id);
                                            const success = await handleAssignToSlot(player.player_id, assignModalSlot);
                                            setAssigningId(null);
                                            if (success) setAssignModalSlot(null);
                                        }}
                                        disabled={assigning || assigningId === player.player_id}
                                        className={`w-full p-3 rounded border bg-slate-700 border-slate-600 hover:border-purple-500 hover:bg-purple-900/30 text-left transition-colors ${assigning || assigningId === player.player_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-600 overflow-hidden border border-slate-500 shrink-0 relative">
                                                {assigning && assigningId === player.player_id && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    </div>
                                                )}                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={getPlayerPhoto(player)}
                                                    onError={(e) => handleImageError(e, player)}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-slate-200">{player.name}</div>
                                                <div className="text-xs text-slate-500">{filterPositions(player)}</div>
                                            </div>
                                            <div className={`text-xs px-2 py-1 rounded border ${getTeamColor(player.team)}`}>
                                                {getTeamAbbr(player.team)}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        <button
                            onClick={() => setAssignModalSlot(null)}
                            className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Header Area */}
            <div className="flex flex-col gap-2 mb-4">
                {/* Main Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center border border-purple-500/30 shadow-lg gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-purple-900/50 rounded-full flex items-center justify-center border-2 border-purple-500">
                            <span className="text-2xl">🏆</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-blue-300">Live Draft Room</h1>
                            {draftState?.currentPick ? (
                                <div className="flex items-center gap-2 text-lg">
                                    <span className="bg-slate-700 px-2 py-0.5 rounded text-sm text-slate-300">Rd {draftState.currentPick.round_number}</span>
                                    <span className="text-purple-200 font-bold">Pick {draftState.currentPick.pick_number}</span>
                                </div>
                            ) : (
                                <div className="text-lg text-blue-300 animate-pulse">
                                    {draftState?.status === 'pre-draft' ? 'Draft Room Open' : 'Draft Finished'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        <div className={`text-6xl font-mono font-black tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(0,0,0,0.5)] ${timeLeft < 10 && draftState?.status !== 'pre-draft' ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                            {timeLeft < 0 && draftState?.status !== 'pre-draft' ? (
                                <span className="text-4xl text-red-500 animate-pulse whitespace-nowrap">Auto picking...</span>
                            ) : (
                                formatTime(timeLeft < 0 ? 0 : timeLeft)
                            )}
                        </div>
                        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mt-1">
                            {draftState?.status === 'pre-draft' ? 'Until Start' : 'Time Remaining'}
                        </div>
                    </div>

                    <div className="flex flex-col items-end min-w-[200px]">
                        {!draftState?.currentPick ? (
                            <div className="text-right">
                                {draftState?.status === 'pre-draft' && draftState.startTime && (
                                    <div className="text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                                        ⏰ Starts: {new Date(draftState.startTime).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-right bg-slate-800/80 p-3 rounded-lg border border-yellow-500/30 w-full">
                                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">On The Clock</div>
                                <div className="text-xl font-bold text-yellow-300 truncate">
                                    {draftState.currentPick.manager_id === myManagerId ? '🟢 YOU' : '🔴 Opponent'}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">{getMemberNickname(draftState.currentPick.manager_id)}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Draft Order Ticker - Split View */}
                <div className="flex gap-2">
                    {/* Left: Previous Pick */}
                    <div className="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg p-2 flex items-center gap-2 overflow-hidden shadow-inner min-w-0">
                        <span className="text-xs font-bold text-slate-500 uppercase px-2 shrink-0 border-r border-slate-700 mr-2">Previous:</span>
                        {recentPicks.length > 0 ? (
                            (() => {
                                const lastPick = recentPicks[0];
                                return (
                                    <div className="flex items-center gap-3 min-w-0 animate-fade-in">
                                        <div className="flex flex-col leading-none shrink-0">
                                            <span className="text-xs font-mono text-slate-400">Pick {lastPick.pick_number}</span>
                                            <span className="text-[10px] text-slate-600">Rd {lastPick.round_number}</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-600 shrink-0">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={getPlayerPhoto({ ...lastPick.player, player_id: lastPick.player_id })}
                                                onError={(e) => handleImageError(e, { ...lastPick.player, player_id: lastPick.player_id })}
                                                alt={lastPick.player?.name || 'Player'}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-sm font-bold text-slate-200 truncate">{lastPick.player?.name}</span>
                                                <span className="text-xs text-slate-400 font-mono">{filterPositions(lastPick.player || {})}</span>
                                                <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold border leading-none ${getTeamColor(lastPick.player?.team)} ml-1`}>
                                                    {getTeamAbbr(lastPick.player?.team)}
                                                </span>
                                                {/* Ensure we access identity from nested player object if available, or top level if constructed manually */}
                                                {(lastPick.player?.identity || lastPick.identity)?.toLowerCase() === 'foreigner' && (
                                                    <span className="text-[9px] font-bold bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30 ml-1">F</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-500 truncate">
                                                Picked by <span className="text-slate-300 font-semibold">{getMemberNickname(lastPick.manager_id)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <span className="text-xs text-slate-600 italic px-2">No picks yet</span>
                        )}
                    </div>

                    {/* Right: Up Next */}
                    <div className="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg p-2 flex items-center gap-2 overflow-x-auto scrollbar-hide shadow-inner min-w-0">
                        <span className="text-xs font-bold text-slate-500 uppercase px-2 shrink-0 border-r border-slate-700 mr-2">Up Next:</span>
                        {draftState?.currentPick && (
                            <div className="flex items-center gap-2 animate-pulse bg-purple-900/40 px-3 py-1.5 rounded border border-purple-500/50 shrink-0">
                                <span className="text-xs font-mono text-purple-300">Pick {draftState.currentPick.pick_number}</span>
                                <span className="text-xs text-slate-400">-</span>
                                <span className="text-xs font-bold text-white">{getMemberNickname(draftState.currentPick.manager_id)}</span>
                                <span className="text-[10px] bg-purple-600 text-white px-1 rounded">NOW</span>
                            </div>
                        )}
                        {upcomingPicks.slice(0, 10).map((pick, i) => (
                            <div key={pick.pick_id} className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded border border-slate-700/50 shrink-0 opacity-80 hover:opacity-100 transition-opacity">
                                <span className="text-xs font-mono text-slate-400">Pick {pick.pick_number}</span>
                                <span className="text-xs text-slate-500">-</span>
                                <span className="text-xs font-bold text-slate-300">{getMemberNickname(pick.manager_id)}</span>
                                {pick.manager_id === myManagerId && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Tab Selector */}
            <div className="flex justify-between items-end mb-4 border-b-2 border-slate-700">
                <div className="flex gap-4">
                    <button
                        onClick={() => setMainTab('players')}
                        className={`px-6 py-3 text-lg font-bold uppercase tracking-widest transition-all ${mainTab === 'players'
                            ? 'text-white border-b-4 border-purple-500 -mb-0.5'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Players
                    </button>
                    <button
                        onClick={() => setMainTab('roster')}
                        className={`px-6 py-3 text-lg font-bold uppercase tracking-widest transition-all ${mainTab === 'roster'
                            ? 'text-white border-b-4 border-purple-500 -mb-0.5'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        My Roster ({draftRosterAssignments.length})
                    </button>
                    <button
                        onClick={() => setMainTab('league_rosters')}
                        className={`px-6 py-3 text-lg font-bold uppercase tracking-widest transition-all ${mainTab === 'league_rosters'
                            ? 'text-white border-b-4 border-purple-500 -mb-0.5'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        League Rosters
                    </button>
                </div>

                {/* Foreigner Limit Hint */}
                {foreignerLimit !== null && (
                    <div className="bg-slate-800/80 px-4 py-2 rounded-t-lg border-t border-x border-slate-600 mb-0 text-sm font-bold text-slate-300 flex items-center gap-2">
                        <span>Foreigners:</span>
                        <span className={`text-base ${foreignerLimit !== null && foreignerCount >= foreignerLimit ? "text-red-400" : "text-white"}`}>{foreignerCount}</span>
                        <span className="text-slate-500">/</span>
                        <span className="text-white">{foreignerLimit}</span>
                        {foreignerLimit !== null && foreignerCount >= foreignerLimit && (
                            <span className="ml-2 text-red-400 text-xs font-black uppercase tracking-wider animate-pulse border border-red-500/50 px-1 rounded bg-red-900/30">
                                Limit Reached
                            </span>
                        )}
                    </div>
                )}
            </div>

            {mainTab === 'players' && (
                <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-350px)]">
                    {/* Center: Player Pool */}
                    <div className="flex-[3] bg-slate-800/40 rounded-xl p-4 border border-slate-700 flex flex-col backdrop-blur-sm shadow-xl">
                        {/* Filter Bar */}
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 mb-4 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-bold text-lg mr-2">Players</span>
                                <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
                                    <button
                                        className={`px-4 py-1 text-sm rounded transition-all ${filterType === 'batter' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                        onClick={() => {
                                            setFilterType('batter');
                                            if (batterStatCategories.length > 0) {
                                                setSortConfig({ key: batterStatCategories[0], direction: 'desc' });
                                            }
                                        }}
                                    >Batter</button>
                                    <button
                                        className={`px-4 py-1 text-sm rounded transition-all ${filterType === 'pitcher' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                        onClick={() => {
                                            setFilterType('pitcher');
                                            if (pitcherStatCategories.length > 0) {
                                                setSortConfig({ key: pitcherStatCategories[0], direction: 'desc' });
                                            }
                                        }}
                                    >Pitcher</button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center">
                                {/* Legend Button moved here */}
                                <button
                                    onClick={() => setShowLegend(true)}
                                    className="bg-slate-800 border border-slate-600 text-purple-400 hover:text-white hover:bg-purple-600/50 hover:border-purple-500 px-3 py-1.5 rounded text-xs transition-all font-bold"
                                >
                                    Legend
                                </button>

                                <select
                                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-purple-500"
                                    value={filterTeam}
                                    onChange={e => setFilterTeam(e.target.value)}
                                >
                                    <option value="All">All Teams</option>
                                    <option value="中信兄弟">Brothers</option>
                                    <option value="統一獅">Lions</option>
                                    <option value="樂天桃猿">Monkeys</option>
                                    <option value="富邦悍將">Guardians</option>
                                    <option value="味全龍">Dragons</option>
                                    <option value="台鋼雄鷹">Hawks</option>
                                </select>

                                <select
                                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-purple-500"
                                    value={filterPos}
                                    onChange={e => setFilterPos(e.target.value)}
                                >
                                    <option value="All">All Positions</option>
                                    {getPosOptions().map(k => <option key={k} value={k}>{k}</option>)}
                                </select>

                                <select
                                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-purple-500"
                                    value={filterIdentity}
                                    onChange={e => setFilterIdentity(e.target.value)}
                                >
                                    <option value="All">All</option>
                                    <option value="Local">Local</option>
                                    <option value="Foreign">Foreign</option>
                                </select>

                                <input
                                    className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs text-slate-200 w-32 focus:w-48 transition-all outline-none focus:border-purple-500"
                                    placeholder="Search Name..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-auto rounded-lg border border-slate-700 bg-slate-900/50 custom-scrollbar relative">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900/95 sticky top-0 z-10 text-[10px] text-slate-400 uppercase tracking-wider font-semibold shadow-md">
                                    <tr>
                                        <th className="p-2 border-b border-slate-700 min-w-[50px] text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('rank')}>
                                            <div className="flex items-center justify-center gap-1">
                                                Rank
                                                {sortConfig.key === 'rank' && (<span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>)}
                                            </div>
                                        </th>
                                        <th className="p-2 border-b border-slate-700 min-w-[250px]">Player</th>
                                        {currentStatCats.map(cat => (
                                            <th key={cat} className="p-2 border-b border-slate-700 text-center min-w-[40px] cursor-pointer hover:text-white transition-colors"
                                                onClick={() => handleSort(cat)}
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    {getStatAbbr(cat)}
                                                    {sortConfig.key === cat && (<span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>)}
                                                </div>
                                            </th>
                                        ))}
                                        <th className="p-2 border-b border-slate-700 text-right sticky right-0 bg-slate-900 shadow-l">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPlayers.map(player => {
                                        const isForeigner = player.identity?.toLowerCase() === 'foreigner';
                                        const showOriginalName = player.original_name && player.original_name !== player.name;

                                        return (
                                            <tr key={player.player_id} className="group hover:bg-slate-700/40 transition-colors border-b border-slate-800/50">
                                                {/* Rank Column */}
                                                <td className="p-2 text-center text-sm font-bold text-slate-400">
                                                    {playerRankings[player.player_id] || '-'}
                                                </td>

                                                {/* Player Info Combined */}
                                                <td className="p-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600 shadow-sm relative shrink-0">
                                                            <img
                                                                src={getPlayerPhoto(player)}
                                                                onError={(e) => handleImageError(e, player)}
                                                                alt={player.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="font-bold text-slate-200 text-base">{player.name}</span>
                                                                <span className="text-slate-400 text-sm">- {filterPositions(player)}</span>
                                                                <span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold border leading-none ${getTeamColor(player.team)}`}>
                                                                    {getTeamAbbr(player.team)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {showOriginalName && (
                                                                    <span className="text-[10px] text-slate-500">{player.original_name}</span>
                                                                )}
                                                                <div className="flex gap-1">
                                                                    {isForeigner && (
                                                                        <span className="text-[9px] font-bold bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30">F</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Stats */}
                                                {currentStatCats.map(cat => {
                                                    const val = getPlayerStat(player.player_id, cat);
                                                    const isForced = !baseStatCats.includes(cat);
                                                    return (
                                                        <td key={cat} className={`p-2 text-center text-xs font-mono ${isForced ? 'text-slate-500' : 'text-slate-300'}`}>
                                                            {formatStat(val)}
                                                        </td>
                                                    );
                                                })}

                                                {/* Action */}
                                                <td className="p-2 text-right sticky right-0 bg-slate-900/0 group-hover:bg-slate-800/0">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => isQueued(player.player_id) ? handleRemoveFromQueue(queue.find(q => q.player_id === player.player_id)?.queue_id) : handleAddToQueue(player)}
                                                            disabled={queuingIds.has(player.player_id)}
                                                            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${isQueued(player.player_id) ? 'bg-purple-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white'}`}
                                                        >
                                                            {queuingIds.has(player.player_id) ? (
                                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                            ) : (
                                                                isQueued(player.player_id) ? '★' : '☆'
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => handlePick(player.player_id)}
                                                            disabled={!!pickingId || draftState?.currentPick?.manager_id !== myManagerId || takenIds.has(String(player.player_id)) || (isForeigner && foreignerLimit !== null && foreignerCount >= foreignerLimit)}
                                                            className={`px-4 py-1.5 rounded-[4px] text-xs font-bold shadow-md transition-all flex items-center gap-2
                                                            ${draftState?.currentPick?.manager_id === myManagerId && !pickingId && !(isForeigner && foreignerLimit !== null && foreignerCount >= foreignerLimit)
                                                                    ? 'bg-green-600 hover:bg-green-500 text-white hover:scale-105 active:scale-95'
                                                                    : 'bg-slate-700/50 text-slate-600 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            {pickingId === player.player_id && (
                                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                            )}
                                                            {pickingId === player.player_id ? 'DRAFTING...'
                                                                : (isForeigner && foreignerLimit !== null && foreignerCount >= foreignerLimit)
                                                                    ? 'LIMIT'
                                                                    : 'DRAFT'
                                                            }
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Info Panels */}
                    <div className="flex-1 flex flex-col gap-4 min-w-[300px] lg:max-w-[350px]">
                        {/* Draft History / Future Sidebar */}
                        <div className={`bg-slate-800/40 rounded-xl border border-slate-700 flex flex-col backdrop-blur-sm shadow-xl transition-all duration-300 overflow-hidden ${isSidebarHistoryOpen ? (isSidebarTeamOpen ? 'h-1/2' : 'flex-1') : 'h-auto shrink-0 flex-none'
                            }`}>
                            <div className="flex justify-between items-center px-4 pt-3 pb-2 border-b border-slate-700/50">
                                <div className="flex gap-4">
                                    <button onClick={() => setSidebarTab('history')} className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${sidebarTab === 'history' ? 'text-white border-purple-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                                        Recent
                                    </button>
                                    <button onClick={() => setSidebarTab('future')} className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${sidebarTab === 'future' ? 'text-white border-purple-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                                        Upcoming
                                    </button>
                                </div>
                                <button
                                    onClick={() => setSidebarHistoryOpen(!isSidebarHistoryOpen)}
                                    className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                                >
                                    {isSidebarHistoryOpen ? '▼' : '◀'}
                                </button>
                            </div>

                            {isSidebarHistoryOpen && (
                                <div className="flex-1 overflow-y-auto space-y-1 p-4 pt-2 pr-1 custom-scrollbar">
                                    {sidebarTab === 'history' ? (
                                        <>
                                            {recentPicks.length === 0 && <div className="text-slate-500 text-sm text-center py-4">No picks yet</div>}
                                            {recentPicks.map(pick => (
                                                <div key={pick.pick_id} className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 flex items-center gap-2">
                                                    <div className="flex flex-col items-center min-w-[30px]">
                                                        <div className="text-xs font-mono text-purple-400 font-bold bg-purple-900/20 px-1.5 py-0.5 rounded">
                                                            #{pick.pick_number}
                                                        </div>
                                                        <div className="text-[9px] text-slate-500 mt-0.5 max-w-[60px] truncate" title={getMemberNickname(pick.manager_id)}>
                                                            {getMemberNickname(pick.manager_id)}
                                                        </div>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-600 shrink-0">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={getPlayerPhoto({ ...pick.player, player_id: pick.player_id })}
                                                            onError={(e) => handleImageError(e, { ...pick.player, player_id: pick.player_id })}
                                                            alt={pick.player?.name || 'Player'}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-slate-200 truncate flex items-center gap-1">
                                                            {playerRankings[pick.player_id] && (
                                                                <span className="text-[10px] font-bold text-cyan-400 mr-1">#{playerRankings[pick.player_id]}</span>
                                                            )}
                                                            {pick.player?.name}
                                                            {(pick.player?.identity || pick.identity)?.toLowerCase() === 'foreigner' && (
                                                                <span className="text-[9px] font-bold bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30">F</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">{filterPositions(pick.player || {})}</div>
                                                    </div>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getTeamColor(pick.player?.team)} shrink-0`}>
                                                        {getTeamAbbr(pick.player?.team)}
                                                    </span>
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        <>
                                            {upcomingPicks.length === 0 && <div className="text-slate-500 text-sm text-center py-4">No remaining picks</div>}
                                            {upcomingPicks.map(pick => (
                                                <div key={pick.pick_id} className="bg-slate-800/50 p-2 rounded border border-slate-700/50 flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono text-slate-400">Pick {pick.pick_number}</span>
                                                        {pick.manager_id === myManagerId ? (
                                                            <span className="text-sm font-bold text-green-400">You</span>
                                                        ) : (
                                                            <span className="text-sm font-bold text-slate-300">{getMemberNickname(pick.manager_id)}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">Rd {pick.round_number}</div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* My Team & Queue & Roster Tabs */}
                        <div className={`bg-slate-800/40 rounded-xl border border-slate-700 flex flex-col backdrop-blur-sm shadow-xl transition-all duration-300 overflow-hidden ${isSidebarTeamOpen ? (isSidebarHistoryOpen ? 'h-1/2' : 'flex-1') : 'h-auto shrink-0 flex-none'
                            }`}>
                            <div className="flex justify-between items-center px-4 pt-3 pb-2 border-b border-slate-700/50">
                                <div className="flex gap-4">
                                    <button onClick={() => setActiveTab('team')} className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'team' ? 'text-white border-purple-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                                        Team ({myTeam.length})
                                    </button>
                                    <button onClick={() => setActiveTab('queue')} className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'queue' ? 'text-white border-purple-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                                        Queue ({queue.length})
                                    </button>
                                    <button onClick={() => setActiveTab('roster')} className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab === 'roster' ? 'text-white border-purple-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                                        Roster ({draftRosterAssignments.length})
                                    </button>
                                </div>

                                <button
                                    onClick={() => setSidebarTeamOpen(!isSidebarTeamOpen)}
                                    className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                                >
                                    {isSidebarTeamOpen ? '▼' : '◀'}
                                </button>
                            </div>

                            {isSidebarTeamOpen && (
                                <div className="flex-1 overflow-y-auto space-y-1 p-4 pt-2 pr-1 custom-scrollbar">
                                    {activeTab === 'team' ? (
                                        <>
                                            {myTeam.length === 0 && <div className="text-slate-500 text-sm text-center py-4">Your roster is empty</div>}
                                            {myTeam.map((p, i) => {
                                                const isBatter = p.batter_or_pitcher === 'batter';
                                                const baseCats = isBatter ? batterStatCategories : pitcherStatCategories;
                                                const forcedCat = isBatter ? 'At Bats (AB)' : 'Innings Pitched (IP)';
                                                const hasForced = baseCats.some(c => getStatAbbr(c) === (isBatter ? 'AB' : 'IP'));
                                                const cats = hasForced ? baseCats : [forcedCat, ...baseCats];
                                                const showOriginalName = p.original_name && p.original_name !== p.name;
                                                return (
                                                    <div key={i} className="flex flex-col text-sm p-3 hover:bg-slate-800/50 rounded transition-colors group border-b border-slate-700/50">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden border border-slate-600 shadow-sm relative shrink-0">
                                                                    <img
                                                                        src={getPlayerPhoto(p)}
                                                                        onError={(e) => handleImageError(e, p)}
                                                                        alt={p.name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-baseline gap-2">
                                                                        {playerRankings[p.player_id] && (
                                                                            <span className="text-[10px] font-bold text-cyan-400">#{playerRankings[p.player_id]}</span>
                                                                        )}
                                                                        <span className="text-slate-200 font-bold group-hover:text-white text-base">{p.name}</span>
                                                                        <span className="text-xs text-slate-400 font-mono">{filterPositions(p)}</span>
                                                                        {p.identity?.toLowerCase() === 'foreigner' && (
                                                                            <span className="text-[9px] font-bold bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30">F</span>
                                                                        )}
                                                                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold border leading-none ${getTeamColor(p.team)}`}>
                                                                            {getTeamAbbr(p.team)}
                                                                        </span>
                                                                    </div>
                                                                    {showOriginalName && (
                                                                        <div className="text-[10px] text-slate-500 mt-0.5">{p.original_name}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 mt-2 text-[10px] text-slate-400 overflow-x-auto scrollbar-hide">
                                                            {cats.map(cat => {
                                                                const isForced = isBatter
                                                                    ? (cat === 'At Bats (AB)' && !batterStatCategories.includes(cat))
                                                                    : (cat === 'Innings Pitched (IP)' && !pitcherStatCategories.includes(cat));

                                                                return (
                                                                    <div key={cat} className="flex flex-col items-center min-w-[30px]">
                                                                        <span className={`mb-0.5 ${isForced ? 'text-slate-500/60' : 'text-slate-600'}`}>{getStatAbbr(cat)}</span>
                                                                        <span className={`${isForced ? 'text-slate-500' : 'text-slate-300'}`}>{formatStat(getPlayerStat(p.player_id, cat))}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    ) : activeTab === 'queue' ? (
                                        <>
                                            {queue.length === 0 && <div className="text-slate-500 text-sm text-center py-4 text-xs italic">
                                                Players in queue will be auto-drafted if time expires.<br />
                                                Drag & drop or use arrows to reorder.
                                            </div>}
                                            {queue.map((item, i) => renderQueueItem(item, i))}
                                        </>
                                    ) : (
                                        <>
                                            {/* Roster Grid */}
                                            <div className="space-y-2">
                                                {Object.keys(rosterPositions)
                                                    .filter(slot => !slot.includes('Minor'))
                                                    .map(slot => {
                                                        const count = rosterPositions[slot];
                                                        return Array.from({ length: count }).map((_, idx) => {
                                                            const slotKey = count > 1 ? `${slot}${idx + 1}` : slot;
                                                            const assignment = getAssignedPlayer(slotKey);

                                                            return (
                                                                <div key={slotKey} className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 flex items-center gap-2">
                                                                    <div className="flex flex-col items-center min-w-[30px]">
                                                                        <div className="text-xs font-mono text-purple-400 font-bold bg-purple-900/20 px-1.5 py-0.5 rounded">
                                                                            {slot}
                                                                        </div>
                                                                    </div>
                                                                    {assignment ? (
                                                                        <>
                                                                            <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-600 shrink-0">
                                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                <img
                                                                                    src={getPlayerPhoto(assignment)}
                                                                                    onError={(e) => handleImageError(e, assignment)}
                                                                                    className="w-full h-full object-cover"
                                                                                />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-sm font-bold text-slate-200 truncate flex items-center gap-1">
                                                                                    {playerRankings[assignment.player_id] && (
                                                                                        <span className="text-[10px] font-bold text-cyan-400 mr-0.5">#{playerRankings[assignment.player_id]}</span>
                                                                                    )}
                                                                                    {assignment.name}
                                                                                    <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold border leading-none ${getTeamColor(assignment.team)}`}>
                                                                                        {getTeamAbbr(assignment.team)}
                                                                                    </span>
                                                                                    {assignment.identity?.toLowerCase() === 'foreigner' && (
                                                                                        <span className="text-[9px] font-bold bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30">F</span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-[10px] text-slate-500">{filterPositions(assignment)}</div>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleRemoveAssignment(assignment.assignment_id)}
                                                                                disabled={assigning}
                                                                                className="text-slate-500 hover:text-red-400 text-xs px-2 disabled:opacity-50"
                                                                            >
                                                                                {assigning && assigningId === assignment.assignment_id ? (
                                                                                    <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-slate-400"></div>
                                                                                ) : '×'}
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <div className="text-slate-600 text-xs italic">Empty</div>
                                                                    )}
                                                                </div>
                                                            );
                                                        });
                                                    })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {mainTab === 'roster' && (
                <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700 backdrop-blur-sm shadow-xl overflow-auto" style={{ height: 'calc(100vh - 350px)' }}>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-bold text-purple-300">Roster Assignment ({draftRosterAssignments.length})</h2>
                        <button
                            onClick={() => setShowLegend(true)}
                            className="px-2 py-0.5 rounded-full bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/50 text-blue-300 text-[10px] font-bold tracking-wider transition-colors"
                        >
                            LEGEND
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">Click on empty slots to assign players</p>

                    {/* Unassigned Players Section (Moved to Top) */}
                    {myTeam.filter(p => !isPlayerAssigned(p.player_id)).length > 0 && (
                        <>
                            <div className="border-b border-slate-700 pb-4 mb-4">
                                <h3 className="text-lg font-bold mb-2 text-slate-300">Unassigned Players ({myTeam.filter(p => !isPlayerAssigned(p.player_id)).length})</h3>
                                <p className="text-xs text-slate-400 mb-3">Click on a player to assign them to a position</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                    {myTeam.filter(p => !isPlayerAssigned(p.player_id)).map((player) => {
                                        const isBatter = player.batter_or_pitcher === 'batter';
                                        return (
                                            <div
                                                key={player.player_id}
                                                onClick={() => setAssignModalPlayer(player)}
                                                className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/50 hover:border-purple-500/50 transition-all cursor-pointer hover:bg-slate-800/80"
                                            >
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 shrink-0 relative">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={getPlayerPhoto(player)}
                                                            onError={(e) => handleImageError(e, player)}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="text-center w-full">
                                                        <div className="text-xs font-bold text-slate-200 truncate flex items-center justify-center gap-1">
                                                            {playerRankings[player.player_id] && (
                                                                <span className="text-[10px] font-bold text-cyan-400">#{playerRankings[player.player_id]}</span>
                                                            )}
                                                            {player.name}
                                                            <span className={`px-1 py-0.5 rounded-[4px] text-[8px] font-bold border leading-none ${getTeamColor(player.team)}`}>
                                                                {getTeamAbbr(player.team)}
                                                            </span>
                                                            {player.identity?.toLowerCase() === 'foreigner' && (
                                                                <span className="text-[8px] font-bold bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30">F</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 truncate">{filterPositions(player)}</div>


                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Roster Tables Helper */}
                    {(() => {
                        const BATTER_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'CI', 'MI', 'LF', 'CF', 'RF', 'OF', 'Util'];
                        const PITCHER_POSITIONS = ['SP', 'RP', 'P'];

                        // Helper to render a table for a group of positions
                        const renderTable = (title, slots, isPitcher) => {
                            if (!slots || slots.length === 0) return null;
                            const baseCats = isPitcher ? pitcherStatCategories : batterStatCategories;
                            const forcedCat = isPitcher ? 'Innings Pitched (IP)' : 'At Bats (AB)';
                            const hasForced = baseCats.some(c => getStatAbbr(c) === (isPitcher ? 'IP' : 'AB'));
                            const statCats = hasForced ? baseCats : [forcedCat, ...baseCats];

                            return (
                                <div className="mb-6" key={title}>
                                    <h3 className="text-md font-bold text-purple-300 mb-2 border-l-4 border-purple-500 pl-2">{title}</h3>
                                    <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden">
                                        {/* Header Row */}
                                        <div className="flex bg-slate-800/60 p-2 text-xs font-bold text-slate-400 border-b border-slate-700">
                                            <div className="w-12 text-center">Slot</div>
                                            <div className="flex-1 pl-2">Player</div>
                                            <div className="flex ml-2 gap-2">
                                                {statCats && statCats.length > 0 ? statCats.map(cat => {
                                                    const isForced = isPitcher
                                                        ? (cat === 'Innings Pitched (IP)' && !pitcherStatCategories.includes(cat))
                                                        : (cat === 'At Bats (AB)' && !batterStatCategories.includes(cat));
                                                    return (
                                                        <div key={cat} className={`w-[30px] text-center ${isForced ? 'text-slate-600' : ''}`} title={cat}>{getStatAbbr(cat)}</div>
                                                    );
                                                }) : (
                                                    <div className="text-slate-600 text-[10px] italic">Stats</div>
                                                )}
                                                {/* Remove Button Placeholder for alignment if needed, though usually fixed width */}
                                                <div className="w-16 text-center">Action</div>
                                            </div>
                                        </div>

                                        {/* Rows */}
                                        {slots.map((slotKey, idx) => {
                                            // Handle slotKey vs slot label
                                            // slotKey might be 'Of1', 'Of2' etc. or just 'C'
                                            // We need to parse valid slot label for display
                                            // Actually inputs here are specific slot KEYS (unique)
                                            const slotLabel = slotKey.replace(/\d+$/, '');

                                            // Determine assignment
                                            // For My Roster: getAssignedPlayer(slotKey)
                                            // For League Rosters: viewingRosterAssignments.find...
                                            // We need to pass the context or assignment list
                                            // Let's rely on a getter passed in or check context

                                            const isLeagueView = mainTab === 'league_rosters';
                                            const assignment = isLeagueView
                                                ? viewingRosterAssignments.find(a => a.roster_slot === slotKey)
                                                : getAssignedPlayer(slotKey);

                                            return (
                                                <div
                                                    key={slotKey}
                                                    onClick={() => !assignment && !isLeagueView && setAssignModalSlot(slotKey)}
                                                    className={`flex items-center justify-between p-2 border-b border-slate-700/30 last:border-0 transition-all ${assignment
                                                        ? 'bg-slate-900/80'
                                                        : isLeagueView ? 'bg-slate-900/10' : 'bg-slate-900/20 cursor-pointer hover:bg-slate-800/50'
                                                        }`}
                                                >
                                                    <div className="w-12 text-center shrink-0">
                                                        <span className="font-mono font-bold text-stone-500 text-xs">{slotLabel}</span>
                                                    </div>

                                                    {assignment ? (
                                                        <>
                                                            <div className="flex-1 min-w-0 flex items-center gap-2 pl-2">
                                                                <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden border border-slate-600 shrink-0">
                                                                    <img
                                                                        src={getPlayerPhoto(assignment)}
                                                                        onError={(e) => handleImageError(e, assignment)}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                                                                        {playerRankings[assignment.player_id] && (
                                                                            <span className="text-[10px] font-bold text-cyan-400 mr-0.5">#{playerRankings[assignment.player_id]}</span>
                                                                        )}
                                                                        {assignment.name}
                                                                        {assignment.identity?.toLowerCase() === 'foreigner' && (
                                                                            <span className="text-[8px] font-bold bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30">F</span>
                                                                        )}
                                                                        <span className={`px-1 py-0.5 rounded-[4px] text-[9px] font-bold border leading-none ${getTeamColor(assignment.team)}`}>
                                                                            {getTeamAbbr(assignment.team)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 truncate">{assignment.position_list}</div>
                                                                </div>
                                                            </div>

                                                            <div className="flex ml-2 gap-2 text-[10px] text-slate-300 font-mono">
                                                                {statCats.map(cat => {
                                                                    const isForced = isPitcher
                                                                        ? (cat === 'Innings Pitched (IP)' && !pitcherStatCategories.includes(cat))
                                                                        : (cat === 'At Bats (AB)' && !batterStatCategories.includes(cat));
                                                                    return (
                                                                        <div key={cat} className={`w-[30px] text-center ${isForced ? 'text-slate-500' : ''}`}>
                                                                            {formatStat(getPlayerStat(assignment.player_id, cat))}
                                                                        </div>
                                                                    );
                                                                })}

                                                                <div className="w-16 flex justify-center">
                                                                    {!isLeagueView && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleRemoveAssignment(assignment.assignment_id);
                                                                            }}
                                                                            disabled={assigning}
                                                                            className="text-slate-500 hover:text-red-400 disabled:opacity-50 text-xs"
                                                                        >
                                                                            {assigning && assigningId === assignment.assignment_id ? (
                                                                                <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-slate-400"></div>
                                                                            ) : 'REMOVE'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex-1 pl-2 text-slate-600 italic text-xs">
                                                            Empty
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        };

                        const renderBenchTable = (slots) => {
                            if (!slots || slots.length === 0) return null;
                            return (
                                <div className="mb-6" key="Bench">
                                    <h3 className="text-md font-bold text-slate-400 mb-2 border-l-4 border-slate-500 pl-2">Bench</h3>
                                    <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden">
                                        {slots.map((slotKey) => {
                                            const slotLabel = slotKey.replace(/\d+$/, '');
                                            const isLeagueView = mainTab === 'league_rosters';
                                            const assignment = isLeagueView
                                                ? viewingRosterAssignments.find(a => a.roster_slot === slotKey)
                                                : getAssignedPlayer(slotKey);

                                            // Determine which stats to show for Bench (Batter or Pitcher logic based on player)
                                            // If empty, no stats.
                                            const baseCats = assignment?.batter_or_pitcher === 'pitcher' ? pitcherStatCategories : batterStatCategories;
                                            const isPitcher = assignment?.batter_or_pitcher === 'pitcher';
                                            const forcedCat = isPitcher ? 'Innings Pitched (IP)' : 'At Bats (AB)';
                                            const hasForced = baseCats.some(c => getStatAbbr(c) === (isPitcher ? 'IP' : 'AB'));
                                            const playerStatCats = hasForced ? baseCats : [forcedCat, ...baseCats];

                                            return (
                                                <div
                                                    key={slotKey}
                                                    onClick={() => !assignment && !isLeagueView && setAssignModalSlot(slotKey)}
                                                    className={`flex items-center justify-between p-3 border-b border-slate-700/30 last:border-0 transition-all ${assignment
                                                        ? 'bg-slate-900/80'
                                                        : isLeagueView ? 'bg-slate-900/10' : 'bg-slate-900/20 cursor-pointer hover:bg-slate-800/50'
                                                        }`}
                                                >
                                                    <div className="w-14 text-center shrink-0">
                                                        <span className="font-mono font-bold text-slate-500 text-sm uppercase">{slotLabel}</span>
                                                    </div>

                                                    {assignment ? (
                                                        <>
                                                            <div className="flex-1 min-w-0 flex items-center gap-3 pl-2">
                                                                <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 shrink-0 shadow-lg">
                                                                    <img
                                                                        src={getPlayerPhoto(assignment)}
                                                                        onError={(e) => handleImageError(e, assignment)}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-base font-bold text-slate-200 truncate flex items-center gap-2">
                                                                        {playerRankings[assignment.player_id] && (
                                                                            <span className="text-[11px] font-bold text-cyan-400 mr-0.5">#{playerRankings[assignment.player_id]}</span>
                                                                        )}
                                                                        {assignment.name}
                                                                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold border leading-none ${getTeamColor(assignment.team)}`}>
                                                                            {getTeamAbbr(assignment.team)}
                                                                        </span>
                                                                        {assignment.identity?.toLowerCase() === 'foreigner' && (
                                                                            <span className="text-[10px] font-bold bg-purple-900/50 text-purple-300 px-1.5 rounded border border-purple-500/30">F</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500 truncate mt-0.5">{assignment.position_list}</div>
                                                                </div>
                                                            </div>

                                                            {/* Inline Stats for Bench */}
                                                            <div className="flex ml-4 gap-3 text-[11px] text-slate-400 overflow-x-auto hide-scrollbar max-w-[500px]">
                                                                {playerStatCats.map(cat => {
                                                                    const isPitcher = assignment?.batter_or_pitcher === 'pitcher';
                                                                    const isForced = isPitcher
                                                                        ? (cat === 'Innings Pitched (IP)' && !pitcherStatCategories.includes(cat))
                                                                        : (cat === 'At Bats (AB)' && !batterStatCategories.includes(cat));

                                                                    return (
                                                                        <div key={cat} className="flex flex-col items-center min-w-[32px]">
                                                                            <span className={`mb-0.5 text-[9px] font-bold ${isForced ? 'text-slate-500/60' : 'text-slate-600'}`}>{getStatAbbr(cat)}</span>
                                                                            <span className={`font-mono ${isForced ? 'text-slate-500' : 'text-slate-200'}`}>{formatStat(getPlayerStat(assignment.player_id, cat))}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="w-20 flex justify-center shrink-0 ml-4">
                                                                {!isLeagueView && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRemoveAssignment(assignment.assignment_id);
                                                                        }}
                                                                        disabled={assigning}
                                                                        className="bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/50 px-2 py-1 rounded text-[10px] font-bold transition-all disabled:opacity-50"
                                                                    >
                                                                        {assigning && assigningId === assignment.assignment_id ? (
                                                                            <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-slate-400"></div>
                                                                        ) : 'REMOVE'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex-1 pl-2 text-slate-600 italic text-sm">
                                                            Empty Slot
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        }

                        // Flatten slots logic
                        // Need to expand counts: { C: 1, OF: 3 } -> [C, OF, OF, OF] -> [C, OF1, OF2, OF3]
                        const allSlots = Object.keys(rosterPositions).flatMap(slot => {
                            const count = rosterPositions[slot];
                            return Array.from({ length: count }).map((_, idx) => {
                                return count > 1 ? `${slot}${idx + 1}` : slot;
                            });
                        });

                        // Categorize
                        const batterSlots = [];
                        const pitcherSlots = [];
                        const benchSlots = [];

                        allSlots.forEach(slotKey => {
                            const label = slotKey.replace(/\d+$/, '');
                            if (BATTER_POSITIONS.includes(label)) batterSlots.push(slotKey);
                            else if (PITCHER_POSITIONS.includes(label)) pitcherSlots.push(slotKey);
                            else if (!label.includes('Minor')) benchSlots.push(slotKey); // Exclude Minor League slots from main bench
                        });

                        return (
                            <>
                                {renderTable('Batters', batterSlots, false)}
                                {renderTable('Pitchers', pitcherSlots, true)}
                                {renderBenchTable(benchSlots)}
                            </>
                        );
                    })()}


                </div>
            )}

            {
                mainTab === 'league_rosters' && (
                    <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700 backdrop-blur-sm shadow-xl overflow-auto" style={{ height: 'calc(100vh - 350px)' }}>
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold text-purple-300">League Rosters</h2>
                                <div className="text-xs text-slate-400">View other managers&apos; assignments</div>
                                {foreignerLimit !== null && (
                                    <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1 rounded border border-slate-700 shadow-sm">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Foreigners</span>
                                        <div className="flex items-center gap-1">
                                            <span className={`text-sm font-bold ${(managerForeignerCounts[String(viewingManagerId)] || 0) >= foreignerLimit ? 'text-red-400' : 'text-purple-300'}`}>
                                                {managerForeignerCounts[String(viewingManagerId)] || 0}
                                            </span>
                                            <span className="text-slate-600 text-[10px]">/</span>
                                            <span className="text-slate-400 text-sm">{foreignerLimit}</span>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowLegend(true)}
                                    className="px-2 py-0.5 rounded-full bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/50 text-blue-300 text-[10px] font-bold tracking-wider transition-colors"
                                >
                                    LEGEND
                                </button>
                            </div>
                            <select
                                className="bg-slate-700 text-white p-2 rounded border border-slate-600 outline-none focus:border-purple-500 min-w-[200px]"
                                value={viewingManagerId || ''}
                                onChange={(e) => setViewingManagerId(e.target.value)}
                            >
                                {members.map(m => {
                                    const fCount = managerForeignerCounts[String(m.manager_id)] || 0;
                                    return (
                                        <option key={m.manager_id} value={m.manager_id}>
                                            {m.nickname} {m.manager_id === myManagerId ? '(You)' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {viewingLoading ? (
                            <div className="flex flex-col items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
                                <div className="text-slate-400 font-mono animate-pulse">Loading roster...</div>
                            </div>
                        ) : (
                            <>
                                {/* Viewing Unassigned Players (Moved to Top) */}
                                {viewingTeam && viewingTeam.filter(p => !viewingRosterAssignments.some(a => a.player_id === p.player_id)).length > 0 && (
                                    <div className="border-b border-slate-700 pb-4 mb-4">
                                        <h3 className="text-lg font-bold mb-2 text-slate-300">Unassigned Players ({viewingTeam.filter(p => !viewingRosterAssignments.some(a => a.player_id === p.player_id)).length})</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                            {viewingTeam.filter(p => !viewingRosterAssignments.some(a => a.player_id === p.player_id)).map((player) => {
                                                const isBatter = player.batter_or_pitcher === 'batter';
                                                return (
                                                    <div
                                                        key={player.player_id}
                                                        className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/50"
                                                    >
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 shrink-0">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={getPlayerPhoto(player)}
                                                                    onError={(e) => handleImageError(e, player)}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                            <div className="text-center w-full">
                                                                <div className="text-xs font-bold text-slate-200 truncate flex items-center justify-center gap-1">
                                                                    {playerRankings[player.player_id] && (
                                                                        <span className="text-[10px] font-bold text-cyan-400">#{playerRankings[player.player_id]}</span>
                                                                    )}
                                                                    {player.name}
                                                                    <span className={`px-1 py-0.5 rounded-[4px] text-[8px] font-bold border leading-none ${getTeamColor(player.team)}`}>
                                                                        {getTeamAbbr(player.team)}
                                                                    </span>
                                                                    {player.identity?.toLowerCase() === 'foreigner' && (
                                                                        <span className="text-[8px] font-bold bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30">F</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-slate-500 truncate">{filterPositions(player)}</div>


                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {(() => {
                                    const BATTER_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'CI', 'MI', 'LF', 'CF', 'RF', 'OF', 'Util', 'DH'];
                                    const PITCHER_POSITIONS = ['SP', 'RP', 'P'];

                                    // Helper to render a table for a group of positions
                                    const renderTable = (title, slots, isPitcher) => {
                                        if (!slots || slots.length === 0) return null;
                                        const baseCats = isPitcher ? pitcherStatCategories : batterStatCategories;
                                        const forcedCat = isPitcher ? 'Innings Pitched (IP)' : 'At Bats (AB)';
                                        const hasForced = baseCats.some(c => getStatAbbr(c) === (isPitcher ? 'IP' : 'AB'));
                                        const statCats = hasForced ? baseCats : [forcedCat, ...baseCats];

                                        return (
                                            <div className="mb-6" key={title}>
                                                <h3 className="text-md font-bold text-purple-300 mb-2 border-l-4 border-purple-500 pl-2">{title}</h3>
                                                <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden">
                                                    {/* Header Row */}
                                                    <div className="flex bg-slate-800/60 p-2 text-xs font-bold text-slate-400 border-b border-slate-700">
                                                        <div className="w-12 text-center">Slot</div>
                                                        <div className="flex-1 pl-2">Player</div>
                                                        <div className="w-10 text-center">Team</div>
                                                        <div className="flex ml-2 gap-2">
                                                            {statCats && statCats.length > 0 ? statCats.map(cat => {
                                                                const isForced = isPitcher
                                                                    ? (cat === 'Innings Pitched (IP)' && !pitcherStatCategories.includes(cat))
                                                                    : (cat === 'At Bats (AB)' && !batterStatCategories.includes(cat));
                                                                return (
                                                                    <div key={cat} className={`w-[30px] text-center ${isForced ? 'text-slate-600' : ''}`} title={cat}>{getStatAbbr(cat)}</div>
                                                                );
                                                            }) : (
                                                                <div className="text-slate-600 text-[10px] italic">Stats</div>
                                                            )}
                                                            <div className="w-8"></div>
                                                        </div>
                                                    </div>

                                                    {/* Rows */}
                                                    {slots.map((slotKey, idx) => {
                                                        const slotLabel = slotKey.replace(/\d+$/, '');
                                                        const isLeagueView = mainTab === 'league_rosters';
                                                        const assignment = isLeagueView
                                                            ? viewingRosterAssignments.find(a => a.roster_slot === slotKey)
                                                            : getAssignedPlayer(slotKey);

                                                        return (
                                                            <div
                                                                key={slotKey}
                                                                onClick={() => !assignment && !isLeagueView && setAssignModalSlot(slotKey)}
                                                                className={`flex items-center justify-between p-2 border-b border-slate-700/30 last:border-0 transition-all ${assignment
                                                                    ? 'bg-slate-900/80'
                                                                    : isLeagueView ? 'bg-slate-900/10' : 'bg-slate-900/20 cursor-pointer hover:bg-slate-800/50'
                                                                    }`}
                                                            >
                                                                <div className="w-12 text-center shrink-0">
                                                                    <span className="font-mono font-bold text-stone-500 text-xs">{slotLabel}</span>
                                                                </div>

                                                                {assignment ? (
                                                                    <>
                                                                        <div className="flex-1 min-w-0 flex items-center gap-2 pl-2">
                                                                            <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden border border-slate-600 shrink-0">
                                                                                <img
                                                                                    src={getPlayerPhoto(assignment)}
                                                                                    onError={(e) => handleImageError(e, assignment)}
                                                                                    className="w-full h-full object-cover"
                                                                                />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                                                                                    {playerRankings[assignment.player_id] && (
                                                                                        <span className="text-[10px] font-bold text-cyan-400 mr-0.5">#{playerRankings[assignment.player_id]}</span>
                                                                                    )}
                                                                                    {assignment.name}
                                                                                    {assignment.identity?.toLowerCase() === 'foreigner' && (
                                                                                        <span className="text-[8px] font-bold bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/30">F</span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-[10px] text-slate-500 truncate">{assignment.position_list}</div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="w-10 text-center shrink-0">
                                                                            <span className={`text-[10px] px-1 py-0.5 rounded border ${getTeamColor(assignment.team)}`}>
                                                                                {getTeamAbbr(assignment.team)}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex ml-2 gap-2 text-[10px] text-slate-300 font-mono">
                                                                            {statCats.map(cat => {
                                                                                const isForced = isPitcher
                                                                                    ? (cat === 'Innings Pitched (IP)' && !pitcherStatCategories.includes(cat))
                                                                                    : (cat === 'At Bats (AB)' && !batterStatCategories.includes(cat));

                                                                                return (
                                                                                    <div key={cat} className={`w-[30px] text-center ${isForced ? 'text-slate-500' : ''}`}>
                                                                                        {formatStat(getPlayerStat(assignment.player_id, cat))}
                                                                                    </div>
                                                                                );
                                                                            })}

                                                                            <div className="w-8 flex justify-center">
                                                                                {!isLeagueView && (
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleRemoveAssignment(assignment.assignment_id);
                                                                                        }}
                                                                                        disabled={assigning}
                                                                                        className="text-slate-500 hover:text-red-400 disabled:opacity-50"
                                                                                    >
                                                                                        {assigning && assigningId === assignment.assignment_id ? (
                                                                                            <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-slate-400"></div>
                                                                                        ) : '×'}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex-1 pl-2 text-slate-600 italic text-xs">
                                                                        Empty
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    };

                                    const renderBenchTable = (slots) => {
                                        if (!slots || slots.length === 0) return null;
                                        return (
                                            <div className="mb-6" key="Bench">
                                                <h3 className="text-md font-bold text-slate-400 mb-2 border-l-4 border-slate-500 pl-2">Bench</h3>
                                                <div className="bg-slate-900/40 rounded-lg border border-slate-700/50 overflow-hidden">
                                                    {slots.map((slotKey) => {
                                                        const slotLabel = slotKey.replace(/\d+$/, '');
                                                        const isLeagueView = mainTab === 'league_rosters';
                                                        const assignment = isLeagueView
                                                            ? viewingRosterAssignments.find(a => a.roster_slot === slotKey)
                                                            : getAssignedPlayer(slotKey);

                                                        const playerStatCats = assignment?.batter_or_pitcher === 'pitcher' ? pitcherStatCategories : batterStatCategories;

                                                        return (
                                                            <div
                                                                key={slotKey}
                                                                onClick={() => !assignment && !isLeagueView && setAssignModalSlot(slotKey)}
                                                                className={`flex items-center justify-between p-3 border-b border-slate-700/30 last:border-0 transition-all ${assignment
                                                                    ? 'bg-slate-900/80'
                                                                    : isLeagueView ? 'bg-slate-900/10' : 'bg-slate-900/20 cursor-pointer hover:bg-slate-800/50'
                                                                    }`}
                                                            >
                                                                <div className="w-14 text-center shrink-0">
                                                                    <span className="font-mono font-bold text-slate-500 text-sm uppercase">{slotLabel}</span>
                                                                </div>

                                                                {assignment ? (
                                                                    <>
                                                                        <div className="flex-1 min-w-0 flex items-center gap-3 pl-2">
                                                                            <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 shrink-0 shadow-lg">
                                                                                <img
                                                                                    src={getPlayerPhoto(assignment)}
                                                                                    onError={(e) => handleImageError(e, assignment)}
                                                                                    className="w-full h-full object-cover"
                                                                                />
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="text-base font-bold text-slate-200 truncate flex items-center gap-2">
                                                                                    {assignment.name}
                                                                                    {assignment.identity?.toLowerCase() === 'foreigner' && (
                                                                                        <span className="text-[10px] font-bold bg-purple-900/50 text-purple-300 px-1.5 rounded border border-purple-500/30">F</span>
                                                                                    )}
                                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${getTeamColor(assignment.team)}`}>
                                                                                        {getTeamAbbr(assignment.team)}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-xs text-slate-500 truncate mt-0.5">{assignment.position_list}</div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Inline Stats for Bench */}
                                                                        <div className="flex ml-4 gap-3 text-[11px] text-slate-400 overflow-x-auto hide-scrollbar max-w-[500px]">
                                                                            {playerStatCats.map(cat => {
                                                                                const isPitcher = assignment?.batter_or_pitcher === 'pitcher';
                                                                                const isForced = isPitcher
                                                                                    ? (cat === 'Innings Pitched (IP)' && !pitcherStatCategories.includes(cat))
                                                                                    : (cat === 'At Bats (AB)' && !batterStatCategories.includes(cat));

                                                                                return (
                                                                                    <div key={cat} className="flex flex-col items-center min-w-[32px]">
                                                                                        <span className={`mb-0.5 text-[9px] font-bold ${isForced ? 'text-slate-500/60' : 'text-slate-600'}`}>{getStatAbbr(cat)}</span>
                                                                                        <span className={`font-mono ${isForced ? 'text-slate-500' : 'text-slate-200'}`}>{formatStat(getPlayerStat(assignment.player_id, cat))}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>

                                                                        <div className="w-10 flex justify-center shrink-0 ml-4">
                                                                            {!isLeagueView && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleRemoveAssignment(assignment.assignment_id);
                                                                                    }}
                                                                                    disabled={assigning}
                                                                                    className="text-slate-500 hover:text-red-400 disabled:opacity-50"
                                                                                >
                                                                                    {assigning && assigningId === assignment.assignment_id ? (
                                                                                        <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-slate-400"></div>
                                                                                    ) : '×'}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex-1 pl-2 text-slate-600 italic text-sm">
                                                                        Empty Slot
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Flatten slots logic
                                    // Need to expand counts: { C: 1, OF: 3 } -> [C, OF, OF, OF] -> [C, OF1, OF2, OF3]
                                    const allSlots = Object.keys(rosterPositions).flatMap(slot => {
                                        const count = rosterPositions[slot];
                                        return Array.from({ length: count }).map((_, idx) => {
                                            return count > 1 ? `${slot}${idx + 1}` : slot;
                                        });
                                    });

                                    // Categorize
                                    const batterSlots = [];
                                    const pitcherSlots = [];
                                    const benchSlots = [];

                                    allSlots.forEach(slotKey => {
                                        const label = slotKey.replace(/\d+$/, '');
                                        if (BATTER_POSITIONS.includes(label)) batterSlots.push(slotKey);
                                        else if (PITCHER_POSITIONS.includes(label)) pitcherSlots.push(slotKey);
                                        else if (!label.includes('Minor')) benchSlots.push(slotKey);
                                    });

                                    return (
                                        <>
                                            {renderTable('Batters', batterSlots, false)}
                                            {renderTable('Pitchers', pitcherSlots, true)}
                                            {renderBenchTable(benchSlots)}
                                        </>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(15, 23, 42, 0.5); 
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(139, 92, 246, 0.3); 
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(139, 92, 246, 0.5); 
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div >
    );
}
