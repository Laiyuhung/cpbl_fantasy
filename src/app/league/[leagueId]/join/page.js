'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function JoinLeaguePage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.leagueId;

  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Processing your request...');

  useEffect(() => {
    if (!leagueId) return;

    const joinLeague = async () => {
      try {
        // 获取当前用户的 manager_id
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const managerId = cookie?.split('=')[1];

        if (!managerId) {
          setStatus('error');
          setMessage('Please login first to join a league');
          setTimeout(() => router.push('/login'), 2000);
          return;
        }

        const response = await fetch(`/api/league/${leagueId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ manager_id: managerId }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setStatus('success');
          setMessage('Successfully joined the league!');
          setTimeout(() => router.push(`/league/${leagueId}`), 2000);
        } else {
          setStatus('error');
          setMessage(result.error || 'Failed to join league');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setStatus('error');
        setMessage('An unexpected error occurred');
      }
    };

    joinLeague();
  }, [leagueId, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
      <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-12 shadow-2xl max-w-md w-full">
        {status === 'processing' && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <h2 className="text-2xl font-bold text-white mb-2">Joining League</h2>
            <p className="text-purple-300">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Success!</h2>
            <p className="text-purple-300">{message}</p>
            <p className="text-sm text-purple-400 mt-4">Redirecting to league page...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Oops!</h2>
            <p className="text-red-300">{message}</p>
            <button
              onClick={() => router.push(`/league/${leagueId}`)}
              className="mt-6 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-full transition-all"
            >
              Go to League Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
