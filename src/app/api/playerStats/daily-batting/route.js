import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

// Get Taiwan today's date
const getTaiwanToday = () => {
  const now = new Date()
  const taiwanOffset = 8 * 60 * 60 * 1000
  const taiwanTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + taiwanOffset)
  return taiwanTime.toISOString().split('T')[0]
}

function cleanName(name) {
  return (name || '').replace(/[#◎＊*]/g, '').trim()
}

export async function POST(req) {
  try {
    const { date } = await req.json()
    
    // Use provided date or default to Taiwan today
    const targetDate = date || getTaiwanToday()

    // Query batting_stats_2026 for the specific date
    const { data: rawData, error } = await supabase
      .from('batting_stats_2026')
      .select('*')
      .eq('is_major', true)
      .eq('game_date', targetDate)

    if (error) {
      console.error('❌ 查詢 batting_stats_2026 失敗:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by player name and aggregate stats
    const playerMap = new Map()
    
    for (const row of (rawData || [])) {
      const playerName = cleanName(row.name)
      if (!playerName) continue
      
      if (!playerMap.has(playerName)) {
        playerMap.set(playerName, {
          GP: 0, PA: 0, AB: 0, H: 0, '1B': 0, '2B': 0, '3B': 0, HR: 0, XBH: 0, TB: 0, R: 0, RBI: 0, K: 0, BB: 0, HBP: 0, SH: 0, SF: 0, SB: 0, CS: 0, GIDP: 0, CYC: 0, AVG: 0, OBP: 0, SLG: 0, OPS: 0
        })
      }
      
      const p = playerMap.get(playerName)
      p.GP += 1
      p.AB += row.at_bats || 0
      p.R += row.runs || 0
      p.H += row.hits || 0
      p['2B'] += row.doubles || 0
      p['3B'] += row.triples || 0
      p.HR += row.home_runs || 0
      p.RBI += row.rbis || 0
      p.K += row.strikeouts || 0
      p.BB += row.walks || 0
      p.HBP += row.hbp || row.hit_by_pitch || 0
      p.SH += row.sacrifice_bunts || 0
      p.SF += row.sacrifice_flies || 0
      p.SB += row.stolen_bases || 0
      p.CS += row.caught_stealing || 0
      p.GIDP += row.double_plays || 0
      // 計算 1B, XBH, TB
      p['1B'] += Math.max(0, (row.hits || 0) - (row.doubles || 0) - (row.triples || 0) - (row.home_runs || 0))
      p.XBH += (row.doubles || 0) + (row.triples || 0) + (row.home_runs || 0)
      p.TB += p['1B'] + (p['2B'] * 2) + (p['3B'] * 3) + (p.HR * 4)
      // PA
      p.PA += p.AB + p.BB + p.HBP + p.SF + p.SH
      // AVG, OBP, SLG, OPS
      p.AVG = p.AB ? p.H / p.AB : 0
      const OBP_den = p.AB + p.BB + p.HBP + p.SF
      p.OBP = OBP_den ? (p.H + p.BB + p.HBP) / OBP_den : 0
      p.SLG = p.AB ? p.TB / p.AB : 0
      p.OPS = p.OBP + p.SLG
      // CYC: 無法判斷單場，設 0
      p.CYC = 0
    }

    const results = []
    for (const [name, p] of playerMap.entries()) {
      results.push({
        name,
        GP: p.GP,
        PA: p.PA,
        AB: p.AB,
        H: p.H,
        '1B': p['1B'],
        '2B': p['2B'],
        '3B': p['3B'],
        HR: p.HR,
        XBH: p.XBH,
        TB: p.TB,
        R: p.R,
        RBI: p.RBI,
        K: p.K,
        BB: p.BB,
        HBP: p.HBP,
        SH: p.SH,
        SF: p.SF,
        SB: p.SB,
        CS: p.CS,
        GIDP: p.GIDP,
        CYC: p.CYC,
        AVG: p.AVG.toFixed(3),
        OBP: p.OBP.toFixed(3),
        SLG: p.SLG.toFixed(3),
        OPS: p.OPS.toFixed(3)
      })
    }

    console.log(`✅ daily-batting: ${targetDate} 共 ${results.length} 筆`)
    return NextResponse.json(results)

  } catch (err) {
    console.error('❌ daily-batting 錯誤:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
