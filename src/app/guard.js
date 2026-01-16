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
    
    // Check if current page is public or is a join league page
    const isPublicPage = publicPages.includes(pathname) || pathname.match(/^\/league\/[^\/]+\/join$/)

    if (!loggedIn && !isPublicPage) {
      redirectingRef.current = true
      router.push('/login')
    } else if (loggedIn && pathname === '/login') {
      redirectingRef.current = true
      router.push('/home')
    }
  }, [pathname, router])

  if (!isReady) return null

  const showNavbar = isLoggedIn && pathname !== '/login'

  return (
    <>
      {showNavbar && <Navbar />}
      {children}
    </>
  )
}
