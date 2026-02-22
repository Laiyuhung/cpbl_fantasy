'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StatsEntryPage() {
  const router = useRouter()
  
  // Get Taiwan today's date
  const getTaiwanToday = () => {
    const now = new Date()
    const taiwanOffset = 8 * 60 * 60 * 1000
    const taiwanTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + taiwanOffset)
    return taiwanTime.toISOString().split('T')[0]
  }
  
  // Tab state: 'pitching' or 'batting'
  const [activeTab, setActiveTab] = useState('pitching')
  
  // Common states
  const [date, setDate] = useState(getTaiwanToday())
  const [isMajor, setIsMajor] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [playerMap, setPlayerMap] = useState({}) // name -> player_id
  
  // Games for date
  const [gamesForDate, setGamesForDate] = useState([])
  const [fetchingGames, setFetchingGames] = useState(false)
  const [selectedGameUuid, setSelectedGameUuid] = useState('')
  const [detectedTeam, setDetectedTeam] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [homeScore, setHomeScore] = useState('')

  // Pitching states
  const [pitchingText, setPitchingText] = useState('')
  const [pitchingPreview, setPitchingPreview] = useState([])
  const [pitchingLoading, setPitchingLoading] = useState(false)
  const [pitchingMessage, setPitchingMessage] = useState({ type: '', text: '' })
  
  // Batting states
  const [battingText, setBattingText] = useState('')
  const [battingPreview, setBattingPreview] = useState([])
  const [battingLoading, setBattingLoading] = useState(false)
  const [battingMessage, setBattingMessage] = useState({ type: '', text: '' })

  const teams = ['統一獅', '中信兄弟', '樂天桃猿', '富邦悍將', '味全龍', '台鋼雄鷹']

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

  // Fetch games for selected date
  useEffect(() => {
    const fetchGames = async () => {
      if (!date) return
      setFetchingGames(true)
      try {
        const res = await fetch(`/api/admin/cpbl-schedule?date=${date}`)
        const data = await res.json()
        if (data.success) {
          // Filter by major/minor
          const filtered = data.data.filter(g => isMajor ? g.major_game !== false : g.major_game === false)
          setGamesForDate(filtered)
          setSelectedGameUuid('')
          setAwayScore('')
          setHomeScore('')
        }
      } catch (err) {
        console.error('Failed to fetch games:', err)
      } finally {
        setFetchingGames(false)
      }
    }
    fetchGames()
  }, [date, isMajor])

  // When game is selected, pre-fill scores if they exist
  useEffect(() => {
    if (selectedGameUuid) {
      const game = gamesForDate.find(g => g.uuid === selectedGameUuid)
      if (game) {
        setAwayScore(game.away_team_score ?? '')
        setHomeScore(game.home_team_score ?? '')
      }
    }
  }, [selectedGameUuid, gamesForDate])

  // ==================== PITCHING ====================
  
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

  // Parse pitching text
  const parsePitchingText = (rawText) => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l)
    if (lines.length === 0) return []
    
    // First line contains team name
    const firstLine = lines[0]
    const detectedTeamName = teams.find(t => firstLine.includes(t))
    setDetectedTeam(detectedTeamName || '')
    
    // Auto-select matching game
    if (detectedTeamName && gamesForDate.length > 0) {
      const matchingGame = gamesForDate.find(g => g.away === detectedTeamName || g.home === detectedTeamName)
      if (matchingGame && !selectedGameUuid) {
        setSelectedGameUuid(matchingGame.uuid)
      }
    }
    
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

  // Update pitching preview when text changes
  useEffect(() => {
    if (pitchingText.trim()) {
      setPitchingPreview(parsePitchingText(pitchingText))
    } else {
      setPitchingPreview([])
      if (activeTab === 'pitching') setDetectedTeam('')
    }
  }, [pitchingText, playerMap, gamesForDate])

  // Submit pitching data
  const handlePitchingSubmit = async () => {
    if (!pitchingText.trim()) {
      setPitchingMessage({ type: 'error', text: '請貼上投手數據' })
      return
    }

    if (pitchingPreview.length === 0) {
      setPitchingMessage({ type: 'error', text: '無法解析任何數據' })
      return
    }

    setPitchingLoading(true)
    setPitchingMessage({ type: '', text: '' })

    try {
      const res = await fetch('/api/pitching-insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: pitchingPreview.map(p => ({
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
        let msg = `✅ 成功插入 ${pitchingPreview.length} 筆投手數據`
        
        // Update game score if selected and scores entered
        if (selectedGameUuid && (awayScore !== '' || homeScore !== '')) {
          const scoreRes = await fetch('/api/admin/cpbl-schedule/score', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uuid: selectedGameUuid,
              away_team_score: awayScore !== '' ? parseInt(awayScore) : null,
              home_team_score: homeScore !== '' ? parseInt(homeScore) : null
            })
          })
          const scoreData = await scoreRes.json()
          if (scoreData.success) {
            msg += '，比分已更新'
          }
        }
        
        setPitchingMessage({ type: 'success', text: msg })
        setPitchingText('')
        setPitchingPreview([])
        setDetectedTeam('')
        
        // Refresh games
        const gamesRes = await fetch(`/api/admin/cpbl-schedule?date=${date}`)
        const gamesData = await gamesRes.json()
        if (gamesData.success) {
          const filtered = gamesData.data.filter(g => isMajor ? g.major_game !== false : g.major_game === false)
          setGamesForDate(filtered)
        }
      } else {
        setPitchingMessage({ type: 'error', text: `❌ 錯誤: ${data.error}` })
      }
    } catch (err) {
      setPitchingMessage({ type: 'error', text: `❌ 錯誤: ${err.message}` })
    } finally {
      setPitchingLoading(false)
    }
  }

  // ==================== BATTING ====================
  
  // Extract positions from raw position string
  const extractPositions = (rawPos) => {
    rawPos = rawPos.replace(/（/g, '(').replace(/）/g, ')')
    const matches = rawPos.match(/[A-Z]+\d*|\d+[A-Z]+/g)
    return matches || []
  }

  // Parse batting text
  const parseBattingText = (rawText) => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l)
    if (lines.length === 0) return []
    
    // First line contains team name
    const firstLine = lines[0]
    const detectedTeamName = teams.find(t => firstLine.includes(t))
    setDetectedTeam(detectedTeamName || '')
    
    // Auto-select matching game
    if (detectedTeamName && gamesForDate.length > 0) {
      const matchingGame = gamesForDate.find(g => g.away === detectedTeamName || g.home === detectedTeamName)
      if (matchingGame && !selectedGameUuid) {
        setSelectedGameUuid(matchingGame.uuid)
      }
    }
    
    // Skip first line (team name + headers)
    const dataLines = lines.slice(1)

    return dataLines.map(line => {
      // Replace full-width parentheses
      line = line.replace(/（0）/g, '0').replace(/（/g, '(').replace(/）/g, ')')
      
      const parts = line.split(/\s+/)
      
      let name, rawPos, stats
      
      // Check if line starts with a number (batting order) or not (substitute)
      if (!isNaN(parts[0])) {
        // Has batting order: "1 王博玄 RF ..."
        name = parts[1]
        rawPos = parts[2]
        stats = parts.slice(3)
      } else {
        // Substitute: " 顏郁軒 (1B) ..."
        name = parts[0]
        rawPos = parts[1]
        stats = parts.slice(2)
      }

      const position = extractPositions(rawPos)
      
      const toInt = val => parseInt(val) || 0
      const toFloat = val => parseFloat(val) || 0

      return {
        name,
        position,
        at_bats: toInt(stats[0]),
        runs: toInt(stats[1]),
        hits: toInt(stats[2]),
        rbis: toInt(stats[3]),
        doubles: toInt(stats[4]),
        triples: toInt(stats[5]),
        home_runs: toInt(stats[6]),
        double_plays: toInt(stats[7]),
        walks: toInt(stats[8]),
        ibb: toInt(stats[9]),
        hbp: toInt(stats[10]),
        strikeouts: toInt(stats[11]),
        sacrifice_bunts: toInt(stats[12]),
        sacrifice_flies: toInt(stats[13]),
        stolen_bases: toInt(stats[14]),
        caught_stealing: toInt(stats[15]),
        errors: toInt(stats[16]),
        avg: toFloat(stats[17]),
        player_id: playerMap[name] || null
      }
    }).filter(p => p.name) // Filter out empty entries
  }

  // Update batting preview when text changes
  useEffect(() => {
    if (battingText.trim()) {
      setBattingPreview(parseBattingText(battingText))
    } else {
      setBattingPreview([])
      if (activeTab === 'batting') setDetectedTeam('')
    }
  }, [battingText, playerMap, gamesForDate])

  // Submit batting data
  const handleBattingSubmit = async () => {
    if (!battingText.trim()) {
      setBattingMessage({ type: 'error', text: '請貼上打擊數據' })
      return
    }

    if (battingPreview.length === 0) {
      setBattingMessage({ type: 'error', text: '無法解析任何數據' })
      return
    }

    setBattingLoading(true)
    setBattingMessage({ type: '', text: '' })

    try {
      const res = await fetch('/api/batting-insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: battingPreview.map(p => ({
            name: p.name,
            position: p.position,
            at_bats: p.at_bats,
            runs: p.runs,
            hits: p.hits,
            rbis: p.rbis,
            doubles: p.doubles,
            triples: p.triples,
            home_runs: p.home_runs,
            double_plays: p.double_plays,
            walks: p.walks,
            ibb: p.ibb,
            hbp: p.hbp,
            strikeouts: p.strikeouts,
            sacrifice_bunts: p.sacrifice_bunts,
            sacrifice_flies: p.sacrifice_flies,
            stolen_bases: p.stolen_bases,
            caught_stealing: p.caught_stealing,
            errors: p.errors,
            avg: p.avg,
            game_date: date,
            is_major: isMajor,
            player_id: p.player_id
          })),
          table: 'batting_stats_2026'
        })
      })

      const data = await res.json()
      
      if (data.success) {
        let msg = `✅ 成功插入 ${battingPreview.length} 筆打擊數據`
        
        // Update game score if selected and scores entered
        if (selectedGameUuid && (awayScore !== '' || homeScore !== '')) {
          const scoreRes = await fetch('/api/admin/cpbl-schedule/score', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uuid: selectedGameUuid,
              away_team_score: awayScore !== '' ? parseInt(awayScore) : null,
              home_team_score: homeScore !== '' ? parseInt(homeScore) : null
            })
          })
          const scoreData = await scoreRes.json()
          if (scoreData.success) {
            msg += '，比分已更新'
          }
        }
        
        setBattingMessage({ type: 'success', text: msg })
        setBattingText('')
        setBattingPreview([])
        setDetectedTeam('')
        
        // Refresh games
        const gamesRes = await fetch(`/api/admin/cpbl-schedule?date=${date}`)
        const gamesData = await gamesRes.json()
        if (gamesData.success) {
          const filtered = gamesData.data.filter(g => isMajor ? g.major_game !== false : g.major_game === false)
          setGamesForDate(filtered)
        }
      } else {
        setBattingMessage({ type: 'error', text: `❌ 錯誤: ${data.error}` })
      }
    } catch (err) {
      setBattingMessage({ type: 'error', text: `❌ 錯誤: ${err.message}` })
    } finally {
      setBattingLoading(false)
    }
  }

  const selectedGame = gamesForDate.find(g => g.uuid === selectedGameUuid)

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
              Stats Entry (2026)
            </h1>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-white rounded-lg border border-slate-500/30 transition-colors"
            >
              ← Back to Admin
            </button>
          </div>
        </div>

        {/* Common Controls */}
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
          </div>

          {/* Games for Date */}
          <div className="mb-6">
            <label className="block text-purple-300 text-sm font-semibold mb-2">
              {date} 當日比賽 {fetchingGames && '(載入中...)'}
            </label>
            {gamesForDate.length === 0 ? (
              <p className="text-slate-400 text-sm">當日無比賽</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {gamesForDate.map(game => {
                  const isSelected = selectedGameUuid === game.uuid
                  const hasScore = game.away_team_score !== null && game.home_team_score !== null
                  const isDetectedGame = detectedTeam && (game.away === detectedTeam || game.home === detectedTeam)
                  
                  return (
                    <div
                      key={game.uuid}
                      onClick={() => setSelectedGameUuid(isSelected ? '' : game.uuid)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-purple-600/30 border-purple-400' 
                          : isDetectedGame
                            ? 'bg-blue-600/20 border-blue-400/50 hover:bg-blue-600/30'
                            : 'bg-slate-800/50 border-slate-600 hover:border-purple-400/50'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                        <span>#{game.game_no}</span>
                        {hasScore && <span className="text-green-400">✓ 已登錄比分</span>}
                      </div>
                      <div className="flex justify-between items-center font-bold text-white">
                        <span className={detectedTeam === game.away ? 'text-yellow-400' : ''}>{game.away}</span>
                        <span className="text-slate-500 mx-2">
                          {hasScore ? `${game.away_team_score} - ${game.home_team_score}` : 'vs'}
                        </span>
                        <span className={detectedTeam === game.home ? 'text-yellow-400' : ''}>{game.home}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Score Input */}
          {selectedGame && (
            <div className="p-4 bg-slate-800/50 rounded-lg border border-purple-500/30">
              <label className="block text-purple-300 text-sm font-semibold mb-3">
                登錄比分 - #{selectedGame.game_no} {selectedGame.away} vs {selectedGame.home}
              </label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">{selectedGame.away}</span>
                  <input
                    type="number"
                    min="0"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    placeholder="0"
                    className="w-16 bg-slate-700 border border-slate-500 text-white text-center p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <span className="text-slate-400">-</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    placeholder="0"
                    className="w-16 bg-slate-700 border border-slate-500 text-white text-center p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-white font-bold">{selectedGame.home}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pitching')}
            className={`px-6 py-3 rounded-lg font-bold transition-all ${
              activeTab === 'pitching'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            投手 Pitching
          </button>
          <button
            onClick={() => setActiveTab('batting')}
            className={`px-6 py-3 rounded-lg font-bold transition-all ${
              activeTab === 'batting'
                ? 'bg-yellow-600 text-white shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            打者 Batting
          </button>
        </div>

        {/* Pitching Tab */}
        {activeTab === 'pitching' && (
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 mb-6 shadow-2xl">
            {/* Message */}
            {pitchingMessage.text && (
              <div className={`mb-6 p-4 rounded-xl border ${
                pitchingMessage.type === 'success' 
                  ? 'bg-green-900/30 border-green-500/50 text-green-300' 
                  : 'bg-red-900/30 border-red-500/50 text-red-300'
              }`}>
                {pitchingMessage.text}
              </div>
            )}

            {/* Detected Team */}
            {detectedTeam && (
              <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                <span className="text-yellow-300 text-sm">偵測到隊伍: <strong>{detectedTeam}</strong></span>
              </div>
            )}

            {/* Textarea */}
            <div className="mb-6">
              <label className="block text-purple-300 text-sm font-semibold mb-2">
                Paste Pitching Data (from CPBL box score)
              </label>
              <textarea
                value={pitchingText}
                onChange={(e) => setPitchingText(e.target.value)}
                placeholder={`Paste data like:
1 後勁	5	22	93	56	4	0	1	（0）	0	8	1	0	3	2	1	2.23	1.20
2 施子謙 (H,4)	1	5	27	16	1	0	1	（0）	0	2	0	0	0	0	0	2.79	1.03`}
                rows={8}
                className="w-full bg-slate-800/60 border border-purple-500/30 text-white p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handlePitchingSubmit}
              disabled={pitchingLoading || pitchingPreview.length === 0}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg mb-6"
            >
              {pitchingLoading ? 'Inserting...' : `Insert ${pitchingPreview.length} Pitching Records`}
            </button>

            {/* Preview Table */}
            {pitchingPreview.length > 0 && (
              <div className="overflow-x-auto">
                <h2 className="text-xl font-bold text-white mb-4">Preview ({pitchingPreview.length} records)</h2>
                <table className="w-full text-sm text-white">
                  <thead>
                    <tr className="border-b border-purple-500/30">
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-center">Record</th>
                      <th className="p-2 text-center">IP</th>
                      <th className="p-2 text-center">BF</th>
                      <th className="p-2 text-center">P</th>
                      <th className="p-2 text-center">S</th>
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
                      <th className="p-2 text-center">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pitchingPreview.map((p, idx) => (
                      <tr key={idx} className="border-b border-purple-500/20 hover:bg-purple-500/10">
                        <td className="p-2 font-semibold">{p.name}</td>
                        <td className="p-2 text-center text-xs">{p.record || '-'}</td>
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
                        <td className="p-2 text-center">{p.era.toFixed(2)}</td>
                        <td className="p-2 text-center">{p.whip.toFixed(2)}</td>
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
        )}

        {/* Batting Tab */}
        {activeTab === 'batting' && (
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 mb-6 shadow-2xl">
            {/* Message */}
            {battingMessage.text && (
              <div className={`mb-6 p-4 rounded-xl border ${
                battingMessage.type === 'success' 
                  ? 'bg-green-900/30 border-green-500/50 text-green-300' 
                  : 'bg-red-900/30 border-red-500/50 text-red-300'
              }`}>
                {battingMessage.text}
              </div>
            )}

            {/* Detected Team */}
            {detectedTeam && (
              <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                <span className="text-yellow-300 text-sm">偵測到隊伍: <strong>{detectedTeam}</strong></span>
              </div>
            )}

            {/* Textarea */}
            <div className="mb-6">
              <label className="block text-purple-300 text-sm font-semibold mb-2">
                Paste Batting Data (from CPBL box score) - First line will be ignored
              </label>
              <textarea
                value={battingText}
                onChange={(e) => setBattingText(e.target.value)}
                placeholder={`Paste data like:
台鋼雄鷹	打數	得分	安打	打點	二安	三安	全壘打	雙殺打	四壞	（故四）	死球	被三振	犧打	犧飛	盜壘	盜壘刺	失誤	打擊率
1 王博玄 RF	4	1	1	0	0	0	0	0	0	（0）	0	0	0	0	0	0	0	0.310
2 曾子祐 SS	4	0	2	0	0	0	0	0	0	（0）	0	0	0	0	0	0	1	0.280`}
                rows={10}
                className="w-full bg-slate-800/60 border border-purple-500/30 text-white p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleBattingSubmit}
              disabled={battingLoading || battingPreview.length === 0}
              className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg mb-6"
            >
              {battingLoading ? 'Inserting...' : `Insert ${battingPreview.length} Batting Records`}
            </button>

            {/* Preview Table */}
            {battingPreview.length > 0 && (
              <div className="overflow-x-auto">
                <h2 className="text-xl font-bold text-white mb-4">Preview ({battingPreview.length} records)</h2>
                <table className="w-full text-sm text-white">
                  <thead>
                    <tr className="border-b border-purple-500/30">
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Pos</th>
                      <th className="p-2 text-center">AB</th>
                      <th className="p-2 text-center">R</th>
                      <th className="p-2 text-center">H</th>
                      <th className="p-2 text-center">RBI</th>
                      <th className="p-2 text-center">2B</th>
                      <th className="p-2 text-center">3B</th>
                      <th className="p-2 text-center">HR</th>
                      <th className="p-2 text-center">GDP</th>
                      <th className="p-2 text-center">BB</th>
                      <th className="p-2 text-center">IBB</th>
                      <th className="p-2 text-center">HBP</th>
                      <th className="p-2 text-center">K</th>
                      <th className="p-2 text-center">SAC</th>
                      <th className="p-2 text-center">SF</th>
                      <th className="p-2 text-center">SB</th>
                      <th className="p-2 text-center">CS</th>
                      <th className="p-2 text-center">E</th>
                      <th className="p-2 text-center">AVG</th>
                      <th className="p-2 text-center">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {battingPreview.map((p, idx) => (
                      <tr key={idx} className="border-b border-purple-500/20 hover:bg-purple-500/10">
                        <td className="p-2 font-semibold">{p.name}</td>
                        <td className="p-2">{p.position?.join(', ') || '-'}</td>
                        <td className="p-2 text-center">{p.at_bats}</td>
                        <td className="p-2 text-center">{p.runs}</td>
                        <td className="p-2 text-center">{p.hits}</td>
                        <td className="p-2 text-center">{p.rbis}</td>
                        <td className="p-2 text-center">{p.doubles}</td>
                        <td className="p-2 text-center">{p.triples}</td>
                        <td className="p-2 text-center">{p.home_runs}</td>
                        <td className="p-2 text-center">{p.double_plays}</td>
                        <td className="p-2 text-center">{p.walks}</td>
                        <td className="p-2 text-center">{p.ibb}</td>
                        <td className="p-2 text-center">{p.hbp}</td>
                        <td className="p-2 text-center">{p.strikeouts}</td>
                        <td className="p-2 text-center">{p.sacrifice_bunts}</td>
                        <td className="p-2 text-center">{p.sacrifice_flies}</td>
                        <td className="p-2 text-center">{p.stolen_bases}</td>
                        <td className="p-2 text-center">{p.caught_stealing}</td>
                        <td className="p-2 text-center">{p.errors}</td>
                        <td className="p-2 text-center">{p.avg.toFixed(3)}</td>
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
        )}
      </div>
    </div>
  )
}
