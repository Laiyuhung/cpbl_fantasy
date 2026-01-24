'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';

export default function LeagueLayout({ children }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const leagueId = params.leagueId;

  const [currentUserRole, setCurrentUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!leagueId) return;

    // 如果是 join 頁面，不需要檢查權限
    if (pathname.includes('/join')) {
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const currentUserId = cookie?.split('=')[1];

        if (!currentUserId) {
          setAccessDenied(true);
          setError('Please log in to view this league');
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/league/${leagueId}`);
        const result = await response.json();

        if (result.success && result.members) {
          const isMember = result.members.some(m => m.manager_id === currentUserId);

          if (!isMember) {
            setAccessDenied(true);
            setError('Access Denied: You are not a member of this league');
            setLoading(false);
            return;
          }

          const currentMember = result.members.find(m => m.manager_id === currentUserId);
          setCurrentUserRole(currentMember?.role || 'member');
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
        setError('Failed to verify access');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [leagueId, pathname]);

  const isActive = (path) => {
    if (path === `/league/${leagueId}`) {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl text-purple-300">Loading...</div>
        </div>
      </div>
    );
  }

  // Access denied state
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 backdrop-blur-lg border border-red-500/30 rounded-2xl p-8 shadow-2xl max-w-md">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div className="text-xl font-bold text-red-300 mb-2">{error}</div>
            <div className="mt-4">
              <a
                href="/home"
                className="inline-block bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Back to Home
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Sub Navigation */}
      {!pathname.includes('/join') && (
        <div className="sticky top-0 z-40 bg-gradient-to-br from-slate-900/95 via-purple-900/95 to-slate-900/95 backdrop-blur-lg border-b border-purple-500/20 shadow-lg">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <div className="flex items-center gap-1">
              <a
                href={`/league/${leagueId}`}
                className={`flex-1 px-6 py-3 text-center font-semibold rounded-lg transition-all ${isActive(`/league/${leagueId}`) && !pathname.includes('/league_settings') && !pathname.includes('/edit_league_settings') && !pathname.includes('/players') && !pathname.includes('/roster')
                    ? 'text-white bg-purple-600/50 shadow-lg shadow-purple-500/30'
                    : 'text-purple-300 hover:text-white hover:bg-purple-600/30'
                  }`}
              >
                Overview
              </a>
              <a
                href={`/league/${leagueId}/players`}
                className={`flex-1 px-6 py-3 text-center font-semibold rounded-lg transition-all ${pathname.includes('/players')
                    ? 'text-white bg-purple-600/50 shadow-lg shadow-purple-500/30'
                    : 'text-purple-300 hover:text-white hover:bg-purple-600/30'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Players
                </div>
              </a>
              <a
                href={`/league/${leagueId}/roster`}
                className={`flex-1 px-6 py-3 text-center font-semibold rounded-lg transition-all ${pathname.includes('/roster')
                    ? 'text-white bg-purple-600/50 shadow-lg shadow-purple-500/30'
                    : 'text-purple-300 hover:text-white hover:bg-purple-600/30'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  My Roster
                </div>
              </a>
              <a
                href={`/league/${leagueId}/league_settings`}
                className={`flex-1 px-6 py-3 text-center font-semibold rounded-lg transition-all ${pathname.includes('/league_settings') || pathname.includes('/edit_league_settings')
                    ? 'text-white bg-purple-600/50 shadow-lg shadow-purple-500/30'
                    : 'text-purple-300 hover:text-white hover:bg-purple-600/30'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  League Settings
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      {children}
    </div>
  );
}
