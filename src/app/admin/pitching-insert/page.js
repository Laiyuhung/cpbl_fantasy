'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PitchingInsertPage() {
  const router = useRouter()
  const todayStr = new Date().toISOString().split('T')[0]
  
  const [text, setText] = useState('')
  const [date, setDate] = useState(todayStr)
  const [isMajor, setIsMajor] = useState(true)
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [preview, setPreview] = useState([])
  const [playerMap, setPlayerMap] = useState({}) // name -> player_id
  const [message, setMessage] = useState({ type: '', text: '' })

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const res = await fetch('/api/admin/check')
        const data = await res.json()
        
        if (!data.isAdmin) {
          alert('You do not have admin privileges')
          router.push('/home')
          return
        }
        
        setIsAdmin(true)
      } catch (err) {
        console.error('Failed to check admin status:', err)
        alert('Failed to check permissions')
        router.push('/home')
      } finally {
        setCheckingAdmin(false)
      }
    }
    checkAdminStatus()
  }, [router])

  // Fetch all players for name matching
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch('/api/playerslist')
        const data = await res.json()
        if (data.success && data.players) {
          const map = {}
          data.players.forEach(p => {
            map[p.name] = p.player_id
          })
          setPlayerMap(map)
        }
      } catch (err) {
        console.error('Failed to fetch players:', err)
      }
    }
    fetchPlayers()
  }, [])

  // Parse innings pitched (e.g., "5" -> 5, "11/3" -> 1.1, "2/3" -> 0.2)
  const parseInnings = (str) => {
    if (str.includes('/')) {
      const [whole, fraction] = str.split('/').map(Number)
      if (!isNaN(whole) && !isNaN(fraction) && fraction === 3) {
        if (whole < 10) {
          return whole === 1 ? 0.1 : whole === 2 ? 0.2 : 0
        } else {
          const intPart = Math.floor(whole / 10)
          const outPart = whole % 10
          return intPart + (outPart === 1 ? 0.1 : outPart === 2 ? 0.2 : 0)
        }
      }
      return 0
    }
    return parseFloat(str) || 0
  }

  // Parse the pasted text
  const parseText = (rawText) => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l)
    
    // Skip first line if it's a header (contains team name and column headers)
    const dataLines = lines.filter(line => {
      const firstPart = line.split(/\s+/)[0]
      return !isNaN(parseInt(firstPart)) // Lines starting with a number
    })

    return dataLines.map(line => {
      // Replace full-width parentheses
      line = line.replace(/（/g, '(').replace(/）/g, ')')
      
      const parts = line.split(/\s+/)
      
      // First part is sequence number
      const sequence = parseInt(parts[0]) || 0
      
      // Parse name and record
      let name = parts[1] || ''
      let record = null
      let statStart = 2
      
      // Check if there's a record like "(H,4)" or "(L,3-1)" after name
      if (parts[2] && /^\(.*\)$/.test(parts[2])) {
        record = parts[2].replace(/[()]/g, '')
        statStart = 3
      }
      
      // Get stats
      const stats = parts.slice(statStart).map(p => p.replace(/[()]/g, ''))
      
      // Ensure we have 17 stats (pad with 0 if needed)
      while (stats.length < 17) stats.push('0')
      
      const toInt = val => parseInt(val) || 0
      const toFloat = val => parseFloat(val) || 0

      return {
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
        player_id: playerMap[name] || null
      }
    })
  }

  // Update preview when text changes
  useEffect(() => {
    if (text.trim()) {
      setPreview(parseText(text))
    } else {
      setPreview([])
    }
  }, [text, playerMap])

  // Submit data
  const handleSubmit = async () => {
    if (!text.trim()) {
      setMessage({ type: 'error', text: '請貼上投手數據' })
      return
    }

    if (preview.length === 0) {
      setMessage({ type: 'error', text: '無法解析任何數據' })
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const res = await fetch('/api/pitching-insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: preview.map(p => ({
            name: p.name,
            innings_pitched: p.innings_pitched,
            batters_faced: p.batters_faced,
            pitches_thrown: p.pitches_thrown,
            strikes_thrown: p.strikes_thrown,
            hits_allowed: p.hits_allowed,
            home_runs_allowed: p.home_runs_allowed,
            walks: p.walks,
            ibb: p.ibb,
            hbp: p.hbp,
            strikeouts: p.strikeouts,
            wild_pitches: p.wild_pitches,
            balks: p.balks,
            runs_allowed: p.runs_allowed,
            earned_runs: p.earned_runs,
            errors: p.errors,
            era: p.era,
            whip: p.whip,
            game_date: date,
            is_major: isMajor,
            record: p.record,
            player_id: p.player_id
          })),
          table: 'pitching_stats_2026'
        })
      })

      const data = await res.json()
      
      if (data.success) {
        setMessage({ type: 'success', text: `✅ 成功插入 ${preview.length} 筆投手數據` })
        setText('')
        setPreview([])
      } else {
        setMessage({ type: 'error', text: `❌ 錯誤: ${data.error}` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: `❌ 錯誤: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  if (checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-xl text-white">Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent">
              Pitching Stats Insert (2026)
            </h1>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-white rounded-lg border border-slate-500/30 transition-colors"
            >
              ← Back to Admin
            </button>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl border ${
            message.type === 'success' 
              ? 'bg-green-900/30 border-green-500/50 text-green-300' 
              : 'bg-red-900/30 border-red-500/50 text-red-300'
          }`}>
            {message.text}
          </div>
        )}

        {/* Input Form */}
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Date */}
            <div>
              <label className="block text-purple-300 text-sm font-semibold mb-2">Game Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800/60 border border-purple-500/30 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Is Major */}
            <div>
              <label className="block text-purple-300 text-sm font-semibold mb-2">League</label>
              <select
                value={isMajor ? 'major' : 'minor'}
                onChange={(e) => setIsMajor(e.target.value === 'major')}
                className="w-full bg-slate-800/60 border border-purple-500/30 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="major">一軍 (Major)</option>
                <option value="minor">二軍 (Minor)</option>
              </select>
            </div>

            {/* Submit Button */}
            <div className="flex items-end">
              <button
                onClick={handleSubmit}
                disabled={loading || preview.length === 0}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg"
              >
                {loading ? 'Inserting...' : `Insert ${preview.length} Records`}
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-purple-300 text-sm font-semibold mb-2">
              Paste Pitching Data (from CPBL box score)
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste data like:
1 後勁	5	22	93	56	4	0	1	（0）	0	8	1	0	3	2	1	2.23	1.20
2 施子謙 (H,4)	1	5	27	16	1	0	1	（0）	0	2	0	0	0	0	0	2.79	1.03`}
              rows={8}
              className="w-full bg-slate-800/60 border border-purple-500/30 text-white p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
          </div>
        </div>

        {/* Preview Table */}
        {preview.length > 0 && (
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl overflow-x-auto">
            <h2 className="text-xl font-bold text-white mb-4">Preview ({preview.length} records)</h2>
            <table className="w-full text-sm text-white">
              <thead>
                <tr className="border-b border-purple-500/30">
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Record</th>
                  <th className="p-2 text-center">IP</th>
                  <th className="p-2 text-center">BF</th>
                  <th className="p-2 text-center">NP</th>
                  <th className="p-2 text-center">STR</th>
                  <th className="p-2 text-center">H</th>
                  <th className="p-2 text-center">HR</th>
                  <th className="p-2 text-center">BB</th>
                  <th className="p-2 text-center">IBB</th>
                  <th className="p-2 text-center">HBP</th>
                  <th className="p-2 text-center">K</th>
                  <th className="p-2 text-center">WP</th>
                  <th className="p-2 text-center">BK</th>
                  <th className="p-2 text-center">R</th>
                  <th className="p-2 text-center">ER</th>
                  <th className="p-2 text-center">E</th>
                  <th className="p-2 text-center">ERA</th>
                  <th className="p-2 text-center">WHIP</th>
                  <th className="p-2 text-center">Player ID</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, idx) => (
                  <tr key={idx} className="border-b border-purple-500/20 hover:bg-purple-500/10">
                    <td className="p-2">{p.sequence}</td>
                    <td className="p-2 font-semibold">{p.name}</td>
                    <td className="p-2">{p.record || '-'}</td>
                    <td className="p-2 text-center">{p.innings_pitched}</td>
                    <td className="p-2 text-center">{p.batters_faced}</td>
                    <td className="p-2 text-center">{p.pitches_thrown}</td>
                    <td className="p-2 text-center">{p.strikes_thrown}</td>
                    <td className="p-2 text-center">{p.hits_allowed}</td>
                    <td className="p-2 text-center">{p.home_runs_allowed}</td>
                    <td className="p-2 text-center">{p.walks}</td>
                    <td className="p-2 text-center">{p.ibb}</td>
                    <td className="p-2 text-center">{p.hbp}</td>
                    <td className="p-2 text-center">{p.strikeouts}</td>
                    <td className="p-2 text-center">{p.wild_pitches}</td>
                    <td className="p-2 text-center">{p.balks}</td>
                    <td className="p-2 text-center">{p.runs_allowed}</td>
                    <td className="p-2 text-center">{p.earned_runs}</td>
                    <td className="p-2 text-center">{p.errors}</td>
                    <td className="p-2 text-center">{p.era}</td>
                    <td className="p-2 text-center">{p.whip}</td>
                    <td className={`p-2 text-center text-xs ${p.player_id ? 'text-green-400' : 'text-red-400'}`}>
                      {p.player_id ? '✓' : '✗'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
