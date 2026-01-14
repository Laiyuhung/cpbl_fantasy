'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LeaguePage() {
  const params = useParams();
  const leagueId = params.leagueId;

  const [leagueSettings, setLeagueSettings] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leagueStatus, setLeagueStatus] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [maxTeams, setMaxTeams] = useState(0);

  useEffect(() => {
    if (!leagueId) return;

    const fetchLeagueData = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/league/${leagueId}`);
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Failed to load league data');
          return;
        }

        if (result.success) {
          setLeagueSettings(result.league);
          setScheduleData(result.schedule || []);
          setMembers(result.members || []);
          setLeagueStatus(result.status || 'unknown');
          setMaxTeams(result.maxTeams || 0);
          
          // 获取当前用户的权限
          const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
          const currentUserId = cookie?.split('=')[1];
          if (currentUserId) {
            const currentMember = result.members?.find(m => m.manager_id === currentUserId);
            setCurrentUserRole(currentMember?.role || 'member');
          }
        } else {
          setError('Failed to load league data');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading league data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 flex items-center justify-center">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    );
  }

  if (!leagueSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 flex items-center justify-center">
        <div className="text-xl text-gray-600">League not found</div>
      </div>
    );
  }

  const getWeekTypeLabel = (weekType) => {
    switch (weekType) {
      case 'regular_season':
        return 'Regular Season';
      case 'playoffs':
        return 'Playoffs';
      case 'makeup':
        return 'Makeup Week';
      default:
        return weekType;
    }
  };

  const getWeekTypeColor = (weekType) => {
    switch (weekType) {
      case 'regular_season':
        return 'bg-blue-500/80 text-blue-100 shadow-blue-500/50';
      case 'playoffs':
        return 'bg-purple-500/80 text-purple-100 shadow-purple-500/50';
      case 'makeup':
        return 'bg-yellow-500/80 text-yellow-100 shadow-yellow-500/50';
      default:
        return 'bg-gray-500/80 text-gray-100 shadow-gray-500/50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-5xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent mb-4">
            {leagueSettings.league_name}
          </h1>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-purple-300 font-medium">Status:</span>
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-lg ${
                leagueStatus === 'pre-draft' ? 'bg-yellow-500/80 text-yellow-100 shadow-yellow-500/50' :
                leagueStatus === 'post-draft & pre-season' ? 'bg-orange-500/80 text-orange-100 shadow-orange-500/50' :
                leagueStatus === 'drafting now' ? 'bg-blue-500/80 text-blue-100 shadow-blue-500/50 animate-pulse' :
                leagueStatus === 'in season' ? 'bg-green-500/80 text-green-100 shadow-green-500/50' :
                leagueStatus === 'playoffs' ? 'bg-purple-500/80 text-purple-100 shadow-purple-500/50' :
                leagueStatus === 'finished' ? 'bg-gray-500/80 text-gray-100 shadow-gray-500/50' :
                'bg-gray-500/80 text-gray-100 shadow-gray-500/50'
              }`}>
                {leagueStatus === 'pre-draft' ? 'Pre-Draft' :
                 leagueStatus === 'post-draft & pre-season' ? 'Post-Draft & Pre-Season' :
                 leagueStatus === 'drafting now' ? 'Drafting Now' :
                 leagueStatus === 'in season' ? 'In Season' :
                 leagueStatus === 'playoffs' ? 'Playoffs' :
                 leagueStatus === 'finished' ? 'Finished' :
                 leagueStatus}
              </span>
            </div>
            {currentUserRole && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-purple-300 font-medium">Your Role:</span>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-lg ${
                  currentUserRole === 'Commissioner' ? 'bg-red-500/80 text-red-100 shadow-red-500/50' :
                  currentUserRole === 'Co-Commissioner' ? 'bg-orange-500/80 text-orange-100 shadow-orange-500/50' :
                  'bg-blue-500/80 text-blue-100 shadow-blue-500/50'
                }`}>
                  {currentUserRole}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* League Members Section */}
        <div className="mb-8 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600/80 to-emerald-600/80 backdrop-blur-sm p-6 border-b border-green-400/30">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black text-white">League Members</h2>
              <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/30">
                <span className="text-2xl font-bold text-white">{members.length}</span>
                <span className="text-white/80">/</span>
                <span className="text-xl font-semibold text-white/90">{maxTeams}</span>
                <span className="text-sm text-white/70 font-medium">Teams</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            {members.length === 0 ? (
              <div className="text-center py-12 text-purple-300/70 text-lg">
                No members in this league yet
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {members.map((member) => (
                  <div
                    key={member.manager_id}
                    className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm border border-purple-500/30 rounded-xl p-5 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/50">
                        {member.nickname.charAt(0).toUpperCase()}
                      </div>
                      {member.role && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          member.role === 'Commissioner' ? 'bg-red-500/30 text-red-300 border border-red-500/50' :
                          member.role === 'Co-Commissioner' ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50' :
                          'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                        }`}>
                          {member.role === 'Commissioner' ? 'COMM' : member.role === 'Co-Commissioner' ? 'CO-COMM' : 'MEMBER'}
                        </span>
                      )}
                    </div>
                    <div className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                      {member.nickname}
                    </div>
                    <div className="text-sm text-purple-300/70 mt-1.5">
                      {member.managers?.name || 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600/80 to-cyan-600/80 backdrop-blur-sm p-6 border-b border-blue-400/30">
            <h2 className="text-3xl font-black text-white">League Schedule</h2>
          </div>
          <div className="p-6">
            {scheduleData.length === 0 ? (
              <div className="text-center py-12 text-purple-300/70 text-lg">
                No schedule data available for this league
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 border-b-2 border-purple-500/50">
                      <th className="px-6 py-4 text-left font-bold text-purple-200 text-sm uppercase tracking-wider">
                        Week #
                      </th>
                      <th className="px-6 py-4 text-left font-bold text-purple-200 text-sm uppercase tracking-wider">
                        Week Label
                      </th>
                      <th className="px-6 py-4 text-left font-bold text-purple-200 text-sm uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left font-bold text-purple-200 text-sm uppercase tracking-wider">
                        Start Date
                      </th>
                      <th className="px-6 py-4 text-left font-bold text-purple-200 text-sm uppercase tracking-wider">
                        End Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleData.map((week, index) => (
                      <tr
                        key={week.id}
                        className={`${
                          index % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-800/40'
                        } border-b border-purple-500/20 hover:bg-purple-500/20 transition-colors`}
                      >
                        <td className="px-6 py-4 font-bold text-white text-lg">
                          {week.week_number}
                        </td>
                        <td className="px-6 py-4 text-purple-200 font-medium">
                          {week.week_label || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${getWeekTypeColor(
                              week.week_type
                            )}`}
                          >
                            {getWeekTypeLabel(week.week_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-purple-300 font-medium">
                          {new Date(week.week_start).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 text-purple-300 font-medium">
                          {new Date(week.week_end).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
