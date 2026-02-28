import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

// GET: Query individual player stats from 2025 tables
// ?player_id=xxx&type=batting|pitching
export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('player_id')
    const playerName = searchParams.get('name')
    const type = searchParams.get('type') || 'batting' // batting or pitching

    if (!playerId && !playerName) {
        return NextResponse.json({ success: false, error: 'Missing player_id or name' }, { status: 400 })
    }

    const table = type === 'pitching' ? 'pitching_stats_2025' : 'batting_stats_2025'

    try {
        let query = supabase
            .from(table)
            .select('*')
            .order('game_date', { ascending: true })

        if (playerId) {
            query = query.eq('player_id', playerId)
        } else if (playerName) {
            query = query.eq('name', playerName)
        }

        const { data, error } = await query

        if (error) throw error

        return NextResponse.json({ success: true, data: data || [] })
    } catch (err) {
        console.error('Stats Verify Query Error:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}

// DELETE: Delete a specific stat entry by id
export async function DELETE(request) {
    try {
        const body = await request.json()
        const { id, type } = body

        if (!id || !type) {
            return NextResponse.json({ success: false, error: 'Missing id or type' }, { status: 400 })
        }

        const table = type === 'pitching' ? 'pitching_stats_2025' : 'batting_stats_2025'

        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Stats Verify Delete Error:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
