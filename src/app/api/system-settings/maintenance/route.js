'use server';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value_bool, updated_at')
      .eq('key', 'under_maintenance')
      .single();

    if (error) {
      console.error('Error fetching maintenance status:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      underMaintenance: data?.value_bool || false,
      updatedAt: data?.updated_at
    });
  } catch (e) {
    console.error('Maintenance status error:', e);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    // Check if user is admin
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

    if (userRole !== 'admin') {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { underMaintenance } = body;

    if (typeof underMaintenance !== 'boolean') {
      return Response.json(
        { success: false, error: 'underMaintenance must be a boolean' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('system_settings')
      .update({ value_bool: underMaintenance })
      .eq('key', 'under_maintenance')
      .select();

    if (error) {
      console.error('Error updating maintenance status:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      underMaintenance: data[0]?.value_bool || false,
      message: underMaintenance ? 'Maintenance mode enabled' : 'Maintenance mode disabled'
    });
  } catch (e) {
    console.error('Maintenance update error:', e);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
