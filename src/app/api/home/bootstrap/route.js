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

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Home bootstrap beta is admin-only' }, { status: 403 });
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
      return NextResponse.json({ success: false, error: 'Home bootstrap beta is admin-only' }, { status: 403 });
    }

    const [settingRes, announcementsRes] = await Promise.all([
      supabaseAdmin
        .from('system_settings')
        .select('value_bool')
        .eq('key', CREATE_LEAGUE_SETTING_KEY)
        .maybeSingle(),
      supabaseAdmin
        .from('announcements')
        .select('id, title, content, created_at, updated_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
    ]);

    if (settingRes.error) {
      return NextResponse.json({ success: false, error: settingRes.error.message }, { status: 500 });
    }

    if (announcementsRes.error) {
      return NextResponse.json({ success: false, error: announcementsRes.error.message }, { status: 500 });
    }

    const payload = {
      success: true,
      apiIntegrationBeta: true,
      isGuest: !userId,
      createLeagueDisabled: Boolean(settingRes.data?.value_bool),
      announcements: announcementsRes.data || [],
      user: null,
      leagues: [],
    };

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
      name: managerRes.data.name,
      email_verified: managerRes.data.email_verified,
      is_admin: Boolean(adminRes.data),
    };
    payload.leagues = leagues;

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
