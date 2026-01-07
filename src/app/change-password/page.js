'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    const cookieUserId = document.cookie.split('; ').find(row => row.startsWith('user_id='))
    if (!cookieUserId) return
    const id = cookieUserId.split('=')[1]
    setUserId(id)
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (!newPassword || newPassword.length < 6) {
      setError('密碼至少 6 碼')
      return
    }
    if (newPassword !== confirm) {
      setError('密碼不一致')
      return
    }
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, newPassword }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        setError(result.error || '更新失敗')
      } else {
        router.push('/home')
      }
    } catch (e) {
      setError('更新失敗，請稍後再試')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-80">
        <h1 className="text-2xl font-bold mb-4 text-center">變更密碼</h1>
        <input
          className="w-full border p-2 mb-2 rounded"
          type="password"
          placeholder="新密碼（至少 6 碼）"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
        />
        <input
          className="w-full border p-2 mb-4 rounded"
          type="password"
          placeholder="再次輸入新密碼"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />
        <button
          onClick={handleSubmit}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
        >
          送出
        </button>
        {error && <div className="text-red-600 mt-4">⚠️ {error}</div>}
      </div>
    </div>
  )
}
