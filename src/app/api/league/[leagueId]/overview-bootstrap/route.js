import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLeagueOverviewData } from '@/lib/getLeagueOverviewData';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Overview bootstrap beta is admin-only' }, { status: 403 });
    }

    const { data: adminData, error: adminError } = await supabase
      .from('admin')
      .select('manager_id')
      .eq('manager_id', userId)
      .maybeSingle();

    if (adminError) {
      return NextResponse.json({ success: false, error: adminError.message }, { status: 500 });
    }

    if (!adminData) {
      return NextResponse.json({ success: false, error: 'Overview bootstrap beta is admin-only' }, { status: 403 });
    }

    const payload = await getLeagueOverviewData(supabase, leagueId);

    return NextResponse.json({
      ...payload,
      apiIntegrationBeta: true,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode === 404) {
      return NextResponse.json(
        { success: false, error: 'League not found', details: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: statusCode }
    );
  }
}
