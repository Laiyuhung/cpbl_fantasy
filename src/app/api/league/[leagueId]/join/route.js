import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request, { params }) {
  try {
    const { leagueId } = params;
    const body = await request.json();
    const { manager_id } = body;

    if (!leagueId || !manager_id) {
      return NextResponse.json(
        { error: 'League ID and Manager ID are required' },
        { status: 400 }
      );
    }

    // 1. 检查联盟状态
    const { data: statusData, error: statusError } = await supabase
      .from('league_statuses')
      .select('status')
      .eq('league_id', leagueId)
      .single();

    if (statusError) {
      console.error('Supabase status error:', statusError);
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      );
    }

    if (statusData.status !== 'pre-draft') {
      return NextResponse.json(
        { error: 'The league draft is complete and the season has started.' },
        { status: 400 }
      );
    }

    // 1.5 Check if league is finalized (record exists = finalized)
    const { data: finalizedStatus, error: finalizedError } = await supabase
      .from('league_finalized_status')
      .select('league_id')
      .eq('league_id', leagueId)
      .single();

    if (!finalizedError && finalizedStatus) {
      return NextResponse.json(
        { error: 'This league has been finalized. Please contact the Commissioner to unlock teams.' },
        { status: 403 }
      );
    }

    // 2. 获取联盟设置（检查是否已满）
    const { data: leagueSettings, error: settingsError } = await supabase
      .from('league_settings')
      .select('max_teams')
      .eq('league_id', leagueId)
      .single();

    if (settingsError) {
      console.error('Supabase settings error:', settingsError);
      return NextResponse.json(
        { error: 'Failed to fetch league settings' },
        { status: 500 }
      );
    }

    // 3. 检查当前成员数
    const { data: currentMembers, error: membersError } = await supabase
      .from('league_members')
      .select('manager_id')
      .eq('league_id', leagueId);

    if (membersError) {
      console.error('Supabase members error:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch league members' },
        { status: 500 }
      );
    }

    // 4. 检查是否已经是成员
    const alreadyMember = currentMembers.some(m => m.manager_id === manager_id);
    if (alreadyMember) {
      return NextResponse.json(
        { error: 'You are already a member of this league' },
        { status: 400 }
      );
    }

    // 5. 检查是否已满
    if (currentMembers.length >= leagueSettings.max_teams) {
      return NextResponse.json(
        { error: 'League is full' },
        { status: 400 }
      );
    }

    // 6. 获取 manager 信息（用于 nickname）
    const { data: managerData, error: managerError } = await supabase
      .from('managers')
      .select('name')
      .eq('manager_id', manager_id)
      .single();

    if (managerError) {
      console.error('Supabase manager error:', managerError);
      return NextResponse.json(
        { error: 'Manager not found' },
        { status: 404 }
      );
    }

    // 7. 插入新成员
    const { error: insertError } = await supabase
      .from('league_members')
      .insert({
        league_id: leagueId,
        manager_id: manager_id,
        nickname: managerData.name,
        role: 'member',
        joined_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to join league', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the league',
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
