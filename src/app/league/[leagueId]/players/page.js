'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

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
  const [members, setMembers] = useState([]); // 當前聯盟成員（含 nickname）
  const [showConfirmAdd, setShowConfirmAdd] = useState(false); // 確認新增對話框
  const [playerToAdd, setPlayerToAdd] = useState(null); // 待加入的球員
  const [isAdding, setIsAdding] = useState(false); // 執行新增中
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
          setRosterPositions(leagueData.league?.roster_positions || {});
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

  // 根據 roster_positions 過濾守備位置
  const filterPositions = (player) => {
    const positionList = player.position_list;
    
    // 若無守備位置資料，直接返回 NA
    if (!positionList) {
      return 'NA';
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

  const filteredPlayers = players.filter(player => {
    const matchesSearch = searchTerm === '' || 
      player.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.original_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = 
      (filterType === 'batter' && player.batter_or_pitcher === 'batter') ||
      (filterType === 'pitcher' && player.batter_or_pitcher === 'pitcher');

    const matchesIdentity = filterIdentity === 'all' || 
      player.identity?.toLowerCase() === filterIdentity.toLowerCase();

    return matchesSearch && matchesType && matchesIdentity;
  });

  const getTeamColor = (team) => {
    switch(team) {
      case '統一獅':
        return 'bg-orange-600 text-white';
      case '富邦悍將':
        return 'bg-blue-600 text-white';
      case '台鋼雄鷹':
        return 'bg-green-800 text-white';
      case '味全龍':
        return 'bg-red-600 text-white';
      case '樂天桃猿':
        return 'bg-rose-800 text-white';
      case '中信兄弟':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-slate-600 text-white';
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
        <span className="text-green-300 font-semibold">| FA</span>
      );
    }

    const status = (ownership.status || '').toLowerCase();
    if (status === 'waiver') {
      const off = ownership.off_waiver ? new Date(ownership.off_waiver) : null;
      const md = off ? `${off.getMonth() + 1}/${off.getDate()}` : '-';
      return (
        <span className="text-yellow-300 font-semibold">| W {md}</span>
      );
    }

    if (status === 'on team') {
      const nick = getOwnerNickname(ownership.manager_id);
      return (
        <span className="text-blue-300 font-semibold">| {nick}</span>
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
  // 處理新增球員到隊伍
  const handleAddPlayer = async (player) => {
    if (!myManagerId) {
      alert('請先登入');
      return;
    }

    // 顯示確認對話框
    setPlayerToAdd(player);
    setShowConfirmAdd(true);
  };

  // 處理 DROP 球員
  const handleDropPlayer = async (player) => {
    if (!myManagerId) {
      alert('請先登入');
      return;
    }

    // 顯示確認對話框
    setPlayerToDrop(player);
    setShowConfirmDrop(true);
  };

  // 確認加入球員
  const confirmAddPlayer = async () => {
    if (!playerToAdd) return;

    try {
      setIsAdding(true);
      
      const res = await fetch(`/api/league/${leagueId}/ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerToAdd.player_id,
          manager_id: myManagerId
        })
      });

      const data = await res.json();
      
      if (data.success) {
        // 關閉對話框
        setIsAdding(false);
        setShowConfirmAdd(false);
        
        // 顯示成功動畫
        setSuccessMessage('Player Added Successfully!');
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
        setIsAdding(false);
        setShowConfirmAdd(false);
        setErrorMessage(data.error || 'Unknown error');
        setShowError(true);
        setTimeout(() => setShowError(false), 3000);
      }
    } catch (err) {
      console.error('Add player error:', err);
      setIsAdding(false);
      setShowConfirmAdd(false);
      setErrorMessage('Operation failed, please try again');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
      setIsRefreshing(false);
    } finally {
      setPlayerToAdd(null);
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

  const getPlayerActionButton = (player) => {
    // 查找該球員的 ownership 資料
    const ownership = ownerships.find(
      o => o.player_id === player.player_id
    );

    // 如果沒有找到 ownership，顯示線色 + 按鈕
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

    const status = ownership.status?.toLowerCase();

    // 如果 status 是 waiver，不顯示按鈕
    if (status === 'waiver') {
      return null;
    }

    // 如果 status 是 on team
    if (status === 'on team') {
      // 檢查是否是自己的球員
      if (ownership.manager_id === myManagerId) {
        // 紅色底的 -
        return (
          <button 
            onClick={() => handleDropPlayer(player)}
            className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold hover:bg-red-700 transition-colors"
          >
            −
          </button>
        );
      } else {
        // 藍色框的 ⇌
        return (
          <button className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold hover:bg-blue-700 transition-colors">
            ⇌
          </button>
        );
      }
    }

    // 其他狀態不顯示按鈕
    return null;
  };  if (loading) {
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
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
              Players
            </h1>
          </div>

          {/* Filters */}
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

              {/* Player Type */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/60 border border-purple-500/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="batter">Batter</option>
                  <option value="pitcher">Pitcher</option>
                </select>
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
            </div>
          </div>
        </div>

        {/* Players Table */}
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600/80 to-blue-600/80 backdrop-blur-sm p-6 border-b border-purple-400/30">
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Player List
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/60 border-b border-purple-500/20">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-purple-300">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-purple-300">Team</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-purple-300">Type</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-purple-300">Identity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/10">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center">
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
                              <span className="text-white font-semibold group-hover:text-purple-300 transition-colors">
                                {player.name || 'Unknown'}
                                <span className="text-purple-300/70 font-normal ml-2">
                                  - {filterPositions(player)}
                                </span>
                              </span>
                              {renderStatusTag(player)}
                            </div>
                            {player.original_name && player.original_name !== player.name && (
                              <span className="text-purple-300/60 text-sm">
                                {player.original_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold ${getTeamColor(player.team)} shadow-md`}>
                          {player.team || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                          player.batter_or_pitcher === 'batter'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        }`}>
                          {player.batter_or_pitcher === 'batter' ? 'Batter' : 'Pitcher'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          player.identity === 'local'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {player.identity === 'local' ? 'Local' : 'Foreigner'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 確認新增對話框 */}
      {showConfirmAdd && playerToAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-purple-500/30 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-4">Add Player</h3>
            <p className="text-purple-200 mb-6">
              Add <span className="font-bold text-white">{playerToAdd.name}</span> to your team?
            </p>
            
            {/* 執行中動畫 */}
            {isAdding && (
              <div className="mb-6 flex items-center justify-center gap-3 text-purple-300">
                <div className="w-6 h-6 border-3 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-semibold">Adding player...</span>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowConfirmAdd(false);
                  setPlayerToAdd(null);
                  setIsAdding(false);
                }}
                disabled={isAdding}
                className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddPlayer}
                disabled={isAdding}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認 DROP 對話框 */}
      {showConfirmDrop && playerToDrop && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
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
      )}

      {/* 成功動畫 */}
      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className={`text-white px-8 py-4 rounded-2xl shadow-2xl animate-bounce ${successMessage.includes('Dropped') ? 'bg-red-600' : 'bg-green-600'}`}>
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xl font-bold">{successMessage}</span>
            </div>
          </div>
        </div>
      )}

      {/* 重新載入動畫 */}
      {isRefreshing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              <span className="text-white font-bold text-lg">Refreshing...</span>
            </div>
          </div>
        </div>
      )}

      {/* 失敗動畫 */}
      {showError && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
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
      )}
    </div>
  );
}
