import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getManagerLeagues } from '@/lib/getManagerLeagues';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CREATE_LEAGUE_SETTING_KEY = 'disable_create_league';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value || null;

    const settingRes = await supabaseAdmin
      .from('system_settings')
      .select('value_bool')
      .eq('key', CREATE_LEAGUE_SETTING_KEY)
      .maybeSingle();

    if (settingRes.error) {
      return NextResponse.json({ success: false, error: settingRes.error.message }, { status: 500 });
    }

    const payload = {
      success: true,
      apiIntegrationBeta: true,
      createLeagueDisabled: Boolean(settingRes.data?.value_bool),
      isGuest: !userId,
      user: null,
      leagues: [],
    };

    if (!userId) {
      return NextResponse.json(payload);
    }

    const [managerRes, adminRes, leagues] = await Promise.all([
      supabase
        .from('managers')
        .select('name, email_verified')
        .eq('manager_id', userId)
        .single(),
      supabase
        .from('admin')
        .select('manager_id')
        .eq('manager_id', userId)
        .maybeSingle(),
      getManagerLeagues(supabase, userId),
    ]);

    if (managerRes.error || !managerRes.data) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (adminRes.error) {
      return NextResponse.json({ success: false, error: adminRes.error.message }, { status: 500 });
    }

    payload.user = {
      userId,
      manager_id: userId,
      name: managerRes.data.name,
      email_verified: managerRes.data.email_verified,
      is_admin: Boolean(adminRes.data),
      isAdmin: Boolean(adminRes.data),
    };
    payload.leagues = leagues || [];

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
