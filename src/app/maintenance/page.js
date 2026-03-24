'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MaintenancePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchAllData = async () => {
      try {
        if (!isMounted) return;

        // 1. 檢查管理員身分
        const userIdCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('user_id='));
        const userId = userIdCookie?.split('=')[1];

        if (userId) {
          try {
            const userRes = await fetch('/api/username', { method: 'POST' });
            const userData = await userRes.json();
            if (isMounted && (userData?.is_admin ?? userData?.isAdmin)) setIsAdmin(true);
          } catch (e) { console.error('Admin check error:', e); }
        }

        // 2. 抓取最新公告
        try {
          const annRes = await fetch('/api/announcements');
          const annData = await annRes.json();
          if (isMounted && annData.success) {
            setAnnouncements(Array.isArray(annData.announcements) ? annData.announcements : []);
          }
        } catch (e) { console.error('Announcements error:', e); }

        // 全部抓完，關閉 Loading 狀態
        if (isMounted) setCheckingStatus(false);

      } catch (e) {
        console.error('Fetch error:', e);
        if (isMounted) setCheckingStatus(false);
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, [router]); // 只有在 router 改變時才會重新執行，且內部無定時器

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full"></div>
          </div>
          <p className="mt-4 text-slate-400">Checking system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 backdrop-blur-lg border border-orange-500/30 rounded-3xl p-12 text-center shadow-2xl">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center">
              <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">Under Maintenance</h1>
          <p className="text-xl text-orange-200 mb-8">
            We&apos;re currently performing system maintenance. Please check back later.
          </p>

          {/* 狀態提示改為靜態 */}
          <p className="text-xs text-slate-500 mb-8 uppercase tracking-widest">
            Refresh the page to check if we are back online
          </p>

          {/* 公告 */}
          {announcements.length > 0 && (
            <div className="mt-8 text-left border-t border-orange-500/30 pt-6">
              <h2 className="text-lg font-bold text-orange-200 mb-4">Latest Announcement</h2>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {announcements.slice(0, 3).map((ann) => (
                  <div key={ann.id} className="rounded-xl border border-orange-400/30 bg-orange-900/20 p-4">
                    <p className="text-sm font-bold text-orange-100 mb-1">{ann.title}</p>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{ann.content}</p>
                    <p className="text-xs text-slate-400 mt-2">{new Date(ann.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作按鈕 */}
          <div className="mt-8 pt-6 border-t border-orange-500/30 flex flex-col gap-4 items-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg border border-slate-500/30 transition-all"
            >
              Refresh Status
            </button>
            
            <button
              onClick={() => router.push('/home')}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-lg"
            >
              Back to Home
            </button>

            {isAdmin && (
              <div className="mt-4 pt-4 border-t border-orange-500/10 w-full">
                <button
                  onClick={() => router.push('/admin')}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg shadow-lg shadow-purple-500/30"
                >
                  Go to Admin Panel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
