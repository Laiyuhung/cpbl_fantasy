'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

import CpblScheduleWidget from '@/components/CpblScheduleWidget';

export default function HomePage() {
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const getCookie = (name) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop().split(';').shift();
        };
        const userId = getCookie('user_id');

        if (!userId) {
          setLoading(false); //
          return;
        }

        const res = await fetch('/api/managers/leagues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });

        const data = await res.json();
        if (data.leagues) {
          setLeagues(data.leagues);
        }
      } catch (error) {
        console.error('Failed to fetch leagues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-[1600px] mx-auto">


        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column: League List */}
          <div className="flex-1">
            {/* Header Row */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                <span className="w-1.5 h-6 bg-purple-400 rounded-full"></span>
                My Leagues
              </h2>
              <div className="flex items-center gap-2">
                {new Date() < new Date('2026-04-16') ? (
                  <>
                    <Link
                      href="/public_league"
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-lg hover:shadow-blue-500/50 flex items-center gap-2 text-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Join Public League
                    </Link>
                    <Link
                      href="/create_league"
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-lg hover:shadow-green-500/50 flex items-center gap-2 text-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Create New League
                    </Link>
                  </>
                ) : (
                  <span className="text-slate-500 text-sm">League creation period has ended</span>
                )}
              </div>
            </div>

            <div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-4 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-purple-300">Loading leagues...</div>
                </div>
              ) : leagues.length === 0 ? (
                <div className="text-center py-12 text-purple-300/70 text-lg">
                  You are not a member of any leagues yet
                </div>
              ) : (
                <div className="space-y-4">
                  {leagues.map((league) => (
                    <Link
                      key={league.league_id}
                      href={`/league/${league.league_id}`}
                      className="block group relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-white/10 hover:border-purple-500/40 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] h-full"
                    >
                      <div className="p-5 h-full flex flex-col">
                        {/* Header: League Name */}
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-black text-white group-hover:text-purple-300 transition-colors truncate pr-2">
                            {league.league_name}
                          </h3>
                          <span className={`shrink-0 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${league.status === 'in season' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                            league.status === 'pre-draft' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                              league.status === 'post-season' || league.status === 'playoffs' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                'bg-slate-700/40 text-slate-400 border-slate-600'
                            }`}>
                            {league.status?.replace('-', ' ') || 'Unknown'}
                          </span>
                        </div>

                        {/* Content */}
                        {league.status === 'pre-draft' ? (
                          <div className="flex flex-col items-center justify-center flex-1 py-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Draft Time</span>
                            <span className="text-white font-mono font-bold text-lg">
                              {league.draft_time ? new Date(league.draft_time).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                              }) : 'TBD'}
                            </span>
                          </div>
                        ) : league.matchup ? (
                          <div className="flex items-center justify-center gap-6 mt-1">
                            {/* Left: My Team */}
                            <div className="text-right w-[35%]">
                              <div className="font-bold text-base text-blue-300 truncate leading-tight">
                                {league.nickname}
                              </div>
                              {league.stats && (
                                <div className="text-xs font-bold text-slate-400 font-mono mt-0.5">
                                  {league.stats.wins}-{league.stats.losses}-{league.stats.ties}
                                  <span className="text-slate-600 mx-1">|</span>
                                  <span className="text-slate-500">
                                    {league.stats.rank}{
                                      (league.stats.rank % 100 >= 11 && league.stats.rank % 100 <= 13) ? 'th' :
                                        (league.stats.rank % 10 === 1) ? 'st' :
                                          (league.stats.rank % 10 === 2) ? 'nd' :
                                            (league.stats.rank % 10 === 3) ? 'rd' : 'th'
                                    }
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Center: Score */}
                            <div className="flex items-center justify-center gap-2 shrink-0 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-white/5">
                              <span className={`text-xl font-black tabular-nums ${league.matchup.myScore > league.matchup.opponentScore ? 'text-green-400' :
                                league.matchup.myScore < league.matchup.opponentScore ? 'text-white' : 'text-white'
                                }`}>
                                {league.matchup.myScore}
                              </span>
                              <span className="text-[10px] font-bold text-slate-600 uppercase">vs</span>
                              <span className={`text-xl font-black tabular-nums ${league.matchup.opponentScore > league.matchup.myScore ? 'text-green-400' :
                                league.matchup.opponentScore < league.matchup.myScore ? 'text-white' : 'text-white'
                                }`}>
                                {league.matchup.opponentScore}
                              </span>
                            </div>

                            {/* Right: Opponent */}
                            <div className="text-left w-[35%]">
                              <div className="font-bold text-base text-blue-300 truncate leading-tight">
                                {league.matchup.opponentName}
                              </div>
                              {league.matchup.opponentStats ? (
                                <div className="text-xs font-bold text-slate-400 font-mono mt-0.5">
                                  <span className="text-slate-500">
                                    {league.matchup.opponentStats.rank}{
                                      (league.matchup.opponentStats.rank % 100 >= 11 && league.matchup.opponentStats.rank % 100 <= 13) ? 'th' :
                                        (league.matchup.opponentStats.rank % 10 === 1) ? 'st' :
                                          (league.matchup.opponentStats.rank % 10 === 2) ? 'nd' :
                                            (league.matchup.opponentStats.rank % 10 === 3) ? 'rd' : 'th'
                                    }
                                  </span>
                                  <span className="text-slate-600 mx-1">|</span>
                                  {league.matchup.opponentStats.wins}-{league.matchup.opponentStats.losses}-{league.matchup.opponentStats.ties}
                                </div>
                              ) : (
                                <div className="text-xs font-bold text-slate-400 font-mono mt-0.5">
                                  0-0-0
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-slate-500 text-sm py-2">
                            Waiting for season start...
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: CPBL Schedule */}
          <div className="w-full lg:w-[350px] shrink-0">
            <div className="bg-gradient-to-br from-slate-900/50 to-purple-900/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl sticky top-8">
              <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-wider flex items-center gap-3">
                <span className="w-1.5 h-6 bg-purple-400 rounded-full"></span>
                CPBL Schedule
              </h2>
              <CpblScheduleWidget />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
