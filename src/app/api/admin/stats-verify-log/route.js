import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

// GET: Fetch all verified players (or check a specific player)
export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('player_id')

    try {
        let query = supabase
            .from('stats_verify_log')
            .select('*')
            .order('verified_at', { ascending: false })

        if (playerId) {
            query = query.eq('player_id', playerId)
        }

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, data: data || [] })
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}

// POST: Mark a player as verified
export async function POST(request) {
    try {
        const body = await request.json()
        const { player_id, player_name, verified_type, status, notes } = body

        if (!player_id || !player_name) {
            return NextResponse.json({ success: false, error: 'Missing player_id or player_name' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('stats_verify_log')
            .insert({
                player_id,
                player_name,
                verified_type: verified_type || 'batting',
                status: status || 'checked',
                notes: notes || null
            })
            .select()

        if (error) throw error

        return NextResponse.json({ success: true, data: data?.[0] })
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}

// DELETE: Remove a verification entry
export async function DELETE(request) {
    try {
        const body = await request.json()
        const { id } = body

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
        }

        const { error } = await supabase
            .from('stats_verify_log')
            .delete()
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
