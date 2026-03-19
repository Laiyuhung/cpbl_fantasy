import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabaseAdmin from '@/lib/supabaseAdmin';

const SETTING_KEY = 'disable_create_league';

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data, error } = await supabaseAdmin
    .from('admin')
    .select('manager_id')
    .eq('manager_id', userId)
    .single();

  if (error || !data) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId };
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value_bool, updated_at')
      .eq('key', SETTING_KEY)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      disabled: Boolean(data?.value_bool),
      updatedAt: data?.updated_at || null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const disabled = body?.disabled;

    if (typeof disabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'disabled must be boolean' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({ key: SETTING_KEY, value_bool: disabled }, { onConflict: 'key' })
      .select('value_bool, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      disabled: Boolean(data?.value_bool),
      updatedAt: data?.updated_at || null,
      message: disabled ? 'Create league disabled' : 'Create league enabled',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
