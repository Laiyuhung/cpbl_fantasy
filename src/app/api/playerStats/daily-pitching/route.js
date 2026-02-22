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

function formatIP(outs) {
  const fullInnings = Math.floor(outs / 3)
  const remainder = outs % 3
  return `${fullInnings}.${remainder}`
}

export async function POST(req) {
  try {
    const { date } = await req.json()
    
    // Use provided date or default to Taiwan today
    const targetDate = date || getTaiwanToday()

    // Query pitching_stats_2026 for the specific date
    const { data: rawData, error } = await supabase
      .from('pitching_stats_2026')
      .select('*')
      .eq('is_major', true)
      .eq('game_date', targetDate)

    if (error) {
      console.error('❌ 查詢 pitching_stats_2026 失敗:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by player name and aggregate stats
    const playerMap = new Map()
    
    for (const row of (rawData || [])) {
      const playerName = cleanName(row.name)
      if (!playerName) continue
      
      if (!playerMap.has(playerName)) {
        playerMap.set(playerName, {
          APP: 0, GS: 0, RAPP: 0, IP: 0, OUT: 0, TBF: 0, PC: 0, W: 0, L: 0, HLD: 0, SV: 0, 'SV+HLD': 0, RW: 0, RL: 0, H: 0, HR: 0, K: 0, BB: 0, IBB: 0, HBP: 0, RA: 0, ER: 0, QS: 0, CG: 0, SHO: 0, PG: 0, NH: 0, ERA: 0, WHIP: 0, 'WIN%': 0, 'K/9': 0, 'BB/9': 0, 'K/BB': 0, 'H/9': 0, OBPA: 0
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
      
      p.APP += 1
      p.GS += isStarter ? 1 : 0
      p.RAPP += isReliever ? 1 : 0
      p.IP += rawIP
      p.OUT += outs
      p.TBF += row.batters_faced || 0
      p.PC += row.pitches_thrown || 0
      
      // 勝敗
      if (isWin) p.W++
      if (isLoss) p.L++
      if (row.record === 'HLD') p.HLD++
      if (row.record === 'SV') p.SV++
      if (isWin && isReliever) p.RW++
      if (isLoss && isReliever) p.RL++
      p['SV+HLD'] = p.SV + p.HLD
      
      // 安打
      p.H += row.hits_allowed || 0
      p.HR += row.home_runs_allowed || 0
      p.K += row.strikeouts || 0
      p.BB += row.walks || 0
      p.IBB += row.ibb || 0
      p.HBP += row.hbp || 0
      p.RA += row.runs_allowed || 0
      p.ER += row.earned_runs || 0
      
      // 品質
      if (rawIP >= 6 && (row.earned_runs || 0) <= 3) p.QS++
      
      const isCG = row.complete_game === 1
      if (isCG) {
        p.CG++
        if ((row.runs_allowed || 0) === 0) p.SHO++
        if ((row.hits_allowed || 0) === 0) {
          p.NH++
          if ((row.walks || 0) === 0 && (row.hbp || 0) === 0) p.PG++
        }
      }
    }

    const results = []
    for (const [name, p] of playerMap.entries()) {
      // Rate stats
      const IP_raw = p.OUT / 3
      p.ERA = IP_raw ? (9 * p.ER / IP_raw) : 0
      p.WHIP = IP_raw ? ((p.BB + p.H) / IP_raw) : 0
      p['WIN%'] = (p.W + p.L) > 0 ? (p.W / (p.W + p.L)) : 0
      p['K/9'] = IP_raw ? (9 * p.K / IP_raw) : 0
      p['BB/9'] = IP_raw ? (9 * p.BB / IP_raw) : 0
      p['K/BB'] = p.BB > 0 ? (p.K / p.BB) : p.K
      p['H/9'] = IP_raw ? (9 * p.H / IP_raw) : 0
      p.OBPA = p.TBF > 0 ? ((p.H + p.BB + p.HBP) / p.TBF) : 0
      results.push({
        name,
        APP: p.APP,
        GS: p.GS,
        RAPP: p.RAPP,
        IP: formatIP(p.OUT),
        OUT: p.OUT,
        TBF: p.TBF,
        PC: p.PC,
        W: p.W,
        L: p.L,
        HLD: p.HLD,
        SV: p.SV,
        'SV+HLD': p['SV+HLD'],
        RW: p.RW,
        RL: p.RL,
        H: p.H,
        HR: p.HR,
        K: p.K,
        BB: p.BB,
        IBB: p.IBB,
        HBP: p.HBP,
        RA: p.RA,
        ER: p.ER,
        QS: p.QS,
        CG: p.CG,
        SHO: p.SHO,
        PG: p.PG,
        NH: p.NH,
        ERA: p.ERA.toFixed(2),
        WHIP: p.WHIP.toFixed(2),
        'WIN%': p['WIN%'].toFixed(3),
        'K/9': p['K/9'].toFixed(2),
        'BB/9': p['BB/9'].toFixed(2),
        'K/BB': p['K/BB'].toFixed(2),
        'H/9': p['H/9'].toFixed(2),
        OBPA: p.OBPA.toFixed(3)
      })
    }

    return NextResponse.json(results)

  } catch (err) {
    console.error('❌ daily-pitching 錯誤:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

