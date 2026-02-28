import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

export async function POST(req) {
  try {
    const body = await req.json()

    // New format: pre-parsed records with table specification
    if (body.records && Array.isArray(body.records)) {
      const { records, table } = body
      const targetTable = table || 'pitching_stats_2026'

      // Validate table name to prevent SQL injection
      const allowedTables = ['pitching_stats', 'pitching_stats_2025', 'pitching_stats_2026']
      if (!allowedTables.includes(targetTable)) {
        return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
      }

      console.log(`🟡 Inserting ${records.length} records into ${targetTable}`)

      const { error } = await supabase.from(targetTable).insert(records)

      if (error) {
        console.error('❌ Supabase insert 錯誤:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, count: records.length })
    }

    // Legacy format: text parsing
    const { text, date, isMajor } = body
    if (!text || !date || typeof isMajor !== 'boolean') {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line)
    console.log('🟡 接收到資料筆數:', lines.length)

    const parseInnings = (str) => {
      if (str.includes('/')) {
        const [whole, fraction] = str.split('/').map(Number)

        if (!isNaN(whole) && !isNaN(fraction) && fraction === 3) {
          if (whole < 10) {
            // 純 1/3 或 2/3
            return whole === 1 ? 0.1 : whole === 2 ? 0.2 : 0
          } else {
            // 11/3 ➝ 1.1，12/3 ➝ 1.2 ...
            const intPart = Math.floor(whole / 10)
            const outPart = whole % 10
            return intPart + (outPart === 1 ? 0.1 : outPart === 2 ? 0.2 : 0)
          }
        }

        return 0
      }

      return parseFloat(str) || 0
    }


    const parseLine = (line, index) => {
      const parts = line.trim().split(/\s+/)

      const sequence = parseInt(parts[0]) || 0
      const name = parts[1] || ''

      let record = null
      let statStart = 2

      // 如果第三欄是括號格式 => 有 record
      if (/^\(.*\)$/.test(parts[2])) {
        record = parts[2].replace(/[()]/g, '').split(',')[0]
        statStart = 3
      }

      const stats = parts.slice(statStart).map(p => p.replace(/[（）]/g, ''))
      if (stats.length > 17) stats.length = 17
      while (stats.length < 17) stats.push('0')

      const toInt = val => parseInt(val) || 0
      const toFloat = val => parseFloat(val) || 0

      const parsed = {
        sequence,
        name,
        record,
        innings_pitched: parseInnings(stats[0]),
        batters_faced: toInt(stats[1]),
        pitches_thrown: toInt(stats[2]),
        strikes_thrown: toInt(stats[3]),
        hits_allowed: toInt(stats[4]),
        home_runs_allowed: toInt(stats[5]),
        walks: toInt(stats[6]),
        ibb: toInt(stats[7]),
        hbp: toInt(stats[8]),
        strikeouts: toInt(stats[9]),
        wild_pitches: toInt(stats[10]),
        balks: toInt(stats[11]),
        runs_allowed: toInt(stats[12]),
        earned_runs: toInt(stats[13]),
        errors: toInt(stats[14]),
        era: toFloat(stats[15]),
        whip: toFloat(stats[16]),
        game_date: date,
        is_major: isMajor
      }

      console.log(`✅ 第 ${index + 1} 筆解析結果:`, parsed)
      return parsed
    }

    const records = lines.map((line, i) => parseLine(line, i))

    const { error } = await supabase.from('pitching_stats').insert(records)

    if (error) {
      console.error('❌ Supabase insert 錯誤:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('❌ API 例外錯誤:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
