'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default function GuardLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
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
      router.push('/login')
    } else if (loggedIn && pathname === '/login') {
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
