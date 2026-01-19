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
  const [invitePermissions, setInvitePermissions] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [draftTimeStatus, setDraftTimeStatus] = useState('loading'); // loading, upcoming, passed

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
          setInvitePermissions(result.invitePermissions || 'commissioner only');
          
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

  // Countdown timer for draft time
  useEffect(() => {
    if (!leagueSettings?.draft_date) {
      setDraftTimeStatus('loading');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const draftTime = new Date(leagueSettings.draft_date);
      const diff = draftTime - now;

      if (diff <= 0) {
        setDraftTimeStatus('passed');
        setCountdown(null);
        return;
      }

      setDraftTimeStatus('upcoming');
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [leagueSettings]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl text-purple-300">Loading league data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 backdrop-blur-lg border border-red-500/30 rounded-2xl p-8 shadow-2xl">
          <div className="text-xl text-red-300">{error}</div>
        </div>
      </div>
    );
  }

  if (!leagueSettings) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
          <div className="text-xl text-purple-300">League not found</div>
        </div>
      </div>
    );
  }

  const canShowInviteLink = () => {
    // 联盟未满 且 状态是 pre-draft
    if (members.length >= maxTeams || leagueStatus !== 'pre-draft') {
      return false;
    }
    
    // commissioner only: 只有 Commissioner 或 Co-Commissioner 可以看到
    if (invitePermissions?.toLowerCase() === 'commissioner only') {
      return currentUserRole === 'Commissioner' || currentUserRole === 'Co-Commissioner';
    }
    
    // Managers can invite: 所有人都可以看到
    return true;
  };

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/league/${leagueId}/join`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  };

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
    <div className="p-8">
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

        {/* Draft Time Section */}
        {leagueSettings?.draft_date && (
          <div className="mb-8 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 backdrop-blur-lg border border-indigo-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="text-center">
              <h2 className="text-3xl font-black bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent mb-4">
                Draft Time
              </h2>
              <div className="text-lg text-indigo-200 mb-2">
                {new Date(leagueSettings.draft_date).toLocaleString('en-US', {
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>
              <div className="text-sm text-indigo-300/70 mb-6">
                (Based on Local Time)
              </div>

              {draftTimeStatus === 'passed' ? (
                <div className="inline-flex items-center gap-3 bg-gradient-to-r from-red-600/80 to-pink-600/80 backdrop-blur-md px-8 py-4 rounded-full border border-red-400/50 shadow-lg shadow-red-500/30">
                  <svg className="w-6 h-6 text-red-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-2xl font-black text-white">Time's Up!</span>
                </div>
              ) : draftTimeStatus === 'upcoming' && countdown ? (
                <div className="flex justify-center gap-4 flex-wrap">
                  <div className="bg-gradient-to-br from-indigo-600/80 to-purple-600/80 backdrop-blur-md rounded-2xl p-6 min-w-[120px] border border-indigo-400/30 shadow-lg shadow-indigo-500/30">
                    <div className="text-5xl font-black text-white mb-2">{countdown.days}</div>
                    <div className="text-sm font-bold text-indigo-200 uppercase tracking-wider">Days</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-600/80 to-pink-600/80 backdrop-blur-md rounded-2xl p-6 min-w-[120px] border border-purple-400/30 shadow-lg shadow-purple-500/30">
                    <div className="text-5xl font-black text-white mb-2">{countdown.hours}</div>
                    <div className="text-sm font-bold text-purple-200 uppercase tracking-wider">Hours</div>
                  </div>
                  <div className="bg-gradient-to-br from-pink-600/80 to-red-600/80 backdrop-blur-md rounded-2xl p-6 min-w-[120px] border border-pink-400/30 shadow-lg shadow-pink-500/30">
                    <div className="text-5xl font-black text-white mb-2">{countdown.minutes}</div>
                    <div className="text-sm font-bold text-pink-200 uppercase tracking-wider">Minutes</div>
                  </div>
                  <div className="bg-gradient-to-br from-red-600/80 to-orange-600/80 backdrop-blur-md rounded-2xl p-6 min-w-[120px] border border-red-400/30 shadow-lg shadow-red-500/30">
                    <div className="text-5xl font-black text-white mb-2">{countdown.seconds}</div>
                    <div className="text-sm font-bold text-red-200 uppercase tracking-wider">Seconds</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* League Members Section */}
        <div className="mb-8 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600/80 to-emerald-600/80 backdrop-blur-sm p-6 border-b border-green-400/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-3xl font-black text-white">League Members</h2>
              <div className="flex items-center gap-3">
                {canShowInviteLink() && (
                  <button
                    onClick={copyInviteLink}
                    className="relative bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/30 transition-all hover:shadow-lg hover:shadow-white/20 group"
                  >
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      {showCopied ? 'Copied!' : 'Invite Link'}
                    </span>
                  </button>
                )}
                <div className="flex items-center gap-3 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/30">
                  <span className="text-2xl font-bold text-white">{members.length}</span>
                  <span className="text-white/80">/</span>
                  <span className="text-xl font-semibold text-white/90">{maxTeams}</span>
                  <span className="text-sm text-white/70 font-medium">Teams</span>
                </div>
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
