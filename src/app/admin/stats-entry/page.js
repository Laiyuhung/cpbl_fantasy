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
  
  // Common states
  const [date, setDate] = useState(getTaiwanToday())
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [playerMap, setPlayerMap] = useState({}) // name -> player_id
  
  // Games for date (ALL games, both major and minor)
  const [gamesForDate, setGamesForDate] = useState([])
  const [fetchingGames, setFetchingGames] = useState(false)
  const [selectedGameUuid, setSelectedGameUuid] = useState('')
  const [detectedTeam, setDetectedTeam] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [scoreUpdating, setScoreUpdating] = useState(false)

  // Combined stats input
  const [statsText, setStatsText] = useState('')
  const [pitchingPreview, setPitchingPreview] = useState([])
  const [battingPreview, setBattingPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  // Entry log - track which teams have been logged
  const [entryLog, setEntryLog] = useState([]) // { game_uuid, team }[]
  const [detectedMinor, setDetectedMinor] = useState(false) // true if "二軍" detected

  // Team name variations for detection (longer variants first for priority matching)
  const teamVariants = {
    '統一獅': ['統一7-ELEVEn獅', '統一7-eleven獅', '統一7-11獅', '統一獅', '統一'],
    '中信兄弟': ['中信兄弟', '兄弟'],
    '樂天桃猿': ['樂天桃猿', '桃猿', '樂天'],
    '富邦悍將': ['富邦悍將', '悍將', '富邦'],
    '味全龍': ['味全龍', '味全'],
    '台鋼雄鷹': ['台鋼雄鷹', '雄鷹', '台鋼']
  }

  const teams = Object.keys(teamVariants)

  // Detect team from text
  const detectTeam = (text) => {
    // Normalize text for matching
    const normalizedText = text.toLowerCase()
    for (const [team, variants] of Object.entries(teamVariants)) {
      for (const variant of variants) {
        // Check both original and lowercase
        if (text.includes(variant) || normalizedText.includes(variant.toLowerCase())) {
          return team
        }
      }
    }
    return null
  }

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

  // Fetch ALL games for selected date (both major and minor)
  useEffect(() => {
    const fetchGames = async () => {
      if (!date) return
      setFetchingGames(true)
      try {
        const res = await fetch(`/api/admin/cpbl-schedule?date=${date}`)
        const data = await res.json()
        if (data.success) {
          // Keep ALL games (major + minor)
          setGamesForDate(data.data)
          setSelectedGameUuid('')
          setAwayScore('')
          setHomeScore('')
          
          // Fetch entry log for this date
          const logRes = await fetch(`/api/admin/stats-entry-log?date=${date}`)
          const logData = await logRes.json()
          if (logData.success) {
            setEntryLog(logData.data || [])
          }
        }
      } catch (err) {
        console.error('Failed to fetch games:', err)
      } finally {
        setFetchingGames(false)
      }
    }
    fetchGames()
  }, [date])

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

  // Extract positions from raw position string - clean format (return as comma-separated string)
  const extractPositions = (rawPos) => {
    rawPos = rawPos.replace(/（/g, '(').replace(/）/g, ')')
    const matches = rawPos.match(/[A-Z]+\d*|\d+[A-Z]+/g)
    return matches ? matches.join(', ') : ''
  }

  // Valid pitcher record values
  const validRecords = ['W', 'L', 'HLD', 'SV', 'H', 'S', 'BS', 'WP', 'LP', 'HD']

  // Determine if a line is pitching or batting based on header
  const isPitchingHeader = (line) => {
    return line.includes('投球局數') || line.includes('面對打席') || line.includes('投球數')
  }

  const isBattingHeader = (line) => {
    return line.includes('打數') || line.includes('得分') || line.includes('安打')
  }

  // Parse the combined text for both pitching and batting
  const parseStatsText = (rawText) => {
    if (!rawText.trim()) {
      setPitchingPreview([])
      setBattingPreview([])
      setDetectedTeam('')
      return
    }

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l)
    if (lines.length === 0) return

    // Detect team from first line
    const firstLine = lines[0]
    const detectedTeamName = detectTeam(firstLine)
    setDetectedTeam(detectedTeamName || '')
    
    // Detect if minor league from header (contains "二軍")
    const isMinorLeague = firstLine.includes('二軍')
    setDetectedMinor(isMinorLeague)

    // Auto-select matching game (considering major/minor)
    if (detectedTeamName && gamesForDate.length > 0 && !selectedGameUuid) {
      const matchingGame = gamesForDate.find(g => {
        const teamMatch = g.away === detectedTeamName || g.home === detectedTeamName
        const leagueMatch = isMinorLeague ? g.major_game === false : g.major_game !== false
        return teamMatch && leagueMatch
      })
      if (matchingGame) {
        setSelectedGameUuid(matchingGame.uuid)
      }
    }

    // Split into sections by team headers
    let currentType = null // 'pitching' or 'batting'
    const pitchingLines = []
    const battingLines = []

    for (const line of lines) {
      // Check if this is a header line
      if (isPitchingHeader(line)) {
        currentType = 'pitching'
        continue
      } else if (isBattingHeader(line)) {
        currentType = 'batting'
        continue
      }

      // Skip team name lines that aren't data
      if (detectTeam(line) && !line.match(/^\d/)) {
        continue
      }

      if (currentType === 'pitching') {
        pitchingLines.push(line)
      } else if (currentType === 'batting') {
        battingLines.push(line)
      }
    }

    // Parse pitching data
    const pitchingData = pitchingLines.map(line => {
      line = line.replace(/（/g, '(').replace(/）/g, ')')
      const parts = line.split(/\s+/)
      
      // Skip if not starting with number (sequence)
      if (isNaN(parseInt(parts[0]))) return null
      
      const sequence = parseInt(parts[0]) || 0
      let name = (parts[1] || '').replace(/[*#◎]/g, '')
      let record = null
      let statStart = 2
      
      if (parts[2] && /^\(.*\)$/.test(parts[2])) {
        // Handle formats like (W,5-2) or (W) - extract first part before comma
        let rawRecord = parts[2].replace(/[()]/g, '').split(',')[0].toUpperCase()
        // Convert short forms: H -> HLD, S -> SV
        if (rawRecord === 'H') rawRecord = 'HLD'
        if (rawRecord === 'S') rawRecord = 'SV'
        // Only keep valid record values
        record = validRecords.includes(rawRecord) ? rawRecord : null
        statStart = 3
      }
      
      const stats = parts.slice(statStart).map(p => p.replace(/[()]/g, ''))
      while (stats.length < 17) stats.push('0')
      
      const toInt = val => parseInt(val) || 0
      const toFloat = val => parseFloat(val) || 0

      return {
        sequence,
        name,
        record,
        position: sequence === 1 ? 'SP' : 'RP',
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
    }).filter(p => p !== null)

    // Parse batting data
    const battingData = battingLines.map(line => {
      line = line.replace(/（0）/g, '0').replace(/（/g, '(').replace(/）/g, ')')
      const parts = line.split(/\s+/)
      
      let name, rawPos, stats
      
      if (!isNaN(parts[0])) {
        name = (parts[1] || '').replace(/[*#◎]/g, '')
        rawPos = parts[2]
        stats = parts.slice(3)
      } else {
        name = (parts[0] || '').replace(/[*#◎]/g, '')
        rawPos = parts[1]
        stats = parts.slice(2)
      }

      if (!name) return null

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
    }).filter(p => p !== null)

    setPitchingPreview(pitchingData)
    setBattingPreview(battingData)
  }

  // Update preview when text changes
  useEffect(() => {
    parseStatsText(statsText)
  }, [statsText, playerMap, gamesForDate])

  // Get is_major from selected game or detected minor league
  const getIsMajor = () => {
    // If detected minor league from header (二軍), always return false
    if (detectedMinor) return false
    
    // Otherwise check selected game
    if (!selectedGameUuid) return true
    const game = gamesForDate.find(g => g.uuid === selectedGameUuid)
    return game ? game.major_game !== false : true
  }

  // Submit all data
  const handleSubmit = async () => {
    if (!statsText.trim()) {
      setMessage({ type: 'error', text: '請貼上數據' })
      return
    }

    if (pitchingPreview.length === 0 && battingPreview.length === 0) {
      setMessage({ type: 'error', text: '無法解析任何數據' })
      return
    }

    if (!selectedGameUuid) {
      setMessage({ type: 'error', text: '請選擇比賽' })
      return
    }

    // Require score input
    if (awayScore === '' || homeScore === '') {
      setMessage({ type: 'error', text: '⚠️ 請輸入該場比分後再登錄' })
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

    const isMajor = getIsMajor()
    let results = []

    try {
      // Insert batting data first
      if (battingPreview.length > 0) {
        const battingRes = await fetch('/api/batting-insert', {
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
        const battingData = await battingRes.json()
        if (battingData.success) {
          results.push(`打擊 ${battingPreview.length} 筆`)
        }
      }

      // Insert pitching data
      if (pitchingPreview.length > 0) {
        // complete_game = 1 if only one pitcher, else 0
        const isCompleteGame = pitchingPreview.length === 1 ? 1 : 0
        
        const pitchingRes = await fetch('/api/pitching-insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            records: pitchingPreview.map(p => ({
              name: p.name,
              position: p.position,
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
              complete_game: isCompleteGame,
              player_id: p.player_id
            })),
            table: 'pitching_stats_2026'
          })
        })
        const pitchingData = await pitchingRes.json()
        if (pitchingData.success) {
          results.push(`投手 ${pitchingPreview.length} 筆`)
        }
      }

      // Update score if entered
      if (awayScore !== '' || homeScore !== '') {
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
          results.push('比分已更新')
        }
      }

      if (results.length > 0) {
        // Log the entry to track which team has been logged
        if (detectedTeam && selectedGameUuid) {
          await fetch('/api/admin/stats-entry-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              game_uuid: selectedGameUuid,
              team: detectedTeam
            })
          })
        }
        
        setMessage({ type: 'success', text: `✅ 成功插入: ${results.join(', ')}` })
        setStatsText('')
        setPitchingPreview([])
        setBattingPreview([])
        setDetectedTeam('')
        setDetectedMinor(false)
        
        // Refresh games and entry log
        const gamesRes = await fetch(`/api/admin/cpbl-schedule?date=${date}`)
        const gamesData = await gamesRes.json()
        if (gamesData.success) {
          setGamesForDate(gamesData.data)
        }
        
        const logRes = await fetch(`/api/admin/stats-entry-log?date=${date}`)
        const logData = await logRes.json()
        if (logData.success) {
          setEntryLog(logData.data || [])
        }
      } else {
        setMessage({ type: 'error', text: '❌ 未能插入任何數據' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: `❌ 錯誤: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  // Standalone score update
  const handleScoreUpdate = async () => {
    if (!selectedGameUuid) {
      setMessage({ type: 'error', text: '請選擇比賽' })
      return
    }

    if (awayScore === '' && homeScore === '') {
      setMessage({ type: 'error', text: '請輸入比分' })
      return
    }

    setScoreUpdating(true)
    try {
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
        setMessage({ type: 'success', text: '✅ 比分已更新' })
        
        // Refresh games
        const gamesRes = await fetch(`/api/admin/cpbl-schedule?date=${date}`)
        const gamesData = await gamesRes.json()
        if (gamesData.success) {
          setGamesForDate(gamesData.data)
        }
      } else {
        setMessage({ type: 'error', text: `❌ 錯誤: ${scoreData.error}` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: `❌ 錯誤: ${err.message}` })
    } finally {
      setScoreUpdating(false)
    }
  }

  const selectedGame = gamesForDate.find(g => g.uuid === selectedGameUuid)

  // Separate games by league
  const majorGames = gamesForDate.filter(g => g.major_game !== false)
  const minorGames = gamesForDate.filter(g => g.major_game === false)
  
  // Helper to check if a team is logged for a game
  const isTeamLogged = (gameUuid, team) => {
    return entryLog.some(log => log.game_uuid === gameUuid && log.team === team)
  }
  
  // Get pending teams for display
  const getPendingTeams = () => {
    const pending = []
    gamesForDate.forEach(game => {
      if (!isTeamLogged(game.uuid, game.away)) {
        pending.push({ team: game.away, league: game.major_game !== false ? '一軍' : '二軍', game })
      }
      if (!isTeamLogged(game.uuid, game.home)) {
        pending.push({ team: game.home, league: game.major_game !== false ? '一軍' : '二軍', game })
      }
    })
    return pending
  }
  
  const pendingTeams = getPendingTeams()

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

        {/* Message Modal - Centered */}
        {message.text && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className={`relative max-w-md w-full mx-4 p-8 rounded-2xl shadow-2xl transform animate-bounce-in ${
              message.type === 'success' 
                ? 'bg-gradient-to-br from-green-900 to-green-800 border-2 border-green-400' 
                : 'bg-gradient-to-br from-red-900 to-red-800 border-2 border-red-400'
            }`}>
              <div className="text-center">
                <div className={`text-6xl mb-4 ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {message.type === 'success' ? '✓' : '✗'}
                </div>
                <div className={`text-xl font-bold mb-6 ${message.type === 'success' ? 'text-green-200' : 'text-red-200'}`}>
                  {message.text}
                </div>
                <button
                  onClick={() => setMessage({ type: '', text: '' })}
                  className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                    message.type === 'success'
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  確認
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Date Selector */}
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="mb-6">
            <label className="block text-purple-300 text-sm font-semibold mb-2">Game Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full md:w-64 bg-slate-800/60 border border-purple-500/30 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Pending Teams */}
          {pendingTeams.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <label className="block text-yellow-300 text-sm font-semibold mb-2">
                ⚠️ 尚未登錄之球隊 ({pendingTeams.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {pendingTeams.map((item, idx) => (
                  <span key={idx} className="px-2 py-1 bg-yellow-800/30 text-yellow-200 text-xs rounded">
                    {item.team} ({item.league})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Games for Date - All leagues */}
          <div className="mb-6">
            <label className="block text-purple-300 text-sm font-semibold mb-2">
              {date} 當日比賽 {fetchingGames && '(載入中...)'}
            </label>
            
            {gamesForDate.length === 0 ? (
              <p className="text-slate-400 text-sm">當日無比賽</p>
            ) : (
              <div className="space-y-4">
                {/* Major League Games */}
                {majorGames.length > 0 && (
                  <div>
                    <div className="text-sm text-blue-400 font-semibold mb-2">一軍</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {majorGames.map(game => {
                        const isSelected = selectedGameUuid === game.uuid
                        const hasScore = game.away_team_score !== null && game.home_team_score !== null
                        const isDetectedGame = detectedTeam && (game.away === detectedTeam || game.home === detectedTeam)
                        const awayLogged = isTeamLogged(game.uuid, game.away)
                        const homeLogged = isTeamLogged(game.uuid, game.home)
                        
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
                              <span className={`${detectedTeam === game.away ? 'text-yellow-400' : ''} ${awayLogged ? 'line-through opacity-50' : ''}`}>
                                {awayLogged && '✓ '}{game.away}
                              </span>
                              <span className="text-slate-500 mx-2">
                                {hasScore ? `${game.away_team_score} - ${game.home_team_score}` : 'vs'}
                              </span>
                              <span className={`${detectedTeam === game.home ? 'text-yellow-400' : ''} ${homeLogged ? 'line-through opacity-50' : ''}`}>
                                {game.home}{homeLogged && ' ✓'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Minor League Games */}
                {minorGames.length > 0 && (
                  <div>
                    <div className="text-sm text-orange-400 font-semibold mb-2">二軍</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {minorGames.map(game => {
                        const isSelected = selectedGameUuid === game.uuid
                        const hasScore = game.away_team_score !== null && game.home_team_score !== null
                        const isDetectedGame = detectedTeam && (game.away === detectedTeam || game.home === detectedTeam)
                        const awayLogged = isTeamLogged(game.uuid, game.away)
                        const homeLogged = isTeamLogged(game.uuid, game.home)
                        
                        return (
                          <div
                            key={game.uuid}
                            onClick={() => setSelectedGameUuid(isSelected ? '' : game.uuid)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-purple-600/30 border-purple-400' 
                                : isDetectedGame
                                  ? 'bg-orange-600/20 border-orange-400/50 hover:bg-orange-600/30'
                                  : 'bg-slate-800/50 border-slate-600 hover:border-purple-400/50'
                            }`}
                          >
                            <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                              <span>#{game.game_no}</span>
                              {hasScore && <span className="text-green-400">✓ 已登錄比分</span>}
                            </div>
                            <div className="flex justify-between items-center font-bold text-white">
                              <span className={`${detectedTeam === game.away ? 'text-yellow-400' : ''} ${awayLogged ? 'line-through opacity-50' : ''}`}>
                                {awayLogged && '✓ '}{game.away}
                              </span>
                              <span className="text-slate-500 mx-2">
                                {hasScore ? `${game.away_team_score} - ${game.home_team_score}` : 'vs'}
                              </span>
                              <span className={`${detectedTeam === game.home ? 'text-yellow-400' : ''} ${homeLogged ? 'line-through opacity-50' : ''}`}>
                                {game.home}{homeLogged && ' ✓'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Score Input */}
          {selectedGame && (
            <div className="p-4 bg-slate-800/50 rounded-lg border border-purple-500/30">
              <label className="block text-purple-300 text-sm font-semibold mb-3">
                比分 - #{selectedGame.game_no} {selectedGame.away} vs {selectedGame.home}
                <span className={`ml-2 text-xs ${selectedGame.major_game !== false ? 'text-blue-400' : 'text-orange-400'}`}>
                  ({selectedGame.major_game !== false ? '一軍' : '二軍'})
                </span>
              </label>
              <div className="flex items-center gap-4 flex-wrap">
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
                <button
                  onClick={handleScoreUpdate}
                  disabled={scoreUpdating}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {scoreUpdating ? '更新中...' : '僅更新比分'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Input */}
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 mb-6 shadow-2xl">
          {/* Detected Team */}
          {detectedTeam && (
            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
              <span className="text-yellow-300 text-sm">
                偵測到隊伍: <strong>{detectedTeam}</strong>
                <span className={`ml-2 ${detectedMinor ? 'text-orange-400' : 'text-blue-400'}`}>
                  ({detectedMinor ? '二軍' : '一軍'})
                </span>
              </span>
            </div>
          )}

          {/* Textarea */}
          <div className="mb-6">
            <label className="block text-purple-300 text-sm font-semibold mb-2">
              貼上數據 (投手+打者一起貼，包含標題列)
            </label>
            <textarea
              value={statsText}
              onChange={(e) => setStatsText(e.target.value)}
              placeholder={`範例 (打者和投手數據一起貼入):
              
統一7-ELEVEn獅	打數	得分	安打	打點 ...
1 林佳緯 CF	5	0	0	0 ...
2 朱迦恩 LF	5	2	1	0 ...
...
統一7-ELEVEn獅	投球局數	面對打席	投球數 ...
1 蒙德茲	6	27	101 ...`}
              rows={12}
              className="w-full bg-slate-800/60 border border-purple-500/30 text-white p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || (pitchingPreview.length === 0 && battingPreview.length === 0)}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg"
          >
            {loading ? 'Inserting...' : `Insert ${battingPreview.length} 打者 + ${pitchingPreview.length} 投手`}
          </button>
        </div>

        {/* Preview Tables */}
        {battingPreview.length > 0 && (
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 mb-6 shadow-2xl overflow-x-auto">
            <h2 className="text-xl font-bold text-white mb-4">打者 Preview ({battingPreview.length} records)</h2>
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
                    <td className="p-2 text-xs">{p.position || '-'}</td>
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

        {pitchingPreview.length > 0 && (
          <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl overflow-x-auto">
            <h2 className="text-xl font-bold text-white mb-4">投手 Preview ({pitchingPreview.length} records)</h2>
            <table className="w-full text-sm text-white">
              <thead>
                <tr className="border-b border-purple-500/30">
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-center">Pos</th>
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
                    <td className="p-2 text-center text-xs">{p.position}</td>
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
    </div>
  )
}
