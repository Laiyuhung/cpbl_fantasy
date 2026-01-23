import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

// ➤ 新增一筆 trade_discussion 紀錄
export async function POST(req) {
  try {
    const body = await req.json()
    const {
      initiator_id,
      receiver_id,
      initiator_received,
      receiver_received
    } = body

    console.log('✅ 檢查參數:', {
      initiator_id,
      receiver_id,
      initiator_received,
      receiver_received
    })

    // ✅ 基本參數檢查
    if (!initiator_id || !receiver_id || !Array.isArray(initiator_received) || !Array.isArray(receiver_received)) {
      return NextResponse.json({ error: '缺少參數或格式錯誤' }, { status: 400 })
    }

    // ➤ 寫入資料表
    const { error } = await supabase.from('trade_discussion').insert([{
      initiator_id,
      receiver_id,
      initiator_received,
      receiver_received,
      status: 'pending'
    }])

    if (error) {
      console.error('❌ 寫入失敗:', error)
      if (error.message.includes('idx_unique_pending_trade')) {
        return NextResponse.json({ error: 'You already have a pending trade with this proposal.' }, { status: 400 })
      }
      return NextResponse.json({ error: '寫入資料庫失敗', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: '已建立交易討論 ✅' })
  } catch (err) {
    console.error('❌ 發生錯誤:', err)
    return NextResponse.json({ error: '伺服器錯誤', detail: err.message }, { status: 500 })
  }
}
