'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PlayersPage() {
  const params = useParams();
  const leagueId = params.leagueId;

  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, batter, pitcher
  const [filterIdentity, setFilterIdentity] = useState('all'); // all, local, foreigner

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/playerslist?available=true');
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Failed to load players');
          return;
        }

        if (result.success) {
          setPlayers(result.players || []);
        } else {
          setError('Failed to load players');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  const filteredPlayers = players.filter(player => {
    const matchesSearch = searchTerm === '' || 
      player.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.original_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || 
      (filterType === 'batter' && player.batter_or_pitcher === 'B') ||
      (filterType === 'pitcher' && player.batter_or_pitcher === 'P');

    const matchesIdentity = filterIdentity === 'all' || 
      player.identity?.toLowerCase() === filterIdentity.toLowerCase();

    return matchesSearch && matchesType && matchesIdentity;
  });

  const batters = filteredPlayers.filter(p => p.batter_or_pitcher === 'B');
  const pitchers = filteredPlayers.filter(p => p.batter_or_pitcher === 'P');

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
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
              Available Players
            </h1>
            <p className="text-purple-300/70">Total: {filteredPlayers.length} players ({batters.length} batters, {pitchers.length} pitchers)</p>
          </div>

          {/* Filters */}
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-2">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, team..."
                  className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                />
              </div>

              {/* Player Type */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-2">
                  Player Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                >
                  <option value="all">All</option>
                  <option value="batter">Batters</option>
                  <option value="pitcher">Pitchers</option>
                </select>
              </div>

              {/* Identity */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-2">
                  Identity
                </label>
                <select
                  value={filterIdentity}
                  onChange={(e) => setFilterIdentity(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
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
                  <th className="px-6 py-4 text-left text-sm font-bold text-purple-300">Original Name</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-purple-300">Team</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-purple-300">Type</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-purple-300">Identity</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-purple-300">Added Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/10">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
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
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/30">
                            {player.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <span className="text-white font-semibold group-hover:text-purple-300 transition-colors">
                            {player.name || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-purple-200/80">
                        {player.original_name || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {player.team || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                          player.batter_or_pitcher === 'B'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        }`}>
                          {player.batter_or_pitcher === 'B' ? '🏏 Batter' : '⚾ Pitcher'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          player.identity === 'local'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {player.identity === 'local' ? '🏠 Local' : '🌏 Foreigner'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-purple-200/80">
                        {player.add_date ? new Date(player.add_date).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          {filteredPlayers.length > 0 && (
            <div className="bg-slate-900/60 border-t border-purple-500/20 p-4">
              <div className="flex justify-between items-center text-sm">
                <div className="text-purple-300/70">
                  Showing {filteredPlayers.length} of {players.length} total players
                </div>
                <div className="flex gap-6">
                  <span className="text-green-300 font-medium">
                    🏏 Batters: {batters.length}
                  </span>
                  <span className="text-orange-300 font-medium">
                    ⚾ Pitchers: {pitchers.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
