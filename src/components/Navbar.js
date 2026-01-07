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
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editData, setEditData] = useState({ account: '', password: '', team_name: '' })
  const [editDataLoaded, setEditDataLoaded] = useState(false)


  useEffect(() => {
    if (editDialogOpen && userId) {
      setEditDataLoaded(false)  // ← 加這行
      fetch('/api/managers/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId })
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.account) {
            setEditData({
              account: data.account || '',
              password: data.password || '',
              team_name: data.team_name || ''
            })
            setEditDataLoaded(true)  // ← 加這行
          }
        })
        .catch(err => console.error('❌ 取得使用者詳細失敗:', err))
    }
  }, [editDialogOpen, userId])



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
          } else {
            setUserId('')
            setUserName('')
          }
        })
        .catch(() => {
          setUserId('')
          setUserName('')
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
          <Link href="/postseason" className="font-semibold hover:text-gray-300">POSTSEASON</Link>
          <Link href="/manager" className="font-semibold hover:text-gray-300">MANAGER</Link>
          <Link href="/record_book" className="font-semibold hover:text-gray-300">RECORD BOOK</Link>
          {userId === '2' && (
            <>
          <Link href="/bulk-insert" className="font-semibold hover:text-yellow-300">資料登錄系統</Link>
          <Link href="/matchup_debug" className="font-semibold hover:text-yellow-300">Debug</Link>
            </>
          )}
          <button
            onClick={() => {
            setEditDialogOpen(true)
            setMenuOpen(false)
          }}
          className="font-semibold hover:text-yellow-300"
        >
          修改帳號資訊
        </button>
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
            <Link href="/postseason" className="block py-2" onClick={() => setMenuOpen(false)}>POSTSEASON</Link>
            <Link href="/manager" className="block py-2" onClick={() => setMenuOpen(false)}>MANAGER</Link>
            <Link href="/record_book" className="block py-2" onClick={() => setMenuOpen(false)}>RECORD BOOK</Link>
            {userId === '2' && (
              <>
              <Link href="/bulk-insert" className="block py-2" onClick={() => setMenuOpen(false)}>資料登錄系統</Link>
              <Link href="/matchup_debug" className="block py-2" onClick={() => setMenuOpen(false)}>Debug</Link>
              </>
            )}
            <button
              onClick={() => {
                setEditDialogOpen(true)
                setMenuOpen(false)
              }}
              className="block py-2 text-left w-full text-white hover:text-yellow-300"
            >
              修改帳號資訊
            </button>
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

      {editDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center">
          <div className="bg-white rounded shadow p-6 w-[90%] max-w-md">
            <h2 className="text-lg font-bold mb-4 text-gray-800">修改帳號資訊</h2>

            {!editDataLoaded ? (
              <div className="text-center text-gray-500">載入中...</div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const form = e.target
                  const account = form.account.value
                  const password = form.password.value
                  const team_name = form.team_name.value

                  const res = await fetch('/api/managers/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: userId, account, password, team_name })
                  })

                  const data = await res.json()
                  if (res.ok) {
                    alert('✅ 更新成功')
                    setEditDialogOpen(false)
                  } else {
                    alert(`❌ 錯誤: ${data.error}`)
                  }
                }}
              >
                <label className="block mb-2 text-sm text-gray-700">帳號</label>
                <input
                  name="account"
                  className="w-full border border-gray-400 bg-white text-gray-800 px-2 py-1 mb-3"
                  required
                  value={editData.account}
                  onChange={e => setEditData({ ...editData, account: e.target.value })}
                />

                <label className="block mb-2 text-sm text-gray-700">密碼</label>
                <input
                  name="password"
                  className="w-full border border-gray-400 bg-white text-gray-800 px-2 py-1 mb-3"
                  required
                  value={editData.password}
                  onChange={e => setEditData({ ...editData, password: e.target.value })}
                />

                <label className="block mb-2 text-sm text-gray-700">隊名</label>
                <input
                  name="team_name"
                  className="w-full border border-gray-400 bg-white text-gray-800 px-2 py-1 mb-3"
                  required
                  value={editData.team_name}
                  onChange={e => setEditData({ ...editData, team_name: e.target.value })}
                />


                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditDialogOpen(false)}
                    className="px-3 py-1 bg-gray-300 rounded"
                  >
                    取消
                  </button>
                  <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">
                    更新
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </nav>
  )
}
