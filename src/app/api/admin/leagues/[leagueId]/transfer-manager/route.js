import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabaseAdmin from '@/lib/supabaseAdmin';

const TRANSFER_TABLES = [
  'draft_picks',
  'draft_queues',
  'draft_roster_assignments',
  'league_player_ownership',
  'league_roster_positions',
  'transactions_2026',
  'waiver_claims',
  'waiver_priority',
  'watched_players',
  'league_members',
];

const DELETE_ONLY_TABLES = ['draft_queues', 'draft_roster_assignments', 'watched_players'];

async function requireLeagueTransferPermission(leagueId) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: memberRecord, error: memberError } = await supabaseAdmin
    .from('league_members')
    .select('manager_id, role')
    .eq('league_id', leagueId)
    .eq('manager_id', userId)
    .maybeSingle();

  if (memberError || !memberRecord) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  if (memberRecord.role !== 'Commissioner' && memberRecord.role !== 'Co-Commissioner') {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId };
}

function normalizeId(value) {
  return String(value ?? '').trim();
}

function createStageError({ stage, table, action, error }) {
  const wrapped = new Error(error?.message || String(error));
  wrapped.failedStage = stage;
  wrapped.failedTable = table;
  wrapped.failedAction = action;
  return wrapped;
}

async function runStage({ stage, table, action, fn }) {
  try {
    return await fn();
  } catch (error) {
    throw createStageError({ stage, table, action, error });
  }
}

async function updateManagerId(tableName, leagueId, oldManagerId, newManagerId) {
  const { data, error } = await supabaseAdmin
    .from(tableName)
    .update({ manager_id: newManagerId })
    .eq('league_id', leagueId)
    .eq('manager_id', oldManagerId)
    .select('manager_id');

  if (error) {
    throw new Error(`${tableName}: ${error.message}`);
  }

  return data?.length || 0;
}

async function updateLeagueMemberTransfer(leagueId, oldManagerId, newManagerId, nextNickname) {
  const { data, error } = await supabaseAdmin
    .from('league_members')
    .update({
      manager_id: newManagerId,
      nickname: nextNickname,
      joined_at: new Date().toISOString(),
      role: 'member',
    })
    .eq('league_id', leagueId)
    .eq('manager_id', oldManagerId)
    .select('manager_id');

  if (error) {
    throw new Error(`league_members: ${error.message}`);
  }

  return data?.length || 0;
}

async function deleteTableRows(tableName, leagueId, oldManagerId) {
  const { data: rows, error: selectError } = await supabaseAdmin
    .from(tableName)
    .select('*')
    .eq('league_id', leagueId)
    .eq('manager_id', oldManagerId);

  if (selectError) {
    throw new Error(`${tableName}: ${selectError.message}`);
  }

  if (!rows || rows.length === 0) {
    return { affectedRows: 0, deletedRows: [] };
  }

  const { error: deleteError } = await supabaseAdmin
    .from(tableName)
    .delete()
    .eq('league_id', leagueId)
    .eq('manager_id', oldManagerId);

  if (deleteError) {
    throw new Error(`${tableName}: ${deleteError.message}`);
  }

  return { affectedRows: rows.length, deletedRows: rows };
}

async function updateLeagueMatchupsTransfer(leagueId, oldManagerId, newManagerId) {
  const { data: rows, error: selectError } = await supabaseAdmin
    .from('league_matchups')
    .select('id, manager_id_a, manager_id_b, winner_manager_id')
    .eq('league_id', leagueId)
    .or(`manager_id_a.eq.${oldManagerId},manager_id_b.eq.${oldManagerId},winner_manager_id.eq.${oldManagerId}`);

  if (selectError) {
    throw new Error(`league_matchups: ${selectError.message}`);
  }

  if (!rows || rows.length === 0) {
    return { affectedRows: 0, originalRows: [] };
  }

  for (const row of rows) {
    const nextManagerA = row.manager_id_a === oldManagerId ? newManagerId : row.manager_id_a;
    const nextManagerB = row.manager_id_b === oldManagerId ? newManagerId : row.manager_id_b;
    const nextWinner = row.winner_manager_id === oldManagerId ? newManagerId : row.winner_manager_id;

    const { error: updateError } = await supabaseAdmin
      .from('league_matchups')
      .update({
        manager_id_a: nextManagerA,
        manager_id_b: nextManagerB,
        winner_manager_id: nextWinner,
      })
      .eq('id', row.id)
      .eq('league_id', leagueId);

    if (updateError) {
      throw new Error(`league_matchups: ${updateError.message}`);
    }
  }

  return { affectedRows: rows.length, originalRows: rows };
}

async function rollbackManagerId(tableName, leagueId, oldManagerId, newManagerId) {
  const { error } = await supabaseAdmin
    .from(tableName)
    .update({ manager_id: oldManagerId })
    .eq('league_id', leagueId)
    .eq('manager_id', newManagerId);

  if (error) {
    console.error(`[transfer-manager] rollback failed for ${tableName}:`, error);
  }
}

async function rollbackDeletedRows(tableName, deletedRows) {
  if (!deletedRows || deletedRows.length === 0) return;

  const { error } = await supabaseAdmin
    .from(tableName)
    .insert(deletedRows);

  if (error) {
    console.error(`[transfer-manager] rollback failed for ${tableName}:`, error);
  }
}

async function rollbackLeagueMatchupsTransfer(leagueId, originalRows) {
  if (!originalRows || originalRows.length === 0) return;

  for (const row of originalRows) {
    const { error } = await supabaseAdmin
      .from('league_matchups')
      .update({
        manager_id_a: row.manager_id_a,
        manager_id_b: row.manager_id_b,
        winner_manager_id: row.winner_manager_id,
      })
      .eq('id', row.id)
      .eq('league_id', leagueId);

    if (error) {
      console.error('[transfer-manager] rollback failed for league_matchups:', error);
    }
  }
}

async function rollbackLeagueMemberTransfer(leagueId, newManagerId, oldMemberSnapshot) {
  if (!oldMemberSnapshot) return;

  const { error } = await supabaseAdmin
    .from('league_members')
    .update({
      manager_id: oldMemberSnapshot.manager_id,
      nickname: oldMemberSnapshot.nickname,
      joined_at: oldMemberSnapshot.joined_at,
      role: oldMemberSnapshot.role,
    })
    .eq('league_id', leagueId)
    .eq('manager_id', newManagerId);

  if (error) {
    console.error('[transfer-manager] rollback failed for league_members:', error);
  }
}

async function refreshLeagueStandingsMaterializedView(leagueId) {
  // Expect a Postgres function exposed by Supabase RPC that performs:
  // REFRESH MATERIALIZED VIEW public.v_league_standings;
  let { error } = await supabaseAdmin.rpc('refresh_v_league_standings', {
    target_league_id: leagueId,
  });

  if (error) {
    const retry = await supabaseAdmin.rpc('refresh_v_league_standings');
    error = retry.error;
  }

  if (error) {
    throw new Error(
      `refresh_v_league_standings RPC failed: ${error.message}. Please ensure the RPC function exists and refreshes public.v_league_standings.`
    );
  }
}

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;
    const auth = await requireLeagueTransferPermission(leagueId);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const oldManagerId = normalizeId(searchParams.get('old_manager_id'));
    const newManagerId = normalizeId(searchParams.get('new_manager_id'));

    if (!leagueId || !oldManagerId || !newManagerId) {
      return NextResponse.json(
        { success: false, error: 'leagueId, old_manager_id, new_manager_id are required' },
        { status: 400 }
      );
    }

    if (oldManagerId === newManagerId) {
      return NextResponse.json(
        { success: false, error: 'old_manager_id and new_manager_id must be different' },
        { status: 400 }
      );
    }

    const [oldMemberRes, newManagerRes, existingNewMemberRes] = await Promise.all([
      supabaseAdmin
        .from('league_members')
        .select('manager_id, role, nickname, managers(name)')
        .eq('league_id', leagueId)
        .eq('manager_id', oldManagerId)
        .maybeSingle(),
      supabaseAdmin
        .from('managers')
        .select('manager_id, name')
        .eq('manager_id', newManagerId)
        .maybeSingle(),
      supabaseAdmin
        .from('league_members')
        .select('manager_id')
        .eq('league_id', leagueId)
        .eq('manager_id', newManagerId)
        .maybeSingle(),
    ]);

    if (oldMemberRes.error || !oldMemberRes.data) {
      return NextResponse.json(
        { success: false, error: 'Old manager is not a member of this league' },
        { status: 404 }
      );
    }

    if (oldMemberRes.data.role === 'Commissioner') {
      return NextResponse.json(
        { success: false, error: 'Commissioner cannot be transferred' },
        { status: 403 }
      );
    }

    if (newManagerRes.error) {
      return NextResponse.json(
        { success: false, error: newManagerRes.error.message },
        { status: 500 }
      );
    }

    if (!newManagerRes.data) {
      return NextResponse.json(
        { success: false, error: 'New manager not found' },
        { status: 404 }
      );
    }

    if (existingNewMemberRes.data) {
      return NextResponse.json(
        { success: false, error: 'New manager is already a member of this league' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      league_id: leagueId,
      old_manager_id: oldManagerId,
      new_manager_id: newManagerId,
      old_manager_name: oldMemberRes.data.managers?.name || oldMemberRes.data.nickname || oldManagerId,
      old_member_role: oldMemberRes.data.role,
      new_manager_name: newManagerRes.data.name || newManagerId,
    });
  } catch (error) {
    console.error('[transfer-manager][preview] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Preview failed' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { leagueId } = params;
    const auth = await requireLeagueTransferPermission(leagueId);
    if (!auth.ok) return auth.response;

    const body = await request.json();

    const oldManagerId = normalizeId(body?.old_manager_id ?? body?.old_player_id ?? body?.source_manager_id);
    const newManagerId = normalizeId(body?.new_manager_id ?? body?.new_player_id ?? body?.target_manager_id);

    if (!leagueId || !oldManagerId || !newManagerId) {
      return NextResponse.json(
        { success: false, error: 'leagueId, old_manager_id, new_manager_id are required' },
        { status: 400 }
      );
    }

    if (oldManagerId === newManagerId) {
      return NextResponse.json(
        { success: false, error: 'old_manager_id and new_manager_id must be different' },
        { status: 400 }
      );
    }

    const [oldMemberRes, newManagerRes, existingNewMemberRes, collisionChecks, leagueMatchupsCollision] = await Promise.all([
      supabaseAdmin
        .from('league_members')
        .select('league_id, manager_id, nickname, role, joined_at')
        .eq('league_id', leagueId)
        .eq('manager_id', oldManagerId)
        .maybeSingle(),
      supabaseAdmin
        .from('managers')
        .select('manager_id, name')
        .eq('manager_id', newManagerId)
        .maybeSingle(),
      supabaseAdmin
        .from('league_members')
        .select('league_id, manager_id')
        .eq('league_id', leagueId)
        .eq('manager_id', newManagerId)
        .maybeSingle(),
      Promise.all(
        TRANSFER_TABLES
          .filter((tableName) => tableName !== 'league_members' && !DELETE_ONLY_TABLES.includes(tableName))
          .map(async (tableName) => {
          const { data, error } = await supabaseAdmin
            .from(tableName)
            .select('manager_id')
            .eq('league_id', leagueId)
            .eq('manager_id', newManagerId)
            .limit(1);

          return { tableName, hasConflict: !!error || (data?.length || 0) > 0 };
          })
      ),
      supabaseAdmin
        .from('league_matchups')
        .select('id')
        .eq('league_id', leagueId)
        .or(`manager_id_a.eq.${newManagerId},manager_id_b.eq.${newManagerId},winner_manager_id.eq.${newManagerId}`)
        .limit(1),
    ]);

    if (newManagerRes.error) {
      return NextResponse.json(
        { success: false, error: newManagerRes.error.message },
        { status: 500 }
      );
    }

    if (!newManagerRes.data) {
      return NextResponse.json(
        { success: false, error: 'New manager not found' },
        { status: 404 }
      );
    }

    if (oldMemberRes.error || !oldMemberRes.data) {
      return NextResponse.json(
        { success: false, error: 'Old manager is not a member of this league' },
        { status: 404 }
      );
    }

    if (oldMemberRes.data.role === 'Commissioner') {
      return NextResponse.json(
        { success: false, error: 'Commissioner cannot be transferred' },
        { status: 403 }
      );
    }

    if (existingNewMemberRes.data) {
      return NextResponse.json(
        { success: false, error: 'New manager is already a member of this league' },
        { status: 409 }
      );
    }

    if (leagueMatchupsCollision.error) {
      return NextResponse.json(
        { success: false, error: leagueMatchupsCollision.error.message },
        { status: 500 }
      );
    }

    const conflictedTables = collisionChecks.filter((item) => item.hasConflict).map((item) => item.tableName);
    if ((leagueMatchupsCollision.data?.length || 0) > 0) {
      conflictedTables.push('league_matchups');
    }

    if (conflictedTables.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'New manager already has rows in one or more transfer tables for this league',
          conflictedTables,
        },
        { status: 409 }
      );
    }

    const updateOrder = [
      'draft_picks',
      'league_player_ownership',
      'league_roster_positions',
      'transactions_2026',
      'waiver_claims',
      'waiver_priority',
    ];

    const results = [];
    const appliedTables = [];
    let deletedDraftQueues = [];
    let deletedDraftRosterAssignments = [];
    let deletedWatchedPlayers = [];
    let originalLeagueMatchups = [];
    const oldMemberSnapshot = oldMemberRes.data;

    try {
      const draftQueueResult = await runStage({
        stage: 'delete_draft_queues',
        table: 'draft_queues',
        action: 'delete',
        fn: () => deleteTableRows('draft_queues', leagueId, oldManagerId),
      });
      deletedDraftQueues = draftQueueResult.deletedRows;
      results.push({ table: 'draft_queues', affectedRows: draftQueueResult.affectedRows, action: 'delete' });
      appliedTables.push('draft_queues');

      const draftRosterAssignmentResult = await runStage({
        stage: 'delete_draft_roster_assignments',
        table: 'draft_roster_assignments',
        action: 'delete',
        fn: () => deleteTableRows('draft_roster_assignments', leagueId, oldManagerId),
      });
      deletedDraftRosterAssignments = draftRosterAssignmentResult.deletedRows;
      results.push({ table: 'draft_roster_assignments', affectedRows: draftRosterAssignmentResult.affectedRows, action: 'delete' });
      appliedTables.push('draft_roster_assignments');

      const watchedPlayersResult = await runStage({
        stage: 'delete_watched_players',
        table: 'watched_players',
        action: 'delete',
        fn: () => deleteTableRows('watched_players', leagueId, oldManagerId),
      });
      deletedWatchedPlayers = watchedPlayersResult.deletedRows;
      results.push({ table: 'watched_players', affectedRows: watchedPlayersResult.affectedRows, action: 'delete' });
      appliedTables.push('watched_players');

      const leagueMatchupsResult = await runStage({
        stage: 'update_league_matchups',
        table: 'league_matchups',
        action: 'update_manager_id_a_b_winner',
        fn: () => updateLeagueMatchupsTransfer(leagueId, oldManagerId, newManagerId),
      });
      originalLeagueMatchups = leagueMatchupsResult.originalRows;
      results.push({ table: 'league_matchups', affectedRows: leagueMatchupsResult.affectedRows, action: 'update' });
      appliedTables.push('league_matchups');

      for (const tableName of updateOrder) {
        const affectedRows = await runStage({
          stage: `update_${tableName}`,
          table: tableName,
          action: 'update_manager_id',
          fn: () => updateManagerId(tableName, leagueId, oldManagerId, newManagerId),
        });
        results.push({ table: tableName, affectedRows });
        appliedTables.push(tableName);
      }

      const nextNickname = String(newManagerRes.data?.name || newManagerId);
      const memberAffectedRows = await runStage({
        stage: 'update_league_members_profile',
        table: 'league_members',
        action: 'transfer_and_reset_profile',
        fn: () => updateLeagueMemberTransfer(leagueId, oldManagerId, newManagerId, nextNickname),
      });
      results.push({ table: 'league_members', affectedRows: memberAffectedRows, action: 'reset_profile' });
      appliedTables.push('league_members');

      await runStage({
        stage: 'refresh_v_league_standings',
        table: 'v_league_standings',
        action: 'refresh_materialized_view',
        fn: () => refreshLeagueStandingsMaterializedView(leagueId),
      });
      results.push({ table: 'v_league_standings', affectedRows: 1, action: 'refresh_materialized_view' });
    } catch (transferError) {
      for (const tableName of [...appliedTables].reverse()) {
        if (tableName === 'draft_queues') {
          await rollbackDeletedRows('draft_queues', deletedDraftQueues);
          continue;
        }
        if (tableName === 'draft_roster_assignments') {
          await rollbackDeletedRows('draft_roster_assignments', deletedDraftRosterAssignments);
          continue;
        }
        if (tableName === 'watched_players') {
          await rollbackDeletedRows('watched_players', deletedWatchedPlayers);
          continue;
        }
        if (tableName === 'league_matchups') {
          await rollbackLeagueMatchupsTransfer(leagueId, originalLeagueMatchups);
          continue;
        }
        if (tableName === 'league_members') {
          await rollbackLeagueMemberTransfer(leagueId, newManagerId, oldMemberSnapshot);
          continue;
        }
        await rollbackManagerId(tableName, leagueId, oldManagerId, newManagerId);
      }

      throw transferError;
    }

    return NextResponse.json({
      success: true,
      message: 'Manager transfer completed',
      league_id: leagueId,
      old_manager_id: oldManagerId,
      new_manager_id: newManagerId,
      updated_tables: results,
    });
  } catch (error) {
    console.error('[transfer-manager] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Transfer failed',
        failed_stage: error.failedStage || null,
        failed_table: error.failedTable || null,
        failed_action: error.failedAction || null,
      },
      { status: 500 }
    );
  }
}