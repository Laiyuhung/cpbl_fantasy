'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"


export default function RosterPage() {

  const [waiverPriority, setWaiverPriority] = useState(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('')
  const [onConfirmAction, setOnConfirmAction] = useState(() => () => { })
  const [taiwanToday, setTaiwanToday] = useState('')
  const [confirmPlayer, setConfirmPlayer] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [waiverDialogOpen, setWaiverDialogOpen] = useState(false)
  const [waiverList, setWaiverList] = useState([])
  const [messageBox, setMessageBox] = useState({ text: '', type: 'info' }) // type: 'info' | 'success' | 'error'
  const [messageVisible, setMessageVisible] = useState(false)
  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  const [tradeDialogOpen, setTradeDialogOpen] = useState(false)
  const [batterMap, setBatterMap] = useState(new Map())
  const [pitcherMap, setPitcherMap] = useState(new Map())
  const [allPlayers, setAllPlayers] = useState([])
  const [managerMap, setManagerMap] = useState({})
  const [tradeList, setTradeList] = useState([])
  const [weeklyIP, setWeeklyIP] = useState('0.0')
  const [activeCount, setActiveCount] = useState(0)
  const [weeklyAddCount, setWeeklyAddCount] = useState(0)
  const [gameInfoMap, setGameInfoMap] = useState({})
  const [players, setPlayers] = useState([])
  const [userId, setUserId] = useState(null)
  const [range, setRange] = useState('Today')
  const [fromDate, setFromDate] = useState('2025-03-27')
  const [toDate, setToDate] = useState('2025-11-30')
  const [loading, setLoading] = useState(false)
  const [assignedPositions, setAssignedPositions] = useState({})
  const [moveTarget, setMoveTarget] = useState(null) // 被點的球員
  const [moveSlots, setMoveSlots] = useState(null)   // 該球員可選 slot 狀態
  const batterPositionOrder = ['C', '1B', '2B', '3B', 'SS', 'OF', 'Util', 'BN', 'NA', 'NA(備用)']
  const pitcherPositionOrder = ['SP', 'RP', 'P', 'BN', 'NA', 'NA(備用)']
  const [moveMessage, setMoveMessage] = useState('')
  const [positionsLoaded, setPositionsLoaded] = useState(false)
  const [positionData, setPositionData] = useState([])
  const [rosterReady, setRosterReady] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [batterSummary, setBatterSummary] = useState(null)
  const [pitcherSummary, setPitcherSummary] = useState(null)
  const [gameInfoLoaded, setGameInfoLoaded] = useState(false)
  const [startingPitchers, setStartingPitchers] = useState([])
  const [pitchersLoaded, setPitchersLoaded] = useState(false)
  const [startingLineup, setStartingLineup] = useState([])
  const [lineupTeams, setLineupTeams] = useState([])
  const [foreignCount, setForeignCount] = useState({ all: 0, active: 0 })
  const [selectedDate, setSelectedDate] = useState(() => {
    const nowUTC = new Date()
    const taiwanOffset = 8 * 60 * 60 * 1000 // +08:00 offset in milliseconds
    const taiwanDate = new Date(nowUTC.getTime() + taiwanOffset)
    return taiwanDate.toISOString().slice(0, 10)
  })

  const today = new Date()

  function StatsRangeSelector({ range, onChange }) {
    return (
      <select
        value={range}
        onChange={e => onChange(e.target.value)}
        className="border px-2 py-1 rounded"
      >
        <option>Today</option>
        <option>Yesterday</option>
        <option>Last 7 days</option>
        <option>Last 14 days</option>
        <option>Last 30 days</option>
        <option>2025 Season</option>
      </select>
    )
  }
  useEffect(() => {
    const now = new Date()
    const taiwanOffset = 8 * 60 * 60 * 1000
    const taiwanNow = new Date(now.getTime() + taiwanOffset)
    const todayStr = taiwanNow.toISOString().slice(0, 10)
    setTaiwanToday(todayStr)
  }, [])

  useEffect(() => {
    if (!userId) return

    const fetchWeeklyIP = async () => {
      try {
        const res = await fetch('/api/weekly_ip_by_manager', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manager_id: parseInt(userId) })
        })
        const data = await res.json()
        if (res.ok) {
          setWeeklyIP(data.IP || '0.0')
        } else {
          console.error('❌ weekly_ip 查詢失敗:', data)
          setWeeklyIP(null)
        }
      } catch (err) {
        console.error('❌ 呼叫 weekly_ip_by_manager 失敗:', err)
        setWeeklyIP(null)
      }
    }

    fetchWeeklyIP()
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const fetchWeeklyAddCount = async () => {
      try {
        const res = await fetch('/api/transaction/weekly_add_count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manager_id: userId })
        })

        const data = await res.json()
        if (res.ok) {
          setWeeklyAddCount(data.count)
        } else {
          console.error('⚠️ 查詢失敗:', data)
          setWeeklyAddCount(null)
        }
      } catch (err) {
        console.error('❌ 呼叫 weekly_add_count 失敗:', err)
        setWeeklyAddCount(null)
      }
    }

    fetchWeeklyAddCount()
  }, [userId])


  useEffect(() => {
    const fetchLineupTeams = async () => {
      try {
        const res = await fetch(`/api/starting-lineup/teams?date=${selectedDate}`)
        const data = await res.json()
        if (res.ok) {
          setLineupTeams(data)
          console.log('📋 已登錄打序的球隊:', data)
        } else {
          console.error('❌ 取得 lineup 球隊失敗:', data)
          setLineupTeams([])
        }
      } catch (err) {
        console.error('❌ 無法取得 starting-lineup/teams:', err)
        setLineupTeams([])
      }
    }

    fetchLineupTeams()
  }, [selectedDate])

  useEffect(() => {
    const fetchStartingLineup = async () => {
      try {
        const res = await fetch(`/api/starting-lineup/load?date=${selectedDate}`)
        const data = await res.json()
        if (res.ok) {
          setStartingLineup(data) // ← 儲存整包打序資料
        } else {
          console.error('❌ 取得先發打序失敗:', data)
          setStartingLineup([])
        }
      } catch (err) {
        console.error('❌ 無法取得 starting_lineup:', err)
        setStartingLineup([])
      }
    }

    fetchStartingLineup()
  }, [selectedDate])

  useEffect(() => {
    const fetchStartingPitchers = async () => {
      try {
        const res = await fetch(`/api/starting-pitcher/load?date=${selectedDate}`)
        const data = await res.json()
        if (res.ok) {
          setStartingPitchers(data)
        } else {
          console.error('❌ 取得先發名單失敗:', data)
          setStartingPitchers([])
        }
      } catch (err) {
        console.error('❌ 無法取得 starting_pitcher:', err)
        setStartingPitchers([])
      }
      setPitchersLoaded(true)
    }

    setPitchersLoaded(false)
    fetchStartingPitchers()
  }, [selectedDate])


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedId = document.cookie.split('; ').find(row => row.startsWith('user_id='))?.split('=')[1]
      setUserId(storedId || null)
    }
  }, [])

  useEffect(() => {
    applyDateRange(range)
  }, [range])

  useEffect(() => {
    setRosterReady(false)
  }, [selectedDate])

  useEffect(() => {
    if (rosterReady) {
      console.log('📊 觸發 fetchStatsSummary (roster ready & date):', selectedDate)
      fetchStatsSummary()
    }
  }, [rosterReady, selectedDate])


  useEffect(() => {
    if (range === 'Today') {
      applyDateRange('Today')
    }
  }, [selectedDate])

  useEffect(() => {
    if (userId) fetchData()
  }, [userId, fromDate, toDate])

  useEffect(() => {
    if (userId) {
      fetchWaiverPriority()
    }
  }, [userId])



  const fetchWaiverPriority = async () => {
    try {
      const res = await fetch('/api/waiver/load_priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: userId }),
      })
      const data = await res.json()
      if (res.ok) {
        setWaiverPriority(data.priority)
      } else {
        console.error('❌ 無法取得 Waiver Priority:', data)
        setWaiverPriority(null)
      }
    } catch (err) {
      console.error('❌ 呼叫 load_priority 失敗:', err)
      setWaiverPriority(null)
    }
  }

  // 取得異動區間 summary
  const fetchPlayerTransactionSummary = async (playerName, type) => {
    try {
      const res = await fetch('/api/playerStats/transactionSummary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, type: type.toLowerCase() })
      })
      if (!res.ok) return []
      return await res.json()
    } catch (e) {
      return []
    }
  }

  const isDropBlocked = (p) => {
    // 目前分配位置（例如 'C', '1B', 'OF', 'BN', 'NA' 等）
    const currentPosition = assignedPositions[p.Name] || 'BN'

    // 先判斷是不是先發位置（不包含 BN、NA、NA(備用)）
    const isStartingPosition = !['BN', 'NA', 'NA(備用)'].includes(currentPosition)

    if (!isStartingPosition) {
      // 如果不是先發位置，永遠允許 drop
      console.log(`✅ 可 Drop：${p.Name} 目前位置 ${currentPosition} 非先發位置`)
      return false
    }

    // 抓 gameInfoMap 判斷時間
    const gameInfo = gameInfoMap[p.Team]
    const timeMatch = gameInfo?.match(/\d{2}:\d{2}/)
    const timeStr = timeMatch ? timeMatch[0] : '23:59'
    const gameDateTime = new Date(`${selectedDate}T${timeStr}:00+08:00`)

    const utcNow = new Date() // 正確取得 UTC+0 時間

    const isLocked = utcNow >= gameDateTime

    if (isLocked) {
      console.log(`⛔ 禁止 Drop：${p.Team} 比賽已開始 (${gameDateTime.toISOString()}), 且 ${p.Name} 在先發位置`)
      return true
    }

    console.log(`✅ 可 Drop：${p.Name} 比賽尚未開始或位置非先發 (${currentPosition})`)
    return false
  }


  const fetchData = async () => {
    setLoading(true)

    try {
      const [statusRes, batterRes, pitcherRes, positionRes, registerRes] = await Promise.all([
        fetch('/api/playerStatus'),
        fetch('/api/playerStats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'batter', from: fromDate, to: toDate })
        }),
        fetch('/api/playerStats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pitcher', from: fromDate, to: toDate })
        }),
        fetch('/api/playerPositionCaculate'),
        fetch('/api/playerRegisterStatus')
      ])

      const [statusData, batterData, pitcherData, positionData, registerData] = await Promise.all([
        statusRes.json(),
        batterRes.ok ? batterRes.json() : [],
        pitcherRes.ok ? pitcherRes.json() : [],
        positionRes.ok ? positionRes.json() : [],
        registerRes.ok ? registerRes.json() : []
      ])

      const statsData = [...batterData, ...pitcherData]
      setBatterMap(new Map(batterData.map(p => [p.name, p])))
      setPitcherMap(new Map(pitcherData.map(p => [p.name, p])))

      console.log('📦 statusData:', statusData)
      console.log('📊 batterData:', batterData)
      console.log('📊 pitcherData:', pitcherData)
      console.log('📌 positionData:', positionData)
      console.log('📋 registerData:', registerData)
      setPositionData(positionData)

      const isPast = (() => {
        const utcNow = new Date() // 正確取得 UTC+0 時間
        const taiwanNow = new Date(utcNow.getTime() + 8 * 60 * 60 * 1000) // 轉換為台灣時間 UTC+8
        const todayStr = taiwanNow.toISOString().slice(0, 10)
        return selectedDate < todayStr
      })()
      console.log(`📅 selectedDate: ${selectedDate}, isPast: ${isPast}`)

      let playersList = []

      if (isPast) {
        const assignedRes = await fetch(`/api/saveAssigned/load?date=${selectedDate}`)
        const assignedData = await assignedRes.json()
        console.log('🗂️ assignedData (from position_assigned):', assignedData)

        const names = [...new Set(assignedData.map(r => r.player_name))]
        console.log('📛 player names from assignedData:', names)

        playersList = names.map(name => {
          const status = statusData.find(s => s.Name === name)
          const stat = statsData.find(s => s.name === name)
          const pos = positionData.find(p => p.name === name)
          const reg = registerData.find(r => r.name === name)

          return {
            ...(status || { Name: name }),
            ...(stat || {}),
            finalPosition: pos?.finalPosition || [],
            registerStatus: reg?.status || '未知'
          }
        })

        console.log('📋 組合後 playersList（isPast）:', playersList)
      } else {
        const merged = statusData.map(p => {
          const stat = statsData.find(s => s.name === p.Name)
          const pos = positionData.find(pos => pos.name === p.Name)
          const reg = registerData.find(r => r.name === p.Name)
          return {
            ...p,
            ...(stat || {}),
            B_or_P: p.B_or_P,  // ⬅️ 確保帶進來
            finalPosition: pos?.finalPosition || [],
            registerStatus: reg?.status || '未知'
          }
        })

        playersList = merged.filter(p => p.manager_id?.toString() === userId)
        console.log('📋 組合後 playersList（today/future）:', playersList)
      }

      setPlayers(playersList)
      await loadAssigned(playersList)
      setPositionsLoaded(true)
      setRosterReady(true)

    } catch (err) {
      console.error('❌ 讀取錯誤:', err)
    }

    setLoading(false)
  }



  useEffect(() => {
    const fetchManagerMap = async () => {
      try {
        const res = await fetch('/api/managers')
        const data = await res.json()
        if (res.ok) {
          const map = {}
          data.forEach(m => {
            map[m.id] = m.team_name
          })
          setManagerMap(map)
        } else {
          console.error('❌ managerMap 載入錯誤:', data)
        }
      } catch (err) {
        console.error('❌ 無法取得 manager list:', err)
      }
    }

    fetchManagerMap()
  }, [])


  useEffect(() => {
    const allForeign = players.filter(p => p.identity === '洋將')
    const activeForeign = allForeign.filter(p => !['NA', 'NA(備用)'].includes(assignedPositions[p.Name]))

    setForeignCount({
      all: allForeign.length,
      active: activeForeign.length
    })

    // ✅ 加在這裡！
    const activePlayers = players.filter(p => !['NA', 'NA(備用)'].includes(assignedPositions[p.Name]))
    setActiveCount(activePlayers.length)

  }, [players, assignedPositions])


  useEffect(() => {
    const fetchGames = async () => {
      try {
        const map = {}
        const teams = [...new Set(players.map(p => p.Team))]

        for (const team of teams) {
          const res = await fetch('/api/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: selectedDate, team })
          })
          const data = await res.json()

          if (data?.info) {
            map[team] = data.info
          } else {
            map[team] = 'No game'
          }
        }

        setGameInfoMap(map)
        setGameInfoLoaded(true)
      } catch (err) {
        console.error('❌ 賽程讀取失敗:', err)
        setGameInfoMap({})
      }
    }

    setGameInfoLoaded(false)
    if (players.length > 0) {
      fetchGames()
    }
  }, [selectedDate, players])

  const calculateActiveForeign = (updatedAssignedPositions) => {
    const activeForeign = players.filter(p =>
      p.identity === '洋將' &&
      !['NA', 'NA(備用)'].includes(updatedAssignedPositions[p.Name])
    )

    console.log('🧮 計算 Active 洋將數：', activeForeign.length)
    console.log('🧑‍💻 活躍洋將名單：', activeForeign.map(p => ({
      name: p.Name,
      assignedPosition: updatedAssignedPositions[p.Name]
    })))

    return activeForeign.length
  }



  const fetchStatsSummary = async () => {
    const batterNames = players
      .filter(p => p.B_or_P === 'Batter' && !['BN', 'NA', 'NA(備用)'].includes(assignedPositions[p.Name]))
      .map(p => p.Name)

    const pitcherNames = players
      .filter(p => p.B_or_P === 'Pitcher' && !['BN', 'NA', 'NA(備用)'].includes(assignedPositions[p.Name]))
      .map(p => p.Name)

    try {
      const [batterRes, pitcherRes] = await Promise.all([
        fetch('/api/playerStatsSummary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'batter',
            from: selectedDate,
            to: selectedDate,
            playerNames: batterNames,
          })
        }),
        fetch('/api/playerStatsSummary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'pitcher',
            from: selectedDate,
            to: selectedDate,
            playerNames: pitcherNames,
          })
        })
      ])

      const batter = await batterRes.json()
      const pitcher = await pitcherRes.json()

      setBatterSummary(batter)
      setPitcherSummary(pitcher)
    } catch (err) {
      console.error('❌ 加總 stats summary 錯誤:', err)
    }
  }

  const formatDateInput = (date) => date.toISOString().slice(0, 10)


  const applyDateRange = (range) => {
    const now = new Date()  // ⚠️ 改這裡，保證每次呼叫都抓系統當前時間
    let from = '', to = ''

    switch (range) {
      case 'Today':
        from = to = selectedDate  // ✅ 唯一使用 selectedDate 的情況
        break
      case 'Yesterday':
        now.setDate(now.getDate() - 1)
        from = to = formatDateInput(now)
        break
      case 'Last 7 days':
        const last7 = new Date(now)
        last7.setDate(now.getDate() - 7)
        const yest7 = new Date(now)
        yest7.setDate(now.getDate() - 1)
        from = formatDateInput(last7)
        to = formatDateInput(yest7)
        break
      // ⬇️ 同理處理 Last 14, 30 ...
      case 'Last 14 days':
        const last14 = new Date(now)
        last14.setDate(now.getDate() - 14)
        const yest14 = new Date(now)
        yest14.setDate(now.getDate() - 1)
        from = formatDateInput(last14)
        to = formatDateInput(yest14)
        break
      case 'Last 30 days':
        const last30 = new Date(now)
        last30.setDate(now.getDate() - 30)
        const yest30 = new Date(now)
        yest30.setDate(now.getDate() - 1)
        from = formatDateInput(last30)
        to = formatDateInput(yest30)
        break
      case '2025 Season':
      default:
        from = '2025-03-27'
        to = '2025-11-30'
        break
    }

    setFromDate(from)
    setToDate(to)
  }


  const renderAssignedPositionSelect = (p) => {
    const getTaiwanTodayString = () => {
      const now = new Date()
      const taiwanOffset = 8 * 60 * 60 * 1000
      const taiwanNow = new Date(now.getTime() + taiwanOffset)
      return taiwanNow.toISOString().slice(0, 10)
    }

    const currentValue = assignedPositions[p.Name] || 'BN'
    const todayStr = getTaiwanTodayString()
    const isEditable = selectedDate >= todayStr

    // ✅ 判斷比賽是否已開打
    const gameInfo = gameInfoMap[p.Team]
    let isLocked = false

    if (gameInfo && !gameInfo.startsWith('PPD') && !gameInfo.startsWith('No game')) {
      const timeStr = gameInfo.slice(0, 5) // 取得 "18:35"
      const [h, m] = timeStr.split(':')

      const gameDateTime = new Date(`${selectedDate}T${h}:${m}:00+08:00`)
      const utcNow = new Date() // 正確取得 UTC+0 時間

      // console.log('🕓 gameDateTime:', gameDateTime.toISOString())
      // console.log('🕒 utcNow:', utcNow.toISOString())

      isLocked = utcNow >= gameDateTime
    }


    if (loading || !isEditable || isLocked) {
      return (
        <span className="text-[#004AAD] text-sm font-bold min-w-[36px] text-center">
          {currentValue}
        </span>
      )
    }

    // ✅ 可異動才顯示按鈕
    return (
      <button
        onClick={() => openMoveModal(p)}
        className="bg-[#004AAD] hover:bg-[#003E7E] text-white text-xs font-bold w-9 h-9 rounded-full flex items-center justify-center"
      >
        {currentValue}
      </button>
    )
  }


  const openMoveModal = (player) => {
    console.log('🔁 可選位置:', player.finalPosition)

    let baseSlots = []

    if (player.B_or_P === 'Batter') {
      baseSlots = [...(player.finalPosition || []), 'Util', 'Batter_BN']
    } else if (player.B_or_P === 'Pitcher') {
      baseSlots = [...(player.finalPosition || []), 'P', 'Pitcher_BN']
    }

    const naSlots = player.registerStatus === '一軍' ? ['NA(備用)'] : ['NA', 'NA(備用)']
    const allSlots = [...baseSlots, ...naSlots]

    const slotLimit = {
      'C': 1,
      '1B': 1,
      '2B': 1,
      '3B': 1,
      'SS': 1,
      'OF': 3,
      'Util': 2,
      'SP': 5,
      'RP': 5,
      'P': 3,
      'BN': 99,
      'NA': 5, // 統一限制 NA 類位置
    }

    const slotStatus = {}

    allSlots.forEach(pos => {
      // 處理 NA 與 NA(備用) 為同一組
      if (pos === 'NA' || pos === 'NA(備用)') {
        const assignedNA = players.filter(p => assignedPositions[p.Name] === 'NA')
        const assignedBackup = players.filter(p => assignedPositions[p.Name] === 'NA(備用)')
        const totalCount = assignedNA.length + assignedBackup.length
        const max = slotLimit['NA'] // 限制總共 5 人

        if (pos === 'NA' && !slotStatus['NA']) {
          slotStatus['NA'] = {
            displayAs: 'NA',
            count: totalCount,
            max,
            players: assignedNA
          }
        }

        if (pos === 'NA(備用)' && !slotStatus['NA(備用)']) {
          slotStatus['NA(備用)'] = {
            displayAs: 'NA(備用)',
            count: totalCount,
            max,
            players: assignedBackup
          }
        }
      } else {
        if (pos === 'Batter_BN' || pos === 'Pitcher_BN') {
          const bnKey = pos === 'Batter_BN' ? 'BN' : 'BN'
          const assigned = players.filter(p =>
            assignedPositions[p.Name] === 'BN' &&
            ((pos === 'Batter_BN' && p.B_or_P === 'Batter') ||
              (pos === 'Pitcher_BN' && p.B_or_P === 'Pitcher'))
          )
          slotStatus[pos] = {
            displayAs: 'BN', // 顯示仍為 BN
            count: assigned.length,
            max: slotLimit['BN'] || 99,
            players: assigned
          }
        } else {
          const assigned = players.filter(p => assignedPositions[p.Name] === pos)
          slotStatus[pos] = {
            displayAs: pos,
            count: assigned.length,
            max: slotLimit[pos] || 99,
            players: assigned
          }
        }

      }
    })

    console.log('🧩 各位置狀況:', slotStatus)

    setMoveTarget(player)
    setMoveSlots(slotStatus)

    // TODO: 打開一個 modal，傳入 slotStatus 跟 player 本身
  }

  const moveWaiver = async (date, idx, direction) => {
    try {
      const groupedWaivers = waiverList.reduce((acc, w) => {
        const date = w.off_waiver
        if (!acc[date]) acc[date] = []
        acc[date].push(w)
        return acc
      }, {})

      const group = groupedWaivers[date]
      if (!group || group.length < 2) return

      const current = group[idx]
      const target = direction === 'up' ? group[idx - 1] : group[idx + 1]

      if (!current || !target) return

      const res = await fetch('/api/waiver/swap_priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id1: current.apply_no, // 注意你是用 apply_no
          id2: target.apply_no,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || '交換失敗')

      console.log('✅ Waiver 優先順序交換成功')
      showMessage('✅ Waiver 順序交換成功', 'success')
    } catch (err) {
      console.error('❌ 移動 Waiver 失敗:', err)
      showMessage(`錯誤：${err.message}`, 'error')
    }

    // ✅ 成功或失敗後，統一重新載入
    try {
      const res = await fetch('/api/waiver/load_personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: userId }),
      })

      const data = await res.json()
      if (res.ok) {
        setWaiverList(data)
        console.log('✅ 成功重抓 Waiver List')
      } else {
        console.error('❌ 重抓 Waiver List 失敗:', data)
      }
    } catch (err) {
      console.error('❌ 呼叫 load_personal 失敗:', err)
    }
  }



  const loadAssigned = async (playersList) => {
    console.log('📦 載入 assigned，用的 playersList:', playersList)

    try {
      const res = await fetch(`/api/saveAssigned/load?date=${selectedDate}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '讀取失敗')

      const map = {}
      playersList.forEach(p => {
        const record = data.find(r => r.player_name === p.Name)
        if (record) {
          map[p.Name] = record.position
        }
      })

      console.log('📋 載入完成的球員位置對應:', map) // 👈 加這行

      setAssignedPositions(map)
    } catch (err) {
      console.error('❌ 載入 AssignedPositions 失敗:', err)
    }
  }

  // ✅ 加入這段：
  const saveAssigned = async (updatedMap) => {
    try {
      const res = await fetch('/api/saveAssigned/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedPositions: updatedMap,
          startDate: selectedDate  // 👈 把目前畫面日期當作開始日傳給後端
        }),
      })

      let data = {}
      try {
        data = await res.json()  // 👈 包起來避免 json() 本身錯誤
      } catch (jsonErr) {
        throw new Error('無法解析後端回應')
      }

      if (!res.ok) {
        console.error('❌ 儲存 API 錯誤:', data)
        throw new Error(data.error || '儲存失敗')
      }

      console.log('✅ 儲存成功:', data)
      setMoveMessage('✅ 自動儲存成功')
      setTimeout(() => setMoveMessage(''), 2000)

      // await loadAssigned(players)
    } catch (err) {
      console.error('❌ 自動儲存錯誤:', err.message)
      setMoveMessage('❌ 自動儲存失敗，請稍後再試')
      setTimeout(() => setMoveMessage(''), 3000)
    }
  }

  const reloadTradeList = async () => {
    try {
      const res = await fetch('/api/trade/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: userId }),
      })
      const data = await res.json()
      if (res.ok) {
        setTradeList(data.trades)
      } else {
        console.error('❌ 無法重新取得交易列表:', data)
      }
    } catch (err) {
      console.error('❌ 發生錯誤:', err)
    }
  }

  const reloadRoster = async () => {
    await fetchData()
  }


  const handleTradeAction = async (tradeId, type, trade) => {
    try {


      const myManagerId = userId
      const opponentManagerId = trade.initiator_id.toString() === userId ? trade.receiver_id : trade.initiator_id
      const myPlayers = trade.initiator_id.toString() === userId ? trade.receiver_received : trade.initiator_received
      const opponentPlayers = trade.initiator_id.toString() === userId ? trade.initiator_received : trade.receiver_received


      if (type === 'accept') {
        const now = new Date();
        const taiwanNow = new Date(now.getTime() + 8 * 60 * 60 * 1000); // +8小時
        const taiwanToday = taiwanNow.toISOString().slice(0, 10);

        // 讀取所有球員身份
        const statusRes = await fetch('/api/playerStatus')
        const statusData = await statusRes.json()

        // 建 identityMap：名字 → 洋將 or 本土
        const identityMap = {}
        statusData.forEach(p => {
          identityMap[p.Name] = p.identity
        })

        // ⛔ 新增：檢查雙方所有涉及球員是否已開賽
        const allInvolvedPlayers = [...myPlayers, ...opponentPlayers];
        const playerTeamMap = {};
        statusData.forEach(p => { playerTeamMap[p.Name] = p.Team });
        let lockedPlayers = [];
        for (const name of allInvolvedPlayers) {
          const team = playerTeamMap[name];
          const gameInfo = gameInfoMap[team];
          if (!gameInfo || gameInfo.startsWith('PPD') || gameInfo.startsWith('No game')) continue;
          const timeStr = gameInfo.slice(0, 5); // 18:35
          const [h, m] = timeStr.split(':');
          const gameDateTime = new Date(`${selectedDate}T${h}:${m}:00+08:00`);
          const utcNow = new Date(); // 正確取得 UTC+0 時間
          if (utcNow >= gameDateTime) {
            lockedPlayers.push(name);
          }
        }
        if (lockedPlayers.length > 0) {
          alert(`以下球員比賽已開賽，禁止交易：\n${lockedPlayers.join(', ')}`);
          return;
        }
        console.log('🧩 開始交易模擬:', { myManagerId, opponentManagerId, myPlayers, opponentPlayers })

        // 抓自己、對方的 saveAssigned
        const myRes = await fetch(`/api/saveAssigned/load_manager?manager_id=${myManagerId}&date=${taiwanToday}`)
        const oppRes = await fetch(`/api/saveAssigned/load_manager?manager_id=${opponentManagerId}&date=${taiwanToday}`)
        const myAssigned = await myRes.json()
        const oppAssigned = await oppRes.json()

        console.log('🧩 自己陣容:', myAssigned)
        console.log('🧩 對方陣容:', oppAssigned)

        const mySimulated = myAssigned
          .filter(p => !myPlayers.includes(p.player_name)) // 移除我給出去的人
          .concat(opponentPlayers.map(name => ({ player_name: name, position: 'BN' }))) // 加入我收到的人，初始都 BN

        const oppSimulated = oppAssigned
          .filter(p => !opponentPlayers.includes(p.player_name))
          .concat(myPlayers.map(name => ({ player_name: name, position: 'BN' })))

        console.log('🧩 模擬後自己陣容:', mySimulated)
        console.log('🧩 模擬後對方陣容:', oppSimulated)

        const myActive = mySimulated.filter(p => !['NA', 'NA(備用)'].includes(p.position))
        const oppActive = oppSimulated.filter(p => !['NA', 'NA(備用)'].includes(p.position))

        const myActiveCount = myActive.length
        const oppActiveCount = oppActive.length

        const myActiveForeign = myActive.filter(p =>
          identityMap[p.player_name] === '洋將'
        ).length

        const myOnTeamForeign = mySimulated.filter(p =>
          identityMap[p.player_name] === '洋將'
        ).length

        const oppActiveForeign = oppActive.filter(p =>
          identityMap[p.player_name] === '洋將'
        ).length

        const oppOnTeamForeign = oppSimulated.filter(p =>
          identityMap[p.player_name] === '洋將'
        ).length

        console.log('🧩 自己統計:', { myActiveCount, myActiveForeign, myOnTeamForeign })
        console.log('🧩 對方統計:', { oppActiveCount, oppActiveForeign, oppOnTeamForeign })

        // ⛔ 驗證自己
        if (myActiveCount > 26) throw new Error('交易後你的 Active 超過26人')
        if (myActiveForeign > 3) throw new Error('交易後你的 Active 洋將超過3人')
        if (myOnTeamForeign > 4) throw new Error('交易後你的 On Team 洋將超過4人')

        // ⛔ 驗證對方
        if (oppActiveCount > 26) throw new Error('交易後對方 Active 超過26人')
        if (oppActiveForeign > 3) throw new Error('交易後對方 Active 洋將超過3人')
        if (oppOnTeamForeign > 4) throw new Error('交易後對方 On Team 洋將超過4人')

        console.log('✅ 雙方交易模擬檢查通過')

      }

      // 🛜 真的送出交易
      const res = await fetch('/api/trade/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tradeId,
          type,
          myManagerId,
          opponentManagerId,
          myPlayers,
          opponentPlayers,
        }),
      })

      // console.log('✅ 雙方交易模擬檢查通過，理論上可以送出，但目前先不真正送出');

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '操作失敗')

      showMessage(data.message || '交易成功', 'success')
      await reloadTradeList()
      await reloadRoster()

    }
    catch (err) {
      console.error('❌ 處理交易失敗:', err)
      alert(`錯誤：${err.message}`)
    }
  }




  const formatDateToLabel = (isoDateStr) => {
    const [y, m, d] = isoDateStr.split('-').map(Number)
    const localDate = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+08:00`)

    const weekday = localDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Taipei' })
    const month = localDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Taipei' })
    const day = localDate.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'Asia/Taipei' })

    return `${weekday}, ${month} ${day}`
  }

  const formatAvg = (val) => {
    const num = parseFloat(val)
    return isNaN(num) ? '.000' : num.toFixed(3).replace(/^0/, '')
  }

  const formatDecimal2 = (val) => {
    const num = parseFloat(val)
    return isNaN(num) ? '0.00' : num.toFixed(2)
  }

  const renderCell = (val) => {
    const displayVal = (val ?? 0).toString()
    const isGray = displayVal === '0' || displayVal === '0.00' || displayVal === '.000' || displayVal === '0.0'
    return (
      <td className={`p-2 font-bold whitespace-nowrap text-s ${isGray ? 'text-gray-400' : ''}`}>
        {displayVal}
      </td>
    )
  }

  const cancelWaiver = async (applyNo) => {
    console.log('🚀 嘗試取消 Waiver，apply_no =', applyNo)

    showConfirm('確定要取消這筆 Waiver 申請嗎？', async () => {
      try {
        const res = await fetch('/api/waiver/cancel_waiver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apply_no: applyNo }),
        })

        const data = await res.json()

        if (!res.ok) throw new Error(data.error || '取消失敗')

        console.log('✅ Waiver 取消成功')
        showMessage('✅ Waiver 取消成功', 'success')

        const reloadRes = await fetch('/api/waiver/load_personal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manager_id: userId }),
        })
        const reloadData = await reloadRes.json()
        if (reloadRes.ok) {
          setWaiverList(reloadData)
        } else {
          console.error('❌ 重新載入失敗:', reloadData)
        }

      } catch (err) {
        console.error('❌ 取消 Waiver 錯誤:', err)
        alert(`取消失敗：${err.message}`)
      }
    })
  }
  const fetchPlayerStatSummary = async (playerName, type) => {
    const ranges = {
      Today: [taiwanToday, taiwanToday],
      Yesterday: [formatDateInput(new Date(today.getTime() - 1 * 86400000)), formatDateInput(new Date(today.getTime() - 1 * 86400000))],
      'Last 7 days': [formatDateInput(new Date(today.getTime() - 7 * 86400000)), formatDateInput(new Date(today.getTime() - 1 * 86400000))],
      'Last 14 days': [formatDateInput(new Date(today.getTime() - 14 * 86400000)), formatDateInput(new Date(today.getTime() - 1 * 86400000))],
      'Last 30 days': [formatDateInput(new Date(today.getTime() - 30 * 86400000)), formatDateInput(new Date(today.getTime() - 1 * 86400000))],
      '2025 Season': ['2025-03-27', '2025-11-30'],
    }


    const result = {}

    for (const [label, [from, to]] of Object.entries(ranges)) {
      try {
        const res = await fetch('/api/playerStats/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: playerName, type })
        })
        const data = await res.json()
        result[label] = data[label] || null
      } catch (e) {
        console.error(`❌ 無法取得 ${label} 區間資料:`, e)
        result[label] = null
      }
    }


    return result
  }

  const showConfirm = (message, onConfirm) => {
    setConfirmDialogMessage(message)
    setOnConfirmAction(() => onConfirm)
    setConfirmDialogOpen(true)
  }

  const batters = players
    .filter(p => p.B_or_P === 'Batter' && assignedPositions[p.Name] !== undefined)
    .sort((a, b) => {
      const posA = assignedPositions[a.Name] || 'BN'
      const posB = assignedPositions[b.Name] || 'BN'
      return batterPositionOrder.indexOf(posA) - batterPositionOrder.indexOf(posB)
    })

  const pitchers = players
    .filter(p => p.B_or_P === 'Pitcher' && assignedPositions[p.Name] !== undefined)
    .sort((a, b) => {
      const posA = assignedPositions[a.Name] || 'BN'
      const posB = assignedPositions[b.Name] || 'BN'
      return pitcherPositionOrder.indexOf(posA) - pitcherPositionOrder.indexOf(posB)
    })


  const renderHeader = (type, zIndex = 'z-40') => {
    const labels = type === 'Batter'
      ? ['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS']
      : ['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP']

    return (
      <tr>
        {labels.map((label) => (
          <th
            key={label}
            className={`p-2 border font-bold bg-gray-200 sticky top-0 ${zIndex}`}
          >
            {label}
          </th>
        ))}
      </tr>
    )
  }

  const showMessage = (text, type = 'info', duration = 3000) => {
    setMessageBox({ text, type })
    setMessageVisible(true)
    setTimeout(() => setMessageVisible(false), duration)
  }


  const renderRow = (p, type) => {
    return (
      <>
        <tr>
          <td
            colSpan={type === 'Batter' ? 13 : 13}
            className={`p-2 border text-left ${['BN', 'NA', 'NA(備用)'].includes(assignedPositions[p.Name]) ? 'bg-gray-100' : 'bg-white'
              }`}
          >
            <div className="flex items-center gap-2 font-bold text-[#0155A0] text-base">
              {renderAssignedPositionSelect(p)}
              <img
                src={`/photo/${p.Name}.png`}
                alt={p.Name}
                className="w-12 h-12 rounded-full"
                onError={(e) => (e.target.src = '/photo/defaultPlayer.png')}
              />
              <div className="flex flex-col">
                {/* 第一行：名字 + Team + Position */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-2 font-bold text-[#0155A0] text-base cursor-pointer"
                    onClick={async () => {
                      setSelectedPlayerDetail({ ...p, type: p.B_or_P })
                      setDetailDialogOpen(true)

                      const playerType = p.B_or_P
                      // console.log(`🛠️ ${p.Name} → ${playerType}`)


                      // Stat summary
                      const summary = await fetchPlayerStatSummary(p.Name, playerType.toLowerCase())

                      const res = await fetch('/api/playerStats/last6games', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: p.Name, team: p.Team, type: playerType.toLowerCase() })
                      })

                      const last6 = await res.json()

                      // 異動區間 summary
                      const txSummary = await fetchPlayerTransactionSummary(p.Name, type)
                      // Merge
                      setSelectedPlayerDetail(prev => ({
                        ...prev,
                        statSummary: summary,
                        last6games: last6.recentGames || [],
                        transactionSummary: txSummary || []
                      }))

                    }}
                  >
                    <span className="text-base font-bold text-[#0155A0]">{p.Name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{p.Team}</span>
                  <span className="text-sm text-gray-500">- {(p.finalPosition || []).join(', ')}</span>
                </div>

                {/* 第二行：比賽資訊 + 打序 or 先發標記 */}
                <div className="flex items-center justify-start gap-2">
                  <span className="text-sm text-gray-500">
                    {gameInfoMap[p.Team] ?? 'No game'}
                  </span>

                  {/* 顯示打序號 or X or V */}
                  {(() => {
                    const found = startingLineup.find(l => l.name === p.Name)

                    // 先發打序：顯示號碼（深綠底）
                    if (found) {
                      return (
                        <span className="text-white bg-green-700 text-xs font-bold px-2 py-0.5 rounded">
                          {found.batting_no}
                        </span>
                      )
                    }

                    // 沒找到打序，若為 Pitcher 不顯示 X
                    if (p.B_or_P === 'Pitcher') return null

                    // 隊伍有登錄但沒該球員 → 紅底 X
                    if (lineupTeams.includes(p.Team)) {
                      return (
                        <span className="text-white bg-red-600 text-xs font-bold px-2 py-0.5 rounded">
                          X
                        </span>
                      )
                    }

                    // 沒有打比賽也沒登錄 → 不顯示
                    return null
                  })()}

                  {/* 若為投手先發 → 顯示 V */}
                  {startingPitchers.some(sp => sp.name === p.Name) && (
                    <span className="text-white bg-green-700 text-xs font-bold px-2 py-0.5 rounded">
                      V
                    </span>
                  )}
                </div>

              </div>

              {['二軍', '未註冊', '註銷'].includes(p.registerStatus) && (
                <span className="ml-1 inline-block bg-[#FDEDEF] text-[#D10C28] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {p.registerStatus === '二軍' ? 'NA' : p.registerStatus}
                </span>
              )}
            </div>
          </td>
        </tr>

        <tr
          className={
            ['BN', 'NA', 'NA(備用)'].includes(assignedPositions[p.Name])
              ? 'bg-gray-100'
              : 'bg-white'
          }
        >
          {type === 'Batter' ? (
            <>
              {renderCell(p.AB)}
              {renderCell(p.R)}
              {renderCell(p.H)}
              {renderCell(p.HR)}
              {renderCell(p.RBI)}
              {renderCell(p.SB)}
              {renderCell(p.K)}
              {renderCell(p.BB)}
              {renderCell(p.GIDP)}
              {renderCell(p.XBH)}
              {renderCell(p.TB)}
              {renderCell(formatAvg(p.AVG))}
              {renderCell(formatAvg(p.OPS))}
            </>
          ) : (
            <>
              {renderCell(p.IP)}
              {renderCell(p.W)}
              {renderCell(p.L)}
              {renderCell(p.HLD)}
              {renderCell(p.SV)}
              {renderCell(p.H)}
              {renderCell(p.ER)}
              {renderCell(p.K)}
              {renderCell(p.BB)}
              {renderCell(p.QS)}
              {renderCell(p.OUT)}
              {renderCell(formatDecimal2(p.ERA))}
              {renderCell(formatDecimal2(p.WHIP))}

            </>
          )}
        </tr>
      </>
    )
  }

  return (

    <>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認操作</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialogMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDialogOpen(false)
                if (onConfirmAction) onConfirmAction()
              }}
            >
              確定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <div className="p-6">

        {messageVisible && (
          <div className={`mb-4 px-4 py-2 rounded border text-sm font-semibold ${messageBox.type === 'success' ? 'bg-green-50 text-green-700 border-green-300' :
            messageBox.type === 'error' ? 'bg-red-50 text-red-700 border-red-300' :
              'bg-blue-50 text-blue-700 border-blue-300'
            }`}>
            {messageBox.text}
          </div>
        )}


        {moveMessage && (
          <div className="mb-4 p-3 text-sm bg-blue-50 text-blue-800 border border-blue-300 rounded">
            {moveMessage}
          </div>
        )}

        <div className="flex flex-col items-center gap-2 mb-4">
          {/* 日期左右按鈕＋顯示文字 */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const prev = new Date(selectedDate)
                prev.setDate(prev.getDate() - 1)
                setRosterReady(false)
                setSelectedDate(prev.toISOString().slice(0, 10))
              }}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-lg"
            >
              <ChevronLeft size={20} />
            </button>

            {/* 可點擊的日期文字 */}
            <button
              onClick={() => setShowDatePicker(prev => !prev)}
              className="text-lg font-bold text-gray-800 hover:underline"
            >
              {formatDateToLabel(selectedDate)}
            </button>

            <button
              onClick={() => {
                const next = new Date(selectedDate)
                next.setDate(next.getDate() + 1)
                setRosterReady(false)
                setSelectedDate(next.toISOString().slice(0, 10))
              }}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-lg"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* 黑底白字的 Today 按鈕 */}
          <button
            onClick={() => {
              const now = new Date()
              const taiwanOffset = 8 * 60 * 60 * 1000
              const taiwanTime = new Date(now.getTime() + taiwanOffset)
              const date = taiwanTime.toISOString().slice(0, 10)
              setSelectedDate(date)
              setShowDatePicker(false)
            }}
            className="px-4 py-1 rounded bg-black text-white text-sm hover:opacity-90"
          >
            Today
          </button>

          {/* 日期選擇器，點日期文字時才出現 */}
          {showDatePicker && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setShowDatePicker(false)
              }}
              min="2025-03-27"
              max="2025-11-30"
              className="text-sm border px-2 py-1 rounded"
            />
          )}
        </div>

        {/* /* 查看交易按鈕 */}
        <button
          onClick={async () => {
            // 交易截止判斷：台灣時間 7/28 00:00 之後禁止
            const nowUTC = new Date()
            const taiwanOffset = 8 * 60 * 60 * 1000
            const taiwanNow = new Date(nowUTC.getTime() + taiwanOffset)
            const deadline = new Date('2025-07-28T00:00:00+08:00')
            if (taiwanNow >= deadline) {
              showMessage('交易大限已到', 'error')
              return
            }
            const res = await fetch('/api/trade/load', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ manager_id: userId })
            })
            const data = await res.json()
            if (res.ok) {
              setTradeList(data.trades)
              setTradeDialogOpen(true)
            } else {
              console.error('❌ 取得交易失敗:', data)
            }
          }}
          className="mt-2 px-4 py-1 rounded bg-[#004AAD] text-white text-sm hover:opacity-90"
        >
          Trades
        </button>

        <button
          onClick={async () => {
            const res = await fetch('/api/waiver/load_personal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ manager_id: userId })
            })
            const data = await res.json()
            if (res.ok) {
              setWaiverList(data)
              setWaiverDialogOpen(true)
            } else {
              console.error('❌ 取得 waiver 失敗:', data)
            }
          }}
          className="mt-2 ml-2 px-4 py-1 rounded bg-[#004AAD] text-white text-sm hover:opacity-90"
        >
          Waivers
        </button>



        <div className="mb-4 flex items-center justify-between">
          <div>
            <label className="text-sm font-semibold">Stats Range</label>
            <StatsRangeSelector range={range} onChange={setRange} />
          </div>

          <div className="text-sm text-right font-medium text-gray-700 leading-snug">
            <div>
              <span className="text-[#0155A0]">Waiver Priority：</span>
              <span className="text-[#0155A0]">{waiverPriority ?? '-'}</span>
            </div>
            <div>
              <span className="text-[#0155A0]">Active Roster：</span>
              <span className="text-[#0155A0]">{activeCount}</span>
            </div>
            <div>
              <span className="text-[#0155A0]">On team 洋將：</span>
              <span className="text-[#0155A0]">{foreignCount.all}</span>
            </div>
            <div>
              <span className="text-[#0155A0]">Active 洋將：</span>
              <span className="text-[#0155A0]">{foreignCount.active}</span>
            </div>
            <div>
              <span className="text-[#0155A0]">Weekly Adds：</span>
              <span className="text-[#0155A0]">{weeklyAddCount}</span>
            </div>
            <div>
              <span className="text-[#0155A0]">Weekly IP：</span>
              <span className={parseFloat(weeklyIP) < 30 ? 'text-red-600 font-bold' : 'text-[#0155A0]'}>
                {weeklyIP ?? '-'}
              </span>
            </div>


          </div>
        </div>

        {loading && <div className="mb-4 text-blue-600 font-semibold">Loading...</div>}
        <h1 className="text-xl font-bold mb-6">MY ROSTER</h1>

        {batterSummary && pitcherSummary && (
          <div className="mb-6 space-y-6 text-sm text-gray-600">

            {/* 🟦 Batters Summary */}
            <div>
              <h3 className="font-semibold text-[13px] text-[#0155A0] mb-1">Batters Total</h3>
              <div className="overflow-x-auto">
                <div className="min-w-[900px] grid grid-cols-13 gap-x-1 px-1">
                  {['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS'].map((label, i) => (
                    <div key={i} className="text-[11px] text-gray-500 font-medium text-center">{label}</div>
                  ))}
                  {['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS'].map((key, i) => (
                    <div key={i} className="text-center text-[#0155A0] font-bold">{batterSummary[key]}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* 🟦 Pitchers Summary */}
            <div>
              <h3 className="font-semibold text-[13px] text-[#0155A0] mb-1">Pitchers Total</h3>
              <div className="overflow-x-auto">
                <div className="min-w-[900px] grid grid-cols-13 gap-x-1 px-1">
                  {['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP'].map((label, i) => (
                    <div key={i} className="text-[11px] text-gray-500 font-medium text-center">{label}</div>
                  ))}
                  {['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP'].map((key, i) => (
                    <div key={i} className="text-center text-[#0155A0] font-bold">{pitcherSummary[key]}</div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {positionsLoaded && !gameInfoLoaded && (
          <div className="text-sm text-gray-500 mb-4">陣容及賽程載入中...</div>
        )}

        {positionsLoaded && gameInfoLoaded && (
          <div className="overflow-auto max-h-[600px]">
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-2">Batters</h2>

              <table className="w-full text-sm text-center">
                <thead>{renderHeader('Batter', 'z-40')}</thead>
                <tbody>
                  {batters.map((p, i) => (
                    <>{renderRow(p, 'Batter')}</>
                  ))}
                </tbody>
              </table>

            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">Pitchers</h2>

              <table className="w-full text-sm text-center">
                <thead>{renderHeader('Pitcher', 'z-50')}</thead>
                <tbody>
                  {pitchers.map((p, i) => (
                    <>{renderRow(p, 'Pitcher')}</>
                  ))}
                </tbody>
              </table>

            </section>
          </div>
        )}

        {moveTarget && moveSlots && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white w-[90%] max-w-xl rounded-xl shadow-lg p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Move Player</h2>
                <button
                  onClick={() => {
                    setMoveTarget(null)
                    setMoveSlots(null)
                  }}
                  className="text-gray-500 hover:text-black text-xl"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Select a new position for <strong>{moveTarget.Name}</strong>
              </p>

              {Object.entries(moveSlots)
                .filter(([posKey]) => posKey !== assignedPositions[moveTarget.Name]) // ❌ 不顯示目前位置
                .map(([posKey, slot]) => (
                  <div key={posKey} className="mb-4">
                    <h3 className="font-semibold text-sm mb-1">{slot.displayAs}</h3>
                    <div className="space-y-1">
                      {slot.players.map(p => (
                        <button
                          key={p.Name}
                          onClick={() => {
                            const getGameDateTime = (team) => {
                              const info = gameInfoMap[team]
                              const timeMatch = info?.match(/\d{2}:\d{2}/)
                              const timeStr = timeMatch ? timeMatch[0] : '23:59'
                              return new Date(`${selectedDate}T${timeStr}:00+08:00`)
                            }

                            const utcNow = new Date() // 正確取得 UTC+0 時間

                            const moveGameTime = getGameDateTime(moveTarget.Team)
                            const targetGameTime = getGameDateTime(p.Team)

                            const moveLocked = utcNow >= moveGameTime
                            const targetLocked = utcNow >= targetGameTime

                            // console.log('🕒 台灣時間:', taiwanNow.toISOString())
                            console.log(`🔒 ${moveTarget.Team} 鎖定狀態:`, moveLocked, moveGameTime.toISOString())
                            console.log(`🔒 ${p.Team} 鎖定狀態:`, targetLocked, targetGameTime.toISOString())

                            if (moveLocked || targetLocked) {
                              setMoveMessage(`❌ ${moveTarget.Team} 或 ${p.Team} 比賽已開始，禁止異動位置`)
                              setTimeout(() => setMoveMessage(''), 3000)
                              return
                            }

                            // ✅ 原本交換邏輯
                            const currentPos = assignedPositions[moveTarget.Name]
                            const isTryingToGoNA = currentPos === 'NA'
                            const canReturn = (p.finalPosition || []).includes(currentPos) ||
                              (p.B_or_P === 'Batter' && currentPos === 'Util') ||
                              (p.B_or_P === 'Pitcher' && currentPos === 'P') ||
                              currentPos === 'BN' ||
                              (currentPos === 'NA(備用)') ||
                              (currentPos === 'NA' && p.registerStatus !== '一軍')  // ✅ 僅非一軍才能進 NA


                            const fallback = 'BN'
                            const newPos = canReturn ? currentPos : fallback

                            const updated = { ...assignedPositions }

                            // ✅ 將 "Batter_BN" / "Pitcher_BN" 實際轉成 'BN'
                            updated[moveTarget.Name] = ['Batter_BN', 'Pitcher_BN'].includes(posKey) ? 'BN' : posKey
                            updated[p.Name] = newPos

                            const activeForeign = calculateActiveForeign(updated)
                            if (activeForeign > 3) {
                              setMoveMessage('❌ Active 洋將不可超過 3 位')
                              setTimeout(() => setMoveMessage(''), 3000)
                              return
                            }

                            const activePlayers = players.filter(p => !['NA', 'NA(備用)'].includes(updated[p.Name] || 'BN'))
                            if (activePlayers.length > 26) {
                              setMoveMessage('❌ Active Roster 不可超過 26 人')
                              setTimeout(() => setMoveMessage(''), 3000)
                              return
                            }

                            setAssignedPositions(updated)
                            setForeignCount(prev => ({ ...prev, active: activeForeign }))
                            saveAssigned(updated)
                            setMoveMessage(`${moveTarget.Name} 被移動到 ${posKey}，${p.Name} 被移動到 ${newPos}`)
                            setTimeout(() => setMoveMessage(''), 3000)
                            setMoveTarget(null)
                            setMoveSlots(null)
                          }}

                          className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50"
                        >
                          <div className="flex flex-col items-start gap-0.5">
                            <div className="flex items-center gap-2">
                              <img
                                src={`/photo/${p.Name}.png`}
                                className="w-9 h-9 rounded-full"
                                onError={(e) => (e.target.src = '/photo/defaultPlayer.png')}
                              />
                              <span className="text-sm font-medium">{p.Name}</span>
                              <span className="text-xs text-gray-400">{p.Team}</span>

                              {/* 顯示守備位置 */}
                              <span className="text-xs text-gray-500">- {(p.finalPosition || []).join(', ')}</span>
                            </div>

                            <div className="text-xs text-gray-500 pl-8">
                              {gameInfoMap[p.Team] ?? 'No game'}

                              {(() => {
                                const found = startingLineup.find(l => l.name === p.Name)
                                if (found) {
                                  return (
                                    <span className="ml-1 text-white bg-green-700 text-xs font-bold px-1.5 rounded">
                                      {found.batting_no}
                                    </span>
                                  )
                                }

                                if (p.B_or_P === 'Pitcher') return null

                                if (lineupTeams.includes(p.Team)) {
                                  return (
                                    <span className="ml-1 text-white bg-red-600 text-xs font-bold px-1.5 rounded">
                                      X
                                    </span>
                                  )
                                }

                                return null
                              })()}

                              {startingPitchers.some(sp => sp.name === p.Name) && (
                                <span className="ml-1 text-white bg-green-700 text-xs font-bold px-1.5 rounded">
                                  V
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="text-blue-500">↔</span>
                        </button>
                      ))}

                      {slot.count < slot.max && (
                        <button
                          onClick={() => {
                            const getGameDateTime = (team) => {
                              const info = gameInfoMap[team]
                              console.log('📋 gameInfoMap[team]:', info)
                              const timeMatch = info?.match(/\d{2}:\d{2}/)
                              const timeStr = timeMatch ? timeMatch[0] : '23:59'
                              console.log('🕐 抓到的比賽時間字串:', timeStr)
                              const dateObj = new Date(`${selectedDate}T${timeStr}:00+08:00`)
                              console.log('📅 比賽預定時間:', dateObj.toISOString())
                              return dateObj
                            }

                            const utcNow = new Date() // 正確取得 UTC+0 時間
                            console.log('🕒 現在 UTC 時間:', utcNow.toISOString())

                            const gameDateTime = getGameDateTime(moveTarget.Team)
                            const isLocked = utcNow >= gameDateTime
                            console.log('🔒 是否鎖定:', isLocked)

                            if (isLocked) {
                              setMoveMessage(`${moveTarget.Team} 比賽已開始，禁止異動位置`)
                              console.log('⛔ 鎖定，無法異動')
                              setTimeout(() => setMoveMessage(''), 3000)
                              return
                            }

                            console.log(`✅ 準備將 ${moveTarget.Name} 移動到 ${posKey}`)
                            const updated = { ...assignedPositions, [moveTarget.Name]: ['Batter_BN', 'Pitcher_BN'].includes(posKey) ? 'BN' : posKey }

                            const activeForeign = calculateActiveForeign(updated)
                            if (activeForeign > 3) {
                              setMoveMessage('❌ Active 洋將不可超過 3 位')
                              setTimeout(() => setMoveMessage(''), 3000)
                              return
                            }

                            const activePlayers = players.filter(p => !['NA', 'NA(備用)'].includes(updated[p.Name] || 'BN'))
                            if (activePlayers.length > 26) {
                              setMoveMessage('❌ Active Roster 不可超過 26 人')
                              setTimeout(() => setMoveMessage(''), 3000)
                              return
                            }

                            setAssignedPositions(updated)
                            setForeignCount(prev => ({ ...prev, active: activeForeign }))
                            saveAssigned(updated)



                            setMoveMessage(`${moveTarget.Name} 被移動到 ${posKey}`)
                            setTimeout(() => setMoveMessage(''), 2000)

                            setMoveTarget(null)
                            setMoveSlots(null)
                          }}

                          className="w-full flex items-center justify-center text-blue-600 font-semibold border-2 border-dashed border-blue-400 p-3 rounded bg-white hover:bg-blue-50"
                        >
                          ➕ Empty
                        </button>
                      )}


                    </div>
                  </div>
                ))}

            </div>
          </div>
        )}

      </div>

      <AlertDialog open={tradeDialogOpen} onOpenChange={setTradeDialogOpen}>
        <AlertDialogContent className="max-w-xl w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>交易紀錄</AlertDialogTitle>
          </AlertDialogHeader>

          <div className="mt-2 text-sm">
            <label className="mr-2 font-semibold">Stats Range：</label>
            <StatsRangeSelector range={range} onChange={setRange} />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-3">
            {tradeList.length === 0 ? (
              <div className="text-gray-500 text-sm">目前沒有可顯示的交易紀錄</div>
            ) : (
              tradeList.map((t, idx) => {
                const initiatorName = managerMap[t.initiator_id] || `M${t.initiator_id}`
                const receiverName = managerMap[t.receiver_id] || `M${t.receiver_id}`

                {
                  (t.initiator_received || []).map(name => {
                    const p = positionData.find(p => p.name === name)
                    console.log('🔍 比對球員：', name, '→ 找到：', p?.name, '→ 類型：', p?.B_or_P)
                    return null
                  })
                }

                {
                  (t.receiver_received || []).map(name => {
                    const p = positionData.find(p => p.name === name)
                    console.log('🧾 receiver球員：', name, '→ 找到：', p?.name, '→ 類型：', p?.B_or_P)
                    return null
                  })
                }



                return (
                  <div key={idx} className="border rounded-lg p-3 shadow-sm bg-gray-50">

                    {/* initiator 收到的球員（對方給他的） */}
                    <div className="border rounded p-2 bg-white shadow">
                      <div className="font-bold text-blue-700">{initiatorName}</div>
                      <div className="text-sm mb-1">Received players：{(t.initiator_received || []).join('、')}</div>

                      {/* 🟦 打者資料區塊 */}
                      {(t.initiator_received || []).filter(name => {
                        const p = positionData.find(p => p.name === name)
                        return p?.B_or_P === 'Batter'
                      }).length > 0 && (
                          <>
                            <div className="font-semibold text-[12px] text-gray-600 mt-2">Batters</div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[900px] text-xs text-center border mt-1">
                                <thead className="bg-gray-100">
                                  <tr>
                                    {['Player', 'AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS'].map(k => (
                                      <th key={k}>{k}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(t.initiator_received || []).map(name => {
                                    const p = positionData.find(p => p.name === name)
                                    const stats = batterMap.get(name)
                                    if (p?.B_or_P !== 'Batter') return null
                                    return (
                                      <tr key={name}>
                                        <td>{name}</td>
                                        {['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS'].map(stat => (
                                          <td key={stat}>{stats?.[stat] ?? 0}</td>
                                        ))}
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}

                      {/* 🟥 投手資料區塊 */}
                      {(t.initiator_received || []).filter(name => {
                        const p = positionData.find(p => p.name === name)
                        return p?.B_or_P === 'Pitcher'
                      }).length > 0 && (
                          <>
                            <div className="font-semibold text-[12px] text-gray-600 mt-4">Pitchers</div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[900px] text-xs text-center border mt-1">
                                <thead className="bg-gray-100">
                                  <tr>
                                    {['Player', 'IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP'].map(k => (
                                      <th key={k}>{k}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(t.initiator_received || []).map(name => {
                                    const p = positionData.find(p => p.name === name)
                                    const stats = pitcherMap.get(name)
                                    if (p?.B_or_P !== 'Pitcher') return null
                                    return (
                                      <tr key={name}>
                                        <td>{name}</td>
                                        {['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP'].map(stat => (
                                          <td key={stat}>{stats?.[stat] ?? 0}</td>
                                        ))}
                                      </tr>
                                    )
                                  })}

                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                    </div>


                    {/* receiver 收到的球員（發起人給他的） */}
                    <div className="border rounded p-2 bg-white shadow">
                      <div className="font-bold text-blue-700">{receiverName}</div>
                      <div className="text-sm mb-1">Received players：{(t.receiver_received || []).join('、')}</div>

                      {/* 🟦 打者資料區塊 */}
                      {(t.receiver_received || []).filter(name => {
                        const p = positionData.find(p => p.name === name)
                        return p?.B_or_P === 'Batter'
                      }).length > 0 && (
                          <>
                            <div className="font-semibold text-[12px] text-gray-600 mt-2">Batters</div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[900px] text-xs text-center border mt-1">
                                <thead className="bg-gray-100">
                                  <tr>
                                    {['Player', 'AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS'].map(k => (
                                      <th key={k}>{k}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(t.receiver_received || []).map(name => {
                                    const p = positionData.find(p => p.name === name)
                                    const stats = batterMap.get(name)
                                    if (p?.B_or_P !== 'Batter') return null
                                    return (
                                      <tr key={name}>
                                        <td>{name}</td>
                                        {['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS'].map(stat => (
                                          <td key={stat}>{stats?.[stat] ?? 0}</td>
                                        ))}
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}

                      {/* 🟥 投手資料區塊 */}
                      {(t.receiver_received || []).filter(name => {
                        const p = positionData.find(p => p.name === name)
                        return p?.B_or_P === 'Pitcher'
                      }).length > 0 && (
                          <>
                            <div className="font-semibold text-[12px] text-gray-600 mt-4">Pitchers</div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[900px] text-xs text-center border mt-1">
                                <thead className="bg-gray-100">
                                  <tr>
                                    {['Player', 'IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP'].map(k => (
                                      <th key={k}>{k}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(t.receiver_received || []).map(name => {
                                    const p = positionData.find(p => p.name === name)
                                    const stats = pitcherMap.get(name)
                                    if (p?.B_or_P !== 'Pitcher') return null
                                    return (
                                      <tr key={name}>
                                        <td>{name}</td>
                                        {['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP'].map(stat => (
                                          <td key={stat}>{stats?.[stat] ?? 0}</td>
                                        ))}
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                    </div>

                    {/* 狀態顯示 */}
                    <div className="text-xs font-semibold mt-2">
                      {t.status === 'pending' && (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Pending</span>
                      )}
                      {t.status === 'accepted' && (
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded">Accepted</span>
                      )}
                      {t.status === 'canceled' && (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">Canceled</span>
                      )}
                      {t.status === 'rejected' && (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">Rejected</span>
                      )}
                    </div>


                    {/* 按鈕區塊 */}
                    {userId && t.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        {t.initiator_id.toString() === userId ? (
                          <button
                            onClick={() => showConfirm('確定要取消這筆交易嗎？', () => handleTradeAction(t.id, 'Cancel', t))}
                            className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
                          >
                            Cancel Trade
                          </button>

                        ) : (
                          <>
                            <button
                              onClick={() => showConfirm('確定要接受這筆交易嗎？', () => handleTradeAction(t.id, 'Accept', t))}
                              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              Accept
                            </button>

                            <button
                              onClick={() => showConfirm('確定要拒絕這筆交易嗎？', () => handleTradeAction(t.id, 'Reject', t))}
                              className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >
                              Reject
                            </button>

                          </>
                        )}
                      </div>
                    )}

                  </div>
                )
              })
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>關閉</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>

      <AlertDialog open={waiverDialogOpen} onOpenChange={setWaiverDialogOpen}>
        <AlertDialogContent className="max-w-xl w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Waiver 申請紀錄</AlertDialogTitle>
          </AlertDialogHeader>

          {/* 滾輪區塊 */}
          <div className="mt-2 text-sm max-h-[400px] overflow-y-auto">
            {waiverList.length === 0 ? (
              <div className="text-gray-500 text-sm">目前沒有 pending 的 Waiver</div>
            ) : (
              Object.entries(
                waiverList.reduce((acc, w) => {
                  const date = w.off_waiver
                  if (!acc[date]) acc[date] = []
                  acc[date].push(w)
                  return acc
                }, {})
              ).map(([date, waivers]) => {
                // 依 priority 排序
                const sortedWaivers = [...waivers].sort((a, b) => a.personal_priority - b.personal_priority);
                return (
                  <div key={date} className="border rounded-lg p-4 shadow-sm bg-gray-50 mb-6">
                    {/* 日期 */}
                    <div className="font-bold text-[#0155A0] text-base mb-4">
                      {(() => {
                        // 將 off_waiver 轉成 mm/dd 格式
                        const d = new Date(date)
                        const mm = d.getMonth() + 1
                        const dd = d.getDate()
                        return `off waivers ${mm}/${dd}`
                      })()}
                    </div>
                    {/* 每一筆 waiver（每一個 box） */}
                    <div className="flex flex-col gap-4">
                      {sortedWaivers.map((w, idx) => (
                        <div key={idx} className="border rounded-md bg-white p-3 shadow relative">
                          {/* Priority 與 🔼 上方移動按鈕同一列 */}
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-xs text-gray-500 font-bold">Priority: {w.personal_priority}</div>
                            <button
                              onClick={() => moveWaiver(date, idx, 'up')}
                              className="text-gray-400 hover:text-black text-2xl"
                              disabled={idx === 0}
                            >▲</button>
                          </div>

                          {/* ➕ Add player */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-green-600 font-bold text-lg">+</span>
                            <div className="text-sm text-gray-800">{w.add_player}</div>
                            <div className="text-xs text-gray-500 font-bold">Waiver Claim</div>
                          </div>

                          {/* ➖ Drop player */}
                          {w.drop_player && (
                            <div className="flex items-center gap-2">
                              <span className="text-red-600 font-bold text-lg">-</span>
                              <div className="text-sm text-gray-800">{w.drop_player}</div>
                              <div className="text-xs text-gray-500 font-bold">To Waivers</div>
                            </div>
                          )}

                          {/* 狀態顯示或 Cancel 按鈕 */}
                          <div className="mt-4 flex items-center justify-between">
                            {w.status === 'pending' ? (
                              <button
                                onClick={() => cancelWaiver(w.apply_no)}
                                className="text-xs text-red-500 hover:text-red-700 border border-red-300 px-2 py-1 rounded"
                              >
                                Cancel
                              </button>
                            ) : (
                              <span className={
                                w.status === 'accepted'
                                  ? 'bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-semibold'
                                  : w.status === 'canceled' || w.status === 'rejected'
                                    ? 'bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-semibold'
                                    : 'bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-semibold'
                              }>
                                {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                              </span>
                            )}
                            <button
                              onClick={() => moveWaiver(date, idx, 'down')}
                              className="text-gray-400 hover:text-black text-2xl"
                              disabled={idx === sortedWaivers.length - 1}
                            >▼</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>關閉</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <AlertDialogContent className="w-full max-w-[95vw] max-h-[80vh] overflow-y-auto px-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedPlayerDetail?.Name} 詳細資料</AlertDialogTitle>
            <AlertDialogDescription className="relative px-1">
              <div className="sticky top-0 z-20 bg-white border-b py-2 px-2 flex items-start justify-between gap-4 text-sm text-gray-700">

                {/* 左側資料＋圖片排成一列 */}
                <div className="flex items-start gap-4">
                  {/* 左側文字區塊 */}
                  <div className="space-y-1 text-left">
                    <div>team：{selectedPlayerDetail?.Team}</div>
                    <div>position：{(selectedPlayerDetail?.finalPosition || []).join(', ')}</div>
                    <div>identity：{selectedPlayerDetail?.identity}</div>
                    <div>status：{selectedPlayerDetail?.status}</div>
                    <div>升降：{selectedPlayerDetail?.registerStatus}</div>
                  </div>

                  {/* 右側圖片 */}
                  <img
                    src={`/photo/${selectedPlayerDetail?.Name}.png`}
                    alt={selectedPlayerDetail?.Name}
                    className="w-24 h-30 object-cover border border-gray-300"
                    onError={(e) => (e.target.src = '/photo/defaultPlayer.png')}
                  />
                </div>


                {/* 右側動態按鈕 */}
                {(() => {
                  const p = selectedPlayerDetail
                  if (!p) return null

                  const status = (p.status || '').toLowerCase()
                  const ownerId = p.manager_id?.toString()
                  const isOwner = ownerId === userId

                  const openConfirmDialog = () => {
                    setDetailDialogOpen(false)  // ✅ 關閉詳細資料彈窗
                    setConfirmPlayer(p)
                    showConfirm(`確定要將 ${p.Name} Drop 嗎？`, async () => {
                      try {

                        const res = await fetch('/api/transaction', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            playerName: p.Name,
                            type: 'Drop',
                          }),
                        });

                        const data = await res.json()

                        if (res.ok) {
                          showMessage(`✅ 已成功 Drop ${p.Name}`, 'success')

                          // ✅ 成功後發信
                          const recipients = [
                            "mar.hung.0708@gmail.com",
                            "laiyuhung921118@gmail.com",
                            "peter0984541203@gmail.com",
                            "anthonylin6507@gmail.com"
                          ];
                          for (const email of recipients) {
                            await fetch('/api/email', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                to: email,
                                subject: 'CPBL Fantasy transaction 通知',
                                html: `
                            <h2>Drop 通知</h2>
                            <p><strong>${managerMap[userId]}</strong> 已成功 Drop 球員：</p>
                            <ul><li><strong>球員：</strong> ${confirmPlayer.Name}</li></ul>
                            <p>時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
                          `
                              })
                            })
                          }

                          if (type === 'Drop') {
                            fetch('/api/check_trade_impact', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                playerName: confirmPlayer.Name,
                                managerId: userId
                              }),
                            })
                          }

                          await reloadRoster()
                        } else {
                          showMessage(`❌ ${data.error || 'Drop 失敗'}`, 'error')
                        }
                      } catch (err) {
                        console.error('❌ Drop 錯誤:', err)
                        showMessage(`❌ Drop 失敗：${err.message}`, 'error')
                      }
                    })
                  }

                  let symbol = '⇄'
                  let borderColor = 'border-blue-600'
                  let textColor = 'text-blue-600'
                  let onClickHandler = () => {
                    setSelectedTradeTarget(p)
                    setTradeDialogOpen(true)
                  }

                  if (status === 'free agent') {
                    symbol = '＋'
                    borderColor = 'border-green-600'
                    textColor = 'text-green-600'
                    onClickHandler = () => {
                      checkAddConstraints(p)
                    }
                  } else if (status.includes('waiver')) {
                    symbol = '＋'
                    borderColor = 'border-yellow-500'
                    textColor = 'text-yellow-500'
                    onClickHandler = () => {
                      setConfirmPlayer(p)
                      setWaiverDialogOpen(true)
                    }
                  } else if (status.includes('on team') && p.owner && p.owner !== '-' && isOwner) {
                    symbol = '－'
                    borderColor = 'border-red-600'
                    textColor = 'text-red-600'
                    onClickHandler = () => {
                      if (isDropBlocked(p)) {
                        setSuccessMessage('⚠️ 該球員已開賽，無法進行 Drop 操作')
                        setSuccessDialogOpen(true)
                        return
                      }
                      setConfirmPlayer(p)
                      setDialogOpen(true)
                    }
                  }

                  return (
                    <div
                      className={`border-2 ${borderColor} rounded-full p-2 flex items-center justify-center cursor-pointer`}
                      onClick={onClickHandler}
                      title={symbol === '＋' ? '加入' : symbol === '－' ? '移除' : '交易'}
                    >
                      <span className={`${textColor} font-bold text-lg`}>{symbol}</span>
                    </div>
                  )
                })()}
              </div>



              {/* 🔻 Tabs 加進來 */}
              <Tabs defaultValue="summary" className="mt-4">
                <TabsList className="mb-2">
                  <TabsTrigger value="summary">統計區間</TabsTrigger>
                  <TabsTrigger value="last6">前六場</TabsTrigger>
                  <TabsTrigger value="txsummary">異動區間</TabsTrigger>
                </TabsList>

                {/* 🔹 summary 區塊 */}
                <TabsContent value="summary">
                  {/* {console.log('🧪 summary tab 顯示中，type:', selectedPlayerDetail?.type)} */}
                  {selectedPlayerDetail?.statSummary && (
                    <div className="overflow-x-auto">
                      <table className="text-xs text-center border w-full min-w-[700px] table-fixed">
                        <thead className="bg-gray-100">
                          <tr>
                            {(selectedPlayerDetail.type === 'Batter'
                              ? ['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS']
                              : ['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP']
                            ).map(k => (
                              <th key={k} className="border px-2">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedPlayerDetail.statSummary).map(([label, stats]) => (
                            <>
                              <tr className="bg-gray-50 text-left text-sm">
                                <td colSpan={selectedPlayerDetail.type === 'Batter' ? 13 : 13} className="px-2 py-1 font-bold text-gray-700">
                                  {label}
                                </td>
                              </tr>
                              <tr>
                                {(selectedPlayerDetail.type === 'Batter'
                                  ? ['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS']
                                  : ['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP']
                                ).map(k => (
                                  <td key={k} className="border px-2 py-1 text-center">{stats?.[k] ?? '-'}</td>
                                ))}
                              </tr>
                            </>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* 🔹 last6 區塊 */}
                <TabsContent value="last6">
                  {selectedPlayerDetail?.last6games && (
                    <div className="overflow-x-auto">
                      <table className="text-xs text-center border w-full min-w-[700px] table-fixed">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border px-2">日期</th>
                            <th className="border px-2">對手</th>
                            {(selectedPlayerDetail.type === 'Batter'
                              ? ['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS']
                              : ['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP']
                            ).map(k => (
                              <th key={k} className="border px-2">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPlayerDetail.last6games.map((game, idx) => (
                            <tr key={idx}>
                              <td className="border px-2 py-1">{game.game_date}</td>
                              <td className="border px-2 py-1">{game.opponent}</td>
                              {(selectedPlayerDetail.type === 'Batter'
                                ? ['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS']
                                : ['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP']
                              ).map(k => (
                                <td key={k} className="border px-2 py-1 text-center">{game?.[k] ?? '-'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                {/* 🔹 異動區間 區塊 */}
                <TabsContent value="txsummary">
                  {selectedPlayerDetail?.transactionSummary && selectedPlayerDetail.transactionSummary.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="text-xs text-center border w-full min-w-[700px] table-fixed">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border px-2" colSpan={selectedPlayerDetail.type === 'Batter' ? 13 : 13}>區間/持有狀態</th>
                          </tr>
                          <tr>
                            {(selectedPlayerDetail.type === 'Batter'
                              ? ['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS']
                              : ['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP']
                            ).map(k => (
                              <th key={k} className="border px-2">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPlayerDetail.transactionSummary.map((seg, idx) => (
                            <>
                              <tr className="bg-gray-50 text-left text-sm">
                                <td colSpan={selectedPlayerDetail.type === 'Batter' ? 13 : 13} className="px-2 py-1 font-bold text-gray-700">
                                  {seg.from} ~ {seg.to}｜{seg.owner ? seg.owner : (seg.type === 'Drop' ? 'FA' : seg.type)}
                                </td>
                              </tr>
                              <tr>
                                {(selectedPlayerDetail.type === 'Batter'
                                  ? ['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'K', 'BB', 'GIDP', 'XBH', 'TB', 'AVG', 'OPS']
                                  : ['IP', 'W', 'L', 'HLD', 'SV', 'H', 'ER', 'K', 'BB', 'QS', 'OUT', 'ERA', 'WHIP']
                                ).map(k => (
                                  <td key={k} className="border px-2 py-1 text-center">{seg.stats?.[k] ?? '-'}</td>
                                ))}
                              </tr>
                            </>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>



              </Tabs>
            </AlertDialogDescription>

          </AlertDialogHeader>
          <AlertDialogFooter className="sticky bottom-0 bg-white border-t pt-2">
            <AlertDialogAction onClick={() => setDetailDialogOpen(false)}>
              關閉
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmPlayer?.status?.toLowerCase().includes('on team') &&
                confirmPlayer?.manager_id?.toString() === userId
                ? '確定要 Drop 嗎？'
                : '確定要 Add 嗎？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              您即將
              {confirmPlayer?.status?.toLowerCase().includes('on team') &&
                confirmPlayer?.manager_id?.toString() === userId
                ? 'Drop'
                : 'Add'}：<strong>{confirmPlayer?.Name}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmPlayer) return;

                const isOwner = confirmPlayer.manager_id?.toString() === userId;
                const type = isOwner ? 'Drop' : 'Add';

                try {
                  const res = await fetch('/api/transaction', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      playerName: confirmPlayer.Name,
                      type,
                    }),
                  });

                  const data = await res.json();
                  if (res.ok) {
                    showMessage(`✅ 成功 ${type} ${confirmPlayer.Name}`, 'success');

                    // ✅ Drop 成功後發信
                    if (type === 'Drop') {
                      const recipients = [
                        "mar.hung.0708@gmail.com",
                        "laiyuhung921118@gmail.com",
                        "peter0984541203@gmail.com",
                        "anthonylin6507@gmail.com"
                      ];
                      for (const email of recipients) {
                        await fetch('/api/email', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            to: email,
                            subject: 'CPBL Fantasy transaction 通知',
                            html: `
                        <h2>Drop 通知</h2>
                        <p><strong>${managerMap[userId]}</strong> 已成功 Drop 球員：</p>
                        <ul><li><strong>球員：</strong> ${confirmPlayer.Name}</li></ul>
                        <p>時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
                      `
                          })
                        })
                      }
                      // 若有需要可加上 check_trade_impact
                      fetch('/api/check_trade_impact', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          playerName: confirmPlayer.Name,
                          managerId: userId
                        }),
                      })
                    }

                    await reloadRoster();
                  } else {
                    showMessage(`❌ ${data.error}`, 'error');
                  }
                } catch (err) {
                  console.error('❌ 處理錯誤:', err);
                  showMessage(`❌ 操作失敗`, 'error');
                }

                setDialogOpen(false);
                setConfirmPlayer(null);
              }}
            >
              確定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </>


  )
}