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

// GET - 取得所有開季一軍的 player_id
export async function GET(req) {
    try {
        const cookieStore = await cookies()
        const userId = cookieStore.get('user_id')?.value

        if (!userId || !(await checkAdmin(userId))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { data, error } = await supabase
            .from('season_start_major')
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

// POST - 新增球員至開季一軍（觸發 trg_auto_apply_major trigger）
// 必須先有季初登錄才能設定開季一軍
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

        // 檢查是否已季初登錄
        const { data: regData, error: regError } = await supabase
            .from('season_start_registration')
            .select('id')
            .eq('player_id', player_id)
            .maybeSingle()

        if (regError) {
            return NextResponse.json({ error: regError.message }, { status: 500 })
        }

        if (!regData) {
            return NextResponse.json(
                { error: '該球員尚未季初登錄，無法設定開季一軍' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('season_start_major')
            .insert([{ player_id }])
            .select()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, major: data[0] }, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// DELETE - 從開季一軍移除球員
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
            .from('season_start_major')
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
