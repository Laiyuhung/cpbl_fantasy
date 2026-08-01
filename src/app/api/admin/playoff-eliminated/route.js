import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabaseAdmin from '@/lib/supabaseAdmin';

async function requireAdmin() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value

  if (!userId) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from('admin')
    .select('manager_id')
    .eq('manager_id', userId)
    .single()

  if (adminError || !adminRecord) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true }
}

export async function GET(request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');

    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'leagueId is required' }, { status: 400 });
    }

    const { data: eliminatedRows, error } = await supabaseAdmin
      .from('league_playoff_eliminated')
      .select('*')
      .eq('league_id', leagueId)
      .eq('eliminated', true);

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch eliminated status', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, eliminated: eliminatedRows || [] });
  } catch (error) {
    console.error('[admin/playoff-eliminated] GET error:', error);
    return NextResponse.json({ success: false, error: 'Server error', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { leagueId, eliminated } = body;

    if (!leagueId || !Array.isArray(eliminated)) {
      return NextResponse.json({ success: false, error: 'leagueId and eliminated array are required' }, { status: 400 });
    }

    // 刪除該聯盟的所有舊 eliminated 記錄
    const { error: deleteError } = await supabaseAdmin
      .from('league_playoff_eliminated')
      .delete()
      .eq('league_id', leagueId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: 'Failed to delete old eliminated records', details: deleteError.message }, { status: 500 });
    }

    // 插入新的 eliminated 記錄
    const eliminatedRows = eliminated.map((item) => ({
      league_id: leagueId,
      manager_id: item.manager_id,
      eliminated: true,
    }));

    const { data: insertedEliminated, error: insertError } = await supabaseAdmin
      .from('league_playoff_eliminated')
      .insert(eliminatedRows)
      .select('*');

    if (insertError) {
      return NextResponse.json({ success: false, error: 'Failed to insert eliminated records', details: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, eliminated: insertedEliminated || [] });
  } catch (error) {
    console.error('[admin/playoff-eliminated] POST error:', error);
    return NextResponse.json({ success: false, error: 'Server error', details: error.message }, { status: 500 });
  }
}
