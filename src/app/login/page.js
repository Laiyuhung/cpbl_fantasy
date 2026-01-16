'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    // 避免重複重定向檢查
    if (isRedirecting) return

    const cookieUserId = document.cookie.split('; ').find(row => row.startsWith('user_id='))
    if (!cookieUserId) return
    const user_id = cookieUserId.split('=')[1]

    // 使用 timeout 避免與 guard.js 的重定向衝突
    const timeoutId = setTimeout(() => {
      fetch('/api/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
      })
        .then(res => res.json())
        .then(data => {
          if (data?.name && !isRedirecting) {
            setIsRedirecting(true)
            router.push('/home')
          }
        })
        .catch(() => {})
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [router, isRedirecting])

  const handleLogin = async () => {
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // ✅ 必加這行才能接受 Set-Cookie
        body: JSON.stringify({ email, password }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        setError(result.error || '登入失敗')
      } else {
        // 若伺服器要求強制更改密碼 -> 導到 change-password
        // 通知全站 auth 狀態已改變，讓 Navbar 等元件立即更新
        try { window.dispatchEvent(new Event('auth-changed')) } catch (e) {}
        if (result.must_change_password) {
          router.push('/change-password')
        } else {
          router.push('/home')
        }
      }
    } catch (err) {
      setError('登入錯誤，請稍後再試')
    }
  }

  // forgot handled on separate page

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl p-8 w-96">
        <h1 className="text-3xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent mb-6 text-center">Sign In</h1>
        <input
          className="w-full bg-slate-800/60 border border-purple-500/30 text-white placeholder-purple-400 p-3 mb-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="w-full bg-slate-800/60 border border-purple-500/30 text-white placeholder-purple-400 p-3 mb-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button
          onClick={handleLogin}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-purple-500/50"
        >
          Sign In
        </button>

        <button
          onClick={() => router.push('/forgot-password')}
          className="w-full mt-3 bg-slate-800/40 border border-purple-500/30 text-purple-300 hover:bg-slate-700/40 font-semibold py-3 rounded-lg transition-all"
        >
          Forgot Password?
        </button>

        <button
          onClick={() => router.push('/register')}
          className="w-full mt-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-green-500/50"
        >
          Create New Account
        </button>

        {error && <div className="text-red-400 bg-red-900/30 border border-red-500/50 rounded-lg p-3 mt-4">⚠️ {error}</div>}
      </div>
    </div>
  )
}
