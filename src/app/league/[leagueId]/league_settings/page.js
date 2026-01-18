'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LeagueSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.leagueId;

  const [leagueSettings, setLeagueSettings] = useState(null);
  const [categoryWeights, setCategoryWeights] = useState({ batter: {}, pitcher: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [leagueStatus, setLeagueStatus] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (!leagueId) return;

    const fetchLeagueSettings = async () => {
      setLoading(true);
      setError('');

      try {
        // 獲取聯盟設定
        const response = await fetch(`/api/league/${leagueId}`);
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Failed to load league settings');
          return;
        }

        if (result.success) {
          setLeagueSettings(result.league);
          setLeagueStatus(result.status || 'unknown');
          
          // 獲取當前用戶的權限
          const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
          const currentUserId = cookie?.split('=')[1];
          if (currentUserId) {
            const currentMember = result.members?.find(m => m.manager_id === currentUserId);
            setCurrentUserRole(currentMember?.role || 'Member');
          }

          // 如果是 Fantasy Points，載入權重
          if (result.league?.scoring_type === 'Head-to-Head Fantasy Points') {
            fetchCategoryWeights();
          }
        } else {
          setError('Failed to load league settings');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    const fetchCategoryWeights = async () => {
      try {
        const response = await fetch(`/api/league-settings/weights?league_id=${leagueId}`);
        const result = await response.json();
        console.log('📊 Weight API Response:', result);
        if (result.success && result.data) {
          const batterWeights = {};
          const pitcherWeights = {};
          result.data.forEach(w => {
            if (w.category_type === 'batter') {
              batterWeights[w.category_name] = w.weight;
            } else if (w.category_type === 'pitcher') {
              pitcherWeights[w.category_name] = w.weight;
            }
          });
          console.log('⚾ Batter Weights:', batterWeights);
          console.log('⚾ Pitcher Weights:', pitcherWeights);
          setCategoryWeights({ batter: batterWeights, pitcher: pitcherWeights });
        }
      } catch (err) {
        console.error('Failed to fetch category weights:', err);
      }
    };

    fetchLeagueSettings();
  }, [leagueId]);

  const canEdit = () => {
    return (currentUserRole === 'Commissioner' || currentUserRole === 'Co-Commissioner') && leagueStatus === 'pre-draft';
  };

  const handleEditClick = () => {
    router.push(`/league/${leagueId}/edit_league_settings`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-xl text-purple-300">Loading league settings...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 backdrop-blur-lg border border-red-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="text-xl text-red-300">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!leagueSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="text-xl text-purple-300">League settings not found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
              League Settings
            </h1>
            <p className="text-purple-300/70">{leagueSettings.league_name}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => router.push(`/league/${leagueId}`)}
              className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to League
            </button>
            {canEdit() && (
              <button
                onClick={handleEditClick}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Settings
              </button>
            )}
          </div>
        </div>

        {/* Settings Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Settings */}
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600/80 to-pink-600/80 backdrop-blur-sm p-5 border-b border-purple-400/30">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                General Settings
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-purple-500/20">
                <span className="text-purple-300/70 font-medium">League Name</span>
                <span className="text-white font-semibold">{leagueSettings.league_name}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-purple-500/20">
                <span className="text-purple-300/70 font-medium">Scoring Type</span>
                <span className="text-white font-semibold">{leagueSettings.scoring_type}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-purple-500/20">
                <span className="text-purple-300/70 font-medium">Draft Type</span>
                <span className="text-white font-semibold">{leagueSettings.draft_type}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-purple-500/20">
                <span className="text-purple-300/70 font-medium">Max Teams</span>
                <span className="text-white font-semibold">{leagueSettings.max_teams}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-purple-500/20">
                <span className="text-purple-300/70 font-medium">Invite Permissions</span>
                <span className="text-white font-semibold capitalize">{leagueSettings.invite_permissions?.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-purple-300/70 font-medium">League Status</span>
                <span className={`font-bold px-3 py-1 rounded-full text-sm ${
                  leagueStatus === 'pre-draft' ? 'bg-blue-500/30 text-blue-300' :
                  leagueStatus === 'drafting' ? 'bg-yellow-500/30 text-yellow-300' :
                  leagueStatus === 'in-season' ? 'bg-green-500/30 text-green-300' :
                  'bg-gray-500/30 text-gray-300'
                }`}>
                  {leagueStatus.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Roster Settings */}
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600/80 to-cyan-600/80 backdrop-blur-sm p-5 border-b border-blue-400/30">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Roster Positions
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {leagueSettings.roster_positions && Object.entries(leagueSettings.roster_positions).map(([position, count]) => (
                  count > 0 && (
                    <div key={position} className="flex justify-between items-center py-2 px-4 bg-slate-900/40 rounded-lg border border-purple-500/20">
                      <span className="text-white font-semibold">{position}</span>
                      <span className="text-purple-300 font-bold">{count}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>

          {/* Batter Categories */}
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-600/80 to-emerald-600/80 backdrop-blur-sm p-5 border-b border-green-400/30">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Batter Categories
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {leagueSettings.batter_stat_categories && leagueSettings.batter_stat_categories.length > 0 ? (
                  leagueSettings.batter_stat_categories.map((cat, index) => (
                    <div key={index} className="flex justify-between items-center py-3 px-4 bg-slate-900/40 rounded-lg border border-purple-500/20 hover:border-purple-400/40 transition-colors">
                      <span className="text-white font-semibold">{cat}</span>
                      {leagueSettings.scoring_type === 'Head-to-Head Fantasy Points' && (
                        <span className="text-purple-300 text-sm">
                          Weight: <span className="font-bold text-white">{categoryWeights.batter[cat] || 'N/A'}</span>
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-purple-300/50 text-center py-8">No batter categories selected</div>
                )}
              </div>
            </div>
          </div>

          {/* Pitcher Categories */}
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600/80 to-red-600/80 backdrop-blur-sm p-5 border-b border-orange-400/30">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Pitcher Categories
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {leagueSettings.pitcher_stat_categories && leagueSettings.pitcher_stat_categories.length > 0 ? (
                  leagueSettings.pitcher_stat_categories.map((cat, index) => (
                    <div key={index} className="flex justify-between items-center py-3 px-4 bg-slate-900/40 rounded-lg border border-purple-500/20 hover:border-purple-400/40 transition-colors">
                      <span className="text-white font-semibold">{cat}</span>
                      {leagueSettings.scoring_type === 'Head-to-Head Fantasy Points' && (
                        <span className="text-purple-300 text-sm">
                          Weight: <span className="font-bold text-white">{categoryWeights.pitcher[cat] || 'N/A'}</span>
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-purple-300/50 text-center py-8">No pitcher categories selected</div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden lg:col-span-2">
            <div className="bg-gradient-to-r from-indigo-600/80 to-purple-600/80 backdrop-blur-sm p-5 border-b border-indigo-400/30">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Additional Settings
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-slate-900/40 rounded-lg p-4 border border-purple-500/20">
                  <div className="text-purple-300/70 text-sm mb-2">Trade End Date</div>
                  <div className="text-white font-semibold">{leagueSettings.trade_end_date || 'Not set'}</div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-4 border border-purple-500/20">
                  <div className="text-purple-300/70 text-sm mb-2">Max Acquisitions/Week</div>
                  <div className="text-white font-semibold">{leagueSettings.max_acquisitions_per_week || 'Unlimited'}</div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-4 border border-purple-500/20">
                  <div className="text-purple-300/70 text-sm mb-2">Min IP per Week</div>
                  <div className="text-white font-semibold">{leagueSettings.min_innings_pitched_per_week || '0'}</div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-4 border border-purple-500/20">
                  <div className="text-purple-300/70 text-sm mb-2">Trade Review</div>
                  <div className="text-white font-semibold">{leagueSettings.trade_review || 'Not set'}</div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-4 border border-purple-500/20">
                  <div className="text-purple-300/70 text-sm mb-2">Playoff Teams</div>
                  <div className="text-white font-semibold">{leagueSettings.playoffs || 'Not set'}</div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-4 border border-purple-500/20">
                  <div className="text-purple-300/70 text-sm mb-2">Publicly Viewable</div>
                  <div className="text-white font-semibold">{leagueSettings.make_league_publicly_viewable || 'No'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Note for non-commissioners */}
        {!canEdit() && (
          <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 backdrop-blur-lg border border-yellow-500/30 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-bold text-yellow-300 mb-2">Viewing Only</h3>
                <p className="text-yellow-200/80">
                  {leagueStatus !== 'pre-draft' 
                    ? 'League settings can only be edited during the pre-draft phase.'
                    : 'Only the Commissioner and Co-Commissioner can edit league settings.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
