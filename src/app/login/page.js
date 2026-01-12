'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const cookieUserId = document.cookie.split('; ').find(row => row.startsWith('user_id='))
    if (!cookieUserId) return
    const user_id = cookieUserId.split('=')[1]

    fetch('/api/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id }),
    })
      .then(res => res.json())
      .then(data => {
        if (data?.name) router.push('/home')
      })
      .catch(() => {})
  }, [router])

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-80">
        <h1 className="text-2xl font-bold mb-4 text-center">登入</h1>
        <input
          className="w-full border p-2 mb-2 rounded"
          placeholder="註冊 Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          className="w-full border p-2 mb-4 rounded"
          type="password"
          placeholder="密碼"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          登入
        </button>

        <button
          onClick={() => router.push('/forgot-password')}
          className="w-full mt-3 border text-gray-700 py-2 rounded hover:bg-gray-50"
        >
          忘記密碼
        </button>

        <button
          onClick={() => router.push('/register')}
          className="w-full mt-3 bg-green-500 text-white py-2 rounded hover:bg-green-600"
        >
          註冊新帳號
        </button>

        {error && <div className="text-red-600 mt-4">⚠️ {error}</div>}
      </div>
    </div>
  )
}
