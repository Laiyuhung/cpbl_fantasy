import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getLeagueOverviewData } from '@/lib/getLeagueOverviewData';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request, { params }) {
  try {
    const { leagueId } = params;
    const payload = await getLeagueOverviewData(supabase, leagueId);

    return NextResponse.json(
      payload,
      {
        headers: {
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45'
        }
      }
    );
  } catch (error) {
    console.error('Server error:', error);
    const statusCode = error.statusCode || 500;

    if (statusCode === 404) {
      return NextResponse.json(
        { error: 'League not found', details: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: statusCode }
    );
  }
}

// DELETE: Delete entire league (Commissioner only)
export async function DELETE(request, { params }) {
  try {
    const { leagueId } = params;

    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: 'League ID is required' },
        { status: 400 }
      );
    }

    // Check if league is finalized (record exists = finalized)
    const { data: finalizedStatus, error: finalizedError } = await supabase
      .from('league_finalized_status')
      .select('league_id')
      .eq('league_id', leagueId)
      .single();

    if (!finalizedError && finalizedStatus) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete finalized league. Please unlock teams first.' },
        { status: 403 }
      );
    }

    // Remove test_league linkage first to avoid FK constraint conflicts.
    const { error: testLeagueDeleteError } = await supabase
      .from('test_league')
      .delete()
      .eq('league_id', leagueId);

    if (testLeagueDeleteError) {
      console.error('Error deleting test_league row:', testLeagueDeleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete test_league relation', details: testLeagueDeleteError.message },
        { status: 500 }
      );
    }

    // Delete league_settings will cascade delete all related data
    const { error: deleteError } = await supabase
      .from('league_settings')
      .delete()
      .eq('league_id', leagueId);

    if (deleteError) {
      console.error('Error deleting league:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete league', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'League deleted successfully'
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}