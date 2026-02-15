'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import supabase from '@/lib/supabase';

// Playoff Bracket Projection Component
const PlayoffBracketDisplay = ({ playoffType, roundLabel, playoffReseeding }) => {
  const getProjectedMatchups = (type, label) => {
    const teamsMatch = type?.match(/^(\d+) teams/);
    const numTeams = teamsMatch ? parseInt(teamsMatch[1]) : 0;
    const isReseeding = playoffReseeding === 'Yes';

    if (numTeams === 2) {
      if (label === 'Final') return [{ a: '1st Seed', b: '2nd Seed' }];
    }

    if (numTeams === 4) {
      if (label === 'Semifinal') return [{ a: '1st Seed', b: '4th Seed', m: 'M1' }, { a: '2nd Seed', b: '3rd Seed', m: 'M2' }];
      if (label === 'Final') {
        if (isReseeding) return [{ a: 'Highest Remaining Seed', b: 'Lowest Remaining Seed', tbd: true }];
        return [{ a: 'Winner of M1', b: 'Winner of M2' }];
      }
    }

    if (numTeams === 6) {
      if (label === 'Quarterfinal') return [{ a: '3rd Seed', b: '6th Seed', m: 'M1' }, { a: '4th Seed', b: '5th Seed', m: 'M2' }, { note: '1st & 2nd Seeds have a Bye' }];
      if (label === 'Semifinal') {
        if (isReseeding) return [{ a: '1st Seed', b: 'Lowest Remaining Seed', tbd: true }, { a: '2nd Seed', b: 'Highest Remaining Seed', tbd: true }];
        return [{ a: '1st Seed', b: 'Winner of M2', m: 'M3' }, { a: '2nd Seed', b: 'Winner of M1', m: 'M4' }];
      }
      if (label === 'Final') {
        if (isReseeding) return [{ a: 'Highest Remaining Seed', b: 'Lowest Remaining Seed', tbd: true }];
        return [{ a: 'Winner of M3', b: 'Winner of M4' }];
      }
    }

    if (numTeams >= 8) {
      const isInitialRound = label === 'First Round' || label === 'Round 1';
      if (isInitialRound) return [{ a: '1st Seed', b: '8th Seed', m: 'M1' }, { a: '4th Seed', b: '5th Seed', m: 'M2' }, { a: '2nd Seed', b: '7th Seed', m: 'M3' }, { a: '3rd Seed', b: '6th Seed', m: 'M4' }];

      if (label === 'Quarterfinal') {
        if (isReseeding) return [{ a: 'Highest Remaining', b: 'Lowest Remaining', tbd: true }, { a: '2nd Highest', b: '2nd Lowest', tbd: true }];
        return [{ a: 'Winner of M1', b: 'Winner of M2', m: 'M5' }, { a: 'Winner of M3', b: 'Winner of M4', m: 'M6' }];
      }
      if (label === 'Semifinal') {
        if (isReseeding) return [{ a: 'Highest Remaining', b: 'Lowest Remaining', tbd: true }];
        return [{ a: 'Winner of M5', b: 'Winner of M6', m: 'M7' }];
      }
      if (label === 'Final') {
        if (isReseeding) return [{ a: 'Highest Remaining', b: 'Lowest Remaining', tbd: true }];
        return [{ a: 'Winner of M7', b: 'TBD' }];
      }
    }

    return null;
  };

  const matchups = getProjectedMatchups(playoffType, roundLabel);

  if (!matchups) return null;

  return (
    <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-full">
            <span className="text-xs font-black text-purple-300 uppercase tracking-widest">Bracket Projection</span>
          </div>
          <div className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
            <span className="text-xs font-black text-cyan-300 uppercase tracking-widest">{roundLabel}</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matchups.map((m, i) => m.note ? (
          <div key={i} className="md:col-span-2 flex items-center justify-center p-4 bg-blue-500/5 border border-dashed border-blue-500/20 rounded-2xl">
            <span className="text-sm font-bold text-blue-300/60 uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {m.note}
            </span>
          </div>
        ) : (
          <div key={i} className={`relative group overflow-hidden bg-slate-900/40 backdrop-blur-sm border rounded-2xl p-5 hover:border-purple-500/30 transition-all ${m.tbd ? 'border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.05)]' : 'border-white/5'}`}>
            <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity ${m.tbd ? 'from-blue-500/5 via-transparent to-purple-500/5' : 'from-purple-500/5 via-transparent to-cyan-500/5'}`}></div>
            <div className="relative flex items-center justify-between">
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-slate-800 border flex items-center justify-center text-[10px] font-black ${m.tbd ? 'border-blue-500/30 text-blue-400' : 'border-white/10 text-white/40'}`}>
                    {m.tbd ? '?' : 'S'}
                  </div>
                  <span className={`text-sm font-bold ${m.tbd ? 'text-blue-200/80 italic' : 'text-white/80'}`}>{m.a}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-slate-800 border flex items-center justify-center text-[10px] font-black ${m.tbd ? 'border-blue-500/30 text-blue-400' : 'border-white/10 text-white/40'}`}>
                    {m.tbd ? '?' : 'S'}
                  </div>
                  <span className={`text-sm font-bold ${m.tbd ? 'text-blue-200/80 italic' : 'text-white/80'}`}>{m.b}</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 px-4">
                <div className="w-px h-8 bg-white/10"></div>
                <span className={`text-[10px] font-black uppercase italic ${m.tbd ? 'text-blue-400' : 'text-purple-400'}`}>VS</span>
                <div className="w-px h-8 bg-white/10"></div>
              </div>
              {m.m && (
                <div className="absolute left-1.5 top-1.5 w-7 h-7 bg-purple-500/20 rounded flex items-center justify-center border border-purple-500/30">
                  <span className="text-[9px] font-black text-purple-300">{m.m}</span>
                </div>
              )}
              {m.tbd && (
                <div className="absolute -right-1 -bottom-1">
                  <div className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[8px] font-black text-blue-400 uppercase tracking-tighter">Reseeding</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

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
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const weekDropdownRef = useRef(null);

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
            // Get current date in Taiwan timezone (UTC+8)
            const now = new Date();
            // Convert to Taiwan time by adding 8 hours to UTC
            const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

            console.log('🔍 Current Week Calculation:', {
              utcTime: now.toISOString(),
              taiwanTime: taiwanTime.toISOString(),
              taiwanLocal: taiwanTime.toLocaleString('en-US', { timeZone: 'UTC' }),
              scheduleLength: result.schedule?.length
            });

            // Find grid week based on Taiwan time
            let week = 1;
            if (result.schedule && result.schedule.length > 0) {
              const schedule = result.schedule;

              console.log('📅 First Week:', {
                week_number: schedule[0].week_number,
                week_start: schedule[0].week_start,
                week_end: schedule[0].week_end
              });

              // Parse dates and convert to Taiwan timezone for comparison
              const getDateInTaiwan = (dateStr) => {
                const date = new Date(dateStr);
                // Add 8 hours to convert UTC to Taiwan time
                return new Date(date.getTime() + (8 * 60 * 60 * 1000));
              };

              const firstWeekStart = getDateInTaiwan(schedule[0].week_start);
              const lastWeekEnd = getDateInTaiwan(schedule[schedule.length - 1].week_end);

              // If before first week, use week 1
              if (taiwanTime < firstWeekStart) {
                week = 1;
                console.log('⏰ Before first week, using week 1');
              }
              // If after last week, use last week
              else if (taiwanTime > lastWeekEnd) {
                week = schedule[schedule.length - 1].week_number;
                console.log('⏰ After last week, using week:', week);
              }
              // Find current week
              else {
                const current = schedule.find(w => {
                  const weekStart = getDateInTaiwan(w.week_start);
                  const weekEnd = getDateInTaiwan(w.week_end);
                  // Set end of day for week_end comparison
                  weekEnd.setUTCHours(23, 59, 59, 999);
                  const isInRange = taiwanTime >= weekStart && taiwanTime <= weekEnd;

                  console.log(`Week ${w.week_number}:`, {
                    week_start: w.week_start,
                    week_end: w.week_end,
                    weekStartTaiwan: weekStart.toISOString(),
                    weekEndTaiwan: weekEnd.toISOString(),
                    taiwanNow: taiwanTime.toISOString(),
                    isInRange
                  });

                  return isInRange;
                });

                if (current) {
                  week = current.week_number;
                  console.log('✅ Found current week:', week);
                } else {
                  console.log('⚠️ No matching week found, defaulting to week 1');
                }
              }
            }
            console.log('🎯 Final selected week:', week);
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
      setWeekDropdownOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (weekDropdownRef.current && !weekDropdownRef.current.contains(event.target)) {
        setWeekDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          {/* Header with League Name */}
          <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl">
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

          {/* MATCHUPS Section Header with Week Selector */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 uppercase tracking-wider">
                Matchups
              </h2>

              {/* Week Type Badge */}
              {weekDetails && (
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${getWeekTypeColor(weekDetails.week_type)}`}>
                  {getWeekTypeLabel(weekDetails.week_type)}
                </span>
              )}
            </div>

            {/* Week Selector */}
            <div className="relative flex items-center bg-slate-800/80 rounded-full p-1.5 border border-white/10 shadow-lg" ref={weekDropdownRef}>
              <button
                onClick={() => handleWeekChange(-1)}
                disabled={currentWeek <= 1 || matchupsLoading}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>

              <button
                onClick={() => setWeekDropdownOpen(!weekDropdownOpen)}
                className="flex flex-col items-center min-w-[200px] px-4 hover:bg-white/5 rounded-2xl py-1 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white tracking-wide group-hover:text-cyan-300 transition-colors">
                    WEEK {currentWeek}
                  </span>
                  <svg className={`w-4 h-4 text-white/50 transition-transform duration-300 ${weekDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {weekDetails && (
                  <span className="text-xs font-bold text-cyan-300/80 uppercase tracking-widest">
                    {new Date(weekDetails.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(weekDetails.week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleWeekChange(1)}
                disabled={currentWeek >= (scheduleData.length || 0) || matchupsLoading}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>

              {/* Custom Dropdown Content */}
              {weekDropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[280px] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="max-h-[400px] overflow-y-auto py-2 px-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {scheduleData.map((week) => (
                      <button
                        key={week.week_number}
                        onClick={() => {
                          setCurrentWeek(week.week_number);
                          fetchMatchups(week.week_number);
                          setWeekDropdownOpen(false);
                        }}
                        className={`w-full flex flex-col items-start px-4 py-3 rounded-xl transition-all mb-1 ${currentWeek === week.week_number
                          ? 'bg-purple-600/30 border border-purple-500/50'
                          : 'hover:bg-white/5 border border-transparent'
                          }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-sm font-black ${currentWeek === week.week_number ? 'text-white' : 'text-white/70'}`}>
                            WEEK {week.week_number}
                          </span>
                          {currentWeek === week.week_number && (
                            <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(week.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(week.week_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase ${week.week_type === 'playoffs' ? 'bg-purple-500/20 text-purple-400' :
                            week.week_type === 'makeup' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-blue-500/10 text-blue-400'
                            }`}>
                            {week.week_type === 'regular_season' ? 'Reg' : week.week_type === 'playoffs' ? 'Post' : 'Mkp'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Matchups Grid */}
          {matchupsLoading ? (
            <div className="w-full h-64 bg-white/5 rounded-3xl animate-pulse border border-white/5 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-purple-300 font-bold tracking-widest uppercase text-sm">Loading Matchups...</span>
            </div>
          ) : matchups.length === 0 ? (
            weekDetails?.week_type === 'playoffs' ? (
              <div className="flex flex-col items-center justify-center p-8 bg-white/5 rounded-3xl border border-white/10">
                <PlayoffBracketDisplay
                  playoffType={leagueSettings?.playoffs}
                  roundLabel={weekDetails?.week_label}
                  playoffReseeding={leagueSettings?.playoff_reseeding}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                <div className="text-6xl mb-4">🏟️</div>
                <h3 className="text-xl font-bold text-white mb-2">No Matchups Scheduled</h3>
                <p className="text-slate-400">There are no games scheduled for this week.</p>
              </div>
            )
          ) : (
            <div className="space-y-6">
              {matchups.map((matchup) => {
                const managerA = getManagerDetails(matchup.manager_id_a);
                const managerB = getManagerDetails(matchup.manager_id_b);
                const now = new Date();
                const weekStart = new Date(weekDetails?.week_start);
                const weekEnd = new Date(weekDetails?.week_end);
                const hasStarted = now >= weekStart;
                const isLive = now >= weekStart && now <= weekEnd;
                const isFinal = now > weekEnd;

                // Get actual scores from database
                const scoreA = matchup.score_a !== null ? parseFloat(matchup.score_a) : 0;
                const scoreB = matchup.score_b !== null ? parseFloat(matchup.score_b) : 0;

                return (
                  <div key={matchup.id} className="group relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-white/10 hover:border-purple-500/40 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(168,85,247,0.15)]">
                    {/* Main Content */}
                    <div className="p-6">
                      <div className="flex items-center justify-between gap-6">
                        {/* Team A */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3">
                            {/* Team Info */}
                            <div className="flex-1">
                              <div className="text-lg font-black text-white group-hover:text-purple-300 transition-colors">
                                {managerA?.nickname || 'Unknown'}
                              </div>
                              <div className="text-xs text-slate-400 font-medium mt-0.5">
                                {managerA?.managers?.name}
                              </div>
                            </div>

                            {/* Score A */}
                            <div className="text-right">
                              <div className={`text-4xl font-black tabular-nums ${scoreA > scoreB ? 'text-green-400' :
                                scoreA < scoreB ? 'text-slate-500' :
                                  'text-cyan-300'
                                }`}>
                                {scoreA}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* VS Divider */}
                        <div className="flex flex-col items-center px-4">
                          <div className="w-px h-16 bg-gradient-to-b from-transparent via-purple-500/50 to-transparent"></div>
                          <div className="absolute">
                            <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-purple-500/30 flex items-center justify-center">
                              <span className="text-xs font-black text-purple-400 uppercase tracking-wider">VS</span>
                            </div>
                          </div>
                        </div>

                        {/* Team B */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3 flex-row-reverse">
                            {/* Team Info */}
                            <div className="flex-1 text-right">
                              <div className="text-lg font-black text-white group-hover:text-cyan-300 transition-colors">
                                {managerB?.nickname || 'Unknown'}
                              </div>
                              <div className="text-xs text-slate-400 font-medium mt-0.5">
                                {managerB?.managers?.name}
                              </div>
                            </div>

                            {/* Score B */}
                            <div className="text-left">
                              <div className={`text-4xl font-black tabular-nums ${scoreB > scoreA ? 'text-green-400' :
                                scoreB < scoreA ? 'text-slate-500' :
                                  'text-cyan-300'
                                }`}>
                                {scoreB}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
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
