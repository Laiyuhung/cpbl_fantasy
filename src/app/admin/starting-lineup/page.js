'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const TEAMS = ['統一獅', '富邦悍將', '樂天桃猿', '中信兄弟', '味全龍', '台鋼雄鷹']

const TEAM_COLORS = {
    '統一獅': 'border-orange-500/40 bg-orange-500/10',
    '富邦悍將': 'border-blue-500/40 bg-blue-500/10',
    '樂天桃猿': 'border-rose-500/40 bg-rose-500/10',
    '中信兄弟': 'border-yellow-500/40 bg-yellow-500/10',
    '味全龍': 'border-red-500/40 bg-red-500/10',
    '台鋼雄鷹': 'border-green-500/40 bg-green-500/10',
}

const TEAM_TEXT = {
    '統一獅': 'text-orange-300',
    '富邦悍將': 'text-blue-300',
    '樂天桃猿': 'text-rose-300',
    '中信兄弟': 'text-yellow-300',
    '味全龍': 'text-red-300',
    '台鋼雄鷹': 'text-green-300',
}

function getTomorrowTW() {
    const now = new Date()
    const twOffset = 8 * 60 * 60 * 1000
    const twTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + twOffset)
    twTime.setDate(twTime.getDate() + 1)
    return twTime.toISOString().split('T')[0]
}

export default function StartingLineupPage() {
    const router = useRouter()

    // Admin check
    const [isAdmin, setIsAdmin] = useState(false)
    const [checkingAdmin, setCheckingAdmin] = useState(true)

    // Date
    const [selectedDate, setSelectedDate] = useState(getTomorrowTW())

    // Pitcher State: { team: { name: '', is_confirmed: false } }
    const [pitchers, setPitchers] = useState(() => {
        const init = {}
        TEAMS.forEach(t => { init[t] = { name: '' } })
        return init
    })

    // Lineup State: { team: [ { batting_no: 1, name: '' }, ... ] }
    const [selectedTeam, setSelectedTeam] = useState(TEAMS[0])
    const [lineups, setLineups] = useState(() => {
        const init = {}
        TEAMS.forEach(t => {
            init[t] = Array.from({ length: 9 }, (_, i) => ({ batting_no: i + 1, name: '' }))
        })
        return init
    })

    // UI State
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState({ type: '', text: '' })

    // Admin check
    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('/api/admin/check')
                const data = await res.json()
                if (!data.isAdmin) {
                    alert('You do not have admin privileges')
                    router.push('/home')
                    return
                }
                setIsAdmin(true)
            } catch {
                alert('Failed to check permissions')
                router.push('/home')
            } finally {
                setCheckingAdmin(false)
            }
        }
        check()
    }, [router])

    // Fetch data when date changes
    useEffect(() => {
        if (!isAdmin || !selectedDate) return
        fetchData()
    }, [isAdmin, selectedDate])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [pitcherRes, lineupRes] = await Promise.all([
                fetch(`/api/admin/starting-pitcher?date=${selectedDate}`),
                fetch(`/api/admin/starting-lineup?date=${selectedDate}`)
            ])
            const pitcherData = await pitcherRes.json()
            const lineupData = await lineupRes.json()

            // Reset pitchers
            const newPitchers = {}
            TEAMS.forEach(t => { newPitchers[t] = { name: '' } })
            if (pitcherData.success && pitcherData.data) {
                pitcherData.data.forEach(p => {
                    if (newPitchers[p.team]) {
                        newPitchers[p.team] = { name: p.name }
                    }
                })
            }
            setPitchers(newPitchers)

            // Reset lineups
            const newLineups = {}
            TEAMS.forEach(t => {
                newLineups[t] = Array.from({ length: 9 }, (_, i) => ({ batting_no: i + 1, name: '' }))
            })
            if (lineupData.success && lineupData.data) {
                lineupData.data.forEach(l => {
                    if (newLineups[l.team] && l.batting_no >= 1 && l.batting_no <= 9) {
                        newLineups[l.team][l.batting_no - 1].name = l.name
                    }
                })
            }
            setLineups(newLineups)
        } catch (err) {
            console.error('Fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    // Save Pitchers
    const savePitchers = async () => {
        setLoading(true)
        try {
            const pitcherList = TEAMS.map(t => ({
                team: t,
                name: pitchers[t].name
            })).filter(p => p.name.trim())

            const res = await fetch('/api/admin/starting-pitcher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: selectedDate, pitchers: pitcherList })
            })
            const data = await res.json()
            if (data.success) {
                setMessage({ type: 'success', text: `✅ 先發投手已儲存 (${data.inserted} 筆)` })
            } else {
                setMessage({ type: 'error', text: `❌ ${data.error}` })
            }
        } catch (err) {
            setMessage({ type: 'error', text: `❌ ${err.message}` })
        } finally {
            setLoading(false)
        }
    }

    // Save Lineup for selected team
    const saveLineup = async (team) => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/starting-lineup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    team,
                    lineup: lineups[team]
                })
            })
            const data = await res.json()
            if (data.success) {
                setMessage({ type: 'success', text: `✅ ${team} 先發打序已儲存 (${data.inserted} 人)` })
            } else {
                setMessage({ type: 'error', text: `❌ ${data.error}` })
            }
        } catch (err) {
            setMessage({ type: 'error', text: `❌ ${err.message}` })
        } finally {
            setLoading(false)
        }
    }

    // Save all lineups at once
    const saveAllLineups = async () => {
        setLoading(true)
        let totalInserted = 0
        try {
            for (const team of TEAMS) {
                const hasData = lineups[team].some(l => l.name.trim())
                if (!hasData) continue

                const res = await fetch('/api/admin/starting-lineup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: selectedDate,
                        team,
                        lineup: lineups[team]
                    })
                })
                const data = await res.json()
                if (data.success) totalInserted += data.inserted
            }
            setMessage({ type: 'success', text: `✅ 全部先發打序已儲存 (${totalInserted} 人)` })
        } catch (err) {
            setMessage({ type: 'error', text: `❌ ${err.message}` })
        } finally {
            setLoading(false)
        }
    }

    // Handlers
    const updatePitcher = (team, field, value) => {
        setPitchers(prev => ({
            ...prev,
            [team]: { ...prev[team], [field]: value }
        }))
    }

    const updateLineup = (team, index, name) => {
        setLineups(prev => {
            const newLineup = [...prev[team]]
            newLineup[index] = { ...newLineup[index], name }
            return { ...prev, [team]: newLineup }
        })
    }

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
            <div className="max-w-6xl mx-auto">

                {/* Message Modal */}
                {message.text && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className={`relative max-w-lg w-full mx-4 p-8 rounded-2xl shadow-2xl ${message.type === 'success'
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
                <div className="mb-8 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 md:p-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent">
                                ⚾ 先發名單管理
                            </h1>
                            <p className="text-slate-400 mt-1 text-sm">登錄每日先發投手與先發打序</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="bg-slate-800/60 border border-purple-500/30 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                                onClick={() => router.push('/admin')}
                                className="px-4 py-3 bg-slate-700/50 hover:bg-slate-600/50 text-white rounded-lg border border-slate-500/30 transition-colors whitespace-nowrap"
                            >
                                ← 返回
                            </button>
                        </div>
                    </div>
                </div>

                {loading && (
                    <div className="text-center py-4">
                        <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                {/* ===== Section 1: Starting Pitchers ===== */}
                <div className="mb-8 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-purple-300 flex items-center gap-2">
                            🔥 先發投手
                        </h2>
                        <button
                            onClick={savePitchers}
                            disabled={loading}
                            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50"
                        >
                            儲存投手
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {TEAMS.map(team => (
                            <div key={team} className={`p-4 rounded-xl border ${TEAM_COLORS[team]} transition-all`}>
                                <div className={`text-sm font-bold mb-3 ${TEAM_TEXT[team]}`}>{team}</div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={pitchers[team].name}
                                        onChange={e => updatePitcher(team, 'name', e.target.value)}
                                        placeholder="投手姓名"
                                        className="flex-1 bg-slate-800/60 border border-slate-600/40 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-500"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ===== Section 2: Starting Lineup ===== */}
                <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-purple-300 flex items-center gap-2">
                            📋 先發打序
                        </h2>
                        <button
                            onClick={saveAllLineups}
                            disabled={loading}
                            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50"
                        >
                            全部儲存
                        </button>
                    </div>

                    {/* Team Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {TEAMS.map(team => {
                            const hasData = lineups[team]?.some(l => l.name.trim())
                            return (
                                <button
                                    key={team}
                                    onClick={() => setSelectedTeam(team)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${selectedTeam === team
                                        ? `${TEAM_COLORS[team]} ${TEAM_TEXT[team]} ring-2 ring-purple-400/40`
                                        : 'border-slate-600/40 text-slate-400 hover:text-white hover:border-slate-500'
                                        }`}
                                >
                                    {team}
                                    {hasData && <span className="ml-1.5 w-2 h-2 inline-block rounded-full bg-green-400"></span>}
                                </button>
                            )
                        })}
                    </div>

                    {/* Lineup Input */}
                    <div className={`p-5 rounded-xl border ${TEAM_COLORS[selectedTeam]} mb-4`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`text-lg font-bold ${TEAM_TEXT[selectedTeam]}`}>{selectedTeam}</h3>
                            <button
                                onClick={() => saveLineup(selectedTeam)}
                                disabled={loading}
                                className="px-4 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 text-white text-sm rounded-lg border border-slate-500/30 transition-colors disabled:opacity-50"
                            >
                                儲存此隊
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {lineups[selectedTeam]?.map((slot, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/60 text-slate-300 text-sm font-bold shrink-0">
                                        {slot.batting_no}
                                    </span>
                                    <input
                                        type="text"
                                        value={slot.name}
                                        onChange={e => updateLineup(selectedTeam, idx, e.target.value)}
                                        placeholder={`第 ${slot.batting_no} 棒`}
                                        className="flex-1 bg-slate-800/60 border border-slate-600/40 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Overview: All Teams Summary */}
                    <div className="mt-6">
                        <h3 className="text-sm font-semibold text-slate-400 mb-3">全隊概覽</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {TEAMS.map(team => {
                                const filled = lineups[team]?.filter(l => l.name.trim()) || []
                                const pitcher = pitchers[team]
                                if (filled.length === 0 && !pitcher?.name?.trim()) return null
                                return (
                                    <div
                                        key={team}
                                        onClick={() => setSelectedTeam(team)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:ring-1 hover:ring-purple-400/40 ${TEAM_COLORS[team]}`}
                                    >
                                        <div className={`text-xs font-bold mb-2 ${TEAM_TEXT[team]}`}>{team}</div>
                                        {pitcher?.name?.trim() && (
                                            <div className="text-xs text-slate-300 mb-1">
                                                <span className="text-purple-400">SP:</span> {pitcher.name}
                                            </div>
                                        )}
                                        {filled.length > 0 && (
                                            <div className="text-xs text-slate-400">
                                                {filled.map(l => `${l.batting_no}.${l.name}`).join(' → ')}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
