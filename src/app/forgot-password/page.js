'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    setMsg('')
    if (!email) {
      setMsg('請輸入 email')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        setMsg(result.error || '重設密碼失敗')
      } else {
        setMsg('已發送重設密碼通知，請檢查您的 email')
      }
    } catch (e) {
      setMsg('重設密碼失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-80">
        <h1 className="text-2xl font-bold mb-4 text-center">忘記密碼</h1>
        <input
          className="w-full border p-2 mb-2 rounded"
          type="email"
          placeholder="請輸入註冊的 email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          發送重設
        </button>
        <button
          onClick={() => router.push('/login')}
          className="w-full mt-3 border text-gray-700 py-2 rounded hover:bg-gray-50"
        >
          返回登入
        </button>
        {msg && <div className="text-gray-700 mt-4">{msg}</div>}
      </div>
    </div>
  )
}
