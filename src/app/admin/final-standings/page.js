'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';

export default function FinalStandingsAdmin() {
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentStandings, setCurrentStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchLeagues(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const fetchLeagues = async (userId) => {
    try {
      const response = await fetch('/api/admin/leagues');
      const result = await response.json();
      
      if (result.success) {
        setLeagues(result.leagues || []);
      } else {
        setMessage('Error fetching leagues');
      }
    } catch (error) {
      console.error('Error fetching leagues:', error);
      setMessage('Error fetching leagues');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeagueMembers = async (leagueId) => {
    try {
      const { data: membersData, error } = await supabase
        .from('league_members')
        .select('manager_id, nickname, role, managers(name)')
        .eq('league_id', leagueId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      setMembers(membersData || []);
      
      // Fetch current final standings using API
      const response = await fetch(`/api/admin/leagues/${leagueId}/final-standings`);
      const result = await response.json();
      
      if (result.success && result.standings && result.standings.length > 0) {
        setCurrentStandings(result.standings);
      } else {
        // Initialize with default rankings based on member order
        const initialStandings = (membersData || []).map((member, index) => ({
          manager_id: member.manager_id,
          rank: index + 1
        }));
        setCurrentStandings(initialStandings);
      }
    } catch (error) {
      console.error('Error fetching league members:', error);
      setMessage('Error fetching league members');
    }
  };

  const handleLeagueChange = (leagueId) => {
    const league = leagues.find(l => l.league_id === leagueId);
    setSelectedLeague(league);
    if (league) {
      fetchLeagueMembers(leagueId);
    }
  };

  const handleRankChange = (managerId, newRank) => {
    setCurrentStandings(prev => 
      prev.map(standing => 
        standing.manager_id === managerId 
          ? { ...standing, rank: parseInt(newRank) || 1 }
          : standing
      )
    );
  };

  const handleSave = async () => {
    if (!selectedLeague) return;
    
    setSaving(true);
    setMessage('');
    
    try {
      const response = await fetch(`/api/admin/leagues/${selectedLeague.league_id}/final-standings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ standings: currentStandings }),
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage('✅ Final standings saved successfully!');
        // Refresh standings
        fetchLeagueMembers(selectedLeague.league_id);
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving final standings:', error);
      setMessage('❌ Error saving final standings');
    } finally {
      setSaving(false);
    }
  };

  const getManagerName = (managerId) => {
    const member = members.find(m => m.manager_id === managerId);
    return member?.nickname || member?.managers?.name || 'Unknown';
  };

  const getManagerRole = (managerId) => {
    const member = members.find(m => m.manager_id === managerId);
    return member?.role || 'Member';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-2">
            Admin: Final Standings
          </h1>
          <p className="text-purple-300/70 text-sm">
            Manage final rankings for leagues
          </p>
        </div>

        {/* League Selection */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 mb-6">
          <label className="block text-sm font-bold text-purple-300 mb-2">
            Select League
          </label>
          <select
            value={selectedLeague?.league_id || ''}
            onChange={(e) => handleLeagueChange(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800/60 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Select a league...</option>
            {leagues.map(league => (
              <option key={league.league_id} value={league.league_id}>
                {league.league_name}
              </option>
            ))}
          </select>
        </div>

        {/* Standings Editor */}
        {selectedLeague && (
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-white">
                {selectedLeague.league_name} - Final Standings
              </h2>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Rankings'}
              </button>
            </div>

            {message && (
              <div className={`mb-4 px-4 py-2 rounded-lg ${
                message.includes('✅') 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/50' 
                  : 'bg-red-500/20 text-red-300 border border-red-500/50'
              }`}>
                {message}
              </div>
            )}

            {members.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                No members found for this league
              </div>
            ) : (
              <div className="space-y-3">
                {currentStandings.map((standing) => (
                  <div
                    key={standing.manager_id}
                    className="flex items-center gap-4 p-4 bg-slate-800/60 border border-white/10 rounded-xl hover:bg-slate-800/80 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
                        standing.rank === 1 
                          ? 'bg-yellow-500 text-yellow-900' 
                          : standing.rank === 2 
                            ? 'bg-gray-400 text-gray-900' 
                            : standing.rank === 3 
                              ? 'bg-orange-600 text-orange-100' 
                              : 'bg-slate-700 text-slate-300'
                      }`}>
                        {standing.rank}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-bold">
                          {getManagerName(standing.manager_id)}
                        </div>
                        <div className="text-xs text-purple-300/70">
                          {getManagerRole(standing.manager_id)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-purple-300">Rank:</label>
                      <input
                        type="number"
                        min="1"
                        max={members.length}
                        value={standing.rank}
                        onChange={(e) => handleRankChange(standing.manager_id, e.target.value)}
                        className="w-20 px-3 py-2 bg-slate-700/60 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedLeague && (
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <p className="text-white/40 text-lg">
              Select a league to manage final standings
            </p>
          </div>
        )}
      </div>
    </div>
  );
}