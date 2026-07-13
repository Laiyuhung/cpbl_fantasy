'use client'

import { useEffect, useMemo, useState } from 'react'

function fmtDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function fmtDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RowBadge({ children, tone = 'slate' }) {
  const palette = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
  }

  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${palette[tone] || palette.slate}`}>{children}</span>
}

function StandingsTable({ title, rows, emptyText, tone }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">{title}</h3>
        <RowBadge tone={tone}>{rows.length}</RowBadge>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-slate-400 text-sm">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-[0.16em]">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Nick</th>
                <th className="px-4 py-3 text-left">W-L-T</th>
                <th className="px-4 py-3 text-left">Pct</th>
                <th className="px-4 py-3 text-left">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.league_id}-${row.manager_id}-${row.rank}`} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-black text-slate-700">{row.rank ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{row.nickname || '-'}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate max-w-[220px]">{row.manager_id}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{row.record_display || `${row.wins ?? 0}-${row.losses ?? 0}-${row.ties ?? 0}`}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{row.win_pct ?? '-'}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{row.streak || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MatchupsTable({ rows }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">League Matchups</h3>
        <RowBadge tone="purple">{rows.length}</RowBadge>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-slate-400 text-sm">No matchup rows yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-[0.16em]">
              <tr>
                <th className="px-4 py-3 text-left">Week</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">A</th>
                <th className="px-4 py-3 text-left">B</th>
                <th className="px-4 py-3 text-left">Winner</th>
                <th className="px-4 py-3 text-left">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-slate-700">W{row.week_number}</td>
                  <td className="px-4 py-3">
                    <RowBadge tone={row.week_type === 'playoffs' ? 'purple' : 'blue'}>{row.week_type}</RowBadge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.manager_id_a || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.manager_id_b || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.winner_manager_id || '-'}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{Number(row.score_a ?? 0).toFixed(1)} - {Number(row.score_b ?? 0).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PlayoffMatchupsPanel({ rows, members, standings, liveStandings, seedSource }) {
  const visibleRows = rows.filter((row) => row.week_type === 'playoffs')
  const rankingRows = seedSource === 'live' ? liveStandings : standings

  const memberLookup = useMemo(() => {
    const map = new Map()

    ;(members || []).forEach((member) => {
      map.set(String(member.manager_id), {
        nickname: member.nickname || '-',
        role: member.role || '-',
      })
    })

    return map
  }, [members])

  const rankingLookup = useMemo(() => {
    const map = new Map()

    ;(rankingRows || []).forEach((row) => {
      map.set(String(row.manager_id), {
        rank: row.rank ?? '-',
        record: row.record_display || `${row.wins ?? 0}-${row.losses ?? 0}-${row.ties ?? 0}`,
        winPct: row.win_pct ?? '-',
      })
    })

    return map
  }, [rankingRows])

  const getManagerCard = (managerId) => {
    const member = memberLookup.get(String(managerId)) || {}
    const rank = rankingLookup.get(String(managerId)) || {}

    return {
      nickname: member.nickname || 'BYE',
      role: member.role || '-',
      rank: rank.rank,
      record: rank.record,
      winPct: rank.winPct,
    }
  }

  if (visibleRows.length === 0) {
    return (
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-gradient-to-r from-purple-50 to-cyan-50">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">Playoff Matchups</h3>
            <p className="text-xs text-slate-500 mt-1">季後賽對戰卡片</p>
          </div>
          <RowBadge tone="purple">0</RowBadge>
        </div>
        <div className="px-5 py-10 text-center text-slate-400 text-sm">No playoff matchups yet.</div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-gradient-to-r from-purple-50 to-cyan-50">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">Playoff Matchups</h3>
          <p className="text-xs text-slate-500 mt-1">以 nickname / rank / record 呈現的季後賽對戰卡片</p>
        </div>
        <RowBadge tone="purple">{visibleRows.length}</RowBadge>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {visibleRows.map((row) => {
          const managerA = getManagerCard(row.manager_id_a)
          const managerB = row.manager_id_b ? getManagerCard(row.manager_id_b) : null
          const isBye = row.matchup_type === 'bye'

          return (
            <div key={row.id} className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)] overflow-hidden">
              <div className="px-4 sm:px-5 py-3 bg-gradient-to-r from-slate-900 to-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Week {row.week_number}</div>
                  <div className="mt-1 text-lg font-black text-white">{row.matchup_label || row.matchup_type || 'playoff'}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RowBadge tone={row.week_type === 'playoffs' ? 'purple' : 'blue'}>{row.week_type}</RowBadge>
                  <RowBadge tone={isBye ? 'amber' : 'emerald'}>{isBye ? 'bye' : 'match'}</RowBadge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <div className="p-4 sm:p-5 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Seed {row.left_seed ?? '-'}</div>
                      <div className="mt-1 text-lg font-black text-slate-900 truncate">{managerA.nickname}</div>
                      <div className="mt-1 text-xs text-slate-500">Rank #{managerA.rank} · {managerA.record}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Score</div>
                      <div className="mt-1 text-2xl font-black text-cyan-600 tabular-nums">{Number(row.score_a ?? 0).toFixed(1)}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Seed {row.right_seed ?? (isBye ? 'BYE' : '-')}</div>
                      <div className="mt-1 text-lg font-black text-slate-900 truncate">{isBye ? 'BYE' : managerB?.nickname || 'TBD'}</div>
                      <div className="mt-1 text-xs text-slate-500">{isBye ? 'Automatic advance' : `Rank #${managerB?.rank ?? '-' } · ${managerB?.record ?? '-'}`}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Score</div>
                      <div className="mt-1 text-2xl font-black text-cyan-600 tabular-nums">{isBye ? '—' : Number(row.score_b ?? 0).toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 sm:px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
                <div className="font-mono">Winner: {row.winner_manager_id ? (memberLookup.get(String(row.winner_manager_id))?.nickname || row.winner_manager_id) : 'TBD'}</div>
                <div>{fmtDate(row.start_date)} - {fmtDate(row.end_date)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DraftPreviewTable({ rows, members, onRowChange }) {
  const memberOptions = members.map((member) => ({
    value: member.manager_id,
    label: member.nickname || 'Unnamed',
  }))

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-[0.16em]">
          <tr>
            <th className="px-4 py-3 text-left">Week</th>
            <th className="px-4 py-3 text-left">Round</th>
            <th className="px-4 py-3 text-left">Left Seed</th>
            <th className="px-4 py-3 text-left">Manager A</th>
            <th className="px-4 py-3 text-left">Right Seed</th>
            <th className="px-4 py-3 text-left">Manager B</th>
            <th className="px-4 py-3 text-left">Score</th>
            <th className="px-4 py-3 text-left">Winner</th>
            <th className="px-4 py-3 text-left">Tie</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, index) => (
            <tr key={row.rowKey || `${row.week_number}-${index}`} className="align-top hover:bg-slate-50/80">
              <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                <div>W{row.week_number}</div>
                <div className="text-[11px] text-slate-400 mt-1">{fmtDate(row.start_date)} - {fmtDate(row.end_date)}</div>
              </td>
              <td className="px-4 py-3">
                <RowBadge tone={row.matchup_type === 'bye' ? 'amber' : 'purple'}>{row.matchup_label || row.matchup_type || 'match'}</RowBadge>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">{row.rowKey || `row-${index + 1}`}</div>
              </td>
              <td className="px-4 py-3 font-black text-slate-700 whitespace-nowrap">#{row.left_seed ?? '-'}</td>
              <td className="px-4 py-3 min-w-[240px]">
                <select
                  value={row.manager_id_a || ''}
                  onChange={(e) => onRowChange(index, 'manager_id_a', e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${!row.manager_id_a ? 'border-amber-400 bg-amber-50 text-slate-800 focus:border-amber-500' : 'border-slate-300 bg-white text-slate-800 focus:border-purple-500'}`}
                >
                  <option value="">Select Manager</option>
                  {memberOptions.map((member) => (
                    <option key={member.value} value={member.value}>{member.label}</option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-400 mt-1 font-mono break-all">{row.left_nickname || '-'}</div>
              </td>
              <td className="px-4 py-3 font-black text-slate-700 whitespace-nowrap">#{row.right_seed ?? '-'}</td>
              <td className="px-4 py-3 min-w-[240px]">
                {row.matchup_type === 'bye' ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-slate-500 text-sm">BYE</div>
                ) : (
                  <>
                    <select
                      value={row.manager_id_b || ''}
                      onChange={(e) => onRowChange(index, 'manager_id_b', e.target.value)}
                      className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${!row.manager_id_b ? 'border-amber-400 bg-amber-50 text-slate-800 focus:border-amber-500' : 'border-slate-300 bg-white text-slate-800 focus:border-purple-500'}`}
                    >
                      <option value="">Select Manager</option>
                      {memberOptions.map((member) => (
                        <option key={member.value} value={member.value}>{member.label}</option>
                      ))}
                    </select>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono break-all">{row.right_nickname || '-'}</div>
                  </>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={row.score_a ?? 0}
                    onChange={(e) => onRowChange(index, 'score_a', e.target.value)}
                    className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-purple-500 focus:outline-none"
                  />
                  <span className="text-slate-400 font-black">-</span>
                  <input
                    type="number"
                    step="0.1"
                    value={row.score_b ?? 0}
                    onChange={(e) => onRowChange(index, 'score_b', e.target.value)}
                    className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </td>
              <td className="px-4 py-3 min-w-[220px]">
                {row.matchup_type === 'bye' ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-slate-500 text-sm">Auto winner</div>
                ) : (
                  <select
                    value={row.winner_manager_id || ''}
                    onChange={(e) => onRowChange(index, 'winner_manager_id', e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Auto / None</option>
                    {row.manager_id_a ? <option value={row.manager_id_a}>{row.left_nickname || row.manager_id_a}</option> : null}
                    {row.manager_id_b ? <option value={row.manager_id_b}>{row.right_nickname || row.manager_id_b}</option> : null}
                  </select>
                )}
              </td>
              <td className="px-4 py-3">
                <label className="inline-flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(row.is_tie)}
                    onChange={(e) => onRowChange(index, 'is_tie', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">{row.tie_categories_count ?? 0}</span>
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminPlayoffSchedulePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [leagues, setLeagues] = useState([])
  const [selectedLeagueId, setSelectedLeagueId] = useState('')
  const [league, setLeague] = useState(null)
  const [members, setMembers] = useState([])
  const [schedule, setSchedule] = useState([])
  const [standings, setStandings] = useState([])
  const [liveStandings, setLiveStandings] = useState([])
  const [matchups, setMatchups] = useState([])
  const [playoffWeeks, setPlayoffWeeks] = useState([])
  const [seedSource, setSeedSource] = useState('final')
  const [selectedWeekNumber, setSelectedWeekNumber] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [draftRows, setDraftRows] = useState([])

  useEffect(() => {
    if (!notice) return

    const timer = setTimeout(() => setNotice(null), 3000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const loadLeagues = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/admin/playoff-schedule')
        const data = await res.json()
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to load leagues')
        }
        setLeagues(data.leagues || [])
        if ((data.leagues || []).length > 0) {
          setSelectedLeagueId((prev) => prev || data.leagues[0].league_id)
        }
      } catch (err) {
        console.error('Failed to load playoff leagues:', err)
        setError(err.message || 'Failed to load leagues')
      } finally {
        setLoading(false)
      }
    }

    loadLeagues()
  }, [])

  useEffect(() => {
    if (!selectedLeagueId) return

    const loadLeague = async () => {
      setLoading(true)
      setError('')
      setNotice(null)
      try {
        const res = await fetch(`/api/admin/playoff-schedule?leagueId=${encodeURIComponent(selectedLeagueId)}`)
        const data = await res.json()
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to load league data')
        }

        setLeague(data.league || null)
        setMembers(data.members || [])
        setSchedule(data.schedule || [])
        setStandings(data.standings || [])
        setLiveStandings(data.liveStandings || [])
        setMatchups(data.matchups || [])
        setPlayoffWeeks(data.playoffWeeks || [])

        const firstPlayoffWeek = (data.playoffWeeks || [])[0]?.week_number || ''
        setSelectedWeekNumber((prev) => {
          const hasPrev = (data.playoffWeeks || []).some((week) => String(week.week_number) === String(prev))
          return hasPrev ? prev : String(firstPlayoffWeek || '')
        })

        setSeedSource((data.liveStandings || []).length > 0 ? 'live' : 'final')
      } catch (err) {
        console.error('Failed to load league data:', err)
        setError(err.message || 'Failed to load league data')
      } finally {
        setLoading(false)
      }
    }

    loadLeague()
  }, [selectedLeagueId])

  useEffect(() => {
    if (!league?.league_id || league.league_id !== selectedLeagueId || !selectedWeekNumber) {
      setDraftRows([])
      return
    }

    const loadPreview = async () => {
      setPreviewLoading(true)
      setNotice(null)
      try {
        const params = new URLSearchParams({
          leagueId: selectedLeagueId,
          targetWeekNumber: String(selectedWeekNumber),
          seedSource,
        })

        const res = await fetch(`/api/admin/playoff-schedule?${params.toString()}`)
        const data = await res.json()
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to load preview rows')
        }

        setDraftRows((data.preview || []).map((row) => ({
          ...row,
          score_a: row.score_a ?? 0,
          score_b: row.score_b ?? 0,
          winner_manager_id: row.winner_manager_id ?? '',
        })))
      } catch (err) {
        console.error('Failed to load playoff preview:', err)
        setNotice({ type: 'error', title: 'Preview error', detail: err.message || 'Failed to load preview rows' })
        setDraftRows([])
      } finally {
        setPreviewLoading(false)
      }
    }

    loadPreview()
  }, [league?.league_id, selectedLeagueId, selectedWeekNumber, seedSource])

  const selectedPlayoffWeek = useMemo(
    () => playoffWeeks.find((week) => Number(week.week_number) === Number(selectedWeekNumber)) || null,
    [playoffWeeks, selectedWeekNumber],
  )

  const handleRowChange = (index, field, value) => {
    setDraftRows((prev) => prev.map((row, rowIndex) => {
      if (rowIndex !== index) return row

      let nextValue = value
      if (field === 'score_a' || field === 'score_b' || field === 'tie_categories_count') {
        nextValue = value === '' ? 0 : Number(value)
      } else if (field === 'is_tie') {
        nextValue = Boolean(value)
      }

      return {
        ...row,
        [field]: nextValue,
      }
    }))
  }

  const handleInsert = async () => {
    if (!league || !selectedPlayoffWeek) return

    // 驗證所有非 bye 比賽都必須選擇 manager
    const incompleteRows = draftRows.filter((row) => {
      if (row.matchup_type === 'bye') return false
      return !row.manager_id_a || !row.manager_id_b
    })

    if (incompleteRows.length > 0) {
      setNotice({
        type: 'error',
        title: 'Incomplete Selection',
        detail: `請為所有比賽選擇 Manager A 和 Manager B（${incompleteRows.length} 筆未完成）`,
      })
      return
    }

    setSaving(true)
    setError('')
    setNotice(null)

    try {
      const res = await fetch('/api/admin/playoff-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: league.league_id,
          targetWeekNumber: Number(selectedPlayoffWeek.week_number),
          seedSource,
          rows: draftRows,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to insert playoff rows')
      }

      setNotice({
        type: 'success',
        title: 'Inserted',
        detail: `已寫入 W${selectedPlayoffWeek.week_number} 的季後賽賽程，共 ${data.inserted?.length || 0} 筆。`,
      })

      const refreshRes = await fetch(`/api/admin/playoff-schedule?leagueId=${encodeURIComponent(league.league_id)}`)
      const refreshData = await refreshRes.json()
      if (refreshRes.ok && refreshData?.success) {
        setMatchups(refreshData.matchups || [])
        setSchedule(refreshData.schedule || [])
        setStandings(refreshData.standings || [])
        setLiveStandings(refreshData.liveStandings || [])
        setPlayoffWeeks(refreshData.playoffWeeks || [])
      }
    } catch (err) {
      console.error('Failed to insert playoff schedule:', err)
      setNotice({
        type: 'error',
        title: 'Insert failed',
        detail: err.message || 'Failed to insert playoff schedule',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading && leagues.length === 0) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff_0,_#f8fafc_35%,_#eef2ff_100%)] py-8">
      {notice ? (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4">
          <div className={`w-full max-w-xl rounded-[2rem] border p-6 sm:p-8 shadow-2xl ${notice.type === 'success' ? 'border-emerald-300/40 bg-emerald-500/15' : 'border-rose-300/40 bg-rose-500/15'}`}>
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${notice.type === 'success' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {notice.type === 'success' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M10.29 3.86l-7.2 12.46A2 2 0 004.83 19h14.34a2 2 0 001.74-2.68l-7.2-12.46a2 2 0 00-3.42 0z" />
                  )}
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-white/60">
                  {notice.type === 'success' ? 'Success' : 'Error'}
                </div>
                <div className="mt-2 text-2xl font-black text-white">{notice.title}</div>
                <div className="mt-2 text-sm sm:text-base text-white/80 leading-relaxed">{notice.detail}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="bg-white/90 backdrop-blur rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-xs font-black uppercase tracking-[0.2em] mb-3">
                Admin Playoff Scheduler
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900">季後賽賽程插入</h1>
              <p className="mt-2 text-slate-600 max-w-3xl">
                選擇聯盟後，可檢視聯盟設定、結算戰績、即時戰績、聯盟成員、賽程與現有對戰資料，並將指定輪次的季後賽賽程寫入 league_matchups。
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[320px] lg:min-w-[520px]">
              <label className="block">
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500 mb-2">League</span>
                <select
                  value={selectedLeagueId}
                  onChange={(e) => setSelectedLeagueId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-purple-500 focus:outline-none"
                >
                  {leagues.map((item) => (
                    <option key={item.league_id} value={item.league_id}>
                      {item.league_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500 mb-2">Seed Source</span>
                <select
                  value={seedSource}
                  onChange={(e) => setSeedSource(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-purple-500 focus:outline-none"
                >
                  <option value="final">結算戰績</option>
                  <option value="live">即時戰績</option>
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500 mb-2">Playoff Week</span>
                <select
                  value={selectedWeekNumber}
                  onChange={(e) => setSelectedWeekNumber(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-purple-500 focus:outline-none"
                >
                  <option value="">Select</option>
                  {playoffWeeks.map((week) => (
                    <option key={week.id} value={week.week_number}>
                      W{week.week_number} {week.week_label ? `- ${week.week_label}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

        </div>

        {!league ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-slate-500">
            找不到聯盟資料。
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">League</div>
                <div className="mt-2 text-xl font-black text-slate-900">{league.league_name}</div>
                <div className="mt-2 text-xs text-slate-500 font-mono break-all">{league.league_id}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Playoffs</div>
                <div className="mt-2 text-lg font-black text-slate-900">{league.playoffs || '-'}</div>
                <div className="mt-2 text-xs text-slate-500">Start: {league.playoffs_start || '-'}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Reseeding</div>
                <div className="mt-2 text-lg font-black text-slate-900">{league.playoff_reseeding || '-'}</div>
                <div className="mt-2 text-xs text-slate-500">Scoring: {league.scoring_type || '-'}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Members</div>
                <div className="mt-2 text-lg font-black text-slate-900">{members.length}</div>
                <div className="mt-2 text-xs text-slate-500">Schedule rows: {schedule.length}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <StandingsTable title="結算戰績" rows={standings} emptyText="沒有結算戰績資料。" tone="emerald" />
              <StandingsTable title="即時戰績" rows={liveStandings} emptyText="沒有即時戰績資料。" tone="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">League Settings</h3>
                  <RowBadge tone="purple">playoffs</RowBadge>
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    ['Scoring Type', league.scoring_type || '-'],
                    ['Playoffs', league.playoffs || '-'],
                    ['Playoffs Start', league.playoffs_start || '-'],
                    ['Playoff Reseeding', league.playoff_reseeding || '-'],
                    ['Playoff Tie Breaker', league.playoff_tie_breaker || '-'],
                    ['Start Scoring On', league.start_scoring_on || '-'],
                    ['Max Teams', league.max_teams ?? '-'],
                    ['Created At', fmtDateTime(league.created_at)],
                    ['Updated At', fmtDateTime(league.updated_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="px-5 py-3 flex items-start justify-between gap-4">
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
                      <span className="text-sm text-slate-800 text-right break-all">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">League Members</h3>
                  <RowBadge tone="blue">{members.length}</RowBadge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-[0.16em]">
                      <tr>
                        <th className="px-4 py-3 text-left">Nickname</th>
                        <th className="px-4 py-3 text-left">Role</th>
                        <th className="px-4 py-3 text-left">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {members.map((member) => (
                        <tr key={member.manager_id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{member.nickname || '-'}</div>
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-[220px]">{member.manager_id}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{member.role || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{fmtDate(member.joined_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">League Schedule</h3>
                  <RowBadge tone="blue">{schedule.length}</RowBadge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-[0.16em]">
                      <tr>
                        <th className="px-4 py-3 text-left">Week</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Label</th>
                        <th className="px-4 py-3 text-left">Start</th>
                        <th className="px-4 py-3 text-left">End</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedule.map((week) => (
                        <tr key={week.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-mono text-slate-700">W{week.week_number}</td>
                          <td className="px-4 py-3"><RowBadge tone={week.week_type === 'playoffs' ? 'purple' : 'blue'}>{week.week_type}</RowBadge></td>
                          <td className="px-4 py-3 text-slate-700">{week.week_label || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{fmtDate(week.week_start)}</td>
                          <td className="px-4 py-3 text-slate-700">{fmtDate(week.week_end)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <PlayoffMatchupsPanel
                rows={matchups}
                members={members}
                standings={standings}
                liveStandings={liveStandings}
                seedSource={seedSource}
              />
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-slate-900">插入預覽</h2>
                  {league?.playoff_reseeding === 'Yes' && (
                    <span className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">
                      RESEED
                    </span>
                  )}
                </div>
                <button
                  onClick={handleInsert}
                    disabled={!selectedPlayoffWeek || saving || draftRows.length === 0 || previewLoading}
                  className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                >
                  {saving ? 'Saving...' : 'Confirm & Insert'}
                </button>
              </div>

              {selectedPlayoffWeek ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Target: W{selectedPlayoffWeek.week_number} {selectedPlayoffWeek.week_label ? `- ${selectedPlayoffWeek.week_label}` : ''}
                </div>
              ) : null}

              {previewLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-500">
                  Loading preview rows...
                </div>
              ) : draftRows.length > 0 ? (
                <DraftPreviewTable rows={draftRows} members={members} onRowChange={handleRowChange} />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-500">
                  選擇聯盟與季後賽輪次後，這裡會顯示將要寫入 `league_matchups` 的預覽列。
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
