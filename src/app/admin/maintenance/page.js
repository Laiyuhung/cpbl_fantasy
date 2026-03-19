'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MaintenanceSettingsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUnderMaintenance, setIsUnderMaintenance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Check admin access and load settings
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const userIdCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('user_id='));
        const userId = userIdCookie?.split('=')[1];

        if (!userId) {
          router.push('/login');
          return;
        }

        // Check if user is admin
        const adminRes = await fetch(`/api/admin/check?userId=${userId}`);
        const adminData = await adminRes.json();

        if (!adminData.isAdmin) {
          router.push('/home');
          return;
        }

        setIsAdmin(true);

        // Load maintenance status
        const mainRes = await fetch('/api/system-settings/maintenance');
        const mainData = await mainRes.json();

        if (mainData.success) {
          setIsUnderMaintenance(mainData.underMaintenance);
        }
      } catch (e) {
        console.error('Error checking access:', e);
        setError('Failed to verify admin access');
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [router]);

  const handleToggleMaintenance = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const userIdCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('user_id='));
      const userId = userIdCookie?.split('=')[1];

      const res = await fetch('/api/system-settings/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-user-role': 'admin'
        },
        body: JSON.stringify({ underMaintenance: !isUnderMaintenance })
      });

      const data = await res.json();

      if (data.success) {
        setIsUnderMaintenance(data.underMaintenance);
        setMessage(data.message);
      } else {
        setError(data.error || 'Failed to update maintenance status');
      }
    } catch (e) {
      console.error('Error updating maintenance status:', e);
      setError('Error updating maintenance status');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full"></div>
          </div>
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="text-purple-400 hover:text-purple-300 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </button>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-4xl font-black text-white mb-2">System Maintenance</h1>
          <p className="text-slate-300 mb-8">
            Control system-wide maintenance mode. When enabled, all non-admin users will be redirected to a maintenance page.
          </p>

          {/* Current Status */}
          <div className="mb-8 p-6 bg-slate-900/50 rounded-xl border border-slate-700/50">
            <p className="text-slate-400 text-sm font-semibold mb-2">CURRENT STATUS</p>
            <div className="flex items-center gap-4">
              <div
                className={`w-4 h-4 rounded-full ${
                  isUnderMaintenance ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                }`}
              ></div>
              <span className="text-2xl font-bold text-white">
                {isUnderMaintenance ? 'Under Maintenance' : 'System Online'}
              </span>
            </div>
          </div>

          {/* Messages */}
          {message && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
              <p className="text-green-300 font-semibold">{message}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-300 font-semibold">{error}</p>
            </div>
          )}

          {/* Toggle Button */}
          <button
            onClick={handleToggleMaintenance}
            disabled={saving}
            className={`w-full py-4 px-6 rounded-xl font-black text-lg transition-all duration-300 border shadow-lg ${
              isUnderMaintenance
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white border-green-500/30 shadow-green-500/30'
                : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white border-red-500/30 shadow-red-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Updating...
              </span>
            ) : isUnderMaintenance ? (
              'Disable Maintenance Mode'
            ) : (
              'Enable Maintenance Mode'
            )}
          </button>

          {/* Info Box */}
          <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <h3 className="text-blue-300 font-bold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              How it works
            </h3>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>✓ When enabled, all non-admin users are redirected to a maintenance page</li>
              <li>✓ All data fetching (polling) stops immediately in draft and other pages</li>
              <li>✓ Admin users can still access all areas</li>
              <li>✓ System checks for maintenance status every 30 seconds</li>
              <li>✓ Users are automatically redirected back when maintenance ends</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
