import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'

export async function POST() {
  try {
    const { error } = await supabaseAdmin.rpc('update_matchup_scores')

    if (error) {
      console.error('[Update Matchup Scores API] RPC Error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Matchup scores updated successfully',
      updated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Update Matchup Scores API] Server Error:', error)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}