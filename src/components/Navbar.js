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
    console.log('=== Navbar: Fetching leagues ===')
    console.log('Manager ID (user_id):', uid)

    fetch('/api/managers/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid }),
    })
      .then(res => res.json())
      .then(data => {
        console.log('Leagues API response:', data)
        if (data?.leagues) {
          setLeagues(data.leagues)
          console.log('Leagues set:', data.leagues)
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
        console.log('Refreshing leagues after change...')
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

  console.log('🔍 [Navbar] Rendering navbar, z-index: 99999')
  console.log('🔍 [Navbar] Current pathname:', pathname)
  console.log('🔍 [Navbar] Current league:', currentLeague)

  return (
    <nav className="sticky top-0 z-[99999] bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white shadow-2xl border-b border-blue-500/30">
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
          <Link
            href="/home"
            className="px-4 py-2 rounded-lg font-medium text-sm hover:bg-white/10 hover:text-cyan-300 transition-all duration-200"
            onClick={(e) => {
              console.log('🖱️ [Navbar] HOME link clicked')
              console.log('🖱️ [Navbar] defaultPrevented:', e.defaultPrevented)
              console.log('🖱️ [Navbar] Router object:', router)
              console.log('🖱️ [Navbar] Current pathname:', pathname)

              // Force navigation using window.location as ultimate fallback
              e.preventDefault()
              console.log('🚀 [Navbar] Forcing navigation to /home with window.location.href')
              window.location.href = '/home'
            }}
          >
            HOME
          </Link>
          <Link
            href="/roster"
            className="px-4 py-2 rounded-lg font-medium text-sm hover:bg-white/10 hover:text-cyan-300 transition-all duration-200"
            onClick={(e) => {
              console.log('🖱️ [Navbar] ROSTER link clicked')
              e.preventDefault()
              console.log('🚀 [Navbar] Forcing navigation to /roster')
              window.location.href = '/roster'
            }}
          >
            ROSTER
          </Link>

          <Link
            href="/matchup"
            className="px-4 py-2 rounded-lg font-medium text-sm hover:bg-white/10 hover:text-cyan-300 transition-all duration-200"
            onClick={(e) => {
              console.log('🖱️ [Navbar] MATCHUP link clicked')
              e.preventDefault()
              console.log('🚀 [Navbar] Forcing navigation to /matchup')
              window.location.href = '/matchup'
            }}
          >
            MATCHUP
          </Link>

          <Link
            href="/record_book"
            className="px-4 py-2 rounded-lg font-medium text-sm hover:bg-white/10 hover:text-cyan-300 transition-all duration-200"
            onClick={(e) => {
              console.log('🖱️ [Navbar] RECORDS link clicked')
              e.preventDefault()
              console.log('🚀 [Navbar] Forcing navigation to /record_book')
              window.location.href = '/record_book'
            }}
          >
            RECORDS
          </Link>

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
                    console.log('🚀 [Navbar] Navigating to /create_league')
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
                          console.log(`🚀 [Navbar] Navigating to /league/${league.league_id}`)
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

          {userId === '2' && (
            <>
              <Link href="/bulk-insert" className="px-4 py-2 rounded-lg font-medium text-sm bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-all duration-200">
                資料登錄
              </Link>
              <Link href="/matchup_debug" className="px-4 py-2 rounded-lg font-medium text-sm bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-all duration-200">
                Debug
              </Link>
            </>
          )}
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
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-sm font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium">{userName}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all duration-200 border border-red-500/30"
          >
            Logout
          </button>
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
              <Link href="/home" className="block px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium" onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = '/home'; }}>HOME</Link>
              <Link href="/roster" className="block px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium" onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = '/roster'; }}>ROSTER</Link>

              <Link href="/matchup" className="block px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium" onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = '/matchup'; }}>MATCHUP</Link>

              <Link href="/record_book" className="block px-4 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium" onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = '/record_book'; }}>RECORDS</Link>

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
