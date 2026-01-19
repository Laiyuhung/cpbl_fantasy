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
  const [deleting, setDeleting] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [currentNickname, setCurrentNickname] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [updatingPermissions, setUpdatingPermissions] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', description: '', updatedMember: null });
  const [currentUserId, setCurrentUserId] = useState('');

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
          setMembers(result.members || []);
          
          // 獲取當前用戶的權限
          const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
          const currentUserId = cookie?.split('=')[1];
          if (currentUserId) {
            setCurrentUserId(currentUserId);
            const currentMember = result.members?.find(m => m.manager_id === currentUserId);
            setCurrentUserRole(currentMember?.role || 'member');
            setCurrentNickname(currentMember?.nickname || '');
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

  const handleEditNickname = () => {
    setNewNickname(currentNickname);
    setShowNicknameModal(true);
  };

  const handleSaveNickname = async () => {
    const trimmedNickname = newNickname.trim();
    
    if (!trimmedNickname) {
      alert('❌ Nickname cannot be empty\n\nPlease enter a valid nickname.');
      return;
    }

    if (trimmedNickname === currentNickname) {
      setShowNicknameModal(false);
      return;
    }

    if (trimmedNickname.length < 2) {
      alert('❌ Nickname too short\n\nNickname must be at least 2 characters long.');
      return;
    }

    setEditingNickname(true);
    try {
      const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
      const managerId = cookie?.split('=')[1];

      const response = await fetch(`/api/league/${leagueId}/member`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          manager_id: managerId,
          nickname: newNickname.trim()
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setCurrentNickname(newNickname.trim());
        setShowNicknameModal(false);
        alert(`✅ Nickname Updated Successfully!\n\nYour new nickname: "${newNickname.trim()}"\n\nThe page will refresh to show your changes.`);
        // Refresh the page to show updated nickname
        window.location.reload();
      } else {
        alert(`❌ Failed to Update Nickname\n\n${result.error || 'An error occurred. Please try again.'}`);
      }
    } catch (err) {
      console.error('Update nickname error:', err);
      alert('❌ Connection Error\n\nUnable to connect to the server. Please check your internet connection and try again.');
    } finally {
      setEditingNickname(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const handleManagePermissions = () => {
    setShowPermissionsModal(true);
  };

  const handleUpdateMemberRole = async (managerId, newRole) => {
    setUpdatingPermissions(true);
    try {
      const response = await fetch(`/api/league/${leagueId}/member/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          manager_id: managerId,
          role: newRole
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update local member list
        const updatedMember = members.find(m => m.manager_id === managerId);
        setMembers(prevMembers => 
          prevMembers.map(m => 
            m.manager_id === managerId ? { ...m, role: newRole } : m
          )
        );
        
        // Show success notification
        setSuccessMessage({
          title: 'Permission Updated Successfully!',
          description: `${updatedMember?.nickname || updatedMember?.managers?.name || 'Member'}'s role has been changed to ${newRole}`,
          updatedMember: { ...updatedMember, role: newRole }
        });
        setShowSuccessNotification(true);
        
        // Auto hide after 4 seconds
        setTimeout(() => {
          setShowSuccessNotification(false);
        }, 4000);
      } else {
        alert(`❌ Failed to Update Permission\n\n${result.error || 'An error occurred. Please try again.'}`);
      }
    } catch (err) {
      console.error('Update role error:', err);
      alert('❌ 連線錯誤\n\n無法連接伺服器，請檢查網路連線');
    } finally {
      setUpdatingPermissions(false);
    }
  };

  const handleConfirmDelete = async () => {
    const isCommissioner = currentUserRole === 'Commissioner';
    const confirmText = isCommissioner 
      ? 'I agree to delete this league'
      : 'I agree to leave this league';

    if (deleteConfirmText !== confirmText) {
      return;
    }

    setDeleting(true);
    try {
      if (isCommissioner) {
        // Delete entire league
        const response = await fetch(`/api/league/${leagueId}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setShowDeleteModal(false);
          router.push('/home');
        } else {
          setDeleting(false);
          alert(`❌ Failed to Delete League\n\n${result.error || 'An error occurred. Please try again.'}`);
        }
      } else {
        // Delete team/member
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const managerId = cookie?.split('=')[1];

        const response = await fetch(`/api/league/${leagueId}/member`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ manager_id: managerId }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setShowDeleteModal(false);
          router.push('/home');
        } else {
          setDeleting(false);
          alert(`❌ Failed to Leave League\n\n${result.error || 'An error occurred. Please try again.'}`);
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
      setDeleting(false);
      alert('❌ Connection Error\n\nUnable to connect to the server. Please check your internet connection and try again.');
    } finally {
      setDeleting(false);
    }
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
            {(currentUserRole === 'Commissioner' || currentUserRole === 'Co-Commissioner') && (
              <button
                onClick={handleManagePermissions}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Manage Permissions
              </button>
            )}
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
            <button
              onClick={handleEditNickname}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Nickname
            </button>
            {leagueStatus === 'pre-draft' && (
              <button
                onClick={handleDeleteClick}
                disabled={deleting}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deleting ? 'Deleting...' : (currentUserRole === 'Commissioner' ? 'Delete League' : 'Delete Team')}
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

      {/* Nickname Edit Modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-white">Edit Nickname</h2>
            </div>
            
            <div className="bg-slate-900/50 border border-blue-500/20 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <label className="text-blue-300 text-sm font-medium">
                  Current Nickname
                </label>
              </div>
              <p className="text-white font-bold text-lg ml-6">{currentNickname}</p>
            </div>

            <div className="mb-6">
              <label className="block text-cyan-300 text-sm font-medium mb-2">
                New Nickname
              </label>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                maxLength={50}
                placeholder="Enter your new nickname..."
                className="w-full px-4 py-3 bg-slate-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-cyan-300/40 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                autoFocus
              />
              <div className="flex justify-between items-center mt-2">
                <div className="flex flex-col gap-1">
                  <p className={`text-xs transition-colors ${
                    newNickname.trim().length < 2 
                      ? 'text-red-400 font-medium' 
                      : newNickname.trim().length > 50 
                      ? 'text-red-400 font-medium'
                      : 'text-cyan-300/70'
                  }`}>
                    {newNickname.trim().length < 2 ? '⚠️ Minimum 2 characters' : '✓ Valid length'}
                  </p>
                </div>
                <p className={`text-xs font-medium ${
                  newNickname.length > 40 
                    ? 'text-orange-400' 
                    : newNickname.length > 45 
                    ? 'text-red-400'
                    : 'text-cyan-300/70'
                }`}>
                  {newNickname.length}/50
                </p>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-6">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-blue-300/90 text-xs">
                  <p className="font-medium mb-1">Nickname Guidelines:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-300/70">
                    <li>Must be 2-50 characters long</li>
                    <li>Will be visible to all league members</li>
                    <li>Can be changed anytime</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNicknameModal(false)}
                disabled={editingNickname}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNickname}
                disabled={editingNickname || !newNickname.trim() || newNickname.trim().length < 2 || newNickname.trim() === currentNickname}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {editingNickname ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {showSuccessNotification && (
        <div className="fixed top-6 right-6 z-[60] animate-slide-in-right">
          <div className="bg-gradient-to-br from-green-600/95 to-emerald-600/95 backdrop-blur-xl border border-green-400/30 rounded-2xl shadow-2xl p-6 max-w-md transform transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="bg-white/20 p-3 rounded-full animate-bounce-once">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl font-black text-white mb-1">
                  {successMessage.title}
                </h3>
                <p className="text-green-50/90 text-sm mb-3">
                  {successMessage.description}
                </p>
                {successMessage.updatedMember && (
                  <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${
                        successMessage.updatedMember.role === 'Co-Commissioner'
                          ? 'bg-purple-400/30'
                          : 'bg-blue-400/30'
                      }`}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">
                          {successMessage.updatedMember.nickname || successMessage.updatedMember.managers?.name}
                        </p>
                        <p className="text-green-50/70 text-xs">
                          New Role: <span className="font-semibold text-white">{successMessage.updatedMember.role}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowSuccessNotification(false)}
                className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/60 rounded-full animate-progress-bar" style={{ animationDuration: '4s' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Management Modal */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-purple-500 to-indigo-500 p-3 rounded-xl">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-white">Manage Member Permissions</h2>
              </div>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="text-purple-300 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-indigo-300/90 text-sm">
                  <p className="font-medium mb-1">Permission Roles:</p>
                  <ul className="list-disc list-inside space-y-1 text-indigo-300/70">
                    <li><strong>Commissioner</strong>: League creator with full permissions (cannot be changed)</li>
                    <li><strong>Co-Commissioner</strong>: Assistant admin who can help manage league settings</li>
                    <li><strong>Member</strong>: Regular member who can only manage their own team</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {members
                .sort((a, b) => {
                  const roleOrder = { 'Commissioner': 0, 'Co-Commissioner': 1, 'member': 2 };
                  return roleOrder[a.role] - roleOrder[b.role];
                })
                .map((member) => {
                  const isCommissioner = member.role === 'Commissioner';
                  const isSelf = member.manager_id === currentUserId;
                  const canModify = !isCommissioner && !isSelf;
                  
                  return (
                    <div
                      key={member.manager_id}
                      className={`bg-slate-900/50 border rounded-lg p-4 transition-all ${
                        isCommissioner 
                          ? 'border-yellow-500/30 bg-yellow-500/5' 
                          : 'border-purple-500/20 hover:border-purple-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`p-2 rounded-lg ${
                            member.role === 'Commissioner' 
                              ? 'bg-yellow-500/20' 
                              : member.role === 'Co-Commissioner'
                              ? 'bg-purple-500/20'
                              : 'bg-blue-500/20'
                          }`}>
                            <svg className={`w-5 h-5 ${
                              member.role === 'Commissioner' 
                                ? 'text-yellow-400' 
                                : member.role === 'Co-Commissioner'
                                ? 'text-purple-400'
                                : 'text-blue-400'
                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-bold">{member.nickname || member.managers?.name || 'Unknown'}</p>
                              {isSelf && (
                                <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded-full font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-purple-300/60 text-sm">{member.managers?.name || 'No manager name'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {canModify ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleUpdateMemberRole(member.manager_id, e.target.value)}
                              disabled={updatingPermissions}
                              className="bg-slate-900/70 border border-purple-500/30 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              <option value="member">Member</option>
                              <option value="Co-Commissioner">Co-Commissioner</option>
                            </select>
                          ) : isCommissioner ? (
                            <div className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 px-4 py-2 rounded-lg font-bold">
                              Commissioner
                            </div>
                          ) : (
                            <div className="bg-slate-700/50 border border-slate-500/30 text-slate-300 px-4 py-2 rounded-lg font-medium flex items-center gap-2">
                              {member.role === 'Co-Commissioner' ? 'Co-Commissioner' : 'Member'}
                              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {updatingPermissions && (
              <div className="mt-4 flex items-center justify-center gap-2 text-purple-300">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Updating permissions...</span>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-6 py-3 rounded-lg transition-all shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (() => {
        const isCommissioner = currentUserRole === 'Commissioner';
        const confirmText = isCommissioner 
          ? 'I agree to delete this league'
          : 'I agree to leave this league';
        const isValid = deleteConfirmText === confirmText;

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-red-500/50 rounded-2xl shadow-2xl max-w-lg w-full p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-red-600 to-red-700 p-3 rounded-xl animate-pulse">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-red-400">
                    {isCommissioner ? '⚠️ DELETE LEAGUE' : '⚠️ LEAVE LEAGUE'}
                  </h2>
                  <p className="text-red-300/70 text-sm font-medium">This action cannot be undone</p>
                </div>
              </div>

              {/* Warning Content */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <h3 className="text-red-300 font-bold mb-3">
                  {isCommissioner 
                    ? '🔥 This will permanently remove:' 
                    : '📤 You will:'}
                </h3>
                <ul className="space-y-2 text-red-200/90">
                  {isCommissioner ? (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>All league settings and data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>All members and their teams</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>All schedules and records</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>All statistical category weights</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Be removed from the league immediately</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Lose access to all league data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Need to be re-invited to join again</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {/* Confirmation Input */}
              <div className="mb-6">
                <label className="block text-red-300 font-bold mb-3">
                  Type the following to confirm:
                </label>
                <div className="bg-slate-900/50 border border-red-500/30 rounded-lg p-3 mb-3">
                  <code className="text-white font-mono text-sm">{confirmText}</code>
                </div>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type here..."
                  className="w-full px-4 py-3 bg-slate-900/50 border border-red-500/30 rounded-lg text-white placeholder-red-300/40 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all font-mono"
                  autoFocus
                />
                {deleteConfirmText && !isValid && (
                  <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Text does not match
                  </p>
                )}
                {isValid && (
                  <p className="text-green-400 text-sm mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirmed
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                  }}
                  disabled={deleting}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={!isValid || deleting}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isCommissioner ? 'Deleting...' : 'Leaving...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {isCommissioner ? 'Delete League' : 'Leave League'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
