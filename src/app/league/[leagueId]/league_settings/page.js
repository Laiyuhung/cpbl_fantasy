'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import supabase from '@/lib/supabase';

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
  const [showFinalizedModal, setShowFinalizedModal] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [updatingFinalized, setUpdatingFinalized] = useState(false);
  const [showDeleteMemberModal, setShowDeleteMemberModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [deletingMember, setDeletingMember] = useState(false);
  const [draftOrder, setDraftOrder] = useState([]);
  const [isDraftOrderOpen, setIsDraftOrderOpen] = useState(false);
  const [hasDraftOrder, setHasDraftOrder] = useState(false);
  const [showGenerateConfirmModal, setShowGenerateConfirmModal] = useState(false); // Confirm modal state


  // Photo Resolution State
  const [photoSrcMap, setPhotoSrcMap] = useState({});
  const failedImages = useRef(new Set());
  const resolvedIds = useRef(new Set());

  // Helper: Filter positions based on league settings
  const filterPositions = (player) => {
    if (!player) return 'N/A';
    let positionList = player.position_list;
    // Fallback if no position list
    if (!positionList) positionList = player.batter_or_pitcher === 'batter' ? 'Util' : 'P';

    const positions = positionList.split(',').map(p => p.trim());
    const validPositions = positions.filter(pos => {
      // If we have league settings with roster positions, check validity
      if (leagueSettings?.roster_positions) {
        return leagueSettings.roster_positions[pos] && leagueSettings.roster_positions[pos] > 0;
      }
      return true; // If no settings loaded yet, show all
    });
    return validPositions.length > 0 ? validPositions.join(', ') : positionList || 'N/A';
  };

  // Extracted fetch function to reuse
  const fetchDraftOrder = async () => {
    if (!leagueId) return;

    try {
      // 1. Fetch picks
      const { data: picks, error } = await supabase
        .from('draft_picks')
        .select(`
          pick_number, 
          round_number,
          manager_id,
          player_id,
          picked_at,
          player:player_list (player_id, name, team, batter_or_pitcher, identity, original_name)
        `)
        .eq('league_id', leagueId)
        .order('pick_number', { ascending: true });

      if (error) {
        console.error("Error fetching draft picks:", error);
      }

      if (picks && picks.length > 0) {
        setHasDraftOrder(true);

        // 2. Fetch Position Data (Client-side join workaround)
        // Fetch batter positions
        const { data: batterPos } = await supabase
          .from('v_batter_positions')
          .select('player_id, position_list');

        // Fetch pitcher positions
        const { data: pitcherPos } = await supabase
          .from('v_pitcher_positions')
          .select('player_id, position_list');

        // Create Position Map
        const posMap = {};
        if (batterPos) batterPos.forEach(p => posMap[p.player_id] = p.position_list);
        if (pitcherPos) pitcherPos.forEach(p => posMap[p.player_id] = p.position_list);

        // 3. Merge Data
        // Map to flatten structure for compatibility with existing JSX
        // Use 'members' state to find nickname by manager_id
        const formattedPicks = picks.map(p => {
          const member = members.find(m => m.manager_id === p.manager_id);
          // Merge position list into player object
          const playerWithPos = p.player ? {
            ...p.player,
            position_list: posMap[p.player.player_id] || null
          } : null;

          return {
            ...p,
            player: playerWithPos,
            member_profile: {
              nickname: member?.nickname || 'Unknown Manager'
            }
          };
        });
        setDraftOrder(formattedPicks);
      } else {
        setHasDraftOrder(false);
        setDraftOrder([]);
      }
    } catch (err) {
      console.error("Unexpected error fetching draft order:", err);
    }
  };

  // Check if draft order has been generated on mount or when members load
  useEffect(() => {
    fetchDraftOrder();
  }, [leagueId, members]);

  // ------------------------------------------------------------------
  // Display Helpers (Team & Color)
  // ------------------------------------------------------------------

  const getTeamAbbr = (team) => {
    switch (team) {
      case '統一獅': return 'UL';
      case '富邦悍將': return 'FG';
      case '樂天桃猿': return 'RM';
      case '中信兄弟': return 'B';
      case '味全龍': return 'W';
      case '台鋼雄鷹': return 'TSG';
      default: return team;
    }
  };

  const getTeamColor = (team) => {
    switch (team) {
      case '統一獅':
        return 'text-orange-400';
      case '富邦悍將':
        return 'text-blue-400';
      case '台鋼雄鷹':
        return 'text-green-400';
      case '味全龍':
        return 'text-red-400';
      case '樂天桃猿':
        return 'text-rose-400';
      case '中信兄弟':
        return 'text-yellow-400';
      default:
        return 'text-slate-400';
    }
  };

  // ------------------------------------------------------------------
  // Photo Resolution Logic (Copied from Draft Page)
  // ------------------------------------------------------------------

  const getPlayerPhotoPaths = (player) => {
    const paths = [];
    if (player.name) paths.push(`/photo/${player.name}.png`);
    if (player.original_name) player.original_name.split(',').forEach(a => a.trim() && paths.push(`/photo/${a.trim()}.png`));
    if (player.player_id) paths.push(`/photo/${player.player_id}.png`);
    paths.push('/photo/defaultPlayer.png');
    return paths;
  };

  const getPlayerPhoto = (player) => {
    if (!player) return '/photo/defaultPlayer.png';
    return photoSrcMap[player.player_id] || '/photo/defaultPlayer.png';
  };

  const handleImageError = (e) => {
    // Basic fallback if helper fails or is simpler here
    // But we should try to match draft page logic if possible.
    // However, the JSX calls handleImageError without player arg sometimes if not carefully bound.
    // In DraftPage: onError={handleImageError} (implicitly passes event), but logic uses player.
    // In the JSX provided in view_file: onError={handleImageError}
    // We need to implement a robust version.
    e.target.src = '/photo/defaultPlayer.png';
  };

  // Batch Resolve Photos for Draft Order Players
  useEffect(() => {
    if (!draftOrder || draftOrder.length === 0) return;

    let cancelled = false;
    const resolvePhotos = async () => {
      // Extract players from draft order
      const players = draftOrder.map(p => p.player).filter(Boolean);

      // Filter out players already in photoSrcMap or resolvedIds
      const unprocessed = players.filter(p => !photoSrcMap[p.player_id] && !resolvedIds.current.has(p.player_id));
      if (unprocessed.length === 0) return;

      // Deduplicate
      const uniquePlayers = Array.from(new Map(unprocessed.map(p => [p.player_id, p])).values());

      const batchPayload = uniquePlayers.map(p => ({
        id: p.player_id,
        candidates: getPlayerPhotoPaths(p).filter(path => !path.endsWith('/defaultPlayer.png'))
      }));

      // Mark as processing
      uniquePlayers.forEach(p => resolvedIds.current.add(p.player_id));

      try {
        const res = await fetch('/api/photo/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ players: batchPayload })
        });
        const data = await res.json();
        if (!cancelled && data.results) {
          setPhotoSrcMap(prev => ({ ...prev, ...data.results }));
        }
      } catch (e) {
        console.error("Photo resolve failed", e);
        if (!cancelled) {
          // Fallback locally
          const fallback = Object.fromEntries(uniquePlayers.map(p => [p.player_id, '/photo/defaultPlayer.png']));
          setPhotoSrcMap(prev => ({ ...prev, ...fallback }));
        }
      }
    };
    resolvePhotos();
    return () => { cancelled = true; };
  }, [draftOrder]);

  const handleGenerateDraftOrder = async () => {
    setShowGenerateConfirmModal(false);
    try {
      setSuccessMessage({ title: 'Generating Draft Order...', description: 'Please wait...' });
      setShowSuccessNotification(true);

      const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
      const managerId = cookie?.split('=')[1];
      const res = await fetch(`/api/league/${leagueId}/draft/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage({ title: 'Success!', description: 'Draft Order Generated! Ready for Auto-Start.' });
        setShowSuccessNotification(true);
        setTimeout(() => setShowSuccessNotification(false), 3000);

        // Fetch new order immediately without reload
        await fetchDraftOrder();
        setIsDraftOrderOpen(true);
      } else {
        setSuccessMessage({ title: 'Error', description: data.error, isError: true });
        setShowSuccessNotification(true);
      }
    } catch (e) {
      setSuccessMessage({ title: 'Error', description: e.message, isError: true });
      setShowSuccessNotification(true);
    }
  };

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
          setIsFinalized(result.league?.is_finalized || false);

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
    // Hide edit button if draft order has been generated (even if no players picked yet)
    return (currentUserRole === 'Commissioner' || currentUserRole === 'Co-Commissioner') && leagueStatus === 'pre-draft' && !hasDraftOrder;
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
      setSuccessMessage({
        title: 'Nickname Cannot Be Empty',
        description: 'Please enter a valid nickname.',
        updatedMember: null,
        isError: true
      });
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
      }, 4000);
      return;
    }

    if (trimmedNickname === currentNickname) {
      setShowNicknameModal(false);
      return;
    }

    if (trimmedNickname.length < 2) {
      setSuccessMessage({
        title: 'Nickname Too Short',
        description: 'Nickname must be at least 2 characters long.',
        updatedMember: null,
        isError: true
      });
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
      }, 4000);
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
        const oldNickname = currentNickname;
        setCurrentNickname(newNickname.trim());
        setShowNicknameModal(false);

        // Show success notification
        setSuccessMessage({
          title: 'Nickname Updated Successfully!',
          description: `Your nickname has been changed from "${oldNickname}" to "${newNickname.trim()}"`,
          updatedMember: null
        });
        setShowSuccessNotification(true);

        // Auto hide after 4 seconds
        setTimeout(() => {
          setShowSuccessNotification(false);
        }, 4000);

        // Update members list to reflect new nickname
        setMembers(prevMembers =>
          prevMembers.map(m =>
            m.manager_id === managerId ? { ...m, nickname: newNickname.trim() } : m
          )
        );
      } else {
        setSuccessMessage({
          title: 'Failed to Update Nickname',
          description: result.error || 'An error occurred. Please try again.',
          updatedMember: null,
          isError: true
        });
        setShowSuccessNotification(true);
        setTimeout(() => {
          setShowSuccessNotification(false);
        }, 4000);
      }
    } catch (err) {
      console.error('Update nickname error:', err);
      setSuccessMessage({
        title: 'Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection and try again.',
        updatedMember: null,
        isError: true
      });
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
      }, 4000);
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

  const handleFinalizedClick = () => {
    setShowFinalizedModal(true);
  };

  const handleUpdateFinalized = async (newFinalizedStatus) => {
    // Check if members count is even when trying to set to true
    if (newFinalizedStatus && members.length % 2 !== 0) {
      setSuccessMessage({
        title: 'Cannot Finalize Teams',
        description: `You need an even number of managers to finalize. Current: ${members.length} managers`,
        updatedMember: null,
        isError: true
      });
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
      }, 4000);
      return;
    }

    setUpdatingFinalized(true);
    try {
      const response = await fetch(`/api/league/${leagueId}/finalized`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_finalized: newFinalizedStatus }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setIsFinalized(newFinalizedStatus);
        setShowFinalizedModal(false);

        setSuccessMessage({
          title: newFinalizedStatus ? 'Teams Finalized Successfully!' : 'Teams Unlocked Successfully!',
          description: newFinalizedStatus
            ? 'Teams are now locked and ready for draft. DELETE buttons are now hidden.'
            : 'Teams are now unlocked. You can modify teams again.',
          updatedMember: null
        });
        setShowSuccessNotification(true);

        setTimeout(() => {
          setShowSuccessNotification(false);
        }, 4000);
      } else {
        setSuccessMessage({
          title: 'Failed to Update Status',
          description: result.error || 'An error occurred. Please try again.',
          updatedMember: null,
          isError: true
        });
        setShowSuccessNotification(true);
        setTimeout(() => {
          setShowSuccessNotification(false);
        }, 4000);
      }
    } catch (err) {
      console.error('Update finalized error:', err);
      setSuccessMessage({
        title: 'Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection.',
        updatedMember: null,
        isError: true
      });
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
      }, 4000);
    } finally {
      setUpdatingFinalized(false);
    }
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
        setSuccessMessage({
          title: 'Failed to Update Permission',
          description: result.error || 'An error occurred. Please try again.',
          updatedMember: null,
          isError: true
        });
        setShowSuccessNotification(true);
        setTimeout(() => {
          setShowSuccessNotification(false);
        }, 4000);
      }
    } catch (err) {
      console.error('Update role error:', err);
      setSuccessMessage({
        title: 'Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection.',
        updatedMember: null,
        isError: true
      });
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
      }, 4000);
    } finally {
      setUpdatingPermissions(false);
    }
  };

  const handleDeleteMemberClick = (member) => {
    setMemberToDelete(member);
    setShowDeleteMemberModal(true);
  };

  const handleConfirmDeleteMember = async () => {
    if (!memberToDelete) return;

    setDeletingMember(true);
    try {
      const response = await fetch(`/api/league/${leagueId}/member`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manager_id: memberToDelete.manager_id }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Remove member from local list
        setMembers(prevMembers =>
          prevMembers.filter(m => m.manager_id !== memberToDelete.manager_id)
        );

        setShowDeleteMemberModal(false);
        setMemberToDelete(null);

        // Show success notification
        setSuccessMessage({
          title: 'Member Removed Successfully!',
          description: `${memberToDelete.nickname || memberToDelete.managers?.name} has been removed from the league.`,
          updatedMember: null
        });
        setShowSuccessNotification(true);

        setTimeout(() => {
          setShowSuccessNotification(false);
        }, 4000);
      } else {
        setShowDeleteMemberModal(false);
        setMemberToDelete(null);

        setSuccessMessage({
          title: 'Failed to Remove Member',
          description: result.error || 'An error occurred. Please try again.',
          updatedMember: null,
          isError: true
        });
        setShowSuccessNotification(true);
        setTimeout(() => {
          setShowSuccessNotification(false);
        }, 4000);
      }
    } catch (err) {
      console.error('Delete member error:', err);
      setShowDeleteMemberModal(false);
      setMemberToDelete(null);

      setSuccessMessage({
        title: 'Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection.',
        updatedMember: null,
        isError: true
      });
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
      }, 4000);
    } finally {
      setDeletingMember(false);
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
          setDeleting(false);

          // Show success notification
          setSuccessMessage({
            title: 'League Deleted Successfully!',
            description: 'The league has been permanently removed. Redirecting to home page...',
            updatedMember: null
          });
          setShowSuccessNotification(true);

          // Dispatch event to refresh navbar leagues
          window.dispatchEvent(new Event('leagues-changed'));

          // Redirect after showing notification
          setTimeout(() => {
            router.push('/home');
          }, 2000);
        } else {
          setDeleting(false);
          setSuccessMessage({
            title: 'Failed to Delete League',
            description: result.error || 'An error occurred. Please try again.',
            updatedMember: null,
            isError: true
          });
          setShowSuccessNotification(true);
          setTimeout(() => {
            setShowSuccessNotification(false);
          }, 4000);
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
          setDeleting(false);

          // Show success notification
          setSuccessMessage({
            title: 'Left League Successfully!',
            description: 'You have left the league. Redirecting to home page...',
            updatedMember: null
          });
          setShowSuccessNotification(true);

          // Dispatch event to refresh navbar leagues
          window.dispatchEvent(new Event('leagues-changed'));

          // Redirect after showing notification
          setTimeout(() => {
            router.push('/home');
          }, 2000);
        } else {
          setDeleting(false);
          setSuccessMessage({
            title: 'Failed to Leave League',
            description: result.error || 'An error occurred. Please try again.',
            updatedMember: null,
            isError: true
          });
          setShowSuccessNotification(true);
          setTimeout(() => {
            setShowSuccessNotification(false);
          }, 4000);
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
      setDeleting(false);
      setSuccessMessage({
        title: 'Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection and try again.',
        updatedMember: null,
        isError: true
      });
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
      }, 4000);
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

  const totalRounds = draftOrder.length > 0
    ? Math.max(...draftOrder.map(p => p.round_number))
    : 0;

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
              <>
                <button
                  onClick={handleManagePermissions}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Manage Permissions
                </button>
                {leagueStatus === 'pre-draft' && !hasDraftOrder && (
                  <button
                    onClick={handleFinalizedClick}
                    className={`font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 ${isFinalized
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                      : 'bg-gradient-to-r from-slate-600 to-gray-600 hover:from-slate-700 hover:to-gray-700 text-white'
                      }`}
                  >
                    {isFinalized ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Finalized ✓
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Not Finalized
                      </>
                    )}
                  </button>
                )}
              </>
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
            {leagueStatus === 'pre-draft' && !isFinalized && (
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
                <span className={`font-bold px-3 py-1 rounded-full text-sm ${leagueStatus === 'pre-draft' ? 'bg-blue-500/30 text-blue-300' :
                  leagueStatus === 'drafting now' ? 'bg-yellow-500/30 text-yellow-300' :
                    leagueStatus === 'in-season' ? 'bg-green-500/30 text-green-300' :
                      leagueStatus === 'post-draft & pre-season' ? 'bg-purple-500/30 text-purple-300' :
                        'bg-gray-500/30 text-gray-300'
                  }`}>
                  {leagueStatus?.toUpperCase()}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="flex justify-between items-center py-2 px-4 bg-slate-900/40 rounded-lg border border-purple-500/20">
                  <span className="text-white font-semibold">Foreigner On Team Limit</span>
                  <span className="text-purple-300 font-bold">
                    {leagueSettings.foreigner_on_team_limit === null ? 'No limit' : leagueSettings.foreigner_on_team_limit}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 px-4 bg-slate-900/40 rounded-lg border border-purple-500/20">
                  <span className="text-white font-semibold">Foreigner Active Limit</span>
                  <span className="text-purple-300 font-bold">
                    {leagueSettings.foreigner_active_limit === null ? 'No limit' : leagueSettings.foreigner_active_limit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {leagueSettings.roster_positions && (() => {
                  const positionOrder = ['C', '1B', '2B', '3B', 'SS', 'CI', 'MI', 'LF', 'CF', 'RF', 'OF', 'Util', 'SP', 'RP', 'P', 'BN', 'Minor'];
                  return Object.entries(leagueSettings.roster_positions)
                    .sort(([a], [b]) => {
                      const indexA = positionOrder.indexOf(a);
                      const indexB = positionOrder.indexOf(b);
                      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                    })
                    .map(([position, count]) => (
                      count > 0 && (
                        <div key={position} className="flex justify-between items-center py-2 px-4 bg-slate-900/40 rounded-lg border border-purple-500/20">
                          <span className="text-white font-semibold">{position}</span>
                          <span className="text-purple-300 font-bold">{count}</span>
                        </div>
                      )
                    ));
                })()}
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

          {/* Waiver Settings */}
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600/80 to-emerald-600/80 backdrop-blur-sm p-5 border-b border-teal-400/30">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Waiver Settings
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-purple-500/20">
                <span className="text-purple-300/70 font-medium">Waiver Players Time</span>
                <span className="text-white font-semibold">{leagueSettings.waiver_players_unfreeze_time || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-purple-500/20">
                <span className="text-purple-300/70 font-medium">Post Draft Waiver Time</span>
                <span className="text-white font-semibold">{leagueSettings.post_draft_players_unfreeze_time || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-purple-300/70 font-medium">Allow Minor from Waivers/FA</span>
                <span className="text-white font-semibold">{leagueSettings.allow_injured_to_injury_slot || 'N/A'}</span>
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
                  <p className={`text-xs transition-colors ${newNickname.trim().length < 2
                    ? 'text-red-400 font-medium'
                    : newNickname.trim().length > 50
                      ? 'text-red-400 font-medium'
                      : 'text-cyan-300/70'
                    }`}>
                    {newNickname.trim().length < 2 ? '⚠️ Minimum 2 characters' : '✓ Valid length'}
                  </p>
                </div>
                <p className={`text-xs font-medium ${newNickname.length > 40
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

      {/* Success/Error Notification */}
      {showSuccessNotification && (
        <div className="fixed top-6 right-6 z-[60] animate-slide-in-right">
          <div className={`backdrop-blur-xl border rounded-2xl shadow-2xl p-6 max-w-md transform transition-all duration-300 ${successMessage.isError
            ? 'bg-gradient-to-br from-red-600/95 to-rose-600/95 border-red-400/30'
            : 'bg-gradient-to-br from-green-600/95 to-emerald-600/95 border-green-400/30'
            }`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="bg-white/20 p-3 rounded-full animate-bounce-once">
                  {successMessage.isError ? (
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl font-black text-white mb-1">
                  {successMessage.title}
                </h3>
                <p className={`text-sm mb-3 ${successMessage.isError ? 'text-red-50/90' : 'text-green-50/90'
                  }`}>
                  {successMessage.description}
                </p>
                {successMessage.updatedMember && (
                  <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${successMessage.updatedMember.role === 'Co-Commissioner'
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
                      className={`bg-slate-900/50 border rounded-lg p-4 transition-all ${isCommissioner
                        ? 'border-yellow-500/30 bg-yellow-500/5'
                        : 'border-purple-500/20 hover:border-purple-400/40'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`p-2 rounded-lg ${member.role === 'Commissioner'
                            ? 'bg-yellow-500/20'
                            : member.role === 'Co-Commissioner'
                              ? 'bg-purple-500/20'
                              : 'bg-blue-500/20'
                            }`}>
                            <svg className={`w-5 h-5 ${member.role === 'Commissioner'
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
                            <>
                              <select
                                value={member.role}
                                onChange={(e) => handleUpdateMemberRole(member.manager_id, e.target.value)}
                                disabled={updatingPermissions}
                                className="bg-slate-900/70 border border-purple-500/30 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                              >
                                <option value="member">Member</option>
                                <option value="Co-Commissioner">Co-Commissioner</option>
                              </select>
                              <button
                                onClick={() => handleDeleteMemberClick(member)}
                                disabled={updatingPermissions || deletingMember}
                                className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Remove member from league"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
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

      {/* Finalized Status Modal */}
      {showFinalizedModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-3 rounded-xl">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-white">Finalize Teams</h2>
              </div>
              <button
                onClick={() => setShowFinalizedModal(false)}
                className="text-emerald-300 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-emerald-300/90 text-sm">
                  <p className="font-medium mb-2">What does finalizing do?</p>
                  <ul className="list-disc list-inside space-y-1 text-emerald-300/70">
                    <li>Locks all teams and prepares them for draft</li>
                    <li>Hides DELETE LEAGUE and DELETE TEAM buttons</li>
                    <li>Requires an even number of managers</li>
                    <li>Can be unlocked later if needed</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-500/20 rounded-lg p-5 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-lg mb-1">Finalize and lock teams</p>
                  <p className="text-slate-400 text-sm">
                    Current Status: {members.length} managers {members.length % 2 === 0 ? '✓' : '(Need even number)'}
                  </p>
                </div>
                <button
                  onClick={() => handleUpdateFinalized(!isFinalized)}
                  disabled={updatingFinalized}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed ${isFinalized ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-slate-600'
                    }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${isFinalized ? 'translate-x-9' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {members.length % 2 !== 0 && (
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-yellow-300 text-sm">
                      You need an even number of managers to finalize teams. Current: <strong>{members.length}</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {updatingFinalized && (
              <div className="mb-4 flex items-center justify-center gap-2 text-emerald-300">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Updating status...</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setShowFinalizedModal(false)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-6 py-3 rounded-lg transition-all shadow-lg"
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

      {/* Draft Management / Results */}
      {(hasDraftOrder || (currentUserRole === 'Commissioner' || currentUserRole === 'Co-Commissioner')) && leagueSettings.draft_type === 'Live Draft' && (
        <div className="mt-8 p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Draft Management</h2>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-bold border border-purple-500/30 shadow-sm">
                {leagueSettings.draft_type === 'Live Draft' ? 'Snake Draft' : leagueSettings.draft_type}
              </span>
              <span className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-sm font-bold border border-blue-500/30 shadow-sm">
                {totalRounds} Rounds
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-4 w-full">
            {!hasDraftOrder ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowGenerateConfirmModal(true)}
                  className="px-6 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Generate Draft Order
                </button>
                <p className="text-sm text-purple-200">
                  Click to create the random snake draft order. The draft will automatically start at the &quot;Live Draft Time&quot;.
                </p>
              </div>
            ) : (
              <div className="w-full">
                <button
                  onClick={() => setIsDraftOrderOpen(!isDraftOrderOpen)}
                  className="w-full flex items-center justify-between text-left bg-slate-800/50 hover:bg-slate-700/50 p-4 rounded-lg border border-purple-500/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-purple-500 to-indigo-500 p-2 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-white font-bold text-lg">
                        {draftOrder.some(p => p.player_id) ? 'Draft Results' : 'Draft Order (First Round)'}
                      </span>
                      <p className="text-purple-300/60 text-xs">
                        {draftOrder.some(p => p.player_id) ? 'View picked players' : 'Generated Randomly - Round 1 Preview'}
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`w-6 h-6 text-purple-400 transition-transform ${isDraftOrderOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDraftOrderOpen && (
                  <div className="mt-2 bg-slate-900/40 border border-purple-500/20 rounded-lg overflow-hidden animate-fadeIn max-h-[600px] overflow-y-auto">
                    <div className="p-2 space-y-1">
                      {draftOrder
                        // If no picks made, show only first round to avoid spam. If picking started, show all.
                        .filter(item => draftOrder.some(p => p.player_id) ? true : item.round_number === 1)
                        .map((item, index) => {
                          const isPicked = !!item.player_id;
                          return (
                            <div key={`${item.round_number}-${item.pick_number}`} className={`flex items-center justify-between p-3 rounded-md transition-colors ${isPicked ? 'bg-purple-900/20 border border-purple-500/10' : 'hover:bg-white/5'}`}>
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center justify-center w-10 shrink-0">
                                  <span className="text-xs text-purple-400 font-mono">R{item.round_number}</span>
                                  <span className={`w-8 h-8 flex items-center justify-center font-bold rounded-full border ${isPicked ? 'bg-purple-500 text-white border-purple-400' : 'bg-purple-500/20 text-purple-300 border-purple-500/30'}`}>
                                    {item.pick_number}
                                  </span>
                                </div>

                                {isPicked ? (
                                  <div className="flex items-center gap-3">
                                    {/* Avatar */}
                                    <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600 shadow-sm relative shrink-0">
                                      <img
                                        src={getPlayerPhoto(item.player)}
                                        onError={handleImageError}
                                        alt={item.player?.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>

                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-white font-bold text-lg">{item.player?.name}</span>
                                        <span className="text-purple-300/70 text-sm font-normal">
                                          - {filterPositions(item.player)}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold border leading-none ${getTeamColor(item.player?.team)}`}>
                                          {getTeamAbbr(item.player?.team)}
                                        </span>
                                        {item.player?.identity?.toLowerCase() === 'foreigner' && (
                                          <span className="text-[9px] font-bold bg-cyan-900/50 text-cyan-300 px-1 rounded border border-cyan-500/30">
                                            F
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-purple-400/60 text-xs mt-0.5">Manager: {item.member_profile?.nickname}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col ml-2">
                                    <span className="text-white font-medium">{item.member_profile?.nickname}</span>
                                    <span className="text-purple-400/50 text-xs">On the clock soon</span>
                                  </div>
                                )}
                              </div>
                              {item.pick_number === 1 && item.round_number === 1 && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded border border-yellow-500/30 shrink-0 ml-2">
                                  1st Overall
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Viewing Only Alert */}
      {currentUserRole !== 'Commissioner' && currentUserRole !== 'Co-Commissioner' && (
        <div className="mt-8 p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex items-center gap-4 animate-fadeIn">
          <div className="bg-yellow-500/20 p-3 rounded-xl flex-shrink-0">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-yellow-200 font-bold text-lg">Viewing Only</p>
            <p className="text-yellow-200/70">Only the Commissioner and Co-Commissioner can edit league settings.</p>
          </div>
        </div>
      )}

      {/* Generate Draft Order Confirm Modal */}
      {showGenerateConfirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-yellow-500/30 rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scaleIn">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-3 rounded-xl shadow-lg shadow-yellow-500/20">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Generate Draft Order?</h2>
                <p className="text-yellow-300/80 text-sm font-medium">This action cannot be undone easily</p>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5 mb-8">
              <p className="text-yellow-100 leading-relaxed">
                This will randomly assign draft positions to all teams and prepare the draft board. Once generated, the draft will be ready to start at the scheduled time.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowGenerateConfirmModal(false)}
                className="flex-1 px-5 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateDraftOrder}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Yes, Generate It!</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Member Confirmation Modal */}
      {showDeleteMemberModal && memberToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-red-500/30 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-red-500 to-rose-500 p-3 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-white">Remove Member?</h2>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-bold">{memberToDelete.nickname || memberToDelete.managers?.name}</p>
                  <p className="text-red-300/70 text-sm">{memberToDelete.role}</p>
                </div>
              </div>

              <div className="text-red-200/90 text-sm space-y-2">
                <p className="font-medium">⚠️ This action will:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Remove this member from the league immediately</li>
                  <li>Delete their team and all associated data</li>
                  <li>Remove them from all schedules and matchups</li>
                </ul>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-yellow-200/90 text-sm">
                  <strong>Note:</strong> This member can rejoin the league if invited again.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteMemberModal(false);
                  setMemberToDelete(null);
                }}
                disabled={deletingMember}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteMember}
                disabled={deletingMember}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deletingMember ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Removing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove Member
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
