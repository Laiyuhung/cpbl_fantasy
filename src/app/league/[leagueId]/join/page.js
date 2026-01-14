'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function JoinLeaguePage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.leagueId;

  const [loading, setLoading] = useState(true);
  const [leagueSettings, setLeagueSettings] = useState(null);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinStatus, setJoinStatus] = useState(null); // null, 'success', 'error'
  const [joinMessage, setJoinMessage] = useState('');

  useEffect(() => {
    if (!leagueId) return;

    const fetchLeagueInfo = async () => {
      try {
        // Check if user is logged in
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const managerId = cookie?.split('=')[1];
        setIsLoggedIn(!!managerId);

        // Fetch league settings
        const response = await fetch(`/api/league/${leagueId}`);
        const result = await response.json();

        if (response.ok && result.success) {
          setLeagueSettings(result.league);
        } else {
          setError(result.error || 'Failed to load league information');
        }
      } catch (err) {
        console.error('Error fetching league:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueInfo();
  }, [leagueId]);

  const handleJoin = async () => {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/league/${leagueId}/join`);
      return;
    }

    setJoining(true);
    try {
      const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
      const managerId = cookie?.split('=')[1];

      const response = await fetch(`/api/league/${leagueId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manager_id: managerId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setJoinStatus('success');
        setJoinMessage('Successfully joined the league!');
        setTimeout(() => router.push(`/league/${leagueId}`), 2000);
      } else {
        setJoinStatus('error');
        setJoinMessage(result.error || 'Failed to join league');
      }
    } catch (err) {
      console.error('Error joining league:', err);
      setJoinStatus('error');
      setJoinMessage('An unexpected error occurred');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-12 shadow-2xl">
          <div className="w-20 h-20 mx-auto mb-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-center">Loading league information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 backdrop-blur-lg border border-red-500/30 rounded-2xl p-12 shadow-2xl max-w-md">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
            <p className="text-red-300">{error}</p>
            <button
              onClick={() => router.push('/home')}
              className="mt-6 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-all"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (joinStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-lg border border-green-500/30 rounded-2xl p-12 shadow-2xl max-w-md">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Success! 🎉</h2>
            <p className="text-green-300">{joinMessage}</p>
            <p className="text-sm text-green-400 mt-4">Redirecting to league page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl mb-6">
          <h1 className="text-4xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent mb-2">
            Join League
          </h1>
          <p className="text-purple-300 text-lg">{leagueSettings.league_name}</p>
        </div>

        {/* Login Warning */}
        {!isLoggedIn && (
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 backdrop-blur-lg border border-yellow-500/50 rounded-2xl p-6 shadow-2xl mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-yellow-300 mb-2">⚠️ Please Login First</h3>
                <p className="text-yellow-200 text-sm">You need to be logged in to join this league. The invite link will remain valid after you sign in.</p>
              </div>
            </div>
          </div>
        )}

        {/* Join Error Message */}
        {joinStatus === 'error' && (
          <div className="bg-gradient-to-r from-red-600/20 to-red-800/20 backdrop-blur-lg border border-red-500/50 rounded-2xl p-6 shadow-2xl mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-300 mb-2">Error</h3>
                <p className="text-red-200 text-sm">{joinMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* League Information */}
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-purple-600/80 to-blue-600/80 backdrop-blur-sm p-6 border-b border-purple-400/30">
            <h2 className="text-2xl font-black text-white">League Settings</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/40 border border-purple-500/30 rounded-lg p-4">
                <span className="text-purple-400 text-sm font-medium">League Type</span>
                <p className="text-white text-lg font-bold mt-1">{leagueSettings.league_type || 'N/A'}</p>
              </div>
              <div className="bg-slate-800/40 border border-purple-500/30 rounded-lg p-4">
                <span className="text-purple-400 text-sm font-medium">Max Teams</span>
                <p className="text-white text-lg font-bold mt-1">{leagueSettings.max_teams || 'N/A'}</p>
              </div>
              <div className="bg-slate-800/40 border border-purple-500/30 rounded-lg p-4">
                <span className="text-purple-400 text-sm font-medium">Scoring Type</span>
                <p className="text-white text-lg font-bold mt-1">{leagueSettings.scoring_type || 'N/A'}</p>
              </div>
              <div className="bg-slate-800/40 border border-purple-500/30 rounded-lg p-4">
                <span className="text-purple-400 text-sm font-medium">Draft Type</span>
                <p className="text-white text-lg font-bold mt-1">{leagueSettings.draft_type || 'N/A'}</p>
              </div>
              <div className="bg-slate-800/40 border border-purple-500/30 rounded-lg p-4">
                <span className="text-purple-400 text-sm font-medium">Trade Review Period</span>
                <p className="text-white text-lg font-bold mt-1">{leagueSettings.trade_review_period_days || 0} days</p>
              </div>
              <div className="bg-slate-800/40 border border-purple-500/30 rounded-lg p-4">
                <span className="text-purple-400 text-sm font-medium">Waiver Period</span>
                <p className="text-white text-lg font-bold mt-1">{leagueSettings.waiver_period_days || 0} days</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/home')}
            className="flex-1 bg-slate-800/60 hover:bg-slate-700/60 border border-purple-500/30 text-purple-300 font-bold py-4 rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={joining}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 rounded-lg transition-all shadow-lg hover:shadow-green-500/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {joining ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Joining...
              </>
            ) : isLoggedIn ? (
              '🎯 JOIN LEAGUE'
            ) : (
              '🔐 Login to Join'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
