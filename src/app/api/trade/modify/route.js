import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'
import { checkEliminatedStatus } from '@/lib/checkEliminated'

function getUTCFormat() {
  const date = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    date.getFullYear() + '-' +
    pad(date.getMonth() + 1) + '-' +
    pad(date.getDate()) + ' ' +
    pad(date.getHours()) + ':' +
    pad(date.getMinutes()) + ':' +
    pad(date.getSeconds()) + '+00:00'
  )
}

function getDateList(startStr, endStr) {
  const list = []
  const startDate = new Date(`${startStr}T00:00:00`)
  const endDate = new Date(`${endStr}T00:00:00`)
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    list.push(`${year}-${month}-${day}`)
  }
  return list
}

async function getPlayerNo(playerName) {
  const { data, error } = await supabase
    .from('playerslist')
    .select('Player_no')
    .eq('Name', playerName)
    .single()
  if (error || !data) throw new Error(`找不到球員：${playerName}`)
  return data.Player_no
}

async function dropAndAdd(fromId, toId, playerName, dateList, transaction_time) {
  const playerNo = await getPlayerNo(playerName)

  await supabase.from('transactions').insert([{
    transaction_time,
    manager_id: fromId,
    type: 'Trade Drop',
    Player_no: playerNo
  }])
  await supabase
    .from('assigned_position_history')
    .delete()
    .in('date', dateList)
    .eq('manager_id', fromId)
    .eq('player_name', playerName)

  await supabase.from('transactions').insert([{
    transaction_time,
    manager_id: toId,
    type: 'Trade Add',
    Player_no: playerNo
  }])
  const addRows = dateList.map(date => ({
    date,
    manager_id: toId,
    player_name: playerName,
    position: 'BN'
  }))
  await supabase.from('assigned_position_history').insert(addRows)

  const { data: oldAssigns, error } = await supabase
    .from('assigned_position_history')
    .select('*')
    .in('date', dateList)
    .eq('manager_id', fromId)
    .eq('player_name', playerName)

  if (error) {
    console.warn(`⚠️ 讀取 ${playerName} 原先歷史資料失敗`, error.message)
    return
  }

  if (oldAssigns?.length) {
    const updated = oldAssigns.map(row => ({
      ...row,
      manager_id: toId,
      position: 'BN'
    }))
    await supabase
      .from('assigned_position_history')
      .delete()
      .in('id', oldAssigns.map(r => r.id))
    await supabase
      .from('assigned_position_history')
      .insert(updated)
  }
}

export async function POST(req) {
  try {
    const { id, type, myManagerId, opponentManagerId, myPlayers, opponentPlayers } = await req.json()
    const transaction_time = getUTCFormat()
    const todayStr = new Date().toISOString().slice(0, 10)
    const endStr = '2025-11-30'
    const dateList = getDateList(todayStr, endStr)

    const statusMap = {
      Accept: 'accepted',
      Reject: 'rejected',
      Cancel: 'canceled'
    }

    const status = statusMap[type] || 'unknown'

    if (!id || status === 'unknown') {
      return NextResponse.json({ error: '缺少交易 ID 或未知動作' }, { status: 400 })
    }

    // Fetch trade details to get league_id
    const { data: trade, error: tradeError } = await supabase
      .from('trade_discussion')
      .select('*')
      .eq('id', id)
      .single()

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }

    // Check if either party is eliminated
    if (trade.league_id) {
      const initiatorCheck = await checkEliminatedStatus(trade.league_id, trade.initiator_id);
      if (initiatorCheck.isEliminated) {
        return NextResponse.json({ error: initiatorCheck.reason || 'Already been eliminated' }, { status: 403 });
      }

      const receiverCheck = await checkEliminatedStatus(trade.league_id, trade.receiver_id);
      if (receiverCheck.isEliminated) {
        return NextResponse.json({ error: 'The other team has been eliminated' }, { status: 403 });
      }
    }

    // ✅ 更新 trade_discussion 狀態
    const { error } = await supabase
      .from('trade_discussion')
      .update({ status })
      .eq('id', id)

    if (error) {
      console.error('❌ 狀態更新失敗:', error)
      return NextResponse.json({ error: '更新狀態失敗', detail: error.message }, { status: 500 })
    }

    if (type === 'Accept') {
      if (!myManagerId || !opponentManagerId || !Array.isArray(myPlayers) || !Array.isArray(opponentPlayers)) {
        return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
      }

      // ✅ 使用 Promise.all 並行執行交易
      const tasks = [
        ...myPlayers.map(name => dropAndAdd(myManagerId, opponentManagerId, name, dateList, transaction_time)),
        ...opponentPlayers.map(name => dropAndAdd(opponentManagerId, myManagerId, name, dateList, transaction_time))
      ]
      await Promise.all(tasks)

      return NextResponse.json({ message: '交換完成 ✅ 並標記為 accepted' })
    }

    return NextResponse.json({ message: `狀態更新為 ${status} ✅` })
  } catch (err) {
    console.error('❌ 錯誤:', err)
    return NextResponse.json({ error: '內部錯誤', detail: err.message }, { status: 500 })
  }
}
