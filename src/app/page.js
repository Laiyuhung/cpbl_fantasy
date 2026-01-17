'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // 檢查是否已登入
    const isLoggedIn = document.cookie.includes('user_id=')
    
    if (isLoggedIn) {
      router.replace('/home')
    } else {
      router.replace('/login')
    }
  }, [router])

  // 顯示載入畫面避免閃爍
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-xl text-purple-300">Loading...</div>
      </div>
    </div>
  )
}
