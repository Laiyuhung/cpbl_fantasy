'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import LegendModal from '../../../../components/LegendModal';
import PlayerDetailModal from '../../../../components/PlayerDetailModal';

export default function PlayersPage() {
  const params = useParams();
  const leagueId = params.leagueId;

  const [players, setPlayers] = useState([]);
  const [ownerships, setOwnerships] = useState([]); // 球員擁有權資料
  const [myManagerId, setMyManagerId] = useState(null); // 當前用戶的 manager_id
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('batter'); // batter, pitcher
  const [filterIdentity, setFilterIdentity] = useState('all'); // all, local, foreigner
  const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' }); // Sorting config
  const [members, setMembers] = useState([]); // 當前聯盟成員（含 nickname）
  const [showConfirmAdd, setShowConfirmAdd] = useState(false); // 確認新增對話框
  const [playerToAdd, setPlayerToAdd] = useState(null); // 待加入的球員
  const [isAdding, setIsAdding] = useState(false); // 執行新增中
  const [waiverMode, setWaiverMode] = useState(false); // 是否waiver申請
  const [showWaiverSuccess, setShowWaiverSuccess] = useState(false);
  const [waiverSuccessMsg, setWaiverSuccessMsg] = useState('');
  const [showWaiverError, setShowWaiverError] = useState(false);
  const [waiverErrorMsg, setWaiverErrorMsg] = useState('');
  const [waiverDropPlayerId, setWaiverDropPlayerId] = useState(''); // 可選丟誰
  const [showConfirmDrop, setShowConfirmDrop] = useState(false); // 確認刪除對話框
  const [playerToDrop, setPlayerToDrop] = useState(null); // 待刪除的球員
  const [isDropping, setIsDropping] = useState(false); // 執行刪除中
  const [showSuccess, setShowSuccess] = useState(false); // 成功動畫
  const [showError, setShowError] = useState(false); // 失敗動畫
  const [errorMessage, setErrorMessage] = useState(''); // 錯誤訊息
  const [isRefreshing, setIsRefreshing] = useState(false); // 重新載入中
  const [successMessage, setSuccessMessage] = useState(''); // 成功訊息
  const failedImages = useRef(new Set()); // 記錄加載失敗的球員ID
  const [photoSrcMap, setPhotoSrcMap] = useState({}); // 每位球員解析後的圖片路徑快取
  const [rosterPositions, setRosterPositions] = useState({}); // 聯盟守備位置設定
  const [leagueStatus, setLeagueStatus] = useState('unknown'); // 聯盟狀態
  const [showInfoModal, setShowInfoModal] = useState(false); // 守位資格說明視窗
  const [showLegendModal, setShowLegendModal] = useState(false); // Legend視窗
  const [timeWindow, setTimeWindow] = useState(null); // 數據區間選擇，初始為 null 等待計算
  const [scheduleData, setScheduleData] = useState([]); // 聯盟賽程
  const [batterStatCategories, setBatterStatCategories] = useState([]); // 打者統計項目
  const [pitcherStatCategories, setPitcherStatCategories] = useState([]); // 投手統計項目
  const [playerStats, setPlayerStats] = useState({}); // 球員統計數據
  const [fetchingStats, setFetchingStats] = useState(false); // 統計數據讀取中
  const [playerRankings, setPlayerRankings] = useState({}); // Z-score rankings
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeTargetManagerId, setTradeTargetManagerId] = useState(null);
  const [selectedMyPlayers, setSelectedMyPlayers] = useState([]);
  const [selectedTheirPlayers, setSelectedTheirPlayers] = useState([]);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [showTradeSuccessNotification, setShowTradeSuccessNotification] = useState(false);
  const [tradeSuccessMessage, setTradeSuccessMessage] = useState({ title: '', description: '' });
  const [showTradeErrorNotification, setShowTradeErrorNotification] = useState(false);
  const [tradeErrorMessage, setTradeErrorMessage] = useState({ title: '', description: '' });
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [leagueSettings, setLeagueSettings] = useState({});
  const [tradeEndDate, setTradeEndDate] = useState(null);
  const [isFetchingTradeData, setIsFetchingTradeData] = useState(false);
  const [selectedPlayerModal, setSelectedPlayerModal] = useState(null);

  // Watch State
  const [watchedPlayerIds, setWatchedPlayerIds] = useState(new Set());
  const [filterOwnership, setFilterOwnership] = useState('available'); // all, available, myteam, watched
  const [filterTeam, setFilterTeam] = useState('all'); // Team filter
  const [filterPosition, setFilterPosition] = useState('all'); // Position filter

  // Position ordering (same as Roster page)
  const batterPositionOrder = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'CI', 'MI', 'Util'];
  const pitcherPositionOrder = ['SP', 'RP', 'P'];

  // Fetch rosters for trade validation
  useEffect(() => {
    if (showTradeModal && myManagerId && tradeTargetManagerId) {
      const fetchTradeRosters = async () => {
        setIsFetchingTradeData(true);
        try {
          const [myRes, theirRes] = await Promise.all([
            fetch(`/api/league/${leagueId}/roster?manager_id=${myManagerId}`),
            fetch(`/api/league/${leagueId}/roster?manager_id=${tradeTargetManagerId}`)
          ]);
          const myData = await myRes.json();
          const theirData = await theirRes.json();
          if (myData.success) setTradeMyRoster(myData.roster || []);
          if (theirData.success) setTradeTheirRoster(theirData.roster || []);
        } catch (e) {
          console.error("Failed to fetch trade rosters", e);
        } finally {
          setIsFetchingTradeData(false);
        }
      };
      fetchTradeRosters();
    }
  }, [showTradeModal, myManagerId, tradeTargetManagerId, leagueId]);
  const [tradeMyRoster, setTradeMyRoster] = useState([]);
  const [tradeTheirRoster, setTradeTheirRoster] = useState([]);

  // Add & Drop State
  const [showAddDropModal, setShowAddDropModal] = useState(false);
  const [pendingAddPlayer, setPendingAddPlayer] = useState(null);
  const [projectedAddSlot, setProjectedAddSlot] = useState('');
  const [dropCandidateID, setDropCandidateID] = useState(null);
  const [limitViolationMsg, setLimitViolationMsg] = useState('');
  const [checkingAdd, setCheckingAdd] = useState(false); // Local loading for pre-check
  const [violationType, setViolationType] = useState(''); // 'foreigner_limit' etc.
  const [currentRosterState, setCurrentRosterState] = useState([]); // Store roster for dynamic slot calc
  const [naLimitState, setNaLimitState] = useState(0); // Store NA limit
  const [allowNaToNaSlot, setAllowNaToNaSlot] = useState(false); // Store setting for NA slot allowed

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 從 cookie 取得當前用戶的 user_id (即 manager_id)
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const userId = cookie?.split('=')[1];
        if (userId) {
          setMyManagerId(userId);
        }

        // 並行請求 players 和 ownerships
        const [playersRes, ownershipsRes, leagueRes] = await Promise.all([
          fetch('/api/playerslist?available=true'),
          fetch(`/api/league/${leagueId}/ownership`),
          fetch(`/api/league/${leagueId}`)
        ]);

        // 處理 players
        const playersData = await playersRes.json();
        if (!playersRes.ok) {
          setError(playersData.error || 'Failed to load players');
          return;
        }
        if (playersData.success) {
          setPlayers(playersData.players || []);
        }

        // 處理 ownerships
        const ownershipsData = await ownershipsRes.json();
        if (ownershipsData.success) {
          setOwnerships(ownershipsData.ownerships || []);
        }

        // 處理 members (取得 nickname 對照) 和 roster_positions
        const leagueData = await leagueRes.json();
        if (leagueData.success) {
          setMembers(leagueData.members || []);
          setMembers(leagueData.members || []);
          setRosterPositions(leagueData.league?.roster_positions || {});
          setLeagueStatus(leagueData.status || 'unknown');
          setScheduleData(leagueData.schedule || []);

          // Get trade deadline info
          setTradeEndDate(leagueData.league?.trade_end_date || null);
          if (leagueData.league?.start_scoring_on) {
            const parts = leagueData.league.start_scoring_on.split('.');
            if (parts.length > 0) {
              const year = parseInt(parts[0]);
              if (!isNaN(year)) setSeasonYear(year);
            }
          }
        }

        // 取得聯盟設定 (stat categories)
        const settingsRes = await fetch(`/api/league-settings?league_id=${leagueId}`);
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.data) {
          setBatterStatCategories(settingsData.data.batter_stat_categories || []);
          setPitcherStatCategories(settingsData.data.pitcher_stat_categories || []);
          setLeagueSettings(settingsData.data || {});
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId]);

  // Determine default timeWindow based on Taiwan time vs first week start
  useEffect(() => {
    if (scheduleData.length === 0 || timeWindow !== null) return;

    // Helper to convert date to Taiwan timezone
    const getDateInTaiwan = (dateStr) => {
      const date = new Date(dateStr);
      // Add 8 hours to convert UTC to Taiwan time
      return new Date(date.getTime() + (8 * 60 * 60 * 1000));
    };

    // Get current Taiwan time
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000;
    const taiwanTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + taiwanOffset);

    // Get first week start date
    const firstWeekStart = getDateInTaiwan(scheduleData[0].week_start);

    // If before first week, use "2025 Season", otherwise "2026 Season"
    if (taiwanTime < firstWeekStart) {
      setTimeWindow('2025 Season');
    } else {
      setTimeWindow('2026 Season');
    }
  }, [scheduleData, timeWindow]);

  // Fetch Acquisitions Count
  const [acquisitionData, setAcquisitionData] = useState(null);
  const [activeTradePlayerIds, setActiveTradePlayerIds] = useState(new Set());
  const [lockedPlayerAlert, setLockedPlayerAlert] = useState(null); // Name of locked player trying to be dropped

  const fetchAcquisitions = async () => {
    if (!myManagerId) return;
    try {
      const res = await fetch(`/api/league/${leagueId}/acquisitions?manager_id=${myManagerId}`);
      const data = await res.json();
      if (data.success) {
        setAcquisitionData(data);
      }
    } catch (e) {
      console.error('Failed to fetch acquisitions', e);
    }
  };

  const fetchActiveTrades = async () => {
    if (!myManagerId) return;
    try {
      const res = await fetch(`/api/trade/list?league_id=${leagueId}&manager_id=${myManagerId}`);
      const data = await res.json();
      if (data.success) {
        const tradeIds = new Set();
        data.trades.forEach(t => {
          if (['pending', 'accepted'].includes(t.status)) {
            // Add Sender Players (Initiator)
            if (Array.isArray(t.initiator_player_ids)) {
              t.initiator_player_ids.forEach(pid => tradeIds.add(pid));
            }
            // Add Receiver Players (Recipient)
            if (Array.isArray(t.recipient_player_ids)) {
              t.recipient_player_ids.forEach(pid => tradeIds.add(pid));
            }
          }
        });
        setActiveTradePlayerIds(tradeIds);
      }
    } catch (e) {
      console.error("Failed to fetch active trades for validation", e);
    }
  };

  useEffect(() => {
    fetchAcquisitions();
    fetchActiveTrades();
  }, [leagueId, myManagerId]);

  // Fetch watched players
  const fetchWatchedPlayers = async () => {
    if (!myManagerId || !leagueId) return;
    try {
      const res = await fetch(`/api/watched?league_id=${leagueId}&manager_id=${myManagerId}`);
      const data = await res.json();
      if (data.success) {
        setWatchedPlayerIds(new Set(data.watchedIds || []));
      }
    } catch (e) {
      console.error('Failed to fetch watched players:', e);
    }
  };

  useEffect(() => {
    fetchWatchedPlayers();
  }, [leagueId, myManagerId]);

  // Toggle watch status (optimistic update)
  const handleToggleWatch = async (player, isCurrentlyWatched) => {
    if (!myManagerId || !leagueId) return;

    // Optimistic update - update UI immediately
    if (isCurrentlyWatched) {
      setWatchedPlayerIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(player.player_id);
        return newSet;
      });
    } else {
      setWatchedPlayerIds(prev => new Set([...prev, player.player_id]));
    }

    try {
      const res = await fetch('/api/watched', {
        method: isCurrentlyWatched ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          manager_id: myManagerId,
          player_id: player.player_id
        })
      });
      const data = await res.json();
      if (!data.success) {
        // Rollback on failure
        if (isCurrentlyWatched) {
          setWatchedPlayerIds(prev => new Set([...prev, player.player_id]));
        } else {
          setWatchedPlayerIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(player.player_id);
            return newSet;
          });
        }
      }
    } catch (e) {
      console.error('Failed to toggle watch:', e);
      // Rollback on error
      if (isCurrentlyWatched) {
        setWatchedPlayerIds(prev => new Set([...prev, player.player_id]));
      } else {
        setWatchedPlayerIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(player.player_id);
          return newSet;
        });
      }
    }
  };

  // Set default sort when categories are loaded
  // useEffect removed to enforce Rank ASC default via initial state and button handlers

  // 取得球員統計數據
  useEffect(() => {
    const fetchPlayerStats = async () => {
      if (!timeWindow) return;
      setFetchingStats(true);

      try {
        // 根據球員類型選擇不同的 API
        const endpoint = filterType === 'batter'
          ? `/api/playerStats/batting-summary?time_window=${encodeURIComponent(timeWindow)}`
          : `/api/playerStats/pitching-summary?time_window=${encodeURIComponent(timeWindow)}`;

        const res = await fetch(endpoint);
        const data = await res.json();

        // console.log('Fetched player stats:', data);
        // console.log('Endpoint:', endpoint);

        if (data.success && data.stats) {
          // 轉換為 player_id => stats 的對照表
          const statsMap = {};
          data.stats.forEach(stat => {
            // console.log('Player stat:', stat.player_id, stat);
            statsMap[stat.player_id] = stat;
          });
          // console.log('Stats map:', statsMap);
          setPlayerStats(statsMap);
        }
      } catch (err) {
        console.error('Failed to fetch player stats:', err);
      } finally {
        setFetchingStats(false);
      }
    };

    fetchPlayerStats();
  }, [timeWindow, filterType]);

  // Fetch Rankings
  useEffect(() => {
    if (!timeWindow) return; // Wait for timeWindow to be set
    const fetchRankings = async () => {
      try {
        const res = await fetch(`/api/league/${leagueId}/rankings?time_window=${encodeURIComponent(timeWindow)}`);
        const data = await res.json();
        if (data.success) {
          const rankMap = {};
          data.rankings.forEach(p => {
            rankMap[p.player_id] = p.rank;
          });
          setPlayerRankings(rankMap);
        }
      } catch (e) {
        console.error('Failed to fetch rankings', e);
      }
    };
    fetchRankings();
  }, [leagueId, timeWindow]);

  // 格式化統計數據顯示
  const formatStatValue = (value, statKey) => {
    if (value === null || value === undefined) return '-';
    // Format 0 as gray
    if (Number(value) === 0) return <span className="text-slate-500 font-bold">0</span>;

    // 直接返回後端傳過來的數字
    return value;
  };

  // 取得球員的統計數據
  const getPlayerStat = (playerId, statKey) => {
    const stats = playerStats[playerId];
    if (!stats) {

      return '-';
    }

    // 提取最靠後的括號內的縮寫作為實際欄位名，例如 "Runs (R)" -> "R"
    let fieldName = statKey;
    const matches = statKey.match(/\(([^)]+)\)/g);
    if (matches) {
      fieldName = matches[matches.length - 1].replace(/[()]/g, ''); // 使用最後一個括號內的內容
    }

    const value = stats[fieldName.toLowerCase()];

    return formatStatValue(value, statKey);
  };

  const getStatAbbr = (cat) => {
    const matches = cat.match(/\(([^)]+)\)/g);
    return matches ? matches[matches.length - 1].replace(/[()]/g, '') : cat;
  };

  const getPlayerStatRaw = (playerId, statKey) => {
    const val = getPlayerStat(playerId, statKey);
    // If val is a React element (gray 0), extract clean number
    if (typeof val === 'object' && val?.props?.children) {
      return 0; // It was a gray 0
    }
    return val === '-' ? -999 : Number(val) || 0;
  };

  // 根據 roster_positions 過濾守備位置
  const filterPositions = (player) => {
    let positionList = player.position_list;

    // 若無守備位置資料，根據球員類型給預設值
    if (!positionList) {
      positionList = player.batter_or_pitcher === 'batter' ? 'Util' : 'P';
    }

    // 解析位置列表
    const positions = positionList.split(',').map(p => p.trim());

    // 過濾出在 roster_positions 中存在的守位
    const validPositions = positions.filter(pos => {
      return rosterPositions[pos] && rosterPositions[pos] > 0;
    });

    // 若過濾後為空，返回 NA
    return validPositions.length > 0 ? validPositions.join(', ') : 'NA';
  };

  // 解析每位球員可用的圖片一次並快取，批次傳送所有候選路徑到 API 一次解析，避免大量請求
  useEffect(() => {
    let cancelled = false;
    const resolvePhotos = async () => {
      if (!players || players.length === 0) return;

      // 組成批次請求資料
      const batchPayload = players.map(player => ({
        id: player.player_id,
        candidates: getPlayerPhotoPaths(player).filter(p => !p.endsWith('/defaultPlayer.png'))
      }));

      try {
        const res = await fetch('/api/photo/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ players: batchPayload })
        });
        const data = await res.json();
        if (!cancelled && data.results) {
          setPhotoSrcMap(data.results);
        }
      } catch {
        // 失敗時全部用預設
        if (!cancelled) {
          const fallback = Object.fromEntries(players.map(p => [p.player_id, '/photo/defaultPlayer.png']));
          setPhotoSrcMap(fallback);
        }
      }
    };

    resolvePhotos();
    return () => { cancelled = true; };
  }, [players]);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const filteredPlayers = useMemo(() => {
    let result = players.filter(player => {
      const matchesSearch = searchTerm === '' ||
        player.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.original_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.team?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        (filterType === 'batter' && player.batter_or_pitcher === 'batter') ||
        (filterType === 'pitcher' && player.batter_or_pitcher === 'pitcher');

      const matchesIdentity = filterIdentity === 'all' ||
        player.identity?.toLowerCase() === filterIdentity.toLowerCase();

      // Team filter
      const matchesTeam = filterTeam === 'all' || player.team === filterTeam;

      // Position filter (check if player has the selected position)
      let matchesPosition = true;
      if (filterPosition !== 'all') {
        const playerPositions = player.position_list
          ? player.position_list.split(',').map(p => p.trim())
          : [];
        matchesPosition = playerPositions.includes(filterPosition);
      }

      // Ownership filter
      const ownership = ownerships.find(o => o.player_id === player.player_id);
      let matchesOwnership = true;
      if (filterOwnership === 'available') {
        matchesOwnership = !ownership; // Free agents only
      } else if (filterOwnership === 'myteam') {
        matchesOwnership = ownership && ownership.manager_id === myManagerId;
      } else if (filterOwnership === 'watched') {
        matchesOwnership = watchedPlayerIds.has(player.player_id);
      }

      return matchesSearch && matchesType && matchesIdentity && matchesOwnership && matchesTeam && matchesPosition;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'rank') {
          // Sort by Z-Score Rank
          const rankA = playerRankings[a.player_id] || 9999;
          const rankB = playerRankings[b.player_id] || 9999;
          valA = rankA;
          valB = rankB;
          // If ranks are equal (both unranked), sort by name
          if (valA === 9999 && valB === 9999) {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0;
          }
        } else if (sortConfig.key === 'name') {
          valA = a.name;
          valB = b.name;
        } else if (sortConfig.key === 'roster_percentage') {
          valA = a.roster_percentage ?? 0;
          valB = b.roster_percentage ?? 0;
        } else {
          valA = getPlayerStatRaw(a.player_id, sortConfig.key);
          valB = getPlayerStatRaw(b.player_id, sortConfig.key);
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [players, searchTerm, filterType, filterIdentity, filterOwnership, filterTeam, filterPosition, sortConfig, playerStats, playerRankings, ownerships, myManagerId, watchedPlayerIds]);

  const displayBatterCats = useMemo(() => {
    const forced = 'At Bats (AB)';
    const hasForced = batterStatCategories.some(c => getStatAbbr(c) === 'AB');
    return hasForced ? batterStatCategories : [forced, ...batterStatCategories];
  }, [batterStatCategories]);

  const displayPitcherCats = useMemo(() => {
    const forced = 'Innings Pitched (IP)';
    const hasForced = pitcherStatCategories.some(c => getStatAbbr(c) === 'IP');
    return hasForced ? pitcherStatCategories : [forced, ...pitcherStatCategories];
  }, [pitcherStatCategories]);

  // Ordinal suffix helper: 1 -> "1st", 2 -> "2nd", 3 -> "3rd", etc.
  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Stats requiring PA/IP qualification (rate stats & lower-is-better stats)
  const batterQualifyStats = new Set(['cs', 'k', 'avg', 'gidp', 'obp', 'ops', 'slg']);
  const pitcherQualifyStats = new Set(['era', 'whip', 'bb/9', 'bb', 'er', 'ra', 'h/9', 'h', 'hbp', 'hr', 'ibb', 'k/9', 'k/bb', 'l', 'obpa', 'rl', 'win%']);

  // Stats where lower value = better ranking
  const batterLowerIsBetter = new Set(['cs', 'k', 'gidp']);
  const pitcherLowerIsBetter = new Set(['era', 'whip', 'bb/9', 'bb', 'er', 'ra', 'h/9', 'h', 'hbp', 'hr', 'ibb', 'l', 'obpa', 'rl']);

  // Compute CPBL stat rankings
  const cpblStatRankings = useMemo(() => {
    if (!playerStats || Object.keys(playerStats).length === 0) return {};

    const allStats = Object.entries(playerStats);
    const qualifyKey = filterType === 'batter' ? 'pa' : 'ip';
    const categories = filterType === 'batter' ? batterStatCategories : pitcherStatCategories;

    const qualifySet = filterType === 'batter' ? batterQualifyStats : pitcherQualifyStats;
    const lowerBetterSet = filterType === 'batter' ? batterLowerIsBetter : pitcherLowerIsBetter;

    // First filter out players with absolutely no stats
    const activePlayers = allStats.filter(([_, s]) => s[qualifyKey] != null && Number(s[qualifyKey]) > 0);

    // Sort active players by PA/IP descending to find top 60%
    const sortedByTime = [...activePlayers].sort((a, b) => Number(b[1][qualifyKey]) - Number(a[1][qualifyKey]));

    // Top 60% cutoff for Qualification
    const cutoff = Math.ceil(sortedByTime.length * 0.6);
    const qualifiedIds = new Set(sortedByTime.slice(0, cutoff).map(([id]) => String(id)));

    // For each scoring category, rank players
    const rankings = {}; // { player_id_string: { statAbbr: rank } }

    categories.forEach(cat => {
      const abbr = getStatAbbr(cat).toLowerCase();
      const requiresQualify = qualifySet.has(abbr);
      const isLowerBetter = lowerBetterSet.has(abbr);

      // Collect players with valid (non-null) stat values
      const entries = activePlayers
        // If it requires qualification, must be in top 60%
        .filter(([id]) => !requiresQualify || qualifiedIds.has(String(id)))
        .map(([id, s]) => ({ id: String(id), val: s[abbr] }))
        .filter(e => e.val != null && e.val !== '' && !isNaN(Number(e.val)))
        .map(e => ({ ...e, val: Number(e.val) }))
        .sort((a, b) => isLowerBetter ? a.val - b.val : b.val - a.val);

      entries.forEach((entry, idx) => {
        if (!rankings[entry.id]) rankings[entry.id] = {};
        rankings[entry.id][abbr] = idx + 1;
      });
    });

    return rankings;
  }, [playerStats, filterType, batterStatCategories, pitcherStatCategories]);

  const getTeamAbbr = (team) => {
    switch (team) {
      case '統一獅': return 'UL';
      case '富邦悍將': return 'FG';
      case '樂天桃猿': return 'RM';
      case '中信兄弟': return 'B';
      case '味全龍': return 'W';
      case '台鋼雄鷹': return 'TSG';
      default: return team;
    }
  };

  const getTeamColor = (team) => {
    switch (team) {
      case '統一獅':
        return 'text-orange-400';
      case '富邦悍將':
        return 'text-blue-400';
      case '台鋼雄鷹':
        return 'text-green-400';
      case '味全龍':
        return 'text-red-400';
      case '樂天桃猿':
        return 'text-rose-400';
      case '中信兄弟':
        return 'text-yellow-400';
      default:
        return 'text-slate-400';
    }
  };

  // 根據 manager_id 取得該成員在此聯盟的 nickname
  const getOwnerNickname = (managerId) => {
    const m = members.find(x => x.manager_id === managerId);
    return m?.nickname || '-';
  };

  // 將 ownership 狀態顯示在名字後面
  const renderStatusTag = (player) => {
    const ownership = ownerships.find(o => o.player_id === player.player_id);
    if (!ownership) {
      return (
        <span className="text-green-300 font-semibold ml-1">| FA</span>
      );
    }

    const status = (ownership.status || '').toLowerCase();
    if (status === 'waiver') {
      const off = ownership.off_waiver ? new Date(ownership.off_waiver) : null;
      const md = off ? `${off.getMonth() + 1}/${off.getDate()}` : '-';
      return (
        <span className="text-yellow-300 font-semibold ml-1">| W {md}</span>
      );
    }

    if (status === 'on team') {
      const nick = getOwnerNickname(ownership.manager_id);
      return (
        <span className="text-blue-300 font-semibold ml-1">| {nick}</span>
      );
    }

    return null;
  };
  const getPlayerPhotoPaths = (player) => {
    const paths = [];

    // 1. 嘗試使用 name
    if (player.name) {
      paths.push(`/photo/${player.name}.png`);
    }

    // 2. 嘗試使用 original_name (逗號+空白分隔)
    if (player.original_name) {
      const aliases = player.original_name.split(',').map(alias => alias.trim());
      aliases.forEach(alias => {
        if (alias) {
          paths.push(`/photo/${alias}.png`);
        }
      });
    }

    // 3. 嘗試使用 player_id
    if (player.player_id) {
      paths.push(`/photo/${player.player_id}.png`);
    }

    // 4. 最後使用預設照片
    paths.push('/photo/defaultPlayer.png');

    return paths;
  };

  const getPlayerPhoto = (player) => {
    // 使用預解析的路徑，沒有就回退為預設
    return photoSrcMap[player.player_id] || '/photo/defaultPlayer.png';
  };

  const handleImageError = (e, player) => {
    // 獲取當前嘗試的路徑
    const currentSrc = e.target.src;
    const paths = getPlayerPhotoPaths(player);

    // 找到當前路徑在 paths 中的位置
    let currentIndex = -1;
    for (let i = 0; i < paths.length; i++) {
      if (currentSrc.includes(paths[i])) {
        currentIndex = i;
        break;
      }
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex < paths.length) {
      // 嘗試下一個路徑
      const nextPath = paths[nextIndex];
      // 確保路徑是完整的 URL
      if (nextPath.startsWith('http')) {
        e.target.src = nextPath;
      } else {
        e.target.src = window.location.origin + nextPath;
      }
    } else {
      // 所有路徑都失敗，記錄此球員並使用預設圖片
      failedImages.current.add(player.player_id); // 使用 ref 不會觸發重新渲染
      e.target.onerror = null; // 防止無限迴圈
      e.target.src = window.location.origin + '/photo/defaultPlayer.png';
    }
  };


  // Pre-Check Logic
  const preCheckAddPlayer = async (player) => {
    // 0. Check Acquisition Limit
    if (acquisitionData && acquisitionData.limit !== 'No Maximum') {
      const limit = parseInt(acquisitionData.limit);
      const usage = parseInt(acquisitionData.usage);
      if (usage >= limit) {
        setErrorMessage(`Weekly acquisition limit reached (${usage}/${limit}). Cannot add player.`);
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
        return;
      }
    }
    // 1. Fetch Roster & Settings for precise calculation
    try {
      setCheckingAdd(true);
      const [rosterRes, settingsRes] = await Promise.all([
        fetch(`/api/league/${leagueId}/roster?manager_id=${myManagerId}`),
        fetch(`/api/league-settings?league_id=${leagueId}`)
      ]);

      const rosterData = await rosterRes.json();
      const settingsData = await settingsRes.json();

      const myRoster = rosterData.roster || [];
      const settings = settingsData.data || {};
      const rosterConfig = settings.roster_positions || {}; // e.g. { Minor: 2, C: 1, ... }

      // Limits
      const onTeamLimit = parseInt(settings.foreigner_on_team_limit) || 999;
      const activeLimit = parseInt(settings.foreigner_active_limit) || 999;

      // Calculate Roster Size Limits from roster_positions
      // Total Limit = Sum of all position counts
      const totalRosterLimit = Object.values(rosterConfig).reduce((sum, count) => sum + count, 0);

      // Active Roster Limit = Sum of positions EXCLUDING 'Minor' and 'NA'
      // Note: roster_positions key for Minor might be 'Minor' or something else, but standard is 'Minor'
      const activeRosterLimit = Object.entries(rosterConfig)
        .filter(([key]) => !['Minor', 'NA'].includes(key))
        .reduce((sum, [_, count]) => sum + count, 0);

      // 2. Identify Player & Slot
      const isForeigner = player.identity?.toLowerCase() === 'foreigner';
      const status = (player.real_life_status || 'Active').toUpperCase();
      const isNaEligible = status !== 'MAJOR';

      // Minor Capacity
      const minorKey = Object.keys(rosterConfig).find(k => k.toLowerCase() === 'minor') || 'Minor';
      const minorLimit = rosterConfig[minorKey] || 0;

      // Check if league allows moving directly to NA/Injury slot
      // Value is usually 'Yes' or 'No', make case insensitive
      const allowNa = (settings.allow_injured_to_injury_slot || '').toLowerCase() === 'yes';

      // Store for dynamic recalc
      setCurrentRosterState(myRoster);
      setNaLimitState(minorLimit);
      setAllowNaToNaSlot(allowNa);

      const currentMinorCount = myRoster.filter(p => ['NA', 'Minor'].includes(p.position)).length;

      console.log('--- NA Slot Calculation ---');
      console.log('Eligible:', isNaEligible);
      console.log('AllowDirectNA:', allowNa);
      console.log('CurrentUsage:', currentMinorCount, '/', minorLimit);

      let targetSlot = 'BN';
      // Only set to NA if: 1. Eligible, 2. Slot available, 3. League Setting allows it
      if (allowNa && isNaEligible && currentMinorCount < minorLimit) {
        targetSlot = 'NA';
      }
      console.log('Decided Target Slot:', targetSlot);

      setProjectedAddSlot(targetSlot);

      // 3. Check Limits
      let violation = null;
      let vType = '';

      // --- A. Foreigner Check (High Priority) ---
      // If adding a foreigner violates foreigner limits, we MUST flag this first
      // so the user is forced to drop a foreigner.
      if (isForeigner) {
        const currentForeigners = myRoster.filter(p => p.identity?.toLowerCase() === 'foreigner');
        const onTeamCount = currentForeigners.length;

        // Calculate Active Foreigners (active includes BN, excludes NA)
        const activeForeigners = currentForeigners.filter(p => !['NA', 'Minor'].includes(p.position));
        const activeCount = activeForeigners.length;

        // Check On-Team Limit
        if (onTeamCount + 1 > onTeamLimit) {
          violation = `Foreigner On-Team Limit Exceeded (Limit: ${onTeamLimit})`;
          vType = 'foreigner_limit';
        }

        // Check Active Limit (Only if adding to Active slot)
        const isTargetActive = !['NA', 'Minor'].includes(targetSlot);
        if (!violation && isTargetActive) {
          if (activeCount + 1 > activeLimit) {
            violation = `Foreigner Active Limit Exceeded (Limit: ${activeLimit})`;
            vType = 'foreigner_active_limit';
          }
        }
      }

      // --- B. Total Roster Limit Check ---
      if (!violation) {
        const currentTotalCount = myRoster.length;
        if (currentTotalCount + 1 > totalRosterLimit) {
          violation = `Roster Full (${totalRosterLimit}/${totalRosterLimit})`;
          vType = 'roster_limit';
        }
      }

      // --- C. Active Roster Limit Check ---
      // Only applicable if targetSlot is NOT Minor/NA
      if (!violation) {
        const isTargetActive = !['NA', 'Minor'].includes(targetSlot);
        if (isTargetActive) {
          const currentActiveCount = myRoster.filter(p => !['NA', 'Minor'].includes(p.position)).length;
          if (currentActiveCount + 1 > activeRosterLimit) {
            violation = `Active Roster Full (${activeRosterLimit}/${activeRosterLimit})`;
            vType = 'active_roster_limit';
          }
        }
      }

      if (violation) {
        setLimitViolationMsg(violation);
        setViolationType(vType);
        setPendingAddPlayer(player);
        setDropCandidateID(null); // Reset selection
        setShowAddDropModal(true); // Force Drop
      } else {
        // Safe to Add standardly
        setPlayerToAdd(player);
        setShowConfirmAdd(true); // Normal Confirm
      }

    } catch (e) {
      console.error(e);
      setError('Failed to validate add.');
    } finally {
      setCheckingAdd(false);
    }
  };

  // Auto-recalculate Slot when Drop Candidate Changes
  useEffect(() => {
    if (!pendingAddPlayer || !currentRosterState) return;

    // Logic similar to Initial Check but considering Drop
    const status = (pendingAddPlayer.real_life_status || 'Active').toUpperCase();
    const isNaEligible = status !== 'MAJOR';

    // Count NA usage
    let currentMinorCount = currentRosterState.filter(p => ['NA', 'Minor'].includes(p.position)).length;

    // Adjust if Drop Candidate is in NA
    if (dropCandidateID) {
      const dropPlayerPosition = currentRosterState.find(p => p.player_id === dropCandidateID)?.position;
      if (['NA', 'Minor'].includes(dropPlayerPosition)) {
        currentMinorCount = Math.max(0, currentMinorCount - 1);
      }
    }

    let targetSlot = 'BN';
    if (allowNaToNaSlot && isNaEligible && currentMinorCount < (naLimitState || 0)) {
      targetSlot = 'NA';
    }

    if (targetSlot !== projectedAddSlot) {
      setProjectedAddSlot(targetSlot);
    }

  }, [dropCandidateID, pendingAddPlayer, currentRosterState, naLimitState, allowNaToNaSlot]);
  // 處理新增球員到隊伍
  const handleAddPlayer = async (player, isWaiver = false) => {
    if (!myManagerId) {
      alert('Please log in first');
      return;
    }

    if (isWaiver) {
      setPlayerToAdd(player);
      setWaiverMode(true);
      setShowConfirmAdd(true);
    } else {
      // FA Add - Run Precheck
      await preCheckAddPlayer(player);
    }
  };

  const confirmAddDrop = async () => {
    if (!pendingAddPlayer || !dropCandidateID) return;

    if (checkTradeInvolvement(dropCandidateID)) return;

    setIsAdding(true);
    try {
      const res = await fetch(`/api/league/${leagueId}/transaction/add-drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: myManagerId,
          addPlayerId: pendingAddPlayer.player_id,
          dropPlayerId: dropCandidateID,
          targetSlot: projectedAddSlot // Pass the frontend calculated slot
        })
      });
      const data = await res.json();

      if (data.success) {
        setShowAddDropModal(false);
        setSuccessMessage(`Added ${pendingAddPlayer.name} (${data.slot}) & Dropped Player`);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);

        // Refresh
        setIsRefreshing(true);
        const ownershipsRes = await fetch(`/api/league/${leagueId}/ownership`);
        const od = await ownershipsRes.json();
        if (od.success) setOwnerships(od.ownerships || []);
        setIsRefreshing(false);
      } else {
        setErrorMessage(data.error);
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage('Transaction failed');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    } finally {
      setIsAdding(false);
      setPendingAddPlayer(null);
      setDropCandidateID(null);
    }
  };

  const checkTradeInvolvement = (playerId) => {
    if (activeTradePlayerIds.has(playerId)) {
      alert('Cannot drop player involved in a pending or accepted trade.');
      return true;
    }
    return false;
  };

  // 處理 DROP 球員
  const handleDropPlayer = async (player) => {
    if (!myManagerId) {
      alert('Please log in first');
      return;
    }

    if (checkTradeInvolvement(player.player_id)) return;

    setPlayerToDrop(player);
    setShowConfirmDrop(true);
  };

  // 確認加入球員
  const confirmAddPlayer = async () => {
    if (!playerToAdd) return;
    try {
      setIsAdding(true);
      let res, data;
      if (waiverMode) {
        // Waiver申請
        // Find the ownership record to get off_waiver date
        const targetOwnership = ownerships.find(o => o.player_id === playerToAdd.player_id);
        const offWaiver = targetOwnership?.off_waiver;

        res = await fetch('/api/waiver_claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            league_id: leagueId,
            manager_id: myManagerId,
            player_id: playerToAdd.player_id,
            drop_player_id: waiverDropPlayerId || null,
            off_waiver: offWaiver
          })
        });
        data = await res.json();
        if (data.success) {
          setShowConfirmAdd(false);
          setIsAdding(false);
          setWaiverSuccessMsg('Waiver claim submitted!');
          setShowWaiverSuccess(true);
          setTimeout(() => setShowWaiverSuccess(false), 4000);
        } else {
          setShowConfirmAdd(false);
          setIsAdding(false);
          setWaiverErrorMsg(data.error || 'Waiver claim failed');
          setShowWaiverError(true);
          setTimeout(() => setShowWaiverError(false), 4000);
        }
      } else {
        // FA 直接加入
        res = await fetch(`/api/league/${leagueId}/ownership`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_id: playerToAdd.player_id,
            manager_id: myManagerId,
            position: projectedAddSlot // Ensure we request the specific slot we showed the user
          })
        });
        data = await res.json();
        if (data.success) {
          setIsAdding(false);
          setShowConfirmAdd(false);
          setSuccessMessage('Player Added Successfully!');
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
          setIsRefreshing(true);
          const ownershipsRes = await fetch(`/api/league/${leagueId}/ownership`);
          const ownershipsData = await ownershipsRes.json();
          if (ownershipsData.success) {
            setOwnerships(ownershipsData.ownerships || []);
          }
          setIsRefreshing(false);
        } else {
          setIsAdding(false);
          setShowConfirmAdd(false);
          setErrorMessage(data.error || 'Unknown error');
          setShowError(true);
          setTimeout(() => setShowError(false), 3000);
        }
      }
    } catch (err) {
      setIsAdding(false);
      setShowConfirmAdd(false);
      if (waiverMode) {
        setWaiverErrorMsg('Waiver claim failed, please try again');
        setShowWaiverError(true);
        setTimeout(() => setShowWaiverError(false), 4000);
      } else {
        setErrorMessage('Operation failed, please try again');
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
      }
      setIsRefreshing(false);
    } finally {
      setPlayerToAdd(null);
      setWaiverMode(false);
      setWaiverDropPlayerId('');
    }
  };

  // 確認 DROP 球員
  const confirmDropPlayer = async () => {
    if (!playerToDrop) return;

    try {
      setIsDropping(true);

      const requestBody = {
        player_id: playerToDrop.player_id,
        manager_id: myManagerId
      };

      const res = await fetch(`/api/league/${leagueId}/ownership`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();

      if (data.success) {
        // 關閉對話框
        setIsDropping(false);
        setShowConfirmDrop(false);

        // 顯示成功動畫
        setSuccessMessage('Player Dropped Successfully!');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);

        // 重新載入 ownerships 資料
        setIsRefreshing(true);
        const ownershipsRes = await fetch(`/api/league/${leagueId}/ownership`);
        const ownershipsData = await ownershipsRes.json();
        if (ownershipsData.success) {
          setOwnerships(ownershipsData.ownerships || []);
        }
        setIsRefreshing(false);
      } else {
        // 顯示失敗動畫
        setIsDropping(false);
        setShowConfirmDrop(false);
        setErrorMessage(data.error || 'Unknown error');
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
      }
    } catch (err) {
      console.error('Drop player error:', err);
      setIsDropping(false);
      setShowConfirmDrop(false);
      setErrorMessage('Operation failed, please try again');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      setIsRefreshing(false);
    } finally {
      setPlayerToDrop(null);
    }
  };

  // 取得自己和對方的球員名單
  const getMyPlayers = () => {
    return ownerships.filter(o => o.manager_id === myManagerId && o.status?.toLowerCase() === 'on team');
  };
  const getTheirPlayers = () => {
    return ownerships.filter(o => o.manager_id === tradeTargetManagerId && o.status?.toLowerCase() === 'on team');
  };

  // 彈窗送出
  const handleSubmitTrade = async () => {
    // 先设置loading状态，给用户立即反馈
    setTradeLoading(true);

    if (!selectedMyPlayers.length || !selectedTheirPlayers.length) {
      setTradeErrorMessage({
        title: 'Validation Error',
        description: 'Both sides must select at least one player to trade.'
      });
      setShowTradeErrorNotification(true);
      setTimeout(() => {
        setShowTradeErrorNotification(false);
      }, 4000);
      setTradeLoading(false); // 重置loading状态
      return;
    }
    try {
      const res = await fetch('/api/trade/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          initiator_manager_id: myManagerId,
          recipient_manager_id: tradeTargetManagerId,
          initiator_player_ids: selectedMyPlayers,
          recipient_player_ids: selectedTheirPlayers
        })
      });
      const data = await res.json();
      if (data.success) {
        setTradeSuccessMessage({
          title: 'Trade Proposal Sent!',
          description: 'Your trade request has been submitted and is pending approval.'
        });
        setShowTradeSuccessNotification(true);
        setShowTradeModal(false); // 立即关闭modal避免重复提交
        setTimeout(() => {
          setShowTradeSuccessNotification(false);
        }, 4000);
      } else {
        setTradeErrorMessage({
          title: 'Trade Failed',
          description: data.error || 'Failed to submit trade proposal. Please try again.'
        });
        setShowTradeErrorNotification(true);
        setTimeout(() => {
          setShowTradeErrorNotification(false);
        }, 4000);
      }
    } catch (err) {
      setTradeErrorMessage({
        title: 'Trade Failed',
        description: 'Trade failed, please try again later'
      });
      setShowTradeErrorNotification(true);
      setTimeout(() => {
        setShowTradeErrorNotification(false);
      }, 4000);
    } finally {
      setTradeLoading(false);
    }
  };

  const isTradeDeadlinePassed = () => {
    if (!tradeEndDate || tradeEndDate.trim().toLowerCase() === 'no trade deadline') return false;

    try {
      const trimmedDate = tradeEndDate.trim();
      let dateStr = trimmedDate;
      // If the date string doesn't include a 4-digit year, append the season year
      if (!/\d{4}/.test(trimmedDate)) {
        dateStr = `${trimmedDate}, ${seasonYear}`;
      }

      const deadline = new Date(dateStr);
      if (isNaN(deadline.getTime())) return false; // Fail safe

      // Set deadline to end of day (23:59:59)
      deadline.setHours(23, 59, 59, 999);

      return new Date() > deadline;
    } catch (e) {
      console.error('Error checking trade deadline:', e);
      return false;
    }
  };

  const getPlayerActionButton = (player) => {
    // 查找該球員的 ownership 資料
    const ownership = ownerships.find(
      o => o.player_id === player.player_id
    );

    // Check League Status
    const allowedStatuses = ['post-draft & pre-season', 'in season', 'playoffs'];
    // Normalize status just in case (e.g. In Season vs in_season) - usually DB uses lowercase specific enum
    // If unknown, default to hide? Or show? Safe is hide.
    // Assuming API returns raw DB value: 'pre_season', 'in_season', 'playoffs', 'post_season'
    const currentStatus = (leagueStatus || '').toLowerCase();

    if (!allowedStatuses.includes(currentStatus)) {
      return <div className="w-8 h-8"></div>;
    }


    // 如果沒有找到 ownership，顯示綠色 + 按鈕
    if (!ownership) {
      return (
        <button
          onClick={() => handleAddPlayer(player)}
          className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold hover:bg-green-700 transition-colors"
        >
          +
        </button>
      );
    }

    // 如果是 waiver 狀態，顯示黃色 + 按鈕
    if (ownership.status?.toLowerCase() === 'waiver') {
      return (
        <button
          onClick={() => handleAddPlayer(player, true)}
          className="w-8 h-8 rounded-full bg-yellow-400 text-white flex items-center justify-center font-bold hover:bg-yellow-500 transition-colors"
          title="Claim via Waiver"
        >
          +
        </button>
      );
    }

    const status = ownership.status?.toLowerCase();

    // 如果 status 是 waiver，顯示占位符以保持對齊
    if (status === 'waiver') {
      return (
        <div className="w-8 h-8"></div>
      );
    }

    // 如果 status 是 on team
    if (status === 'on team') {
      // 檢查是否是自己的球員
      if (ownership.manager_id === myManagerId) {

        // Check Trade Lock
        if (activeTradePlayerIds.has(player.player_id)) {
          return (
            <button
              onClick={() => {
                setLockedPlayerAlert(player.name);
                setTimeout(() => setLockedPlayerAlert(null), 3000);
              }}
              className="w-8 h-8 rounded-full bg-slate-500/20 text-slate-400 flex items-center justify-center font-bold cursor-not-allowed border border-slate-500/50 hover:bg-slate-500/30 transition-colors"
              title="Player is locked in an active trade"
            >
              🔒
            </button>
          );
        }

        // 紅色底的 -
        return (
          <button
            onClick={() => handleDropPlayer(player)}
            className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold hover:bg-red-700 transition-colors"
            title="Drop Player"
          >
            −
          </button>
        );
      } else {
        // Check Trade Deadline
        if (isTradeDeadlinePassed()) {
          return <div className="w-8 h-8"></div>;
        }

        // 藍色框的 ⇌
        return (
          <button
            className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold hover:bg-blue-700 transition-colors"
            onClick={() => {
              setTradeTargetManagerId(ownership.manager_id);
              setShowTradeModal(true);
              setSelectedMyPlayers([]);
              setSelectedTheirPlayers([]);
            }}
            title="Propose Trade"
          >
            ⇌
          </button>
        );
      }
    }

    // 其他狀態不顯示按鈕
    return null;
  };

  // Trade Validation
  const validateTradeRoster = (currentRoster, losingPlayerIds, gainingPlayerIds, settings) => {
    // 1. Calculate future roster
    const losingSet = new Set(losingPlayerIds);
    const futureRoster = currentRoster.filter(p => !losingSet.has(p.player_id));

    // gainingPlayerIds are just IDs, need player objects.
    // Use `players` list to find info.
    const gainingPlayers = players.filter(p => gainingPlayerIds.includes(p.player_id));

    // Add gaining players to future roster. Assume they go to BN (Active).
    const futureRosterWithIncoming = [
      ...futureRoster,
      ...gainingPlayers.map(p => ({ ...p, position: 'BN', identity: p.identity || 'local' }))
    ];

    // 2. Counts
    const rosterConfig = settings.roster_positions || {};
    const totalLimit = Object.values(rosterConfig).reduce((sum, count) => sum + count, 0);

    const foreigners = futureRosterWithIncoming.filter(p => p.identity?.toLowerCase() === 'foreigner');
    const foreignerCount = foreigners.length;
    const foreignerLimit = parseInt(settings.foreigner_on_team_limit) || 999;

    // Active Counts (Exclude NA and Minor)
    const activePlayers = futureRosterWithIncoming.filter(p => {
      const pos = (p.position || '').toUpperCase();
      return !['NA', 'MINOR', 'DL', 'IL'].includes(pos);
    });
    const activeCount = activePlayers.length;

    // Calculate Active Limit (Sum of all slots except NA/Minor/DL/IL)
    const activeLimit = Object.entries(rosterConfig)
      .filter(([key]) => {
        const k = key.toUpperCase();
        return !['MINOR', 'NA', 'DL', 'IL'].includes(k);
      })
      .reduce((sum, [_, count]) => sum + count, 0);

    const activeForeigners = activePlayers.filter(p => p.identity?.toLowerCase() === 'foreigner');
    const activeForeignerCount = activeForeigners.length;
    const activeForeignerLimit = parseInt(settings.foreigner_active_limit) || 999;

    // 3. Check violations
    const violations = [];
    if (futureRosterWithIncoming.length > totalLimit) violations.push(`Total Players: ${futureRosterWithIncoming.length}/${totalLimit}`);
    if (activeCount > activeLimit) violations.push(`Active Players: ${activeCount}/${activeLimit}`);
    if (foreignerCount > foreignerLimit) violations.push(`Foreign Players: ${foreignerCount}/${foreignerLimit}`);
    if (activeForeignerCount > activeForeignerLimit) violations.push(`Active Foreigners: ${activeForeignerCount}/${activeForeignerLimit}`);

    return violations;
  };

  // Trade Modal
  const renderTradeModal = () => {
    if (!showTradeModal) return null;
    const myPlayers = getMyPlayers();
    const theirPlayers = getTheirPlayers();
    const myNick = members.find(m => m.manager_id === myManagerId)?.nickname || 'You';
    const theirNick = members.find(m => m.manager_id === tradeTargetManagerId)?.nickname || 'Opponent';

    // Validate
    const myViolations = validateTradeRoster(tradeMyRoster, selectedMyPlayers, selectedTheirPlayers, leagueSettings);
    const theirViolations = validateTradeRoster(tradeTheirRoster, selectedTheirPlayers, selectedMyPlayers, leagueSettings);

    const isValid = myViolations.length === 0 && theirViolations.length === 0;

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-gradient-to-br from-purple-700/90 to-blue-800/90 border border-purple-400/40 rounded-2xl shadow-2xl w-full max-w-2xl relative max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-purple-400/20 bg-gradient-to-r from-purple-600/80 to-blue-700/80 rounded-t-2xl shrink-0">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span className="text-3xl">⇌</span> Trade Proposal
            </h2>
            <button className="text-purple-200 hover:text-white text-2xl font-bold" onClick={() => setShowTradeModal(false)}>
              ×
            </button>
          </div>

          {isFetchingTradeData ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mb-4"></div>
              <div className="text-purple-200 font-bold">Loading rosters...</div>
            </div>
          ) : (
            <>
              <div className="flex justify-between px-6 pt-4 pb-2 shrink-0">
                <div className="font-bold text-purple-200">{myNick}</div>
                <div className="font-bold text-pink-200">{theirNick}</div>
              </div>

              <div className="grid grid-cols-2 gap-6 px-6 pb-2 flex-1 min-h-0 overflow-hidden">
                <div className="flex flex-col h-full overflow-hidden">
                  <h3 className="text-purple-300 font-bold mb-2 sticky top-0 bg-slate-900/90 z-10 px-1 backdrop-blur-sm">My Players</h3>
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                    {myPlayers.length === 0 && <div className="text-gray-400 p-2 italic">No tradable players</div>}
                    {myPlayers.map(o => {
                      const player = players.find(p => p.player_id === o.player_id);
                      if (!player) return null;
                      const isSelected = selectedMyPlayers.includes(o.player_id);
                      const rosterEntry = tradeMyRoster.find(r => r.player_id === o.player_id);
                      const currentSlot = rosterEntry?.position || '-';

                      return (
                        <label
                          key={o.player_id}
                          className={`
                        flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer relative overflow-hidden shrink-0
                        ${isSelected
                              ? 'bg-purple-600/20 border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                              : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/80 hover:border-slate-500'}
                      `}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={isSelected}
                            onChange={e => {
                              setSelectedMyPlayers(val => e.target.checked ? [...val, o.player_id] : val.filter(id => id !== o.player_id));
                            }}
                          />
                          {/* Selection Indicator */}
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-500'}`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>

                          {/* Photo */}
                          <div className="w-10 h-10 rounded-full bg-slate-900 overflow-hidden border border-slate-600 shrink-0">
                            <img
                              src={getPlayerPhoto(player)}
                              alt={player.name}
                              className="w-full h-full object-cover"
                              onError={(e) => handleImageError(e, player)}
                            />
                          </div>

                          {/* Info */}
                          <div className="flex flex-col min-w-0">
                            <div className={`font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>{player.name}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                              <span className={`${getTeamColor(player.team)} font-bold`}>{getTeamAbbr(player.team)}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                              <span>{filterPositions(player)}</span>
                              <span className="text-yellow-400 font-bold ml-1">({currentSlot})</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col h-full overflow-hidden">
                  <h3 className="text-pink-300 font-bold mb-2 sticky top-0 bg-slate-900/90 z-10 px-1 backdrop-blur-sm">Their Players</h3>
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                    {theirPlayers.length === 0 && <div className="text-gray-400 p-2 italic">No tradable players</div>}
                    {theirPlayers.map(o => {
                      const player = players.find(p => p.player_id === o.player_id);
                      if (!player) return null;
                      const isSelected = selectedTheirPlayers.includes(o.player_id);
                      const rosterEntry = tradeTheirRoster.find(r => r.player_id === o.player_id);
                      const currentSlot = rosterEntry?.position || '-';

                      return (
                        <label
                          key={o.player_id}
                          className={`
                        flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer relative overflow-hidden shrink-0
                        ${isSelected
                              ? 'bg-pink-600/20 border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.2)]'
                              : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800/80 hover:border-slate-500'}
                      `}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={isSelected}
                            onChange={e => {
                              setSelectedTheirPlayers(val => e.target.checked ? [...val, o.player_id] : val.filter(id => id !== o.player_id));
                            }}
                          />
                          {/* Selection Indicator */}
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-pink-500 border-pink-500' : 'border-slate-500'}`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>

                          {/* Photo */}
                          <div className="w-10 h-10 rounded-full bg-slate-900 overflow-hidden border border-slate-600 shrink-0">
                            <img
                              src={getPlayerPhoto(player)}
                              alt={player.name}
                              className="w-full h-full object-cover"
                              onError={(e) => handleImageError(e, player)}
                            />
                          </div>

                          {/* Info */}
                          <div className="flex flex-col min-w-0">
                            <div className={`font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>{player.name}</div>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                              <span className={`${getTeamColor(player.team)} font-bold`}>{getTeamAbbr(player.team)}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                              <span>{filterPositions(player)}</span>
                              <span className="text-yellow-400 font-bold ml-1">({currentSlot})</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Validation Errors */}
              {
                (myViolations.length > 0 || theirViolations.length > 0) && (
                  <div className="px-6 pb-2">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <h4 className="text-red-300 font-bold text-sm mb-1">⚠ Roster Violations</h4>
                      <ul className="text-xs text-red-200 list-disc list-inside space-y-0.5">
                        {myViolations.map((v, i) => <li key={`my-${i}`}>You: {v}</li>)}
                        {theirViolations.map((v, i) => <li key={`their-${i}`}>{theirNick}: {v}</li>)}
                      </ul>
                    </div>
                  </div>
                )
              }

              <div className="flex justify-between items-center px-6 py-4 border-t border-purple-400/20 bg-gradient-to-r from-purple-700/60 to-blue-800/60 rounded-b-2xl shrink-0">
                <div className="text-xs text-purple-200/60 italic">
                  * Received players are assumed to occupy Active (BN) slots.
                </div>
                <div className="flex gap-3">
                  <button
                    className="px-6 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold"
                    onClick={() => setShowTradeModal(false)}
                    disabled={tradeLoading}
                  >Cancel</button>
                  <button
                    className={`px-6 py-2 rounded-lg font-bold shadow flex items-center gap-2 ${isValid && !tradeLoading
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      }`}
                    onClick={handleSubmitTrade}
                    disabled={tradeLoading || !isValid}
                  >
                    {tradeLoading && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {tradeLoading ? 'Submitting...' : 'Submit Trade'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div >
      </div >
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-xl text-purple-300">Loading players...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 backdrop-blur-lg border border-red-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="text-xl text-red-300">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
              Players
            </h1>
            <button
              onClick={() => setShowLegendModal(true)}
              className="mb-2 px-3 py-1 rounded-full bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/50 text-blue-300 flex items-center justify-center transition-colors text-xs font-bold tracking-wider"
              title="View Legend"
            >
              LEGEND
            </button>
            <button
              onClick={() => setShowInfoModal(true)}
              className="mb-2 px-3 py-1 rounded-full bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/50 text-purple-300 flex items-center justify-center transition-colors text-xs font-bold tracking-wider"
              title="Position Eligibility Rules"
            >
              POS RULES
            </button>
            {acquisitionData && (
              <div className={`mb-2 px-3 py-1 rounded-full border flex items-center justify-center transition-colors text-xs font-bold tracking-wider ${acquisitionData.limit !== 'No Maximum' && acquisitionData.usage >= acquisitionData.limit
                ? 'bg-red-500/30 border-red-400/50 text-red-300'
                : 'bg-emerald-500/30 border-emerald-400/50 text-emerald-300'
                }`}>
                {acquisitionData.week.includes('Pre-season') || acquisitionData.week.includes('Off-season')
                  ? `Add limit: ${acquisitionData.limit} (${acquisitionData.week})`
                  : `Add limit: ${acquisitionData.usage} / ${acquisitionData.limit} (${acquisitionData.week})`
                }
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search player name or alias"
                  className="w-full px-3 py-2 bg-slate-800/60 border border-purple-500/30 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>



              {/* Identity */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Identity
                </label>
                <select
                  value={filterIdentity}
                  onChange={(e) => setFilterIdentity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/60 border border-purple-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="local">Local</option>
                  <option value="foreigner">Foreigner</option>
                </select>
              </div>

              {/* Team Filter */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Team
                </label>
                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/60 border border-purple-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">All Teams</option>
                  <option value="統一獅">統一獅</option>
                  <option value="富邦悍將">富邦悍將</option>
                  <option value="樂天桃猿">樂天桃猿</option>
                  <option value="中信兄弟">中信兄弟</option>
                  <option value="味全龍">味全龍</option>
                  <option value="台鋼雄鷹">台鋼雄鷹</option>
                </select>
              </div>

              {/* Position Filter */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Position
                </label>
                <select
                  value={filterPosition}
                  onChange={(e) => setFilterPosition(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/60 border border-purple-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">All Positions</option>
                  {(filterType === 'batter' ? batterPositionOrder : pitcherPositionOrder)
                    .filter(pos => rosterPositions[pos] && rosterPositions[pos] > 0 && !['BN', 'NA'].includes(pos))
                    .map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))
                  }
                </select>
              </div>

              {/* Ownership Filter */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Status
                </label>
                <select
                  value={filterOwnership}
                  onChange={(e) => setFilterOwnership(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/60 border border-purple-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="all">All Players</option>
                  <option value="available">Free Agents</option>
                  <option value="myteam">My Team</option>
                  <option value="watched">★ Watched</option>
                </select>
              </div>

              {/* Time Window */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Stats Period
                </label>
                <select
                  value={timeWindow || ''}
                  onChange={(e) => setTimeWindow(e.target.value)}
                  disabled={!timeWindow}
                  className="w-full px-3 py-2 bg-slate-800/60 border border-purple-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                >
                  {!timeWindow && <option value="">Loading...</option>}
                  <option value="Today">Today</option>
                  <option value="Yesterday">Yesterday</option>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 14 Days">Last 14 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="2026 Season">2026 Season</option>
                  <option value="2025 Season">2025 Season</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Players Table */}
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600/80 to-blue-600/80 backdrop-blur-sm p-6 border-b border-purple-400/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Player List
              </h2>
              <span className="text-[10px] sm:text-xs text-white/70 italic font-sans md:ml-10">
                *Rate/Negative stats require PA/IP top 60% qualification to rank.
              </span>
            </div>
            <div className="flex bg-slate-900/40 p-1 rounded-md border border-white/20">
              <button
                onClick={() => {
                  setFilterType('batter');
                  setFilterPosition('all');
                  setSortConfig({ key: 'rank', direction: 'asc' });
                }}
                className={`flex items-center justify-center py-1.5 px-4 rounded text-sm font-bold transition-all ${filterType === 'batter'
                  ? 'bg-white text-purple-600 shadow'
                  : 'text-purple-200 hover:text-white hover:bg-white/10'
                  }`}
              >
                Batter
              </button>
              <button
                onClick={() => {
                  setFilterType('pitcher');
                  setFilterPosition('all');
                  setSortConfig({ key: 'rank', direction: 'asc' });
                }}
                className={`flex items-center justify-center py-1.5 px-4 rounded text-sm font-bold transition-all ${filterType === 'pitcher'
                  ? 'bg-white text-purple-600 shadow'
                  : 'text-purple-200 hover:text-white hover:bg-white/10'
                  }`}
              >
                Pitcher
              </button>
            </div>
          </div>

          <div className="overflow-x-auto relative min-h-[400px]">



            <table className="w-full">
              <thead className="bg-slate-900/60 border-b border-purple-500/20">
                <tr>
                  <th
                    className="px-6 py-4 text-left text-sm font-bold text-purple-300 cursor-pointer hover:text-white transition-colors group"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortConfig.key === 'name' && (
                        <span className="text-xs">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-4 text-center text-sm font-bold text-purple-300 cursor-pointer hover:text-white transition-colors group select-none"
                    onClick={() => handleSort('rank')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Rank
                      {sortConfig.key === 'rank' && (
                        <span className="text-xs">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-4 text-center text-sm font-bold text-purple-300 cursor-pointer hover:text-white transition-colors group select-none"
                    onClick={() => handleSort('roster_percentage')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Roster%
                      {sortConfig.key === 'roster_percentage' && (
                        <span className="text-xs">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>


                  {/* 動態顯示統計項目 */}
                  {filterType === 'batter' && displayBatterCats.map((stat) => {
                    const displayName = getStatAbbr(stat);
                    const isForced = !batterStatCategories.includes(stat);
                    return (
                      <th
                        key={stat}
                        className={`px-4 py-4 text-center text-sm font-bold ${isForced ? 'text-purple-300/60' : 'text-purple-300'} cursor-pointer hover:text-white transition-colors select-none`}
                        onClick={() => handleSort(stat)}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {displayName}
                          {sortConfig.key === stat && (
                            <span className="text-xs">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {filterType === 'pitcher' && displayPitcherCats.map((stat) => {
                    const displayName = getStatAbbr(stat);
                    const isForced = !pitcherStatCategories.includes(stat);
                    return (
                      <th
                        key={stat}
                        className={`px-4 py-4 text-center text-sm font-bold ${isForced ? 'text-purple-300/60' : 'text-purple-300'} cursor-pointer hover:text-white transition-colors select-none`}
                        onClick={() => handleSort(stat)}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {displayName}
                          {sortConfig.key === stat && (
                            <span className="text-xs">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/10">
                {fetchingStats ? (
                  <tr>
                    <td colSpan={4 + (filterType === 'batter' ? displayBatterCats.length : displayPitcherCats.length)} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin"></div>
                        <span className="text-purple-300 font-bold tracking-widest animate-pulse">LOADING STATS & SORTING...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={4 + (filterType === 'batter' ? displayBatterCats.length : displayPitcherCats.length)} className="px-6 py-12 text-center">
                      <div className="text-purple-300/50 text-lg">
                        {searchTerm || filterType !== 'all' || filterIdentity !== 'all'
                          ? 'No players found matching your filters'
                          : 'No available players'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player, index) => (
                    <tr
                      key={player.player_id}
                      className="hover:bg-purple-500/5 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {getPlayerActionButton(player)}
                          <img
                            src={getPlayerPhoto(player)}
                            alt={`${player.name} Avatar`}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              {/* Watch Button */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleToggleWatch(player, watchedPlayerIds.has(player.player_id)); }}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold transition-all ${watchedPlayerIds.has(player.player_id)
                                  ? 'bg-amber-500 text-white hover:bg-amber-400'
                                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-amber-400'
                                  }`}
                                title={watchedPlayerIds.has(player.player_id) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                              >
                                {watchedPlayerIds.has(player.player_id) ? '★' : '☆'}
                              </button>
                              {playerRankings[player.player_id] && (
                                <span className="text-xs font-bold text-cyan-400">#{playerRankings[player.player_id]}</span>
                              )}
                              <span
                                className="text-white font-semibold group-hover:text-purple-300 transition-colors cursor-pointer"
                                onClick={() => setSelectedPlayerModal(player)}
                              >
                                {player.name || 'Unknown'}
                                {player.original_name && player.original_name !== player.name && (
                                  <span className="text-purple-300/60 text-sm font-normal ml-1">
                                    ({player.original_name})
                                  </span>
                                )}
                                <span className="text-purple-300/70 font-normal ml-2">
                                  - {filterPositions(player)}
                                </span>
                                <span className={`text-sm font-bold ml-2 ${getTeamColor(player.team)}`}>
                                  {player.team ? `${getTeamAbbr(player.team)}` : ''}
                                </span>
                              </span>
                              {renderStatusTag(player)}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                {player.game_info ? (
                                  <>
                                    {new Date(player.game_info.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    {' '}
                                    {player.game_info.is_home ? 'vs' : '@'}
                                    {' '}
                                    {player.game_info.opponent}
                                  </>
                                ) : (
                                  'No game'
                                )}
                              </span>
                              {player.real_life_status && player.real_life_status !== 'MAJOR' && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${player.real_life_status === 'MINOR'
                                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                  : player.real_life_status === 'DEREGISTERED'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                    : 'bg-slate-500/20 text-slate-300 border-slate-500/30' // UNREGISTERED
                                  }`} title={player.real_life_status}>
                                  {player.real_life_status === 'MINOR' ? 'NA' : player.real_life_status === 'DEREGISTERED' ? 'DR' : 'NR'}
                                </span>
                              )}
                              {player.identity !== 'local' && (
                                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold" title="Foreign Player">
                                  F
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-mono text-cyan-300">
                        {playerRankings[player.player_id] || '-'}
                      </td>
                      <td className="px-4 py-4 text-center font-mono text-cyan-300">
                        {player.roster_percentage ?? 0}%
                      </td>


                      {/* 動態顯示統計數據 */}
                      {filterType === 'batter' && displayBatterCats.map((stat) => {
                        const isForced = !batterStatCategories.includes(stat);
                        const statAbbr = getStatAbbr(stat).toLowerCase();
                        const rank = !isForced && cpblStatRankings[String(player.player_id)]?.[statAbbr];
                        return (
                          <td key={stat} className={`px-4 py-4 text-center font-mono relative ${isForced ? 'text-slate-500' : 'text-purple-100'}`}>
                            <div className="w-full text-center">{getPlayerStat(player.player_id, stat)}</div>
                            {rank && rank <= 15 && (
                              <div className="absolute left-0 right-0 bottom-1.5 text-[11px] font-black text-amber-500 font-sans tracking-wide leading-none">{getOrdinal(rank)}</div>
                            )}
                          </td>
                        );
                      })}
                      {filterType === 'pitcher' && displayPitcherCats.map((stat) => {
                        const isForced = !pitcherStatCategories.includes(stat);
                        const statAbbr = getStatAbbr(stat).toLowerCase();
                        const rank = !isForced && cpblStatRankings[String(player.player_id)]?.[statAbbr];
                        return (
                          <td key={stat} className={`px-4 py-4 text-center font-mono relative ${isForced ? 'text-slate-500' : 'text-purple-100'}`}>
                            <div className="w-full text-center">{getPlayerStat(player.player_id, stat)}</div>
                            {rank && rank <= 15 && (
                              <div className="absolute left-0 right-0 bottom-1.5 text-[11px] font-black text-amber-500 font-sans tracking-wide leading-none">{getOrdinal(rank)}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div >

      {/* 確認新增對話框 */}
      {
        showConfirmAdd && playerToAdd && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-purple-500/30 shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-4">
                {waiverMode ? 'Claim Waiver Player' : 'Add Player'}
              </h3>
              <p className="text-purple-200 mb-6">
                {waiverMode ? (
                  <>
                    Submit a waiver claim for <span className="font-bold text-white">{playerToAdd.name}</span>?
                    <br />
                    <span className="text-sm text-purple-300">(Optional) Select a player to drop if claim successful:</span>
                    <select
                      className="block w-full mt-2 px-3 py-2 bg-slate-800/60 border border-purple-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      value={waiverDropPlayerId}
                      onChange={e => setWaiverDropPlayerId(e.target.value)}
                      disabled={isAdding}
                    >
                      <option value="">No drop (just add)</option>
                      {ownerships.filter(o => o.manager_id === myManagerId && o.status?.toLowerCase() === 'on team').map(o => (
                        <option key={o.player_id} value={o.player_id}>
                          {players.find(p => p.player_id === o.player_id)?.name || o.player_id}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    Add <span className="font-bold text-white">{playerToAdd.name}</span> to your team?
                    <div className="mt-2 text-sm text-purple-300">
                      Target Slot: <span className={`font-bold uppercase px-1.5 py-0.5 rounded ${projectedAddSlot === 'NA' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-slate-700 text-slate-300 border border-slate-600'}`}>{projectedAddSlot}</span>
                    </div>
                  </>
                )}
              </p>

              {/* 執行中動畫 */}
              {isAdding && (
                <div className="mb-6 flex items-center justify-center gap-3 text-purple-300">
                  <div className="w-6 h-6 border-3 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-semibold">{waiverMode ? 'Submitting...' : 'Adding player...'}</span>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowConfirmAdd(false);
                    setPlayerToAdd(null);
                    setIsAdding(false);
                    setWaiverMode(false);
                    setWaiverDropPlayerId('');
                  }}
                  disabled={isAdding}
                  className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAddPlayer}
                  disabled={isAdding}
                  className={`flex-1 px-4 py-2 ${waiverMode ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isAdding ? (waiverMode ? 'Submitting...' : 'Processing...') : (waiverMode ? 'Submit Claim' : 'Confirm')}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 確認 DROP 對話框 */}
      {
        showConfirmDrop && playerToDrop && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-red-500/30 shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-4">Drop Player</h3>
              <p className="text-red-200 mb-6">
                Are you sure you want to drop <span className="font-bold text-white">{playerToDrop.name}</span>?
              </p>

              {/* 執行中動畫 */}
              {isDropping && (
                <div className="mb-6 flex items-center justify-center gap-3 text-red-300">
                  <div className="w-6 h-6 border-3 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-semibold">Dropping player...</span>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowConfirmDrop(false);
                    setPlayerToDrop(null);
                    setIsDropping(false);
                  }}
                  disabled={isDropping}
                  className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDropPlayer}
                  disabled={isDropping}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDropping ? 'Processing...' : 'Confirm Drop'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 成功動畫 */}
      {
        showSuccess && (
          <div className="fixed inset-0 flex items-center justify-center z-[100020] pointer-events-none">
            <div className={`text-white px-8 py-4 rounded-2xl shadow-2xl animate-bounce ${successMessage.startsWith('Player Dropped') ? 'bg-red-600' : 'bg-green-600'}`}>
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xl font-bold">{successMessage}</span>
              </div>
            </div>
          </div>
        )
      }

      {/* 重新載入動畫 */}
      {
        isRefreshing && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100010]">
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-white font-bold text-lg">Refreshing...</span>
              </div>
            </div>
          </div>
        )
      }

      {/* 失敗動畫 */}
      {
        showError && (
          <div className="fixed inset-0 flex items-center justify-center z-[100020] pointer-events-none">
            <div className="bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl animate-bounce max-w-md mx-4">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <div>
                  <div className="text-xl font-bold">Failed!</div>
                  <div className="text-sm">{errorMessage}</div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* 守位資格說明視窗 */}
      {
        showInfoModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]" onClick={() => setShowInfoModal(false)}>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-0 max-w-2xl w-full mx-4 border border-purple-500/30 shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-purple-500/20 flex-shrink-0">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Position Eligibility Rules
                </h3>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-5 text-purple-100">
                <div className="bg-purple-500/10 rounded-lg p-5 border border-purple-500/20">
                  <h4 className="text-lg font-bold text-purple-300 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    Batter Position Eligibility
                  </h4>
                  <p className="text-purple-200 leading-relaxed">
                    Players must appear in <span className="font-bold text-green-300">8 or more games</span> at a position to be eligible for that position.
                  </p>
                </div>

                <div className="bg-purple-500/10 rounded-lg p-5 border border-purple-500/20">
                  <h4 className="text-lg font-bold text-purple-300 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                    Pitcher Position Eligibility
                  </h4>
                  <div className="space-y-2 text-purple-200">
                    <p className="leading-relaxed">
                      <span className="font-bold text-orange-300">SP (Starting Pitcher):</span> Must have <span className="font-bold text-orange-300">3 or more</span> starting appearances.
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-bold text-orange-300">RP (Relief Pitcher):</span> Must have <span className="font-bold text-orange-300">5 or more</span> relief appearances.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-500/10 rounded-lg p-5 border border-blue-500/20">
                  <h4 className="text-lg font-bold text-blue-300 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    Data Coverage
                  </h4>
                  <p className="text-blue-200 leading-relaxed">
                    Position eligibility is calculated using <span className="font-bold text-blue-300">2025 OR 2026</span> season statistics (union of both seasons).
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-purple-500/20 flex justify-end flex-shrink-0">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Trade Modal */}
      {renderTradeModal()}

      {/* Waiver Success Notification */}
      {
        showWaiverSuccess && (
          <div className="fixed top-6 right-6 z-[100020] animate-slide-in-right">
            <div className="bg-gradient-to-br from-green-600/95 to-emerald-600/95 border border-green-400/30 rounded-2xl shadow-2xl p-6 max-w-md transform transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="bg-white/20 p-3 rounded-full animate-bounce-once">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-xl font-black text-white mb-1">
                    Success!
                  </h3>
                  <p className="text-green-50/90 text-sm mb-3">
                    {waiverSuccessMsg}
                  </p>
                </div>
                <button
                  onClick={() => setShowWaiverSuccess(false)}
                  className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full animate-progress-bar" style={{ animationDuration: '4s' }}></div>
              </div>
            </div>
          </div>
        )
      }

      {/* Waiver Error Notification */}
      {
        showWaiverError && (
          <div className="fixed top-6 right-6 z-[100020] animate-slide-in-right">
            <div className="bg-gradient-to-br from-red-600/95 to-rose-600/95 border border-red-400/30 rounded-2xl shadow-2xl p-6 max-w-md transform transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="bg-white/20 p-3 rounded-full animate-bounce-once">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-xl font-black text-white mb-1">
                    Error
                  </h3>
                  <p className="text-red-50/90 text-sm mb-3">
                    {waiverErrorMsg}
                  </p>
                </div>
                <button
                  onClick={() => setShowWaiverError(false)}
                  className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full animate-progress-bar" style={{ animationDuration: '4s' }}></div>
              </div>
            </div>
          </div>
        )
      }

      {/* Checking Roster Overlay */}
      {
        checkingAdd && (
          <div className="fixed inset-0 z-[100010] bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-blue-200 font-bold tracking-widest text-lg">CHECKING ROSTER ELIGIBILITY...</div>
            </div>
          </div>
        )
      }

      {/* Trade Success Notification */}
      {
        showTradeSuccessNotification && (
          <div className="fixed top-6 right-6 z-[100020] animate-slide-in-right">
            <div className="bg-gradient-to-br from-green-600/95 to-emerald-600/95 border border-green-400/30 rounded-2xl shadow-2xl p-6 max-w-md transform transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="bg-white/20 p-3 rounded-full animate-bounce-once">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-xl font-black text-white mb-1">
                    {tradeSuccessMessage.title}
                  </h3>
                  <p className="text-green-50/90 text-sm mb-3">
                    {tradeSuccessMessage.description}
                  </p>
                </div>
                <button
                  onClick={() => setShowTradeSuccessNotification(false)}
                  className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full animate-progress-bar" style={{ animationDuration: '4s' }}></div>
              </div>
            </div>
          </div>
        )
      }

      {/* Trade Error Notification */}
      {
        showTradeErrorNotification && (
          <div className="fixed top-6 right-6 z-[100020] animate-slide-in-right">
            <div className="bg-gradient-to-br from-red-600/95 to-rose-600/95 border border-red-400/30 rounded-2xl shadow-2xl p-6 max-w-md transform transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="bg-white/20 p-3 rounded-full animate-bounce-once">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-xl font-black text-white mb-1">
                    {tradeErrorMessage.title}
                  </h3>
                  <p className="text-red-50/90 text-sm mb-3">
                    {tradeErrorMessage.description}
                  </p>
                </div>
                <button
                  onClick={() => setShowTradeErrorNotification(false)}
                  className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full animate-progress-bar" style={{ animationDuration: '4s' }}></div>
              </div>
            </div>
          </div>
        )
      }

      {/* Locked Player Notification */}
      {
        lockedPlayerAlert && (
          <div className="fixed top-6 right-6 z-[100030] animate-slide-in-right">
            <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 border border-purple-500/50 rounded-2xl shadow-2xl p-5 max-w-sm transform transition-all duration-300 flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/30 shrink-0">
                <span className="text-2xl">🔒</span>
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Trade Locked</h4>
                <p className="text-slate-300 text-xs">
                  <span className="text-purple-300 font-bold">{lockedPlayerAlert}</span> is involved in an active trade and cannot be dropped.
                </p>
              </div>
              <button
                onClick={() => setLockedPlayerAlert(null)}
                className="ml-auto text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        )
      }

      {/* Legend Modal */}
      <LegendModal
        isOpen={showLegendModal}
        onClose={() => setShowLegendModal(false)}
        batterStats={batterStatCategories}
        pitcherStats={pitcherStatCategories}
      />

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes bounce-once {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }
        @keyframes progress-bar {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.5s ease-out;
        }
        .animate-bounce-once {
          animation: bounce-once 1s ease-in-out;
        }
        .animate-progress-bar {
          animation: progress-bar linear forwards;
        }
      `}</style>
      {/* Add & Drop Modal */}
      {
        showAddDropModal && pendingAddPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-red-500/50 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-fade-in-up">
              <div className="px-6 py-4 bg-red-900/30 border-b border-red-500/30 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  ⚠️ Limit Reached
                </h3>
                <button onClick={() => setShowAddDropModal(false)} className="text-slate-400 hover:text-white font-bold text-2xl">×</button>
              </div>



              <div className="p-6">
                <div className="mb-4 text-slate-300 text-sm">
                  {limitViolationMsg}. To add <span className="text-white font-bold">{pendingAddPlayer.name}</span>, you must drop <span className="text-red-400 font-bold">{violationType.includes('foreigner') ? 'a Foreigner' : 'a player'}</span>.
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 border border-purple-500/20 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-green-400 font-black text-xl">+</div>
                    <img src={getPlayerPhoto(pendingAddPlayer)} className="w-10 h-10 rounded-full bg-slate-700" onError={(e) => e.target.src = '/photo/defaultPlayer.png'} />
                    <div>
                      <div className="font-bold text-white">{pendingAddPlayer.name}</div>
                      <div className="text-xs text-purple-300">Target Slot: <span className="font-bold uppercase border border-purple-500/50 px-1 rounded">{projectedAddSlot}</span></div>
                    </div>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wide">
                  Select {violationType.includes('foreigner') ? 'Foreigner' : 'Player'} to Drop
                </h4>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {getMyPlayers().map(p => {
                    const playerDetail = players.find(x => x.player_id === p.player_id);
                    if (!playerDetail) return null;

                    // Filter logic: If violation is foreigner specific, only show foreigners
                    if (violationType === 'foreigner_limit' || violationType === 'foreigner_active_limit') {
                      if (playerDetail.identity?.toLowerCase() !== 'foreigner') return null;
                    }

                    const isLocked = activeTradePlayerIds.has(p.player_id);
                    const isSelected = dropCandidateID === p.player_id;

                    if (isLocked) {
                      return (
                        <div key={p.player_id} className="flex items-center justify-between p-3 rounded-xl border border-slate-700 bg-slate-900/50 opacity-60 cursor-not-allowed">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-900 overflow-hidden grayscale">
                              <img src={getPlayerPhoto(playerDetail)} className="w-full h-full object-cover" onError={(e) => e.target.src = '/photo/defaultPlayer.png'} />
                            </div>
                            <div className="font-bold text-slate-400">{playerDetail.name}</div>
                          </div>
                          <div className="text-slate-500 font-bold text-xs flex items-center gap-1">
                            🔒 <span className="hidden sm:inline">In Trade</span>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={p.player_id}
                        onClick={() => setDropCandidateID(p.player_id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-red-900/40 border-red-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 overflow-hidden">
                            <img src={getPlayerPhoto(playerDetail)} className="w-full h-full object-cover" onError={(e) => e.target.src = '/photo/defaultPlayer.png'} />
                          </div>
                          <div className="font-bold text-white">{playerDetail.name}</div>
                        </div>
                        {isSelected && <div className="text-red-400 font-bold text-sm">DROP</div>}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setShowAddDropModal(false)} className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800">Cancel</button>
                  {(() => {
                    const dropPlayerInRoster = currentRosterState.find(p => p.player_id === dropCandidateID);
                    const isDropActive = dropPlayerInRoster && !['NA', 'Minor'].includes(dropPlayerInRoster.position);

                    // Validation: 
                    // If Active Limit exceeded (active_roster_limit OR foreigner_active_limit), we usually need to drop Active.
                    // BUT if the new player goes to NA (because we dropped an NA player??? No, if we add active, we must drop active OR drop NA to move someone to NA... wait)
                    // Simplified: If violation is Active Limit, drop candidate MUST be Active.
                    const isViolationActiveLimit = violationType === 'active_roster_limit' || violationType === 'foreigner_active_limit';

                    // If violation is ActiveLimit, we generally must drop an Active player to free up a slot.
                    // Exception: If we drop an NA player, but that allows us to move an active player to NA... the system doesn't auto-move players yet usually.
                    // So we strictly require drop to be Active if limit is Active.


                    // Simplified Logic:
                    // We only have a problem if we represent a Net Increase in Active count that violates the limit.
                    // Violation exists if: Add is Active AND Drop is NOT Active.
                    // If Add becomes NA (projectedAddSlot 'NA'), then Add is NOT Active (0 increase), so we are safe regardless of drop.
                    const isAddActive = !['NA', 'Minor'].includes(projectedAddSlot);
                    const isInvalidDropForActiveLimit = isViolationActiveLimit && isAddActive && !isDropActive;

                    return (
                      <button
                        onClick={confirmAddDrop}
                        disabled={!dropCandidateID || isAdding || isInvalidDropForActiveLimit}
                        className={`px-6 py-2 rounded-xl font-bold shadow-lg transition-all ${!dropCandidateID || isAdding || isInvalidDropForActiveLimit ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:scale-105'}`}
                      >
                        {isInvalidDropForActiveLimit ? 'Drop Active Player to Fix' : (isAdding ? 'Processing...' : 'Confirm Add & Drop')}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )
      }

      <PlayerDetailModal
        isOpen={!!selectedPlayerModal}
        onClose={() => setSelectedPlayerModal(null)}
        player={selectedPlayerModal}
        leagueId={leagueId}
        // Transaction Props
        myManagerId={myManagerId}
        ownership={selectedPlayerModal ? ownerships.find(o => o.player_id === selectedPlayerModal.player_id) : null}
        leagueStatus={leagueStatus}
        tradeEndDate={tradeEndDate}
        seasonYear={seasonYear}
        isPlayerLocked={selectedPlayerModal ? activeTradePlayerIds.has(selectedPlayerModal.player_id) : false}
        onAdd={(player, isWaiver) => handleAddPlayer(player, isWaiver)}
        onDrop={(player) => handleDropPlayer(player)}
        onTrade={(player, ownerManagerId) => {
          setTradeTargetManagerId(ownerManagerId);
          setShowTradeModal(true);
          setSelectedMyPlayers([]);
          setSelectedTheirPlayers([]);
        }}
        // Watch Props
        isWatched={selectedPlayerModal ? watchedPlayerIds.has(selectedPlayerModal.player_id) : false}
        onToggleWatch={handleToggleWatch}
      />
    </div >
  );
}

