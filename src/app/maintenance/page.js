'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MaintenancePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check maintenance status and admin status
  useEffect(() => {
    let isMounted = true;
    let checkInterval;

    const checkStatus = async () => {
      try {
        // Check maintenance status
        const mainRes = await fetch('/api/system-settings/maintenance');
        const mainData = await mainRes.json();

        if (!isMounted) return;

        // If maintenance is disabled, redirect back
        if (!mainData.underMaintenance) {
          router.push('/home');
          return;
        }

        // Check if user is admin
        const userIdCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('user_id='));
        const userId = userIdCookie?.split('=')[1];

        if (userId) {
          try {
            const userRes = await fetch(`/api/admin/check?userId=${userId}`);
            const userData = await userRes.json();
            if (isMounted && userData.isAdmin) {
              setIsAdmin(true);
            }
          } catch (e) {
            console.error('Error checking admin status:', e);
          }
        }

        if (isMounted) {
          setCheckingStatus(false);
        }
      } catch (e) {
        console.error('Error checking status:', e);
        if (isMounted) {
          setCheckingStatus(false);
        }
      }
    };

    checkStatus();

    // Poll every 10 seconds to check if maintenance is over
    checkInterval = setInterval(checkStatus, 10000);

    return () => {
      isMounted = false;
      clearInterval(checkInterval);
    };
  }, [router]);

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full"></div>
          </div>
          <p className="mt-4 text-slate-400">Checking status...</p>
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
              <svg
                className="w-10 h-10 text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4v2m0 4v2m6-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Under Maintenance
          </h1>

          {/* Message */}
          <p className="text-xl text-orange-200 mb-8">
            We&apos;re currently performing system maintenance to improve your experience.
            We should be back online shortly!
          </p>

          {/* Spinner */}
          <div className="flex justify-center mb-8">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>

          {/* Status */}
          <p className="text-sm text-slate-400 mb-8">
            We&apos;re automatically checking if the system is back online...
          </p>

          {/* Admin Info */}
          {isAdmin && (
            <div className="mt-12 pt-8 border-t border-orange-500/30">
              <p className="text-purple-300 text-sm font-bold mb-4">
                ADMIN PANEL
              </p>
              <button
                onClick={() => router.push('/admin')}
                className="inline-block px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg border border-purple-400/30 shadow-lg shadow-purple-500/30 transition-all duration-300"
              >
                Go to Admin Panel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
