'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StatsVerifyPage() {
    const router = useRouter()

    const getTaiwanToday = () => {
        const now = new Date()
        const taiwanOffset = 8 * 60 * 60 * 1000
        const taiwanTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + taiwanOffset)
        return taiwanTime.toISOString().split('T')[0]
    }

    // Admin
    const [isAdmin, setIsAdmin] = useState(false)
    const [checkingAdmin, setCheckingAdmin] = useState(true)

    // Player search
    const [playerMap, setPlayerMap] = useState({}) // name -> [{player_id, team, batter_or_pitcher}]
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [selectedPlayer, setSelectedPlayer] = useState(null) // { player_id, name, team, batter_or_pitcher }

    // Stats data for selected player
    const [playerStats, setPlayerStats] = useState([])
    const [statsLoading, setStatsLoading] = useState(false)
    const [statsType, setStatsType] = useState('batting') // auto-set from player type

    // Data entry (same method as stats-entry)
    const [date, setDate] = useState(getTaiwanToday())
    const [statsText, setStatsText] = useState('')
    const [pitchingPreview, setPitchingPreview] = useState([])
    const [battingPreview, setBattingPreview] = useState([])
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })

    // Team detection
    const teamVariants = {
        '統一獅': ['統一7-ELEVEn獅', '統一7-eleven獅', '統一7-11獅', '統一獅', '統一'],
        '中信兄弟': ['中信兄弟', '兄弟'],
        '樂天桃猿': ['樂天桃猿', '桃猿', '樂天'],
        '富邦悍將': ['富邦悍將', '悍將', '富邦'],
        '味全龍': ['味全龍', '味全'],
        '台鋼雄鷹': ['台鋼雄鷹', '雄鷹', '台鋼']
    }

    const [detectedTeam, setDetectedTeam] = useState('')
    const [detectedMinor, setDetectedMinor] = useState(false)

    const detectTeam = (text) => {
        const normalizedText = text.toLowerCase()
        for (const [team, variants] of Object.entries(teamVariants)) {
            for (const variant of variants) {
                if (text.includes(variant) || normalizedText.includes(variant.toLowerCase())) {
                    return team
                }
            }
        }
        return null
    }

    const resolvePlayerId = (name, team) => {
        const entries = playerMap[name]
        if (!entries || entries.length === 0) return null
        if (entries.length === 1) return entries[0].player_id
        if (team) {
            const match = entries.find(e => e.team === team)
            if (match) return match.player_id
        }
        return entries[0].player_id
    }

    // Admin check
    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('/api/admin/check')
                const data = await res.json()
                if (!data.isAdmin) { alert('No admin privileges'); router.push('/home'); return }
                setIsAdmin(true)
            } catch { alert('Failed to check permissions'); router.push('/home') }
            finally { setCheckingAdmin(false) }
        }
        check()
    }, [router])

    // Fetch players
    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                const res = await fetch('/api/playerslist')
                const data = await res.json()
                if (data.success && data.players) {
                    const map = {}
                    data.players.forEach(p => {
                        if (!map[p.name]) map[p.name] = []
                        map[p.name].push({ player_id: p.player_id, team: p.team, batter_or_pitcher: p.batter_or_pitcher, name: p.name })
                    })
                    setPlayerMap(map)
                }
            } catch (err) { console.error('Failed to fetch players:', err) }
        }
        fetchPlayers()
    }, [])

    // Search players
    useEffect(() => {
        if (!searchTerm.trim()) { setSearchResults([]); return }
        const term = searchTerm.toLowerCase()
        const results = []
        for (const [name, entries] of Object.entries(playerMap)) {
            if (name.toLowerCase().includes(term)) {
                entries.forEach(e => results.push({ ...e, name }))
            }
        }
        setSearchResults(results.slice(0, 20))
    }, [searchTerm, playerMap])

    // Fetch stats when player selected
    useEffect(() => {
        if (!selectedPlayer) return
        const type = selectedPlayer.batter_or_pitcher === 'pitcher' ? 'pitching' : 'batting'
        setStatsType(type)
        fetchPlayerStats(selectedPlayer.player_id, type)
    }, [selectedPlayer])

    const fetchPlayerStats = async (playerId, type) => {
        setStatsLoading(true)
        try {
            const res = await fetch(`/api/admin/stats-verify?player_id=${playerId}&type=${type}`)
            const data = await res.json()
            if (data.success) {
                setPlayerStats(data.data || [])
            }
        } catch (err) { console.error('Fetch stats error:', err) }
        finally { setStatsLoading(false) }
    }

    // Delete a stat entry
    const handleDelete = async (id) => {
        if (!confirm('確定刪除此筆資料？')) return
        try {
            const res = await fetch('/api/admin/stats-verify', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, type: statsType })
            })
            const data = await res.json()
            if (data.success) {
                setPlayerStats(prev => prev.filter(s => s.id !== id))
                setMessage({ type: 'success', text: '✅ 已刪除' })
            } else {
                setMessage({ type: 'error', text: `❌ ${data.error}` })
            }
        } catch (err) { setMessage({ type: 'error', text: `❌ ${err.message}` }) }
    }

    // ===== Data Entry (same as stats-entry) =====
    const parseInnings = (str) => {
        if (str.includes('/')) {
            const [whole, fraction] = str.split('/').map(Number)
            if (!isNaN(whole) && !isNaN(fraction) && fraction === 3) {
                if (whole < 10) return whole === 1 ? 0.1 : whole === 2 ? 0.2 : 0
                else { const intPart = Math.floor(whole / 10); const outPart = whole % 10; return intPart + (outPart === 1 ? 0.1 : outPart === 2 ? 0.2 : 0) }
            }
            return 0
        }
        return parseFloat(str) || 0
    }

    const extractPositions = (rawPos) => {
        rawPos = rawPos.replace(/（/g, '(').replace(/）/g, ')')
        const matches = rawPos.match(/[A-Z]+\d*|\d+[A-Z]+/g)
        return matches ? matches.join(', ') : ''
    }

    const validRecords = ['W', 'L', 'HLD', 'SV', 'H', 'S', 'BS', 'WP', 'LP', 'HD']

    const isPitchingHeader = (line) => line.includes('投球局數') || line.includes('面對打席') || line.includes('投球數')
    const isBattingHeader = (line) => line.includes('打數') || line.includes('得分') || line.includes('安打')

    const parseStatsText = (rawText) => {
        if (!rawText.trim()) { setPitchingPreview([]); setBattingPreview([]); setDetectedTeam(''); return }
        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l)
        if (lines.length === 0) return

        const firstLine = lines[0]
        const detectedTeamName = detectTeam(firstLine)
        setDetectedTeam(detectedTeamName || '')
        const isMinorLeague = firstLine.includes('二軍')
        setDetectedMinor(isMinorLeague)

        let currentType = null
        const pitchingLines = []
        const battingLines = []

        for (const line of lines) {
            if (isPitchingHeader(line)) { currentType = 'pitching'; continue }
            else if (isBattingHeader(line)) { currentType = 'batting'; continue }
            if (detectTeam(line) && !line.match(/^\d/)) continue
            if (currentType === 'pitching') pitchingLines.push(line)
            else if (currentType === 'batting') battingLines.push(line)
        }

        // Parse pitching
        const pitchingData = pitchingLines.map(line => {
            line = line.replace(/（/g, '(').replace(/）/g, ')')
            const parts = line.split(/\s+/)
            if (isNaN(parseInt(parts[0]))) return null
            const sequence = parseInt(parts[0]) || 0
            let name = (parts[1] || '').replace(/[*#◎]/g, '')
            let record = null
            let statStart = 2
            if (parts[2] && /^\(.*\)$/.test(parts[2])) {
                let rawRecord = parts[2].replace(/[()]/g, '').split(',')[0].toUpperCase()
                if (rawRecord === 'H') rawRecord = 'HLD'
                if (rawRecord === 'S') rawRecord = 'SV'
                record = validRecords.includes(rawRecord) ? rawRecord : null
                statStart = 3
            }
            const stats = parts.slice(statStart).map(p => p.replace(/[()]/g, ''))
            while (stats.length < 17) stats.push('0')
            const toInt = val => parseInt(val) || 0
            const toFloat = val => parseFloat(val) || 0
            return {
                sequence, name, record, position: sequence === 1 ? 'SP' : 'RP',
                innings_pitched: parseInnings(stats[0]), batters_faced: toInt(stats[1]),
                pitches_thrown: toInt(stats[2]), strikes_thrown: toInt(stats[3]),
                hits_allowed: toInt(stats[4]), home_runs_allowed: toInt(stats[5]),
                walks: toInt(stats[6]), ibb: toInt(stats[7]), hbp: toInt(stats[8]),
                strikeouts: toInt(stats[9]), wild_pitches: toInt(stats[10]), balks: toInt(stats[11]),
                runs_allowed: toInt(stats[12]), earned_runs: toInt(stats[13]), errors: toInt(stats[14]),
                era: toFloat(stats[15]), whip: toFloat(stats[16]),
                player_id: resolvePlayerId(name, detectedTeamName) || null
            }
        }).filter(p => p !== null)

        // Parse batting
        const battingData = battingLines.map(line => {
            line = line.replace(/（0）/g, '0').replace(/（/g, '(').replace(/）/g, ')')
            const parts = line.split(/\s+/)
            let name, rawPos, stats
            if (!isNaN(parts[0])) { name = (parts[1] || '').replace(/[*#◎]/g, ''); rawPos = parts[2]; stats = parts.slice(3) }
            else { name = (parts[0] || '').replace(/[*#◎]/g, ''); rawPos = parts[1]; stats = parts.slice(2) }
            if (!name) return null
            const position = extractPositions(rawPos)
            const toInt = val => parseInt(val) || 0
            const toFloat = val => parseFloat(val) || 0
            return {
                name, position, at_bats: toInt(stats[0]), runs: toInt(stats[1]),
                hits: toInt(stats[2]), rbis: toInt(stats[3]), doubles: toInt(stats[4]),
                triples: toInt(stats[5]), home_runs: toInt(stats[6]), double_plays: toInt(stats[7]),
                walks: toInt(stats[8]), ibb: toInt(stats[9]), hbp: toInt(stats[10]),
                strikeouts: toInt(stats[11]), sacrifice_bunts: toInt(stats[12]),
                sacrifice_flies: toInt(stats[13]), stolen_bases: toInt(stats[14]),
                caught_stealing: toInt(stats[15]), errors: toInt(stats[16]),
                avg: toFloat(stats[17]),
                player_id: resolvePlayerId(name, detectedTeamName) || null
            }
        }).filter(p => p !== null)

        setPitchingPreview(pitchingData)
        setBattingPreview(battingData)
    }

    useEffect(() => { parseStatsText(statsText) }, [statsText, playerMap])

    const handleSubmit = async () => {
        if (!statsText.trim()) { setMessage({ type: 'error', text: '請貼上數據' }); return }
        if (pitchingPreview.length === 0 && battingPreview.length === 0) { setMessage({ type: 'error', text: '無法解析任何數據' }); return }

        setLoading(true)
        setMessage({ type: '', text: '' })

        const isMajor = !detectedMinor
        let results = []

        try {
            if (battingPreview.length > 0) {
                const battingRes = await fetch('/api/batting-insert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        records: battingPreview.map(p => ({
                            ...p, game_date: date, is_major: isMajor
                        })),
                        table: 'batting_stats_2025'
                    })
                })
                const battingData = await battingRes.json()
                if (battingData.success) results.push(`打擊 ${battingPreview.length} 筆`)
            }

            if (pitchingPreview.length > 0) {
                const isCompleteGame = pitchingPreview.length === 1 ? 1 : 0
                const pitchingRes = await fetch('/api/pitching-insert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        records: pitchingPreview.map(p => ({
                            ...p, game_date: date, is_major: isMajor, complete_game: isCompleteGame
                        })),
                        table: 'pitching_stats_2025'
                    })
                })
                const pitchingData = await pitchingRes.json()
                if (pitchingData.success) results.push(`投手 ${pitchingPreview.length} 筆`)
            }

            if (results.length > 0) {
                setMessage({ type: 'success', text: `✅ 成功插入: ${results.join(', ')}` })
                setStatsText('')
                setPitchingPreview([])
                setBattingPreview([])
                // Refresh if viewing selected player
                if (selectedPlayer) fetchPlayerStats(selectedPlayer.player_id, statsType)
            } else {
                setMessage({ type: 'error', text: '❌ 未能插入任何數據' })
            }
        } catch (err) { setMessage({ type: 'error', text: `❌ ${err.message}` }) }
        finally { setLoading(false) }
    }

    // Batting columns
    const battingCols = ['game_date', 'is_major', 'position', 'AB', 'R', 'H', 'RBI', '2B', '3B', 'HR', 'GDP', 'BB', 'IBB', 'HBP', 'K', 'SAC', 'SF', 'SB', 'CS', 'E', 'AVG']
    const battingKeys = ['game_date', 'is_major', 'position', 'at_bats', 'runs', 'hits', 'rbis', 'doubles', 'triples', 'home_runs', 'double_plays', 'walks', 'ibb', 'hbp', 'strikeouts', 'sacrifice_bunts', 'sacrifice_flies', 'stolen_bases', 'caught_stealing', 'errors', 'avg']

    const pitchingCols = ['game_date', 'is_major', 'Pos', 'Record', 'IP', 'BF', 'P', 'S', 'H', 'HR', 'BB', 'IBB', 'HBP', 'K', 'WP', 'BK', 'R', 'ER', 'E', 'ERA', 'WHIP', 'CG']
    const pitchingKeys = ['game_date', 'is_major', 'position', 'record', 'innings_pitched', 'batters_faced', 'pitches_thrown', 'strikes_thrown', 'hits_allowed', 'home_runs_allowed', 'walks', 'ibb', 'hbp', 'strikeouts', 'wild_pitches', 'balks', 'runs_allowed', 'earned_runs', 'errors', 'era', 'whip', 'complete_game']

    if (checkingAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <div className="text-xl text-white">Loading...</div>
            </div>
        )
    }
    if (!isAdmin) return null

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">

                {/* Message Modal */}
                {message.text && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className={`relative max-w-md w-full mx-4 p-8 rounded-2xl shadow-2xl ${message.type === 'success'
                            ? 'bg-gradient-to-br from-green-900 to-green-800 border-2 border-green-400'
                            : 'bg-gradient-to-br from-red-900 to-red-800 border-2 border-red-400'
                            }`}>
                            <div className="text-center">
                                <div className={`text-6xl mb-4 ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                    {message.type === 'success' ? '✓' : '✗'}
                                </div>
                                <div className={`text-lg font-bold mb-6 ${message.type === 'success' ? 'text-green-200' : 'text-red-200'}`}>
                                    {message.text}
                                </div>
                                <button
                                    onClick={() => setMessage({ type: '', text: '' })}
                                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${message.type === 'success'
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

                {/* Header */}
                <div className="mb-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent">
                                📊 2025 數據校對
                            </h1>
                            <p className="text-slate-400 mt-1 text-sm">查詢單一球員 2025 數據，校對及登錄</p>
                        </div>
                        <button
                            onClick={() => router.push('/admin')}
                            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-white rounded-lg border border-slate-500/30 transition-colors"
                        >
                            ← 返回
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: Player Search */}
                    <div className="lg:col-span-1">
                        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-5 shadow-2xl sticky top-4">
                            <h2 className="text-lg font-bold text-purple-300 mb-4">🔍 搜尋球員</h2>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="輸入球員名稱..."
                                className="w-full bg-slate-800/60 border border-purple-500/30 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-500 mb-3"
                            />

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                                    {searchResults.map((p, idx) => (
                                        <div
                                            key={`${p.player_id}-${idx}`}
                                            onClick={() => { setSelectedPlayer(p); setSearchTerm(''); setSearchResults([]) }}
                                            className={`p-2 rounded-lg cursor-pointer transition-all text-sm ${selectedPlayer?.player_id === p.player_id
                                                ? 'bg-purple-600/30 border border-purple-400'
                                                : 'hover:bg-slate-700/50 border border-transparent'
                                                }`}
                                        >
                                            <span className="text-white font-bold">{p.name}</span>
                                            <span className="text-slate-400 ml-2 text-xs">{p.team}</span>
                                            <span className={`ml-2 text-xs ${p.batter_or_pitcher === 'pitcher' ? 'text-blue-400' : 'text-green-400'}`}>
                                                {p.batter_or_pitcher === 'pitcher' ? '投' : '打'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Selected Player */}
                            {selectedPlayer && (
                                <div className="mt-4 p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg">
                                    <div className="text-white font-bold text-lg">{selectedPlayer.name}</div>
                                    <div className="text-slate-400 text-sm">{selectedPlayer.team}</div>
                                    <div className={`text-xs mt-1 ${selectedPlayer.batter_or_pitcher === 'pitcher' ? 'text-blue-400' : 'text-green-400'}`}>
                                        {selectedPlayer.batter_or_pitcher === 'pitcher' ? '投手' : '打者'}
                                    </div>
                                    <div className="text-purple-300 text-xs mt-1">
                                        資料筆數: {playerStats.length}
                                    </div>

                                    {/* Toggle type for dual-role players */}
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            onClick={() => { setStatsType('batting'); fetchPlayerStats(selectedPlayer.player_id, 'batting') }}
                                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${statsType === 'batting'
                                                ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                                                : 'bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:text-white'
                                                }`}
                                        >
                                            打擊
                                        </button>
                                        <button
                                            onClick={() => { setStatsType('pitching'); fetchPlayerStats(selectedPlayer.player_id, 'pitching') }}
                                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${statsType === 'pitching'
                                                ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                                                : 'bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:text-white'
                                                }`}
                                        >
                                            投手
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Stats Table + Entry */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Stats List */}
                        {selectedPlayer && (
                            <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-5 shadow-2xl overflow-x-auto">
                                <h2 className="text-lg font-bold text-white mb-4">
                                    {selectedPlayer.name} — {statsType === 'batting' ? '打擊' : '投手'}紀錄 ({playerStats.length} 筆)
                                </h2>

                                {statsLoading ? (
                                    <div className="text-center py-8">
                                        <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : playerStats.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400">無紀錄</div>
                                ) : (
                                    <table className="w-full text-xs text-white">
                                        <thead>
                                            <tr className="border-b border-purple-500/30">
                                                {(statsType === 'batting' ? battingCols : pitchingCols).map(col => (
                                                    <th key={col} className="p-1.5 text-center text-purple-300 font-bold whitespace-nowrap">{col}</th>
                                                ))}
                                                <th className="p-1.5 text-center text-red-300">Del</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {playerStats.map(row => {
                                                const keys = statsType === 'batting' ? battingKeys : pitchingKeys
                                                return (
                                                    <tr key={row.id} className="border-b border-purple-500/10 hover:bg-purple-500/10">
                                                        {keys.map(key => {
                                                            let val = row[key]
                                                            if (key === 'is_major') val = val ? '1軍' : '2軍'
                                                            if (key === 'avg' && val != null) val = Number(val).toFixed(3)
                                                            if (key === 'era' && val != null) val = Number(val).toFixed(2)
                                                            if (key === 'whip' && val != null) val = Number(val).toFixed(2)
                                                            return (
                                                                <td key={key} className="p-1.5 text-center whitespace-nowrap">
                                                                    {val ?? '-'}
                                                                </td>
                                                            )
                                                        })}
                                                        <td className="p-1.5 text-center">
                                                            <button
                                                                onClick={() => handleDelete(row.id)}
                                                                className="text-red-400 hover:text-red-300 transition-colors"
                                                                title="刪除"
                                                            >
                                                                ✗
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        {/* Data Entry Section */}
                        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-5 shadow-2xl">
                            <h2 className="text-lg font-bold text-purple-300 mb-4">📝 數據登錄 (2025)</h2>

                            <div className="mb-4">
                                <label className="block text-purple-300 text-sm font-semibold mb-2">Game Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full md:w-64 bg-slate-800/60 border border-purple-500/30 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

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

                            <div className="mb-4">
                                <label className="block text-purple-300 text-sm font-semibold mb-2">
                                    貼上數據 (投手+打者一起貼，包含標題列)
                                </label>
                                <textarea
                                    value={statsText}
                                    onChange={e => setStatsText(e.target.value)}
                                    placeholder={`範例:\n統一7-ELEVEn獅\t打數\t得分\t安打\t打點 ...\n1 林佳緯 CF\t5\t0\t0\t0 ...`}
                                    rows={8}
                                    className="w-full bg-slate-800/60 border border-purple-500/30 text-white p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading || (pitchingPreview.length === 0 && battingPreview.length === 0)}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg"
                            >
                                {loading ? '插入中...' : `Insert ${battingPreview.length} 打者 + ${pitchingPreview.length} 投手 → batting/pitching_stats_2025`}
                            </button>

                            {/* Preview */}
                            {battingPreview.length > 0 && (
                                <div className="mt-4 overflow-x-auto">
                                    <h3 className="text-sm font-bold text-white mb-2">打者 Preview ({battingPreview.length})</h3>
                                    <table className="w-full text-xs text-white">
                                        <thead>
                                            <tr className="border-b border-purple-500/30">
                                                <th className="p-1 text-left">Name</th><th className="p-1">Pos</th>
                                                <th className="p-1">AB</th><th className="p-1">R</th><th className="p-1">H</th>
                                                <th className="p-1">RBI</th><th className="p-1">HR</th><th className="p-1">BB</th>
                                                <th className="p-1">K</th><th className="p-1">SB</th><th className="p-1">AVG</th>
                                                <th className="p-1">ID</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {battingPreview.map((p, idx) => (
                                                <tr key={idx} className="border-b border-purple-500/10">
                                                    <td className="p-1 font-bold">{p.name}</td><td className="p-1 text-center">{p.position}</td>
                                                    <td className="p-1 text-center">{p.at_bats}</td><td className="p-1 text-center">{p.runs}</td>
                                                    <td className="p-1 text-center">{p.hits}</td><td className="p-1 text-center">{p.rbis}</td>
                                                    <td className="p-1 text-center">{p.home_runs}</td><td className="p-1 text-center">{p.walks}</td>
                                                    <td className="p-1 text-center">{p.strikeouts}</td><td className="p-1 text-center">{p.stolen_bases}</td>
                                                    <td className="p-1 text-center">{p.avg?.toFixed(3)}</td>
                                                    <td className={`p-1 text-center ${p.player_id ? 'text-green-400' : 'text-red-400'}`}>{p.player_id ? '✓' : '✗'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {pitchingPreview.length > 0 && (
                                <div className="mt-4 overflow-x-auto">
                                    <h3 className="text-sm font-bold text-white mb-2">投手 Preview ({pitchingPreview.length})</h3>
                                    <table className="w-full text-xs text-white">
                                        <thead>
                                            <tr className="border-b border-purple-500/30">
                                                <th className="p-1 text-left">Name</th><th className="p-1">Pos</th>
                                                <th className="p-1">Rec</th><th className="p-1">IP</th><th className="p-1">H</th>
                                                <th className="p-1">HR</th><th className="p-1">BB</th><th className="p-1">K</th>
                                                <th className="p-1">ER</th><th className="p-1">ERA</th><th className="p-1">WHIP</th>
                                                <th className="p-1">ID</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pitchingPreview.map((p, idx) => (
                                                <tr key={idx} className="border-b border-purple-500/10">
                                                    <td className="p-1 font-bold">{p.name}</td><td className="p-1 text-center">{p.position}</td>
                                                    <td className="p-1 text-center">{p.record || '-'}</td><td className="p-1 text-center">{p.innings_pitched}</td>
                                                    <td className="p-1 text-center">{p.hits_allowed}</td><td className="p-1 text-center">{p.home_runs_allowed}</td>
                                                    <td className="p-1 text-center">{p.walks}</td><td className="p-1 text-center">{p.strikeouts}</td>
                                                    <td className="p-1 text-center">{p.earned_runs}</td><td className="p-1 text-center">{p.era?.toFixed(2)}</td>
                                                    <td className="p-1 text-center">{p.whip?.toFixed(2)}</td>
                                                    <td className={`p-1 text-center ${p.player_id ? 'text-green-400' : 'text-red-400'}`}>{p.player_id ? '✓' : '✗'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
