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
function formatIP(outs) {
  const fullInnings = Math.floor(outs / 3)
  const remainder = outs % 3
  return `${fullInnings}.${remainder}`
}

export async function POST(req) {
  try {
    const { date } = await req.json()
    const targetDate = date || getTaiwanToday()
    const { data: rawData, error } = await supabase
      .from('pitching_stats_2026')
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
          app: 0, gs: 0, rapp: 0, ip: 0, out: 0, tbf: 0, pc: 0, w: 0, l: 0, hld: 0, sv: 0, sv_hld: 0, rw: 0, rl: 0, h: 0, hr: 0, k: 0, bb: 0, ibb: 0, hbp: 0, ra: 0, er: 0, qs: 0, cg: 0, sho: 0, pg: 0, nh: 0, era: 0, whip: 0, win_pct: 0, k9: 0, bb9: 0, kbb: 0, h9: 0, obpa: 0
        })
      }
      const p = playerMap.get(playerName)
      const isStarter = row.position === 'SP'
      const isReliever = row.position === 'RP' || row.position === 'MR' || row.position === 'CL'
      const isWin = row.record === 'W'
      const isLoss = row.record === 'L'
      // IP/OUT
      const rawIP = row.innings_pitched || 0
      const outs = Math.floor(rawIP) * 3 + Math.round((rawIP % 1) * 10)
      p.app += 1
      p.gs += isStarter ? 1 : 0
      p.rapp += isReliever ? 1 : 0
      p.ip += rawIP
      p.out += outs
      p.tbf += row.batters_faced || 0
      p.pc += row.pitches_thrown || 0
      // 勝敗
      if (isWin) p.w++
      if (isLoss) p.l++
      if (row.record === 'HLD') p.hld++
      if (row.record === 'SV') p.sv++
      if (isWin && isReliever) p.rw++
      if (isLoss && isReliever) p.rl++
      p.sv_hld = p.sv + p.hld
      // 安打
      p.h += row.hits_allowed || 0
      p.hr += row.home_runs_allowed || 0
      p.k += row.strikeouts || 0
      p.bb += row.walks || 0
      p.ibb += row.ibb || 0
      p.hbp += row.hbp || 0
      p.ra += row.runs_allowed || 0
      p.er += row.earned_runs || 0
      // 品質
      if (rawIP >= 6 && (row.earned_runs || 0) <= 3) p.qs++
      const isCG = row.complete_game === 1
      if (isCG) {
        p.cg++
        if ((row.runs_allowed || 0) === 0) p.sho++
        if ((row.hits_allowed || 0) === 0) {
          p.nh++
          if ((row.walks || 0) === 0 && (row.hbp || 0) === 0) p.pg++
        }
      }
    }
    const results = []
    for (const [_, p] of playerMap.entries()) {
      // Rate stats
      const ip_raw = p.out / 3
      p.era = ip_raw ? Number((9 * p.er / ip_raw).toFixed(2)) : 0
      p.whip = ip_raw ? Number(((p.bb + p.h) / ip_raw).toFixed(2)) : 0
      p.win_pct = (p.w + p.l) > 0 ? Number((p.w / (p.w + p.l)).toFixed(3)) : 0
      p.k9 = ip_raw ? Number((9 * p.k / ip_raw).toFixed(2)) : 0
      p.bb9 = ip_raw ? Number((9 * p.bb / ip_raw).toFixed(2)) : 0
      p.kbb = p.bb > 0 ? Number((p.k / p.bb).toFixed(2)) : Number(p.k.toFixed(2))
      p.h9 = ip_raw ? Number((9 * p.h / ip_raw).toFixed(2)) : 0
      p.obpa = p.tbf > 0 ? Number(((p.h + p.bb + p.hbp) / p.tbf).toFixed(3)) : 0
      results.push({
        player_id: p.player_id,
        player_name: p.player_name,
        time_window: p.time_window,
        app: p.app,
        gs: p.gs,
        rapp: p.rapp,
        ip: formatIP(p.out),
        out: p.out,
        tbf: p.tbf,
        pc: p.pc,
        w: p.w,
        l: p.l,
        hld: p.hld,
        sv: p.sv,
        sv_hld: p.sv_hld,
        rw: p.rw,
        rl: p.rl,
        h: p.h,
        hr: p.hr,
        k: p.k,
        bb: p.bb,
        ibb: p.ibb,
        hbp: p.hbp,
        ra: p.ra,
        er: p.er,
        qs: p.qs,
        cg: p.cg,
        sho: p.sho,
        pg: p.pg,
        nh: p.nh,
        era: p.era,
        whip: p.whip,
        win_pct: p.win_pct,
        k9: p.k9,
        bb9: p.bb9,
        kbb: p.kbb,
        h9: p.h9,
        obpa: p.obpa
      })
    }
    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

