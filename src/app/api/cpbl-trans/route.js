import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || new Date().getMonth() + 1
    const year = searchParams.get('year') || new Date().getFullYear()
    const saveToDb = searchParams.get('save') === 'true'

    const url = `https://www.cpbl.com.tw/player/trans?year=${year}&month=${month}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const transactions = []
    let lastDate = '' // 追蹤上一個日期，處理合併儲存格

    // 找到表格並解析
    $('table tbody tr').each((index, element) => {
      const tds = $(element).find('td')
      
      if (tds.length >= 4) {
        // 正常情況：有4個欄位（日期、球員、球隊、異動原因）
        const date = $(tds[0]).text().trim()
        if (date) {
          lastDate = date // 更新最後看到的日期
        }
        
        transactions.push({
          date: date || lastDate, // 如果沒有日期，使用上一個日期
          player: $(tds[1]).text().trim(),
          team: $(tds[2]).text().trim(),
          reason: $(tds[3]).text().trim(),
        })
      } else if (tds.length === 3) {
        // 合併儲存格情況：只有3個欄位（球員、球隊、異動原因）
        // 使用上一個記錄的日期
        transactions.push({
          date: lastDate,
          player: $(tds[0]).text().trim(),
          team: $(tds[1]).text().trim(),
          reason: $(tds[2]).text().trim(),
        })
      }
    })

    // 如果需要儲存到資料庫
    if (saveToDb && transactions.length > 0) {
      // 先刪除該月份的舊資料
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0)
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`
      
      await supabase
        .from('trans_cpbl')
        .delete()
        .gte('move_date', startDate)
        .lte('move_date', endDateStr)

      // 準備插入的資料
      const insertData = []
      
      for (const trans of transactions) {
        // Match player_id from player_list
        const { data: players } = await supabase
          .from('player_list')
          .select('player_id')
          .eq('name', trans.player)
          .eq('team', trans.team)
          .limit(1)

        const playerId = players && players.length > 0 ? players[0].player_id : null

        if (playerId) {
          // 轉換日期格式 YYYY/MM/DD -> YYYY-MM-DD
          const dateStr = trans.date.replace(/\//g, '-')
          
          insertData.push({
            player_id: playerId,
            name: trans.player,
            team: trans.team,
            action: trans.reason,
            move_date: dateStr
          })
        }
      }

      // 批次插入資料
      if (insertData.length > 0) {
        const { error: insertError } = await supabase
          .from('trans_cpbl')
          .insert(insertData)

        if (insertError) {
          console.error('Insert error:', insertError)
        }
      }

      return NextResponse.json({ 
        success: true,
        year,
        month,
        transactions,
        savedCount: insertData.length,
        totalScraped: transactions.length
      })
    }

    return NextResponse.json({ 
      success: true,
      year,
      month,
      transactions 
    })

  } catch (error) {
    console.error('Error fetching CPBL transactions:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
