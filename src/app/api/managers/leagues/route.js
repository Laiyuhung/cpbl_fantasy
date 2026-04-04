import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getManagerLeagues } from '@/lib/getManagerLeagues';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const enrichedLeagues = await getManagerLeagues(supabase, user_id);

    return NextResponse.json({ leagues: enrichedLeagues });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}
