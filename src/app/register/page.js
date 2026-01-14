'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleRegister = async () => {
    setError('')

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      
      const result = await res.json()
      
      if (!res.ok || result.error) {
        setError(result.error || 'Registration failed')
      } else {
        // Registration successful, show success message
        setSuccess(true)
        setLoading(false)
        // Redirect to login after 5 seconds
        setTimeout(() => {
          router.push('/login?registered=true')
        }, 5000)
        return
      }
    } catch (err) {
      setError('Registration error, please try again later')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl p-8 w-96">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Registration Successful! 🎉</h1>
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4">
              <p className="text-blue-200 text-lg font-semibold mb-2">📧 Check Your Email</p>
              <p className="text-blue-300 text-sm">We&apos;ve sent a verification link to <strong>{email}</strong></p>
            </div>
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
              <p className="text-yellow-200 text-sm">⚠️ Please verify your email before signing in</p>
              <p className="text-yellow-300 text-xs mt-1">The verification link will expire in 24 hours</p>
            </div>
            <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-4">
              <p className="text-purple-300 text-sm">Redirecting to login page in 5 seconds...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl p-8 w-96">
        <h1 className="text-3xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent mb-6 text-center">Create Account</h1>
        
        <input
          className="w-full bg-slate-800/60 border border-purple-500/30 text-white placeholder-purple-400 p-3 mb-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={loading}
        />
        
        <input
          className="w-full bg-slate-800/60 border border-purple-500/30 text-white placeholder-purple-400 p-3 mb-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={loading}
        />
        
        <input
          className="w-full bg-slate-800/60 border border-purple-500/30 text-white placeholder-purple-400 p-3 mb-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          type="password"
          placeholder="Password (at least 6 characters)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={loading}
        />
        
        <input
          className="w-full bg-slate-800/60 border border-purple-500/30 text-white placeholder-purple-400 p-3 mb-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          disabled={loading}
        />
        
        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-green-500/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              Registering...
            </>
          ) : (
            'Register'
          )}
        </button>

        <button
          onClick={() => router.push('/login')}
          disabled={loading}
          className="w-full mt-3 bg-slate-800/40 border border-purple-500/30 text-purple-300 hover:bg-slate-700/40 font-semibold py-3 rounded-lg transition-all disabled:opacity-60"
        >
          Already have an account? Sign In
        </button>

        {error && (
          <div className="text-red-400 bg-red-900/30 border border-red-500/50 rounded-lg p-3 mt-4">
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  )
}
