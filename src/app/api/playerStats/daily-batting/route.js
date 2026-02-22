import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

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
    const targetDate = date || getTaiwanToday()
    const { data: rawData, error } = await supabase
      .from('batting_stats_2026')
      .select('*')
      .eq('is_major', true)
      .eq('game_date', targetDate)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const playerMap = new Map()
    for (const row of (rawData || [])) {
      const playerName = cleanName(row.name)
      if (!playerName) continue
      const playerId = row.player_id || null
      if (!playerMap.has(playerName)) {
        playerMap.set(playerName, {
          player_id: playerId,
          player_name: playerName,
          time_window: targetDate,
          r: 0, hr: 0, rbi: 0, sb: 0, cs: 0, k: 0, avg: 0, '1b': 0, '2b': 0, '3b': 0, ab: 0, bb: 0, cyc: 0, gidp: 0, gp: 0, h: 0, hbp: 0, obp: 0, ops: 0, pa: 0, sf: 0, sh: 0, slg: 0, tb: 0, xbh: 0
        })
      }
      const p = playerMap.get(playerName)
      p.gp += 1
      p.ab += row.at_bats || 0
      p.r += row.runs || 0
      p.h += row.hits || 0
      p['2b'] += row.doubles || 0
      p['3b'] += row.triples || 0
      p.hr += row.home_runs || 0
      p.rbi += row.rbis || 0
      p.k += row.strikeouts || 0
      p.bb += row.walks || 0
      p.hbp += row.hbp || row.hit_by_pitch || 0
      p.sh += row.sacrifice_bunts || 0
      p.sf += row.sacrifice_flies || 0
      p.sb += row.stolen_bases || 0
      p.cs += row.caught_stealing || 0
      p.gidp += row.double_plays || 0
      // 計算 1b, xbh, tb
      p['1b'] += Math.max(0, (row.hits || 0) - (row.doubles || 0) - (row.triples || 0) - (row.home_runs || 0))
      p.xbh += (row.doubles || 0) + (row.triples || 0) + (row.home_runs || 0)
      p.tb += p['1b'] + (p['2b'] * 2) + (p['3b'] * 3) + (p.hr * 4)
      // PA
      p.pa += p.ab + p.bb + p.hbp + p.sf + p.sh
      // AVG, OBP, SLG, OPS
      p.avg = p.ab ? Number((p.h / p.ab).toFixed(3)) : 0
      const obpDen = p.ab + p.bb + p.hbp + p.sf
      p.obp = obpDen ? Number(((p.h + p.bb + p.hbp) / obpDen).toFixed(3)) : 0
      p.slg = p.ab ? Number((p.tb / p.ab).toFixed(3)) : 0
      p.ops = Number((p.obp + p.slg).toFixed(3))
      // CYC: 單場有1b,2b,3b,hr各>=1才算
      p.cyc = (p['1b'] >= 1 && p['2b'] >= 1 && p['3b'] >= 1 && p.hr >= 1) ? 1 : 0
    }
    const results = []
    for (const [_, p] of playerMap.entries()) {
      results.push(p)
    }
    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
