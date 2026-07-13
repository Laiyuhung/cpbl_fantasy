const BRACKET_DEFINITIONS = {
  2: [
    [
      {
        key: 'final',
        type: 'match',
        left: { kind: 'seed', seed: 1 },
        right: { kind: 'seed', seed: 2 },
        label: 'Final',
      },
    ],
  ],
  4: [
    [
      {
        key: 'm1',
        type: 'match',
        left: { kind: 'seed', seed: 1 },
        right: { kind: 'seed', seed: 4 },
        label: 'Semifinal',
      },
      {
        key: 'm2',
        type: 'match',
        left: { kind: 'seed', seed: 2 },
        right: { kind: 'seed', seed: 3 },
        label: 'Semifinal',
      },
    ],
    [
      {
        key: 'final',
        type: 'match',
        left: null,
        right: null,
        label: 'Final',
      },
    ],
  ],
  6: [
    [
      {
        key: 'bye1',
        type: 'bye',
        left: { kind: 'seed', seed: 1 },
        label: 'Bye',
      },
      {
        key: 'bye2',
        type: 'bye',
        left: { kind: 'seed', seed: 2 },
        label: 'Bye',
      },
      {
        key: 'm1',
        type: 'match',
        left: { kind: 'seed', seed: 3 },
        right: { kind: 'seed', seed: 6 },
        label: 'Quarterfinal',
      },
      {
        key: 'm2',
        type: 'match',
        left: { kind: 'seed', seed: 4 },
        right: { kind: 'seed', seed: 5 },
        label: 'Quarterfinal',
      },
    ],
    [
      {
        key: 'sf1',
        type: 'match',
        left: { kind: 'seed', seed: 1 },
        right: null,
        label: 'Semifinal',
      },
      {
        key: 'sf2',
        type: 'match',
        left: { kind: 'seed', seed: 2 },
        right: null,
        label: 'Semifinal',
      },
    ],
    [
      {
        key: 'final',
        type: 'match',
        left: null,
        right: null,
        label: 'Final',
      },
    ],
  ],
  8: [
    [
      {
        key: 'm1',
        type: 'match',
        left: { kind: 'seed', seed: 1 },
        right: { kind: 'seed', seed: 8 },
        label: 'Quarterfinal',
      },
      {
        key: 'm2',
        type: 'match',
        left: { kind: 'seed', seed: 4 },
        right: { kind: 'seed', seed: 5 },
        label: 'Quarterfinal',
      },
      {
        key: 'm3',
        type: 'match',
        left: { kind: 'seed', seed: 2 },
        right: { kind: 'seed', seed: 7 },
        label: 'Quarterfinal',
      },
      {
        key: 'm4',
        type: 'match',
        left: { kind: 'seed', seed: 3 },
        right: { kind: 'seed', seed: 6 },
        label: 'Quarterfinal',
      },
    ],
    [
      {
        key: 'sf1',
        type: 'match',
        left: null,
        right: null,
        label: 'Semifinal',
      },
      {
        key: 'sf2',
        type: 'match',
        left: null,
        right: null,
        label: 'Semifinal',
      },
    ],
    [
      {
        key: 'final',
        type: 'match',
        left: null,
        right: null,
        label: 'Final',
      },
    ],
  ],
}

function sortBySeed(a, b) {
  return Number(a.seed) - Number(b.seed)
}

export function parsePlayoffConfig(playoffsText) {
  if (!playoffsText || String(playoffsText).trim() === 'No playoffs') {
    return null
  }

  const text = String(playoffsText)
  const teamsMatch = text.match(/(\d+)\s+teams?/i)
  const weeksMatch = text.match(/(\d+)\s+weeks?/i)

  const teamCount = teamsMatch ? Number.parseInt(teamsMatch[1], 10) : 0
  const roundCount = weeksMatch ? Number.parseInt(weeksMatch[1], 10) : 0

  if (!teamCount || !roundCount) {
    return null
  }

  return {
    teamCount,
    roundCount,
    raw: text,
  }
}

export function getPlayoffRoundLabel(teamCount, roundIndex) {
  if (teamCount === 2) return ['Final'][roundIndex] || `Playoff Round ${roundIndex + 1}`
  if (teamCount === 4) return ['Semifinal', 'Final'][roundIndex] || `Playoff Round ${roundIndex + 1}`
  if (teamCount === 6 || teamCount >= 8) {
    return ['Quarterfinal', 'Semifinal', 'Final'][roundIndex] || `Playoff Round ${roundIndex + 1}`
  }
  return `Playoff Round ${roundIndex + 1}`
}

export function getBracketDefinitions(teamCount) {
  return BRACKET_DEFINITIONS[teamCount] || null
}

export function buildSeedMap(standingsRows, teamCount) {
  const sortedRows = [...(standingsRows || [])].sort((a, b) => {
    const rankA = Number(a.rank ?? Number.MAX_SAFE_INTEGER)
    const rankB = Number(b.rank ?? Number.MAX_SAFE_INTEGER)
    if (rankA !== rankB) return rankA - rankB

    const pctA = Number(a.win_pct ?? 0)
    const pctB = Number(b.win_pct ?? 0)
    if (pctA !== pctB) return pctB - pctA

    const winsA = Number(a.wins ?? 0)
    const winsB = Number(b.wins ?? 0)
    if (winsA !== winsB) return winsB - winsA

    return String(a.nickname || '').localeCompare(String(b.nickname || ''))
  })

  const seedMap = {}
  const seedList = []

  sortedRows.slice(0, teamCount).forEach((row, index) => {
    const seed = index + 1
    const entry = {
      ...row,
      seed,
    }
    seedMap[seed] = entry
    seedMap[row.manager_id] = entry
    seedList.push(entry)
  })

  return { seedMap, seedList }
}

function resolveRef(ref, { seedMap, resolvedKeys }) {
  if (!ref) {
    return null
  }

  if (ref.kind === 'seed') {
    return seedMap[ref.seed] || null
  }

  if (ref.kind === 'winner') {
    const resolved = resolvedKeys[ref.key]
    if (!resolved?.winnerManagerId) {
      return {
        manager_id: null,
        seed: null,
        nickname: 'TBD',
        unresolved: true,
      }
    }

    return seedMap[resolved.winnerManagerId] || {
      manager_id: resolved.winnerManagerId,
      seed: resolved.winnerSeed ?? 999,
      nickname: resolved.winnerNickname || 'TBD',
    }
  }

  return null
}

function makeRoundRow({ leagueId, weekRow, entry, left, right, rowKey }) {
  const isBye = entry.type === 'bye'

  return {
    rowKey,
    league_id: leagueId,
    week_number: weekRow.week_number,
    week_type: 'playoffs',
    start_date: weekRow.week_start,
    end_date: weekRow.week_end,
    manager_id_a: left?.manager_id || null,
    score_a: 0,
    manager_id_b: isBye ? null : right?.manager_id || null,
    score_b: 0,
    winner_manager_id: isBye ? (left?.manager_id || null) : null,
    is_tie: false,
    created_at: null,
    updated_at: null,
    tie_categories_count: 0,
    matchup_label: entry.label,
    matchup_type: entry.type,
    left_seed: left?.seed ?? null,
    right_seed: right?.seed ?? null,
    left_nickname: left?.nickname || '-',
    right_nickname: isBye ? 'BYE' : (right?.nickname || '-'),
  }
}

function getWinnerFromRow(row, seedMap) {
  const winnerManagerId = row.winner_manager_id
    || (row.manager_id_b == null ? row.manager_id_a : null)
    || (Number(row.score_a) > Number(row.score_b) ? row.manager_id_a : null)
    || (Number(row.score_b) > Number(row.score_a) ? row.manager_id_b : null)

  if (!winnerManagerId) {
    return null
  }

  const seedInfo = seedMap[winnerManagerId]
  return {
    winnerManagerId,
    winnerSeed: seedInfo?.seed ?? null,
    winnerNickname: seedInfo?.nickname || 'TBD',
  }
}

function matchPair(row, left, right) {
  const rowLeft = row.manager_id_a
  const rowRight = row.manager_id_b
  const leftId = left?.manager_id || null
  const rightId = right?.manager_id || null

  if (rowRight == null && rightId == null) {
    return rowLeft === leftId
  }

  return (
    (rowLeft === leftId && rowRight === rightId)
    || (rowLeft === rightId && rowRight === leftId)
  )
}

function buildResolvedKeysForRounds({ definitions, targetIndex, existingRowsByWeek, playoffWeeks, seedMap }) {
  const resolvedKeys = {}

  for (let roundIndex = 0; roundIndex < targetIndex; roundIndex++) {
    const definition = definitions[roundIndex]
    const weekNumber = Number(playoffWeeks[roundIndex]?.week_number)
    const rowsForWeek = existingRowsByWeek.get(weekNumber) || []
    const matchedRows = []

    for (const entry of definition) {
      const left = resolveRef(entry.left, { seedMap, resolvedKeys })
      const right = entry.type === 'bye' ? null : resolveRef(entry.right, { seedMap, resolvedKeys })

      const row = rowsForWeek.find((candidate) => !matchedRows.includes(candidate) && matchPair(candidate, left, right))
      if (!row) {
        resolvedKeys[entry.key] = {
          winnerManagerId: null,
          winnerSeed: null,
          winnerNickname: 'TBD',
        }
        continue
      }

      matchedRows.push(row)

      const winner = getWinnerFromRow(row, seedMap)
      if (winner?.winnerManagerId) {
        resolvedKeys[entry.key] = winner
      } else {
        resolvedKeys[entry.key] = {
          winnerManagerId: null,
          winnerSeed: null,
          winnerNickname: 'TBD',
        }
      }
    }
  }

  return resolvedKeys
}

export function buildPlayoffInsertPlan({
  leagueId,
  leagueName,
  playoffsText,
  playoffReseeding,
  standingsRows,
  scheduleRows,
  existingPlayoffRows,
  targetWeekNumber,
  seedSource = 'final',
}) {
  const config = parsePlayoffConfig(playoffsText)
  if (!config) {
    return { error: 'This league does not have a playoff configuration.' }
  }

  const definitions = getBracketDefinitions(config.teamCount)
  if (!definitions) {
    return { error: `Unsupported playoff team count: ${config.teamCount}` }
  }

  const playoffWeeks = [...(scheduleRows || [])]
    .filter((row) => row.week_type === 'playoffs')
    .sort((a, b) => Number(a.week_number) - Number(b.week_number))

  const targetIndex = playoffWeeks.findIndex((row) => Number(row.week_number) === Number(targetWeekNumber))
  if (targetIndex < 0) {
    return { error: 'Selected week is not a playoff week.' }
  }

  const targetWeekRow = playoffWeeks[targetIndex]

  const { seedMap, seedList } = buildSeedMap(standingsRows, config.teamCount)

  if (seedList.length < config.teamCount) {
    return {
      error: `Need at least ${config.teamCount} ranked teams to build this playoff bracket.`,
    }
  }

  const existingRowsByWeek = new Map()
  for (const row of existingPlayoffRows || []) {
    if (!existingRowsByWeek.has(row.week_number)) {
      existingRowsByWeek.set(row.week_number, [])
    }
    existingRowsByWeek.get(row.week_number).push(row)
  }

  if (targetIndex === 0) {
    const roundDefinition = definitions[0]
    const rows = []

    for (const entry of roundDefinition) {
      const left = resolveRef(entry.left, { seedMap, resolvedKeys: {} })
      if (!left) {
        return { error: `Unable to resolve left side for ${entry.key}.` }
      }

      const right = entry.type === 'bye' ? null : resolveRef(entry.right, { seedMap, resolvedKeys: {} })
      if (entry.type !== 'bye' && !right) {
        return { error: `Unable to resolve right side for ${entry.key}.` }
      }

      rows.push(makeRoundRow({
        leagueId,
        weekRow: targetWeekRow,
        entry,
        left,
        right,
        rowKey: entry.key,
      }))
    }

    return {
      success: true,
      leagueId,
      leagueName,
      config,
      seedSource,
      roundIndex: 0,
      targetWeekRow,
      rows,
    }
  }

  const resolvedKeys = buildResolvedKeysForRounds({
    definitions,
    targetIndex,
    existingRowsByWeek,
    playoffWeeks,
    seedMap,
  })

  const currentDefinition = definitions[targetIndex]
  if (!currentDefinition) {
    return {
      error: `No playoff definition found for round ${targetIndex + 1}.`,
    }
  }

  const rows = []
  for (const entry of currentDefinition) {
    const left = resolveRef(entry.left, { seedMap, resolvedKeys }) || {
      manager_id: null,
      seed: null,
      nickname: 'TBD',
    }

    const right = entry.type === 'bye' ? null : (resolveRef(entry.right, { seedMap, resolvedKeys }) || {
      manager_id: null,
      seed: null,
      nickname: 'TBD',
    })

    rows.push(makeRoundRow({
      leagueId,
      weekRow: targetWeekRow,
      entry,
      left,
      right,
      rowKey: entry.key,
    }))
  }

  return {
    success: true,
    leagueId,
    leagueName,
    config,
    seedSource,
    roundIndex: targetIndex,
    targetWeekRow,
    rows,
  }
}
