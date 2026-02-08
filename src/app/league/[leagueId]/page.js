'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import supabase from '@/lib/supabase';

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

  const [currentWeek, setCurrentWeek] = useState(1);
  const [matchups, setMatchups] = useState([]);
  const [matchupsLoading, setMatchupsLoading] = useState(true);
  const [standings, setStandings] = useState([]);
  const [standingsLoading, setStandingsLoading] = useState(true);

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
          const status = result.status || 'unknown';
          setLeagueStatus(status);
          setMaxTeams(result.maxTeams || 0);
          setInvitePermissions(result.invitePermissions || 'commissioner only');

          // Initialize Current Week logic
          if (status === 'post-draft & pre-season' || status === 'in season') {
            const today = new Date();
            // Find grid week based on today
            let week = 1;
            if (result.schedule && result.schedule.length > 0) {
              const schedule = result.schedule;
              // If before first week, use week 1
              if (today < new Date(schedule[0].week_start)) {
                week = 1;
              }
              // If after last week, use last week
              else if (today > new Date(schedule[schedule.length - 1].week_end)) {
                week = schedule[schedule.length - 1].week_number;
              }
              // Find current week
              else {
                const current = schedule.find(w => today >= new Date(w.week_start) && today <= new Date(w.week_end));
                if (current) week = current.week_number;
              }
            }
            setCurrentWeek(week);
            // Fetch matchups for this default week will be triggered by another effect or called here
            fetchMatchups(week);
          }


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

  const fetchMatchups = async (week) => {
    setMatchupsLoading(true);
    try {
      const res = await fetch(`/api/league/${leagueId}/matchups?week=${week}`);
      const data = await res.json();
      if (data.success) {
        setMatchups(data.matchups);
      }
    } catch (e) {
      console.error("Error fetching matchups", e);
    } finally {
      setMatchupsLoading(false);
    }
  };

  // Fetch standings
  useEffect(() => {
    if (!leagueId) return;

    const fetchStandings = async () => {
      setStandingsLoading(true);
      try {
        const response = await fetch(`/api/league/${leagueId}/standings`);
        const result = await response.json();

        if (response.ok && result.success) {
          setStandings(result.standings || []);
        } else {
          console.error('Failed to fetch standings:', result.error);
          setStandings([]);
        }
      } catch (error) {
        console.error('Error fetching standings:', error);
        setStandings([]);
      } finally {
        setStandingsLoading(false);
      }
    };

    fetchStandings();
  }, [leagueId]);

  const handleWeekChange = (direction) => {
    const maxWeek = scheduleData.length > 0 ? scheduleData[scheduleData.length - 1].week_number : 1;
    let newWeek = currentWeek + direction;
    if (newWeek < 1) newWeek = 1;
    if (newWeek > maxWeek) newWeek = maxWeek;

    if (newWeek !== currentWeek) {
      setCurrentWeek(newWeek);
      fetchMatchups(newWeek);
    }
  };

  // Countdown timer for draft time
  useEffect(() => {
    if (!leagueSettings?.live_draft_time || leagueSettings?.draft_type !== 'Live Draft') {
      setDraftTimeStatus('loading');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const draftTime = new Date(leagueSettings.live_draft_time);
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
    // 联盟未满 且 状态是 pre-draft 且 未 finalized
    if (members.length >= maxTeams || leagueStatus !== 'pre-draft' || leagueSettings?.is_finalized) {
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

  // Helper to get manager details
  const getManagerDetails = (managerId) => {
    return members.find(m => m.manager_id === managerId);
  };

  // Helper to get week details
  const getCurrentWeekDetails = () => {
    return scheduleData.find(w => w.week_number === currentWeek);
  };

  const showMatchups = leagueStatus === 'post-draft & pre-season' || leagueStatus === 'in season';
  const weekDetails = getCurrentWeekDetails();

  if (showMatchups) {
    return (
      <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="w-[70%] space-y-8">
          {/* Header with League Name & Week Selector */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-br from-purple-900/50 to-blue-900/50 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                {leagueSettings?.league_name}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${leagueStatus === 'in season'
                  ? 'bg-green-500/20 text-green-300 border-green-500/30'
                  : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                  }`}>
                  {leagueStatus === 'in season' ? 'IN SEASON' : 'PRE-SEASON'}
                </span>
              </div>
            </div>

            {/* Week Selector */}
            <div className="flex items-center bg-slate-800/80 rounded-full p-1.5 border border-white/10 shadow-lg">
              <button
                onClick={() => handleWeekChange(-1)}
                disabled={currentWeek <= 1 || matchupsLoading}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>

              <div className="flex flex-col items-center min-w-[160px] px-4">
                <span className="text-lg font-black text-white tracking-wide">
                  WEEK {currentWeek}
                </span>
                {weekDetails && (
                  <span className="text-xs font-bold text-cyan-300/80 uppercase tracking-widest">
                    {new Date(weekDetails.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(weekDetails.week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>

              <button
                onClick={() => handleWeekChange(1)}
                disabled={currentWeek >= (scheduleData.length || 0) || matchupsLoading}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          {/* MATCHUPS Section Header */}
          <div className="mb-4">
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 uppercase tracking-wider">
              Matchups
            </h2>
          </div>

          {/* Matchups Grid */}
          {matchupsLoading ? (
            <div className="w-full h-64 bg-white/5 rounded-3xl animate-pulse border border-white/5 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-purple-300 font-bold tracking-widest uppercase text-sm">Loading Matchups...</span>
            </div>
          ) : matchups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
              <div className="text-6xl mb-4">🏟️</div>
              <h3 className="text-xl font-bold text-white mb-2">No Matchups Scheduled</h3>
              <p className="text-slate-400">There are no games scheduled for this week.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
              {matchups.map((matchup) => {
                const managerA = getManagerDetails(matchup.manager_id_a);
                const managerB = getManagerDetails(matchup.manager_id_b);
                // Calculate win probability or status if needed, for now just show scores
                // Calculate status based on week schedule
                const now = new Date();
                const weekStart = new Date(weekDetails?.week_start);
                const weekEnd = new Date(weekDetails?.week_end);

                const hasStarted = now >= weekStart;
                const isLive = now >= weekStart && now <= weekEnd;
                const isFinal = now > weekEnd;

                // Test override (optional, remove for production if needed, or keep logic solely on dates)
                // const isLive = leagueStatus === 'in season'; 

                return (
                  <div key={matchup.id} className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 hover:from-purple-900/40 hover:to-blue-900/40 backdrop-blur-sm border border-white/5 hover:border-purple-500/50 rounded-2xl p-0 overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                    {/* Card Header / Status */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <div className="flex items-stretch h-32 md:h-40 relative">
                      {/* Background decorations */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none"></div>
                      {/* Team A */}
                      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
                        <div className="text-lg md:text-xl font-black text-white text-center line-clamp-1 px-2 mb-1 group-hover:text-purple-300 transition-colors">
                          {managerA?.nickname || 'Unknown'}
                        </div>
                        <div className="text-xs text-slate-400 text-center line-clamp-1 font-bold uppercase tracking-wider">
                          {managerA?.managers?.name}
                        </div>
                      </div>

                      {/* VS / Score */}
                      <div className="w-32 md:w-40 flex flex-col items-center justify-center bg-black/20 z-10">
                        {hasStarted ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-4 text-2xl md:text-3xl font-black text-white tabular-nums tracking-tighter">
                              <span className={scoreA > scoreB ? 'text-green-400' : scoreA < scoreB ? 'text-slate-300' : 'text-white'}>{scoreA}</span>
                              <span className="text-slate-600 text-lg font-normal">-</span>
                              <span className={scoreB > scoreA ? 'text-green-400' : scoreB < scoreA ? 'text-slate-300' : 'text-white'}>{scoreB}</span>
                            </div>
                            {isLive && (
                              <div className="text-[10px] font-bold tracking-widest text-red-400 uppercase animate-pulse flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                LIVE
                              </div>
                            )}
                            {isFinal && (
                              <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                                FINAL
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-3xl font-black text-slate-600 italic tracking-widest">VS</span>
                          </div>
                        )}
                      </div>

                      {/* Team B */}
                      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
                        <div className="text-lg md:text-xl font-black text-white text-center line-clamp-1 px-2 mb-1 group-hover:text-pink-300 transition-colors">
                          {managerB?.nickname || 'Unknown'}
                        </div>
                        <div className="text-xs text-slate-400 text-center line-clamp-1 font-bold uppercase tracking-wider">
                          {managerB?.managers?.name}
                        </div>
                      </div>
                    </div>

                    {/* Footer / Actions */}
                    <div className="bg-white/5 px-4 py-2 flex justify-between items-center text-xs font-medium text-slate-400">
                      <span>Matchup Info</span>
                      <span className="group-hover:text-purple-300 transition-colors">View Details →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* STANDINGS Section */}
          <div className="mt-12">
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 uppercase tracking-wider mb-4">
              Standings
            </h2>

            {standingsLoading ? (
              <div className="w-full h-48 bg-white/5 rounded-3xl animate-pulse border border-white/5 flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-purple-300 font-bold tracking-widest uppercase text-sm">Loading Standings...</span>
              </div>
            ) : standings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/10">
                <div className="text-4xl mb-3">📊</div>
                <h3 className="text-lg font-bold text-white mb-2">No Standings Available</h3>
                <p className="text-slate-400 text-sm">Standings will appear once matchups are completed.</p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-b border-white/10">
                        <th className="px-6 py-4 text-left text-xs font-bold text-purple-300 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-purple-300 uppercase tracking-wider">Team</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-purple-300 uppercase tracking-wider">Record</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-purple-300 uppercase tracking-wider">Win %</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-purple-300 uppercase tracking-wider">Streak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {standings.map((team, index) => (
                        <tr key={team.manager_id} className="hover:bg-purple-500/10 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${team.rank === 1 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                              team.rank === 2 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30' :
                                team.rank === 3 ? 'bg-orange-600/20 text-orange-300 border border-orange-600/30' :
                                  'bg-slate-700/40 text-slate-400'
                              }`}>
                              {team.rank}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-white">{team.nickname}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-mono text-cyan-300 font-semibold">{team.record_display}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-mono text-purple-300 font-semibold">{team.win_pct.toFixed(3)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${team.streak.startsWith('W') ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                              team.streak.startsWith('L') ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                                team.streak.startsWith('T') ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                  'bg-slate-700/40 text-slate-400'
                              }`}>
                              {team.streak}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-white/5">
                  {standings.map((team) => (
                    <div key={team.manager_id} className="p-4 hover:bg-purple-500/10 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold ${team.rank === 1 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                            team.rank === 2 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30' :
                              team.rank === 3 ? 'bg-orange-600/20 text-orange-300 border border-orange-600/30' :
                                'bg-slate-700/40 text-slate-400'
                            }`}>
                            {team.rank}
                          </span>
                          <div className="font-bold text-white">{team.nickname}</div>
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${team.streak.startsWith('W') ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                          team.streak.startsWith('L') ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                            team.streak.startsWith('T') ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                              'bg-slate-700/40 text-slate-400'
                          }`}>
                          {team.streak}
                        </span>
                      </div>
                      <div className="flex justify-around text-sm">
                        <div className="text-center">
                          <div className="text-slate-400 text-xs uppercase mb-1">Record</div>
                          <div className="font-mono text-cyan-300 font-semibold">{team.record_display}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-slate-400 text-xs uppercase mb-1">Win %</div>
                          <div className="font-mono text-purple-300 font-semibold">{team.win_pct.toFixed(3)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-lg ${leagueStatus === 'pre-draft' ? 'bg-yellow-500/80 text-yellow-100 shadow-yellow-500/50' :
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
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-lg ${currentUserRole === 'Commissioner' ? 'bg-red-500/80 text-red-100 shadow-red-500/50' :
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
        {leagueSettings?.live_draft_time && leagueSettings?.draft_type === 'Live Draft' && (
          <div className="mb-8 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 backdrop-blur-lg border border-indigo-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="text-center">
              <h2 className="text-3xl font-black bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent mb-4">
                Draft Time
              </h2>
              <div className="text-sm text-yellow-300/90 font-bold mb-3 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Even number of managers required</span>
                {(currentUserRole === 'Commissioner' || currentUserRole === 'Co-Commissioner') && !leagueSettings?.is_finalized && (
                  <span className="ml-2 text-xs text-indigo-300/70 italic">
                    (Go to League Settings to finalize)
                  </span>
                )}
              </div>
              <div className="text-lg text-indigo-200 mb-6">
                {new Date(leagueSettings.live_draft_time).toLocaleString('en-US', {
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>

              {draftTimeStatus === 'passed' ? (
                <div className="inline-flex items-center gap-3 bg-gradient-to-r from-red-600/80 to-pink-600/80 backdrop-blur-md px-8 py-4 rounded-full border border-red-400/50 shadow-lg shadow-red-500/30">
                  <svg className="w-6 h-6 text-red-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-2xl font-black text-white">Time&apos;s Up!</span>
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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${member.role === 'Commissioner' ? 'bg-red-500/30 text-red-300 border border-red-500/50' :
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
                        Label
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
                        className={`${index % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-800/40'
                          } border-b border-purple-500/20 hover:bg-purple-500/20 transition-colors`}
                      >
                        <td className="px-6 py-4 font-bold text-white text-lg">
                          Week {week.week_number}
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
