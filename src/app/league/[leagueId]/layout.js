'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';

export default function LeagueLayout({ children }) {
  const params = useParams();
  const pathname = usePathname();
  const leagueId = params.leagueId;
  
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) return;

    const fetchUserRole = async () => {
      try {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const currentUserId = cookie?.split('=')[1];
        
        if (!currentUserId) {
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/league/${leagueId}`);
        const result = await response.json();

        if (result.success && result.members) {
          const currentMember = result.members.find(m => m.manager_id === currentUserId);
          setCurrentUserRole(currentMember?.role || 'member');
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [leagueId]);

  const isActive = (path) => {
    if (path === `/league/${leagueId}`) {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Sub Navigation */}
      {!loading && (currentUserRole === 'Commissioner' || currentUserRole === 'Co-Commissioner') && (
        <div className="sticky top-0 z-40 bg-gradient-to-br from-slate-900/95 via-purple-900/95 to-slate-900/95 backdrop-blur-lg border-b border-purple-500/20 shadow-lg">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <div className="flex items-center gap-1">
              <a
                href={`/league/${leagueId}`}
                className={`flex-1 px-6 py-3 text-center font-semibold rounded-lg transition-all ${
                  isActive(`/league/${leagueId}`)
                    ? 'text-white bg-purple-600/50 shadow-lg shadow-purple-500/30'
                    : 'text-purple-300 hover:text-white hover:bg-purple-600/30'
                }`}
              >
                Overview
              </a>
              <a
                href={`/edit_league_settings/${leagueId}`}
                className={`flex-1 px-6 py-3 text-center font-semibold rounded-lg transition-all ${
                  isActive(`/edit_league_settings/${leagueId}`)
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
