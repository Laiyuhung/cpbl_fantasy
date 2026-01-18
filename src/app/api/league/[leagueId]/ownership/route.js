import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

// GET - 獲取聯盟球員擁有權狀態
export async function GET(req, { params }) {
  try {
    const { leagueId } = params;

    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: 'League ID is required' },
        { status: 400 }
      );
    }

    // 獲取該聯盟所有球員的擁有權狀態
    const { data: ownerships, error } = await supabase
      .from('league_player_ownership')
      .select('*')
      .eq('league_id', leagueId);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch ownership data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ownerships: ownerships || [],
    });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: err.message },
      { status: 500 }
    );
  }
}
