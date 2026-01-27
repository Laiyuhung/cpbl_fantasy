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
    const [members, setMembers] = useState([]);

    // Stats State
    const [playerStats, setPlayerStats] = useState({});
    const [batterStatCategories, setBatterStatCategories] = useState([]);
    const [pitcherStatCategories, setPitcherStatCategories] = useState([]);

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
                    if (playerPositions.includes(slot) || slot === 'Util' || slot === 'BN' ||
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

            if (baseSlot === 'Util' || baseSlot === 'BN') return true;
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
                        setTimeLeft(diff > 0 ? diff : 0);
                    } else if (data.currentPick?.deadline) {
                        const deadline = new Date(data.currentPick.deadline).getTime();
                        diff = Math.floor((deadline - now) / 1000);
                        if (logCalc || !prevPickIdRef.current) { // Log on change or if just starting
                            console.log('%c[Timer Calc] Active Pick', 'color: lime; font-weight: bold;', {
                                pickInfo: `Pick ${data.currentPick.pick_number} (Rd ${data.currentPick.round_number})`,
                                serverTime: data.serverTime,
                                deadline: data.currentPick.deadline,
                                calculation: `Deadline(${new Date(data.currentPick.deadline).getTime()}) - Server(${now}) = ${deadline - now}ms`,
                                secondsRemaining: diff
                            });
                        }
                        setTimeLeft(diff > 0 ? diff : 0);
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
            setTimeLeft(prev => {
                const newVal = prev > 0 ? prev - 1 : 0;
                console.log('Timer Tick:', newVal);
                return newVal;
            });
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
                    setBatterStatCategories(settingsData.data.batter_stat_categories || []);
                    setPitcherStatCategories(settingsData.data.pitcher_stat_categories || []);
                }
                if (leagueData.success && leagueData.members) {
                    setMembers(leagueData.members);
                }

                const timeWindow = '2025 Season';
                const [battingRes, pitchingRes] = await Promise.all([
                    fetch(`/api/playerStats/batting-summary?time_window=${encodeURIComponent(timeWindow)}`),
                    fetch(`/api/playerStats/pitching-summary?time_window=${encodeURIComponent(timeWindow)}`)
                ]);

                const battingData = await battingRes.json();
                const pitchingData = await pitchingRes.json();

                const statsMap = {};
                if (battingData.success && battingData.stats) battingData.stats.forEach(s => statsMap[s.player_id] = s);
                if (pitchingData.success && pitchingData.stats) pitchingData.stats.forEach(s => statsMap[s.player_id] = s);
                setPlayerStats(statsMap);

            } catch (e) {
                console.error('Failed to load draft resources', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [leagueId]);

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
        return stats[fieldName.toLowerCase()] || '-';
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

            // Deduplicate by player_id
            const uniquePlayers = Array.from(new Map(allPlayers.map(p => [p.player_id, p])).values());

            if (!uniquePlayers.length) return;

            const batchPayload = uniquePlayers.map(p => ({
                id: p.player_id,
                candidates: getPlayerPhotoPaths(p).filter(path => !path.endsWith('/defaultPlayer.png'))
            }));

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
                    // Fallback to default to avoid 404 spam
                    const fallback = Object.fromEntries(uniquePlayers.map(p => [p.player_id, '/photo/defaultPlayer.png']));
                    setPhotoSrcMap(prev => ({ ...prev, ...fallback }));
                }
            }
        };
        resolvePhotos();
        return () => { cancelled = true; };
    }, [players, draftState?.picks]);

    const getPlayerPhoto = (player) => photoSrcMap[player.player_id] || getPlayerPhotoPaths(player)[0];

    const handleImageError = (e, player) => {
        const currentSrc = e.target.src;
        const paths = getPlayerPhotoPaths(player);
        let idx = paths.findIndex(p => currentSrc.includes(encodeURI(p)) || currentSrc.includes(p));
        if (idx === -1) idx = 0;
        e.target.src = paths[idx + 1] || '/photo/defaultPlayer.png';
        if (idx + 1 >= paths.length) e.target.onerror = null;
    };

    // ---------------------------------------------------------
    // Draft & Filtering Logic
    // ---------------------------------------------------------

    const { takenIds, recentPicks, myTeam, upcomingPicks, viewingTeam } = useMemo(() => {
        if (!draftState?.picks) return { takenIds: new Set(), recentPicks: [], myTeam: [], upcomingPicks: [] };
        const picks = draftState.picks;

        // Coerce player_id to string to ensure safe set properties
        const taken = new Set(picks.map(p => String(p.player_id)).filter(Boolean));

        // Recent Picks: "Draft History" order (Descending Pick Number - Newest First)
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
            original_name: p.player?.original_name || ''
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
                original_name: p.player?.original_name || ''
            }));
        }

        // Upcoming
        let upcoming = draftState.nextPicks || [];
        if (draftState.currentPick && upcoming.length > 0 && upcoming[0].pick_id === draftState.currentPick.pick_id) {
            upcoming = upcoming.slice(1);
        }

        return { takenIds: taken, recentPicks: recent, myTeam: mine, upcomingPicks: upcoming, viewingTeam };
    }, [draftState, myManagerId, viewingManagerId]);

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
                    valA = a.name;
                    valB = b.name;
                } else {
                    valA = getPlayerStatRaw(a.player_id, sortConfig.key);
                    valB = getPlayerStatRaw(b.player_id, sortConfig.key);
                }
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result.slice(0, 100);
    }, [players, takenIds, searchTerm, filterType, filterPos, filterTeam, filterIdentity, sortConfig, playerStats]);

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
        const cats = isBatter ? batterStatCategories : pitcherStatCategories;
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
                                <span className="text-slate-200 font-bold group-hover:text-white text-base">{player.name}</span>
                                <span className="text-xs text-slate-400 font-mono">{filterPositions(player)}</span>
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
                    {cats.map(cat => (
                        <div key={cat} className="flex flex-col items-center min-w-[30px]">
                            <span className="text-slate-600 mb-0.5">{getStatAbbr(cat)}</span>
                            <span className="text-slate-300">{getPlayerStat(player.player_id, cat)}</span>
                        </div>
                    ))}
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

    const currentStatCats = filterType === 'batter' ? batterStatCategories : pitcherStatCategories;

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
                            {formatTime(timeLeft)}
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
                                                src={getPlayerPhoto(lastPick.player || {})}
                                                onError={(e) => handleImageError(e, lastPick.player || {})}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-sm font-bold text-slate-200 truncate">{lastPick.player?.name}</span>
                                                <span className="text-xs text-slate-400 font-mono">{filterPositions(lastPick.player || {})}</span>
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
            <div className="flex gap-4 mb-4 border-b-2 border-slate-700">
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
                                        onClick={() => setFilterType('batter')}
                                    >Batter</button>
                                    <button
                                        className={`px-4 py-1 text-sm rounded transition-all ${filterType === 'pitcher' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                        onClick={() => setFilterType('pitcher')}
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
                                                    return (
                                                        <td key={cat} className="p-2 text-center text-xs text-slate-300 font-mono">
                                                            {val}
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
                                                            disabled={!!pickingId || draftState?.currentPick?.manager_id !== myManagerId || takenIds.has(String(player.player_id))}
                                                            className={`px-4 py-1.5 rounded-[4px] text-xs font-bold shadow-md transition-all flex items-center gap-2
                                                            ${draftState?.currentPick?.manager_id === myManagerId && !pickingId
                                                                    ? 'bg-green-600 hover:bg-green-500 text-white hover:scale-105 active:scale-95'
                                                                    : 'bg-slate-700/50 text-slate-600 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            {pickingId === player.player_id && (
                                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                            )}
                                                            {pickingId === player.player_id ? 'DRAFTING...' : 'DRAFT'}
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
                                                        <img
                                                            src={pick.player?.photo_url || getPlayerPhoto(pick.player || {})}
                                                            onError={(e) => handleImageError(e, pick.player || {})}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-slate-200 truncate">{pick.player?.name}</div>
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
                                                const cats = isBatter ? batterStatCategories : pitcherStatCategories;
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
                                                                        <span className="text-slate-200 font-bold group-hover:text-white text-base">{p.name}</span>
                                                                        <span className="text-xs text-slate-400 font-mono">{filterPositions(p)}</span>
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
                                                            {cats.map(cat => (
                                                                <div key={cat} className="flex flex-col items-center min-w-[30px]">
                                                                    <span className="text-slate-600 mb-0.5">{getStatAbbr(cat)}</span>
                                                                    <span className="text-slate-300">{getPlayerStat(p.player_id, cat)}</span>
                                                                </div>
                                                            ))}
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
                                                                                <div className="text-sm font-bold text-slate-200 truncate">{assignment.name}</div>
                                                                                <div className="text-[10px] text-slate-500">{filterPositions(assignment)}</div>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleRemoveAssignment(assignment.assignment_id)}
                                                                                disabled={assigning}
                                                                                className="text-slate-500 hover:text-red-400 text-xs px-2 disabled:opacity-50"
                                                                            >
                                                                                {assigning && assigningId === assignment.assignment_id ? (
                                                                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-400"></div>
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
                    <h2 className="text-xl font-bold mb-2 text-purple-300">Roster Assignment ({draftRosterAssignments.length})</h2>
                    <p className="text-xs text-slate-400 mb-4">Click on empty slots to assign players</p>

                    {/* Unassigned Players Section (Moved to Top) */}
                    {myTeam.filter(p => !isPlayerAssigned(p.player_id)).length > 0 && (
                        <>
                            <div className="border-b border-slate-700 pb-4 mb-4">
                                <h3 className="text-lg font-bold mb-2 text-slate-300">Unassigned Players ({myTeam.filter(p => !isPlayerAssigned(p.player_id)).length})</h3>
                                <p className="text-xs text-slate-400 mb-3">Click on a player to assign them to a position</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                    {myTeam.filter(p => !isPlayerAssigned(p.player_id)).map((player) => (
                                        <div
                                            key={player.player_id}
                                            onClick={() => setAssignModalPlayer(player)}
                                            className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/50 hover:border-purple-500/50 transition-all cursor-pointer hover:bg-slate-800/80"
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
                                                    <div className="text-xs font-bold text-slate-200 truncate">{player.name}</div>
                                                    <div className="text-[10px] text-slate-500 truncate">{filterPositions(player)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <div className="space-y-2 mb-6">
                        {Object.keys(rosterPositions)
                            .filter(slot => !slot.includes('Minor'))
                            .map(slot => {
                                const count = rosterPositions[slot];
                                return Array.from({ length: count }).map((_, idx) => {
                                    const slotKey = count > 1 ? `${slot}${idx + 1}` : slot;
                                    const assignment = getAssignedPlayer(slotKey);

                                    return (
                                        <div
                                            key={slotKey}
                                            onClick={() => !assignment && setAssignModalSlot(slotKey)}
                                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${assignment
                                                ? 'bg-slate-900/80 border-slate-700/50'
                                                : 'bg-slate-900/50 border-slate-700/30 cursor-pointer hover:border-purple-500/50 hover:bg-slate-800/80'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="w-16 text-center">
                                                    <span className="font-mono font-bold text-purple-400 text-sm">{slot}</span>
                                                </div>

                                                {assignment ? (
                                                    <>
                                                        <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 shrink-0">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={getPlayerPhoto(assignment)}
                                                                onError={(e) => handleImageError(e, assignment)}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-slate-200 truncate">{assignment.name}</div>
                                                            <div className="text-xs text-slate-500">{assignment.position_list}</div>
                                                        </div>
                                                        <div className={`text-xs px-2 py-1 rounded border ${getTeamColor(assignment.team)}`}>
                                                            {getTeamAbbr(assignment.team)}
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveAssignment(assignment.assignment_id);
                                                            }}
                                                            disabled={assigning}
                                                            className={`text-slate-500 hover:text-red-400 text-xs px-3 py-1 rounded hover:bg-red-900/20 transition-colors disabled:opacity-50 ${assigning && assigningId === assignment.assignment_id ? 'cursor-not-allowed' : ''}`}
                                                        >
                                                            {assigning && assigningId === assignment.assignment_id ? (
                                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-400"></div>
                                                            ) : 'Remove'}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex-1 text-slate-600 italic text-sm">
                                                        Empty - Click to assign player
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })}
                    </div>


                </div>
            )}

            {
                mainTab === 'league_rosters' && (
                    <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700 backdrop-blur-sm shadow-xl overflow-auto" style={{ height: 'calc(100vh - 350px)' }}>
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold text-purple-300">League Rosters</h2>
                                <div className="text-xs text-slate-400">View other managers&apos; assignments</div>
                            </div>
                            <select
                                className="bg-slate-700 text-white p-2 rounded border border-slate-600 outline-none focus:border-purple-500 min-w-[200px]"
                                value={viewingManagerId || ''}
                                onChange={(e) => setViewingManagerId(e.target.value)}
                            >
                                {members.map(m => (
                                    <option key={m.manager_id} value={m.manager_id}>
                                        {m.nickname} {m.manager_id === myManagerId ? '(You)' : ''}
                                    </option>
                                ))}
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
                                            {viewingTeam.filter(p => !viewingRosterAssignments.some(a => a.player_id === p.player_id)).map((player) => (
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
                                                            <div className="text-xs font-bold text-slate-200 truncate">{player.name}</div>
                                                            <div className="text-[10px] text-slate-500 truncate">{filterPositions(player)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2 mb-6">
                                    {Object.keys(rosterPositions)
                                        .filter(slot => !slot.includes('Minor'))
                                        .map(slot => {
                                            const count = rosterPositions[slot];
                                            return Array.from({ length: count }).map((_, idx) => {
                                                const slotKey = count > 1 ? `${slot}${idx + 1}` : slot;
                                                const assignment = viewingRosterAssignments.find(a => a.roster_slot === slotKey);

                                                return (
                                                    <div
                                                        key={slotKey}
                                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${assignment
                                                            ? 'bg-slate-900/80 border-slate-700/50'
                                                            : 'bg-slate-900/50 border-slate-700/30'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <div className="w-16 text-center">
                                                                <span className="font-mono font-bold text-slate-400 text-sm">{slot}</span>
                                                            </div>

                                                            {assignment ? (
                                                                <>
                                                                    <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 shrink-0">
                                                                        <img
                                                                            src={getPlayerPhoto(assignment)}
                                                                            onError={(e) => handleImageError(e, assignment)}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-sm font-bold text-slate-200 truncate">{assignment.name}</div>
                                                                        <div className="text-xs text-slate-500">{assignment.position_list}</div>
                                                                    </div>
                                                                    <div className={`text-xs px-2 py-1 rounded border ${getTeamColor(assignment.team)}`}>
                                                                        {getTeamAbbr(assignment.team)}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="flex-1 text-slate-600 italic text-sm">
                                                                    Empty
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })}
                                </div>
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
