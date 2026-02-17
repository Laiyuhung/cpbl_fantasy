// Navbar.js
'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [leagues, setLeagues] = useState([])
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false)
  const [currentLeague, setCurrentLeague] = useState(null)
  const [taiwanTime, setTaiwanTime] = useState('')

  // Update Taiwan time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Taipei',
        hour: 'numeric',
        minute: '2-digit',
        hour12: false
      };
      const timeString = now.toLocaleString('en-US', options);
      setTaiwanTime(timeString);
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Fetch user's leagues
  const fetchLeagues = useCallback((uid) => {
    fetch('/api/managers/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid }),
    })
      .then(res => res.json())
      .then(data => {
        if (data?.leagues) {
          setLeagues(data.leagues)
        }
      })
      .catch(err => console.error('Failed to fetch leagues:', err))
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (leagueDropdownOpen && !e.target.closest('.league-dropdown')) {
        setLeagueDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [leagueDropdownOpen])

  // 當使用者登入或登出時，更新 navbar 顯示
  useEffect(() => {
    const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='))
    const uid = cookie?.split('=')[1]

    if (!uid) return router.push('/login')

    fetch('/api/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid }),
    })
      .then(res => res.json())
      .then(data => {
        if (data?.name) {
          setUserId(uid)
          setUserName(data.name)
          fetchLeagues(uid)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
  }, [router, fetchLeagues])

  // 監聽全局 auth 改變事件，讓 Navbar 可以在登入/登出時立即更新
  useEffect(() => {
    const handler = () => {
      const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='))
      const uid = cookie?.split('=')[1]
      if (!uid) {
        setUserId('')
        setUserName('')
        return
      }
      fetch('/api/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid }),
      })
        .then(res => res.json())
        .then(data => {
          if (data?.name) {
            setUserId(uid)
            setUserName(data.name)
            fetchLeagues(uid)
          } else {
            setUserId('')
            setUserName('')
            setLeagues([])
          }
        })
        .catch(() => {
          setUserId('')
          setUserName('')
          setLeagues([])
        })
    }

    window.addEventListener('auth-changed', handler)
    return () => window.removeEventListener('auth-changed', handler)
  }, [])

  // 監聽 leagues 改變事件，當 league 被刪除或離開時更新列表
  useEffect(() => {
    const handler = () => {
      if (userId) {
        fetchLeagues(userId)
      }
    }

    window.addEventListener('leagues-changed', handler)
    return () => window.removeEventListener('leagues-changed', handler)
  }, [userId, fetchLeagues])

  // 監測當前路徑，如果在 league/[leagueId] 底下，設定當前聯盟
  useEffect(() => {
    const match = pathname?.match(/^\/league\/([^\/]+)/)
    if (match && match[1]) {
      const leagueId = match[1]
      const found = leagues.find(l => l.league_id === leagueId)
      setCurrentLeague(found || null)
    } else {
      setCurrentLeague(null)
    }
  }, [pathname, leagues])


  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' })
    // 在登出時清除 userId 並跳轉到登錄頁面
    setUserId('')  // 更新 userId
    setUserName('')  // 清空用戶名稱
    setLeagues([])  // 清空 leagues
    localStorage.removeItem('user_id')  // 清除 localStorage 中的 user_id
    router.push('/login')
  }

  // 如果沒有登入，則不顯示 navbar
  if (!userId) return null


  return (
    <nav className="sticky top-0 z-[50] bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white shadow-2xl border-b border-blue-500/30">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e510_1px,transparent_1px),linear-gradient(to_bottom,#4f46e510_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none"></div>

      <div className="relative px-6 py-4 flex items-center justify-between">
        <Link
          href="/home"
          className="flex items-center space-x-3 group"
          onClick={(e) => {
            e.preventDefault()
            window.location.href = '/home'
          }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg shadow-lg">
              <span className="text-xl font-bold">⚾</span>
            </div>
          </div>
          <div className="text-lg font-bold tracking-wider bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            CPBL FANTASY
          </div>
        </Link>

        <div className="hidden lg:flex items-center space-x-1">
          {currentLeague ? (
            <>
              <a
                href={`/league/${currentLeague.league_id}`}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${pathname === `/league/${currentLeague.league_id}`
                  ? 'bg-blue-500/30 text-cyan-300 border border-blue-500/50'
                  : 'hover:bg-white/10 hover:text-cyan-300'
                  }`}
              >
                OVERVIEW
              </a>
              <a
                href={`/league/${currentLeague.league_id}/players`}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${pathname?.includes('/players')
                  ? 'bg-blue-500/30 text-cyan-300 border border-blue-500/50'
                  : 'hover:bg-white/10 hover:text-cyan-300'
                  }`}
              >
                PLAYERS
              </a>
              <a
                href={`/league/${currentLeague.league_id}/roster`}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${pathname?.includes('/roster')
                  ? 'bg-blue-500/30 text-cyan-300 border border-blue-500/50'
                  : 'hover:bg-white/10 hover:text-cyan-300'
                  }`}
              >
                ROSTER
              </a>
              <a
                href={`/league/${currentLeague.league_id}/matchups`}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${pathname?.includes('/matchups')
                  ? 'bg-blue-500/30 text-cyan-300 border border-blue-500/50'
                  : 'hover:bg-white/10 hover:text-cyan-300'
                  }`}
              >
                MATCHUPS
              </a>
              <a
                href={`/league/${currentLeague.league_id}/league_settings`}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${pathname?.includes('/league_settings') || pathname?.includes('/edit_league_settings')
                  ? 'bg-blue-500/30 text-cyan-300 border border-blue-500/50'
                  : 'hover:bg-white/10 hover:text-cyan-300'
                  }`}
              >
                LEAGUE SETTINGS
              </a>
            </>
          ) : null}

          <div className="relative league-dropdown">
            <button
              onClick={() => setLeagueDropdownOpen(!leagueDropdownOpen)}
              className="px-4 py-2 rounded-lg font-medium text-sm hover:bg-white/10 hover:text-cyan-300 transition-all duration-200 flex items-center gap-1.5"
            >
              {currentLeague ? (
                <>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 font-black text-base drop-shadow-lg">
                    {currentLeague.league_name}
                  </span>
                  <span className="text-white/50">|</span>
                  <span>LEAGUES</span>
                </>
              ) : (
                'LEAGUES'
              )}
              <svg className={`w-4 h-4 transition-transform duration-200 ${leagueDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {leagueDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 bg-slate-800/95 backdrop-blur-xl text-white rounded-xl shadow-2xl min-w-[260px] z-50 border border-blue-500/30 overflow-hidden">
                <Link
                  href="/create_league"
                  className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-200 border-b border-blue-400/30"
                  onClick={(e) => {
                    e.preventDefault()
                    setLeagueDropdownOpen(false)
                    window.location.href = '/create_league'
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="font-bold text-sm">CREATE NEW LEAGUE</span>
                </Link>

                {leagues.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto">
                    {leagues.map((league, index) => (
                      <Link
                        key={league.league_id}
                        href={`/league/${league.league_id}`}
                        className={`block px-4 py-3 hover:bg-blue-500/20 transition-all duration-200 ${index !== leagues.length - 1 ? 'border-b border-slate-700/50' : ''}`}
                        onClick={(e) => {
                          e.preventDefault()
                          setLeagueDropdownOpen(false)
                          window.location.href = `/league/${league.league_id}`
                        }}
                      >
                        <div className="font-bold text-sm text-cyan-300">{league.league_name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{league.nickname}</div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">
                    No leagues yet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:flex items-center space-x-3">
          {taiwanTime && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-cyan-300">Taiwan Time:</span>
              <span className="text-sm font-bold text-white">{taiwanTime}</span>
            </div>
          )}
          {userName && (
            <div className="relative group">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-200"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/20">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium">{userName}</span>
                <svg className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 text-white rounded-xl shadow-2xl border border-blue-500/30 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-500/20 transition-colors border-b border-white/5"
                >
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-medium">Profile Settings</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-300 hover:text-red-200 transition-colors text-left"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:hidden flex items-center">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-[999] lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-blue-500/30">
              <div className="flex items-center gap-3">
                {userName && (
                  <>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center font-bold">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{userName}</div>
                      <div className="text-xs text-blue-300/70">Manager</div>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setMenuOpen(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto h-[calc(100%-180px)] p-4 space-y-1">
              {currentLeague ? (
                <>
                  <div className="text-xs text-blue-300/70 mb-3 px-4 font-semibold tracking-wider">LEAGUE NAV</div>
                  <Link
                    href={`/league/${currentLeague.league_id}`}
                    className={`block px-4 py-3 rounded-lg transition-colors font-medium ${pathname === `/league/${currentLeague.league_id}` ? 'bg-white/10 text-cyan-300' : 'hover:bg-white/10'}`}
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${currentLeague.league_id}`; }}
                  >
                    OVERVIEW
                  </Link>
                  <Link
                    href={`/league/${currentLeague.league_id}/players`}
                    className={`block px-4 py-3 rounded-lg transition-colors font-medium ${pathname?.includes('/players') ? 'bg-white/10 text-cyan-300' : 'hover:bg-white/10'}`}
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${currentLeague.league_id}/players`; }}
                  >
                    PLAYERS
                  </Link>
                  <Link
                    href={`/league/${currentLeague.league_id}/roster`}
                    className={`block px-4 py-3 rounded-lg transition-colors font-medium ${pathname?.includes('/roster') ? 'bg-white/10 text-cyan-300' : 'hover:bg-white/10'}`}
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${currentLeague.league_id}/roster`; }}
                  >
                    ROSTER
                  </Link>
                  <Link
                    href={`/league/${currentLeague.league_id}/matchups`}
                    className={`block px-4 py-3 rounded-lg transition-colors font-medium ${pathname?.includes('/matchups') ? 'bg-white/10 text-cyan-300' : 'hover:bg-white/10'}`}
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${currentLeague.league_id}/matchups`; }}
                  >
                    MATCHUPS
                  </Link>
                  <Link
                    href={`/league/${currentLeague.league_id}/league_settings`}
                    className={`block px-4 py-3 rounded-lg transition-colors font-medium ${pathname?.includes('/league_settings') || pathname?.includes('/edit_league_settings') ? 'bg-white/10 text-cyan-300' : 'hover:bg-white/10'}`}
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${currentLeague.league_id}/league_settings`; }}
                  >
                    LEAGUE SETTINGS
                  </Link>
                </>
              ) : null}


              <div className="border-t border-blue-500/30 mt-4 pt-4">
                <div className="text-xs text-blue-300/70 mb-3 px-4 font-semibold tracking-wider">MY LEAGUES</div>

                <Link href="/create_league" className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-200 font-medium" onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = '/create_league'; }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-bold">CREATE NEW LEAGUE</span>
                </Link>

                {leagues.length > 0 ? (
                  leagues.map(league => (
                    <Link key={league.league_id} href={`/league/${league.league_id}`} className="block px-4 py-3 rounded-lg hover:bg-white/10 transition-colors" onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${league.league_id}`; }}>
                      <div className="font-bold text-sm text-cyan-300">{league.league_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{league.nickname}</div>
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">No leagues yet</div>
                )}
              </div>


            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-500/30 bg-slate-900/50">
              <button onClick={handleLogout} className="w-full px-4 py-3 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all duration-200 font-medium border border-red-500/30">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
