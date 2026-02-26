import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import supabase from '@/lib/supabase'

async function checkAdmin(userId) {
    const { data, error } = await supabase
        .from('admin')
        .select('manager_id')
        .eq('manager_id', userId)
        .single()
    return !error && data
}

// GET - 取得所有已登錄的 player_id
export async function GET(req) {
    try {
        const cookieStore = await cookies()
        const userId = cookieStore.get('user_id')?.value

        if (!userId || !(await checkAdmin(userId))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { data, error } = await supabase
            .from('season_start_registration')
            .select('player_id')

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const playerIds = data.map(row => row.player_id)
        return NextResponse.json({ playerIds }, { status: 200 })
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST - 新增球員至季初登錄（觸發 trg_auto_apply_reg trigger）
export async function POST(req) {
    try {
        const cookieStore = await cookies()
        const userId = cookieStore.get('user_id')?.value

        if (!userId || !(await checkAdmin(userId))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const body = await req.json()
        const { player_id } = body

        if (!player_id) {
            return NextResponse.json({ error: 'player_id is required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('season_start_registration')
            .insert([{ player_id }])
            .select()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, registration: data[0] }, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// DELETE - 從季初登錄移除球員
export async function DELETE(req) {
    try {
        const cookieStore = await cookies()
        const userId = cookieStore.get('user_id')?.value

        if (!userId || !(await checkAdmin(userId))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const playerId = searchParams.get('player_id')

        if (!playerId) {
            return NextResponse.json({ error: 'player_id is required' }, { status: 400 })
        }

        const { error } = await supabase
            .from('season_start_registration')
            .delete()
            .eq('player_id', playerId)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
