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
        // 顯示成功 Banner，2 秒後導回登入頁面
        setMsg('已發送重設密碼通知，請檢查您的 email')
        setTimeout(() => router.push('/login'), 2000)
      }
    } catch (e) {
      setMsg('重設密碼失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl p-8 w-96">
        <h1 className="text-3xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent mb-6 text-center">忘記密碼</h1>
        <input
          className="w-full bg-slate-800/60 border border-purple-500/30 text-white placeholder-purple-400 p-3 mb-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          type="email"
          placeholder="請輸入註冊的 email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              發送中...
            </>
          ) : (
            '發送重設'
          )}
        </button>
        <button
          onClick={() => router.push('/login')}
          className="w-full mt-3 bg-slate-800/40 border border-purple-500/30 text-purple-300 hover:bg-slate-700/40 font-semibold py-3 rounded-lg transition-all"
        >
          返回登入
        </button>
        {msg && <div className="text-purple-300 bg-purple-900/30 border border-purple-500/50 rounded-lg p-3 mt-4">{msg}</div>}
      </div>
    </div>
  )
}
