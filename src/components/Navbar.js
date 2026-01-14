// Navbar.js
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [leagues, setLeagues] = useState([])
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false)

  // Fetch user's leagues
  const fetchLeagues = (uid) => {
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
  }

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
  }, [])

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
    <nav className="bg-[#003366] text-white px-6 py-3 flex items-center justify-between shadow-md">
      {/* Logo Section */}
      <div className="flex items-center space-x-8">
        <div className="text-sm font-bold tracking-wide whitespace-nowrap">2025 CPBL FANTASY</div>
      </div>

      {/* Menu for larger screens */}
        <div className="hidden md:flex items-center space-x-4 text-sm">
          <Link href="/home" className="font-semibold hover:text-gray-300">HOME</Link>
          <Link href="/roster" className="font-semibold hover:text-gray-300">ROSTER</Link>
          <Link href="/player" className="font-semibold hover:text-gray-300">PLAYERS</Link>
          <Link href="/matchup" className="font-semibold hover:text-gray-300">MATCHUP</Link>
          <Link href="/manager" className="font-semibold hover:text-gray-300">MANAGER</Link>
          <Link href="/record_book" className="font-semibold hover:text-gray-300">RECORD BOOK</Link>
          {/* Leagues Dropdown */}
          {leagues.length > 0 && (
            <div className="relative league-dropdown">
              <button
                onClick={() => setLeagueDropdownOpen(!leagueDropdownOpen)}
                className="font-semibold hover:text-gray-300 flex items-center gap-1"
              >
                LEAGUES
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {leagueDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white text-gray-800 rounded shadow-lg min-w-[200px] z-50">
                  {leagues.map(league => (
                    <Link
                      key={league.league_id}
                      href={`/league/${league.league_id}`}
                      className="block px-4 py-2 hover:bg-gray-100 text-sm"
                      onClick={() => setLeagueDropdownOpen(false)}
                    >
                      {league.league_name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {userId === '2' && (
            <>
          <Link href="/bulk-insert" className="font-semibold hover:text-yellow-300">資料登錄系統</Link>
          <Link href="/matchup_debug" className="font-semibold hover:text-yellow-300">Debug</Link>
            </>
          )}
      </div>

      {/* Hamburger Menu for smaller screens */}
      <div className="md:hidden flex items-center">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-white focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Dropdown Menu for small screens */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[999] flex justify-end"
          onClick={() => setMenuOpen(false)} // 點擊背景就關閉
        >
          <div
            className="w-1/2 bg-[#003366] text-white p-4"
            onClick={(e) => e.stopPropagation()} // 防止點選內容時關閉
          >
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={() => setMenuOpen(false)}
                className="text-white text-xl"
              >
                &times;
              </button>
            </div>
            <Link href="/home" className="block py-2" onClick={() => setMenuOpen(false)}>HOME</Link>
            <Link href="/roster" className="block py-2" onClick={() => setMenuOpen(false)}>ROSTER</Link>
            <Link href="/player" className="block py-2" onClick={() => setMenuOpen(false)}>PLAYERS</Link>
            <Link href="/matchup" className="block py-2" onClick={() => setMenuOpen(false)}>MATCHUP</Link>
            <Link href="/manager" className="block py-2" onClick={() => setMenuOpen(false)}>MANAGER</Link>
            <Link href="/record_book" className="block py-2" onClick={() => setMenuOpen(false)}>RECORD BOOK</Link>
            {/* Leagues in mobile menu */}
            {leagues.length > 0 && (
              <div className="border-t border-white/20 mt-2 pt-2">
                <div className="text-xs text-gray-300 mb-2 px-1">MY LEAGUES</div>
                {leagues.map(league => (
                  <Link
                    key={league.league_id}
                    href={`/league/${league.league_id}`}
                    className="block py-2 pl-4 text-sm"
                    onClick={() => setMenuOpen(false)}
                  >
                    {league.league_name}
                  </Link>
                ))}
              </div>
            )}
            {userId === '2' && (
              <>
              <Link href="/bulk-insert" className="block py-2" onClick={() => setMenuOpen(false)}>資料登錄系統</Link>
              <Link href="/matchup_debug" className="block py-2" onClick={() => setMenuOpen(false)}>Debug</Link>
              </>
            )}
          </div>
        </div>
      )}


      {/* User and Logout Section (For larger screens, will only show if user is logged in) */}
      <div className="flex items-center space-x-4">
        {userName && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg">👤</span> 歡迎 {userName}
            {/* <button
              onClick={() => setEditDialogOpen(true)}
              className="text-sm text-white hover:text-yellow-300"
            >
              修改帳號資訊
            </button> */}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="text-sm text-white hover:text-red-300"
        >
          Logout
        </button>
      </div>

    </nav>
  )
}
