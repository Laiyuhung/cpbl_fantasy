'use client';

import { useEffect, useState } from 'react';
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
  const [failedImages, setFailedImages] = useState(new Set()); // 記錄加載失敗的球員ID

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
        const [playersRes, ownershipsRes] = await Promise.all([
          fetch('/api/playerslist?available=true'),
          fetch(`/api/league/${leagueId}/ownership`)
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
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId]);

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
    // 如果球員圖片已知載入失敗，直接返回預設圖片
    if (failedImages.has(player.player_id)) {
      return '/photo/defaultPlayer.png';
    }
    
    const paths = getPlayerPhotoPaths(player);
    // 預設返回第一個路徑（name）
    return paths[0] || '/photo/defaultPlayer.png';
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
      setFailedImages(prev => new Set([...prev, player.player_id]));
      e.target.onerror = null; // 防止無限迴圈
      e.target.src = window.location.origin + '/photo/defaultPlayer.png';
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
        <button className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold hover:bg-green-700 transition-colors">
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
          <button className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold hover:bg-red-700 transition-colors">
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
                            onError={(e) => handleImageError(e, player)}
                          />
                          <div className="flex flex-col">
                            <span className="text-white font-semibold group-hover:text-purple-300 transition-colors">
                              {player.name || 'Unknown'}
                            </span>
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
    </div>
  );
}
