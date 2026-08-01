import supabase from '@/lib/supabase';

/**
 * 檢查玩家是否被淘汰並且聯盟鎖定淘汰球隊
 * @param {string} leagueId - 聯盟 ID
 * @param {string} managerId - 玩家 ID
 * @returns {Promise<{isEliminated: boolean, reason: string|null}>}
 */
export async function checkEliminatedStatus(leagueId, managerId) {
  try {
    // 1. 檢查聯盟設定 lock_eliminated_teams
    const { data: settings, error: settingsError } = await supabase
      .from('league_settings')
      .select('lock_eliminated_teams')
      .eq('league_id', leagueId)
      .single();

    if (settingsError) {
      console.error('Error fetching league settings:', settingsError);
      return { isEliminated: false, reason: null };
    }

    const lockEliminated = settings?.lock_eliminated_teams?.toLowerCase() === 'yes';
    
    if (!lockEliminated) {
      return { isEliminated: false, reason: null };
    }

    // 2. 檢查玩家是否在 eliminated 表中
    const { data: eliminatedRecord, error: eliminatedError } = await supabase
      .from('league_playoff_eliminated')
      .select('*')
      .eq('league_id', leagueId)
      .eq('manager_id', managerId)
      .eq('eliminated', true)
      .maybeSingle();

    if (eliminatedError) {
      console.error('Error checking eliminated status:', eliminatedError);
      return { isEliminated: false, reason: null };
    }

    if (eliminatedRecord) {
      return { 
        isEliminated: true, 
        reason: 'This team has been eliminated and cannot perform transactions.' 
      };
    }

    return { isEliminated: false, reason: null };
  } catch (error) {
    console.error('Error in checkEliminatedStatus:', error);
    return { isEliminated: false, reason: null };
  }
}
