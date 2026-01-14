'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
      setError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, newPassword }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        setError(result.error || 'Failed to update password')
      } else {
        router.push('/home')
      }
    } catch (e) {
      setError('Failed to update password. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl p-8 w-96">
        <h1 className="text-3xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent mb-6 text-center">Change Password</h1>
        <input
          className="w-full bg-slate-800/60 border border-purple-500/30 text-white placeholder-purple-400 p-3 mb-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          type="password"
          placeholder="New Password (at least 6 characters)"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          disabled={loading}
        />
        <input
          className="w-full bg-slate-800/60 border border-purple-500/30 text-white placeholder-purple-400 p-3 mb-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          type="password"
          placeholder="Confirm New Password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
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
              Updating...
            </>
          ) : (
            'Update Password'
          )}
        </button>
        {error && (
          <div className="text-red-300 bg-red-900/30 border border-red-500/50 rounded-lg p-3 mt-4 flex items-start">
            <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
