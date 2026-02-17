'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import CpblScheduleWidget from '@/components/CpblScheduleWidget'

export default function HomePage() {
  const router = useRouter()
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
          setLoading(false);
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
            {/* League List */}
            <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600/80 to-cyan-600/80 backdrop-blur-sm p-6 border-b border-blue-400/30 flex items-center justify-between">
                <h2 className="text-3xl font-black text-white">My Leagues</h2>
                <button
                  onClick={() => router.push('/create_league')}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-lg hover:shadow-green-500/50 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create New League
                </button>
              </div>
              <div className="p-6">
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
                      <div
                        key={league.league_id}
                        onClick={() => router.push(`/league/${league.league_id}`)}
                        className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-2xl font-bold text-white group-hover:text-purple-300 transition-colors mb-2">
                              {league.league_name}
                            </h3>
                            <p className="text-purple-300/70 text-sm">
                              Your team: <span className="font-semibold text-purple-300">{league.nickname}</span>
                            </p>
                          </div>
                          <svg className="w-8 h-8 text-purple-400 group-hover:text-purple-300 group-hover:translate-x-2 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
