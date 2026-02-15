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


      {/* Page Content */}
      {children}
    </div>
  );
}
