// Navbar.js
'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { fetchManagerLeagues } from '@/lib/leaguesClient'
import { clearHomeBootstrapCache } from '@/lib/homeBootstrapClient'
import { clearNavbarBootstrapCache, getNavbarBootstrap } from '@/lib/navbarBootstrapClient'
import { getCreateLeagueDisabled } from '@/lib/systemSettingsClient'
import { clearUsernameCache, getCurrentUsername } from '@/lib/usernameClient'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [leagues, setLeagues] = useState([])
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false)
  const [currentLeague, setCurrentLeague] = useState(null)
  const [expandedDesktopLeagueId, setExpandedDesktopLeagueId] = useState(null)
  const [expandedMobileLeagueId, setExpandedMobileLeagueId] = useState(null)
  const [taiwanTime, setTaiwanTime] = useState('')
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [createLeagueDisabled, setCreateLeagueDisabled] = useState(false)

  const navigateTo = (path, { closeDropdown = false, closeMenuPanel = false } = {}) => {
    if (closeDropdown) setLeagueDropdownOpen(false)
    if (closeMenuPanel) setMenuOpen(false)
    window.location.href = path
  }

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
    fetchManagerLeagues(uid)
      .then((leaguesData) => {
        setLeagues(leaguesData)
      })
      .catch(err => console.error('Failed to fetch leagues:', err))
  }, [])

  const hydrateFromLegacy = useCallback(async () => {
    try {
      const disabled = await getCreateLeagueDisabled()
      setCreateLeagueDisabled(disabled)

      const currentUser = await getCurrentUsername()

      if (!currentUser) {
        setUserId('')
        setUserName('')
        setIsAdmin(false)
        setLeagues([])
        return
      }

      if (currentUser.name) {
        setUserId(currentUser.userId)
        setUserName(currentUser.name)
        setIsAdmin(currentUser.is_admin || false)
        fetchLeagues(currentUser.userId)
      } else {
        setUserId('')
        setUserName('')
        setIsAdmin(false)
        setLeagues([])
      }
    } catch (err) {
      console.error('Failed to fetch navbar legacy data:', err)
      setUserId('')
      setUserName('')
      setIsAdmin(false)
      setLeagues([])
    }
  }, [fetchLeagues])

  const hydrateFromBootstrap = useCallback(async (forceRefresh = false) => {
    try {
      const data = await getNavbarBootstrap({ forceRefresh })

      setCreateLeagueDisabled(Boolean(data.createLeagueDisabled))

      if (data.isGuest || !data.user) {
        setUserId('')
        setUserName('')
        setIsAdmin(false)
        setLeagues([])
        return
      }

      setUserId(data.user.userId || '')
      setUserName(data.user.name || '')
      setIsAdmin(Boolean(data.user.is_admin))
      setLeagues(data.leagues || [])
    } catch (err) {
      await hydrateFromLegacy()
    }
  }, [hydrateFromLegacy])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (leagueDropdownOpen && !e.target.closest('.league-dropdown')) {
        setLeagueDropdownOpen(false)
      }
      if (userDropdownOpen && !e.target.closest('.user-dropdown')) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [leagueDropdownOpen, userDropdownOpen])

  // 當使用者登入或登出時，更新 navbar 顯示
  useEffect(() => {
    hydrateFromBootstrap()
      .finally(() => setIsLoading(false))
  }, [hydrateFromBootstrap])

  // 監聽全局 auth 改變事件，讓 Navbar 可以在登入/登出時立即更新
  useEffect(() => {
    const handler = () => {
      hydrateFromBootstrap(true)
    }

    window.addEventListener('auth-changed', handler)
    return () => window.removeEventListener('auth-changed', handler)
  }, [hydrateFromBootstrap])

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
    clearHomeBootstrapCache()
    clearNavbarBootstrapCache()
    clearUsernameCache()
    // 在登出時清除 userId 並跳轉到登錄頁面
    setUserId('')  // 更新 userId
    setUserName('')  // 清空用戶名稱
    setIsAdmin(false)
    setLeagues([])  // 清空 leagues
    localStorage.removeItem('user_id')  // 清除 localStorage 中的 user_id
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-[50] bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white shadow-2xl border-b border-blue-500/30">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f46e510_1px,transparent_1px),linear-gradient(to_bottom,#4f46e510_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none"></div>

      <div className="relative px-3 sm:px-6 py-2 sm:py-4 flex items-center justify-between">
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
            <div className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg shadow-lg">
              <span className="text-base sm:text-xl font-bold">⚾</span>
            </div>
          </div>
          <div className="whitespace-nowrap text-sm sm:text-lg font-bold tracking-wider bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            CPBL FANTASY
          </div>
        </Link>

        {userName && (
          <div className="hidden lg:flex items-center space-x-1">
            {(() => {
            const leagueIdMatch = pathname?.match(/^\/league\/([^\/]+)/);
            const activeLeagueId = leagueIdMatch ? leagueIdMatch[1] : currentLeague?.league_id;

            if (activeLeagueId) {
              return (
                <>
                  <a
                    href={`/league/${activeLeagueId}`}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${pathname === `/league/${activeLeagueId}`
                      ? 'bg-blue-500/30 text-cyan-300 border border-blue-500/50'
                      : 'hover:bg-white/10 hover:text-cyan-300'
                      }`}
                  >
                    OVERVIEW
                  </a>
                  <a
                    href={`/league/${activeLeagueId}/players`}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${pathname?.includes('/players')
                      ? 'bg-blue-500/30 text-cyan-300 border border-blue-500/50'
                      : 'hover:bg-white/10 hover:text-cyan-300'
                      }`}
                  >
                    PLAYERS
                  </a>
                  <a
                    href={`/league/${activeLeagueId}/roster`}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${pathname?.includes('/roster')
                      ? 'bg-blue-500/30 text-cyan-300 border border-blue-500/50'
                      : 'hover:bg-white/10 hover:text-cyan-300'
                      }`}
                  >
                    ROSTER
                  </a>
                  <a
                    href={`/league/${activeLeagueId}/matchups`}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${pathname?.includes('/matchups')
                      ? 'bg-blue-500/30 text-cyan-300 border border-blue-500/50'
                      : 'hover:bg-white/10 hover:text-cyan-300'
                      }`}
                  >
                    MATCHUPS
                  </a>
                  <a
                    href={`/league/${activeLeagueId}/league_settings`}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${pathname?.includes('/league_settings') || pathname?.includes('/edit_league_settings')
                      ? 'bg-blue-500/30 text-cyan-300 border border-blue-500/50'
                      : 'hover:bg-white/10 hover:text-cyan-300'
                      }`}
                  >
                    LEAGUE SETTINGS
                  </a>
                </>
              );
            }
              return null;
            })()}

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
                {new Date() < new Date('2026-04-16') ? (
                  <>
                    <Link
                      href="/public_league"
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all duration-200 border-b border-purple-400/30"
                      onClick={(e) => {
                        e.preventDefault()
                        setLeagueDropdownOpen(false)
                        window.location.href = '/public_league'
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-bold text-sm">JOIN PUBLIC LEAGUE</span>
                    </Link>
                    <Link
                      href={createLeagueDisabled ? '#' : '/create_league'}
                      className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 border-b ${createLeagueDisabled
                        ? 'bg-gray-600/40 border-gray-500/40 opacity-70 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-blue-400/30'
                        }`}
                      onClick={(e) => {
                        e.preventDefault()
                        setLeagueDropdownOpen(false)
                        if (!createLeagueDisabled) {
                          window.location.href = '/create_league'
                        }
                      }}
                      title={createLeagueDisabled ? 'Create league is currently disabled by admin' : ''}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="font-bold text-sm">CREATE NEW LEAGUE</span>
                    </Link>
                  </>
                ) : (
                  <div className="px-4 py-3 text-slate-400 text-sm text-center border-b border-slate-700/50">
                    League creation period has ended
                  </div>
                )}

                {leagues.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto">
                    {leagues.map((league, index) => (
                      <div
                        key={league.league_id}
                        className={`${index !== leagues.length - 1 ? 'border-b border-slate-700/50' : ''}`}
                      >
                        <button
                          onClick={() => setExpandedDesktopLeagueId(expandedDesktopLeagueId === league.league_id ? null : league.league_id)}
                          className="w-full px-4 py-3 hover:bg-blue-500/20 transition-all duration-200 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-bold text-sm text-cyan-300">{league.league_name}</div>
                              <div className="text-xs text-slate-400 mt-0.5">{league.nickname}</div>
                            </div>
                            <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedDesktopLeagueId === league.league_id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        {expandedDesktopLeagueId === league.league_id && (
                          <div className="px-4 pb-3 grid grid-cols-2 gap-2 bg-slate-900/40">
                            <button onClick={() => navigateTo(`/league/${league.league_id}`, { closeDropdown: true })} className="text-left text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-blue-500/20 text-slate-200">Overview</button>
                            <button onClick={() => navigateTo(`/league/${league.league_id}/players`, { closeDropdown: true })} className="text-left text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-blue-500/20 text-slate-200">Players</button>
                            <button onClick={() => navigateTo(`/league/${league.league_id}/roster`, { closeDropdown: true })} className="text-left text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-blue-500/20 text-slate-200">Roster</button>
                            <button onClick={() => navigateTo(`/league/${league.league_id}/matchups`, { closeDropdown: true })} className="text-left text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-blue-500/20 text-slate-200">Matchups</button>
                            <button onClick={() => navigateTo(`/league/${league.league_id}/league_settings`, { closeDropdown: true })} className="col-span-2 text-left text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-blue-500/20 text-slate-200">Settings</button>
                          </div>
                        )}
                      </div>
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
        )}

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
          {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-lg border border-white/10">
              <div className="w-6 h-6 rounded-full bg-slate-600 animate-pulse"></div>
              <div className="w-16 h-4 bg-slate-600 rounded animate-pulse"></div>
            </div>
          ) : userName ? (
            <div className="relative user-dropdown">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-200"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold shadow-lg shadow-blue-500/20">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium">{userName}</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 text-white rounded-xl shadow-2xl border border-blue-500/30 overflow-hidden z-50">
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-blue-500/20 transition-colors border-b border-white/5"
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm font-medium">Profile Settings</span>
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-blue-500/20 transition-colors border-b border-white/5"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      <span className="text-sm font-medium">Admin Dashboard</span>
                    </Link>
                  )}
                  <button
                    onClick={() => { setUserDropdownOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-300 hover:text-red-200 transition-colors text-left"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="text-sm font-medium">Logout</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-200"
            >
              Login
            </Link>
          )}
        </div>

        <div className="lg:hidden flex items-center">
          {userName ? (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg font-medium text-sm bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-200"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {menuOpen && userName && (
        <div className="fixed inset-0 z-[999] lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div className="absolute right-0 top-0 h-full w-72 max-w-[80vw] bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-blue-500/30">
              <div className="flex items-center gap-3">
                {userName && (
                  <>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-sm font-bold">
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

            {/* Action buttons - right after header */}
            <div className="px-3 py-2 border-b border-blue-500/30 flex gap-1.5">
              <Link
                href="/profile"
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-blue-500/20 text-cyan-300 hover:bg-blue-500/30 transition-all text-xs font-medium border border-blue-500/30"
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = '/profile'; }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all text-xs font-medium border border-purple-500/30"
                  onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = '/admin'; }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Admin
                </Link>
              )}
              <button
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all text-xs font-medium border border-red-500/30"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-1">
              {currentLeague ? (
                <>
                  <div className="text-xs text-blue-300/70 mb-2 px-3 font-semibold tracking-wider">LEAGUE NAV</div>
                  <Link
                    href={`/league/${currentLeague.league_id}`}
                    className={`block px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${pathname === `/league/${currentLeague.league_id}` ? 'bg-white/10 text-cyan-300' : 'hover:bg-white/10'}`}
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${currentLeague.league_id}`; }}
                  >
                    OVERVIEW
                  </Link>
                  <Link
                    href={`/league/${currentLeague.league_id}/players`}
                    className={`block px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${pathname?.includes('/players') ? 'bg-white/10 text-cyan-300' : 'hover:bg-white/10'}`}
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${currentLeague.league_id}/players`; }}
                  >
                    PLAYERS
                  </Link>
                  <Link
                    href={`/league/${currentLeague.league_id}/roster`}
                    className={`block px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${pathname?.includes('/roster') ? 'bg-white/10 text-cyan-300' : 'hover:bg-white/10'}`}
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${currentLeague.league_id}/roster`; }}
                  >
                    ROSTER
                  </Link>
                  <Link
                    href={`/league/${currentLeague.league_id}/matchups`}
                    className={`block px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${pathname?.includes('/matchups') ? 'bg-white/10 text-cyan-300' : 'hover:bg-white/10'}`}
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${currentLeague.league_id}/matchups`; }}
                  >
                    MATCHUPS
                  </Link>
                  <Link
                    href={`/league/${currentLeague.league_id}/league_settings`}
                    className={`block px-3 py-2.5 rounded-lg transition-colors font-medium text-sm ${pathname?.includes('/league_settings') || pathname?.includes('/edit_league_settings') ? 'bg-white/10 text-cyan-300' : 'hover:bg-white/10'}`}
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = `/league/${currentLeague.league_id}/league_settings`; }}
                  >
                    SETTINGS
                  </Link>
                </>
              ) : null}


              <div className="border-t border-blue-500/30 mt-3 pt-3">
                <div className="text-xs text-blue-300/70 mb-2 px-3 font-semibold tracking-wider">MY LEAGUES</div>

                {new Date() < new Date('2026-04-16') ? (
                  <>
                    <Link href="/public_league" className="flex items-center gap-2 px-3 py-2.5 mb-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all duration-200 font-medium text-sm" onClick={(e) => { e.preventDefault(); setMenuOpen(false); window.location.href = '/public_league'; }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm font-bold">JOIN PUBLIC LEAGUE</span>
                    </Link>
                    <Link href={createLeagueDisabled ? '#' : '/create_league'} className={`flex items-center gap-2 px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 font-medium text-sm ${createLeagueDisabled ? 'bg-gray-600/40 opacity-70 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500'}`} onClick={(e) => { e.preventDefault(); setMenuOpen(false); if (!createLeagueDisabled) window.location.href = '/create_league'; }} title={createLeagueDisabled ? 'Create league is currently disabled by admin' : ''}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="text-sm font-bold">CREATE NEW LEAGUE</span>
                    </Link>
                  </>
                ) : (
                  <div className="px-4 py-3 mb-2 text-slate-400 text-sm text-center">
                    League creation period has ended
                  </div>
                )}

                {leagues.length > 0 ? (
                  leagues.map(league => (
                    <div key={league.league_id} className="mb-1.5 rounded-lg border border-white/5 bg-white/[0.02]">
                      <button
                        onClick={() => setExpandedMobileLeagueId(expandedMobileLeagueId === league.league_id ? null : league.league_id)}
                        className="w-full px-3 py-2.5 text-left hover:bg-white/10 transition-colors rounded-lg"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-cyan-300">{league.league_name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{league.nickname}</div>
                          </div>
                          <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedMobileLeagueId === league.league_id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      {expandedMobileLeagueId === league.league_id && (
                        <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
                          <button onClick={() => navigateTo(`/league/${league.league_id}`, { closeMenuPanel: true })} className="text-left text-xs px-2 py-1.5 rounded bg-white/5 hover:bg-blue-500/20">Overview</button>
                          <button onClick={() => navigateTo(`/league/${league.league_id}/players`, { closeMenuPanel: true })} className="text-left text-xs px-2 py-1.5 rounded bg-white/5 hover:bg-blue-500/20">Players</button>
                          <button onClick={() => navigateTo(`/league/${league.league_id}/roster`, { closeMenuPanel: true })} className="text-left text-xs px-2 py-1.5 rounded bg-white/5 hover:bg-blue-500/20">Roster</button>
                          <button onClick={() => navigateTo(`/league/${league.league_id}/matchups`, { closeMenuPanel: true })} className="text-left text-xs px-2 py-1.5 rounded bg-white/5 hover:bg-blue-500/20">Matchups</button>
                          <button onClick={() => navigateTo(`/league/${league.league_id}/league_settings`, { closeMenuPanel: true })} className="col-span-2 text-left text-xs px-2 py-1.5 rounded bg-white/5 hover:bg-blue-500/20">Settings</button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">No leagues yet</div>
                )}
              </div>


            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
