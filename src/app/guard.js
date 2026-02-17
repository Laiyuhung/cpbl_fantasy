'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default function GuardLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const redirectingRef = useRef(false)

  const [emailVerified, setEmailVerified] = useState(true)
  const [isRestricted, setIsRestricted] = useState(false)

  useEffect(() => {
    // 避免重複重定向
    if (redirectingRef.current) return

    const loggedIn = document.cookie.includes('user_id=')
    setIsLoggedIn(loggedIn)
    setIsReady(true)

    // Pages that don't require login (whitelist)
    const publicPages = [
      '/login',
      '/register',
      '/forgot-password',
      '/verify-email',
    ]

    const pathIsProfile = pathname === '/profile'
    const isPublicPage = publicPages.includes(pathname) || pathname.match(/^\/league\/[^\/]+\/join$/)

    if (!loggedIn && !isPublicPage) {
      redirectingRef.current = true
      router.push('/login')
      return;
    } else if (loggedIn && pathname === '/login') {
      redirectingRef.current = true
      router.push('/home')
      return;
    }

    const checkVerificationStatus = () => {
      const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
      const uid = cookie?.split('=')[1];
      if (uid) {
        fetch('/api/username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: uid }),
        })
          .then(res => res.json())
          .then(data => {
            if (data && typeof data.email_verified !== 'undefined') {
              setEmailVerified(data.email_verified);
              // If not verified and NOT on profile page
              if (!data.email_verified && !pathIsProfile) {
                setIsRestricted(true);
              } else {
                setIsRestricted(false);
              }
            }
          })
          .catch(() => { });
      }
    };

    if (loggedIn) {
      checkVerificationStatus();

      // Listen for auth changes (e.g. verified in another tab or this tab)
      window.addEventListener('auth-changed', checkVerificationStatus);
      window.addEventListener('storage', checkVerificationStatus);
    } else {
      setIsRestricted(false);
    }

    return () => {
      window.removeEventListener('auth-changed', checkVerificationStatus);
      window.removeEventListener('storage', checkVerificationStatus);
    };
  }, [pathname, router])

  if (!isReady) return null

  const showNavbar = isLoggedIn && pathname !== '/login'

  return (
    <>
      {showNavbar && <Navbar />}

      {/* Blurred Overlay for Unverified Users */}
      {isRestricted && (
        <div className="fixed inset-0 z-[100] backdrop-blur-xl bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Email Verification Required</h2>
            <p className="text-slate-400 mb-8">
              Please verify your email address to access the full features of CPBL Fantasy. Check your inbox for the verification link.
            </p>
            <button
              onClick={() => router.push('/profile')}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25"
            >
              Go to Profile Settings
            </button>
          </div>
        </div>
      )}

      {children}
    </>
  )
}
