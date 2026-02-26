'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PlayerManagePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [players, setPlayers] = useState([])
  const [allPlayers, setAllPlayers] = useState([]) // 儲存所有球員資料
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [identityFilter, setIdentityFilter] = useState('')
  const [availableFilter, setAvailableFilter] = useState('')
  const [registrationFilter, setRegistrationFilter] = useState('')
  const [majorFilter, setMajorFilter] = useState('')
  const [sortBy, setSortBy] = useState('add_date')
  const [registeredPlayerIds, setRegisteredPlayerIds] = useState(new Set())
  const [majorPlayerIds, setMajorPlayerIds] = useState(new Set())
  const [showModal, setShowModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    team: '',
    original_name: '',
    batter_or_pitcher: 'batter',
    identity: 'local',
    available: true
  })

  useEffect(() => {
    checkAdminStatus()
  }, [])

  // 只在初始載入時請求 API
  useEffect(() => {
    if (isAdmin) {
      fetchAllPlayers()
      fetchRegistrations()
      fetchMajors()
    }
  }, [isAdmin])

  // 在前端進行篩選和排序
  useEffect(() => {
    filterAndSortPlayers()
  }, [allPlayers, search, teamFilter, typeFilter, identityFilter, availableFilter, registrationFilter, majorFilter, sortBy, registeredPlayerIds, majorPlayerIds])

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
      setLoading(false)
    }
  }

  const fetchAllPlayers = async () => {
    try {
      setLoading(true)
      // 不帶任何篩選參數，載入所有球員
      const res = await fetch('/api/admin/players')
      const data = await res.json()

      if (data.players) {
        setAllPlayers(data.players)
      }
    } catch (err) {
      console.error('Failed to fetch players:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchRegistrations = async () => {
    try {
      const res = await fetch('/api/admin/season-registration')
      const data = await res.json()
      if (data.playerIds) {
        setRegisteredPlayerIds(new Set(data.playerIds))
      }
    } catch (err) {
      console.error('Failed to fetch registrations:', err)
    }
  }

  const fetchMajors = async () => {
    try {
      const res = await fetch('/api/admin/season-major')
      const data = await res.json()
      if (data.playerIds) {
        setMajorPlayerIds(new Set(data.playerIds))
      }
    } catch (err) {
      console.error('Failed to fetch majors:', err)
    }
  }

  const filterAndSortPlayers = () => {
    let filtered = [...allPlayers]

    // 搜尋篩選
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(player =>
        player.name?.toLowerCase().includes(searchLower) ||
        player.original_name?.toLowerCase().includes(searchLower) ||
        player.team?.toLowerCase().includes(searchLower)
      )
    }

    // 隊伍篩選
    if (teamFilter) {
      filtered = filtered.filter(player => player.team === teamFilter)
    }

    // 類型篩選 (batter/pitcher)
    if (typeFilter) {
      filtered = filtered.filter(player => player.batter_or_pitcher === typeFilter)
    }

    // 身份篩選 (local/foreigner)
    if (identityFilter) {
      filtered = filtered.filter(player => player.identity === identityFilter)
    }

    // Available 篩選
    if (availableFilter) {
      const isAvailable = availableFilter === 'true'
      filtered = filtered.filter(player => player.available === isAvailable)
    }

    // 季初登錄篩選
    if (registrationFilter) {
      const isRegistered = registrationFilter === 'true'
      filtered = filtered.filter(player =>
        isRegistered ? registeredPlayerIds.has(player.player_id) : !registeredPlayerIds.has(player.player_id)
      )
    }

    // 開季一軍篩選
    if (majorFilter) {
      const isMajor = majorFilter === 'true'
      filtered = filtered.filter(player =>
        isMajor ? majorPlayerIds.has(player.player_id) : !majorPlayerIds.has(player.player_id)
      )
    }

    // 排序
    filtered.sort((a, b) => {
      if (sortBy === 'add_date') {
        return new Date(b.add_date) - new Date(a.add_date)
      } else if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '')
      } else if (sortBy === 'team') {
        return (a.team || '').localeCompare(b.team || '')
      }
      return 0
    })

    setPlayers(filtered)
  }

  const handleOpenModal = (player = null) => {
    if (player) {
      setEditingPlayer(player)
      setFormData({
        name: player.name || '',
        team: player.team || '',
        original_name: player.original_name || '',
        batter_or_pitcher: player.batter_or_pitcher || 'batter',
        identity: player.identity || 'local',
        available: player.available !== undefined ? player.available : true
      })
    } else {
      setEditingPlayer(null)
      setFormData({
        name: '',
        team: '',
        original_name: '',
        batter_or_pitcher: 'batter',
        identity: 'local',
        available: true
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingPlayer(null)
    setFormData({
      name: '',
      team: '',
      original_name: '',
      batter_or_pitcher: 'batter',
      identity: 'local',
      available: true
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      if (editingPlayer) {
        // 更新球员
        const res = await fetch('/api/admin/players', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_id: editingPlayer.player_id,
            ...formData
          })
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Update failed')
        }

        alert('Updated successfully')
      } else {
        // Add new player
        const res = await fetch('/api/admin/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Create failed')
        }

        alert('Created successfully')
      }

      handleCloseModal()
      fetchAllPlayers()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async (playerId, playerName) => {
    if (!confirm(`Are you sure you want to delete player "${playerName}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/players?player_id=${playerId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Delete failed')
      }

      alert('Deleted successfully')
      fetchAllPlayers()
    } catch (err) {
      alert(err.message)
    }
  }

  const toggleAvailable = async (player) => {
    try {
      const res = await fetch('/api/admin/players', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: player.player_id,
          available: !player.available
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Update failed')
      }

      fetchAllPlayers()
    } catch (err) {
      alert(err.message)
    }
  }

  const toggleRegistration = async (player) => {
    const isCurrentlyRegistered = registeredPlayerIds.has(player.player_id)
    try {
      if (isCurrentlyRegistered) {
        // 如果目前是一軍，先移除一軍
        if (majorPlayerIds.has(player.player_id)) {
          const majorRes = await fetch(`/api/admin/season-major?player_id=${player.player_id}`, {
            method: 'DELETE'
          })
          if (!majorRes.ok) {
            const data = await majorRes.json()
            throw new Error(data.error || 'Failed to remove major status')
          }
        }
        // DELETE registration
        const res = await fetch(`/api/admin/season-registration?player_id=${player.player_id}`, {
          method: 'DELETE'
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to unregister')
        }
      } else {
        // POST
        const res = await fetch('/api/admin/season-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_id: player.player_id })
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to register')
        }
      }
      // Refresh both states
      fetchRegistrations()
      fetchMajors()
    } catch (err) {
      alert(err.message)
    }
  }

  const toggleMajor = async (player) => {
    // 前端驗證：未登錄不能設定一軍
    if (!registeredPlayerIds.has(player.player_id)) {
      alert('該球員尚未季初登錄，無法設定開季一軍')
      return
    }
    const isCurrentlyMajor = majorPlayerIds.has(player.player_id)
    try {
      if (isCurrentlyMajor) {
        const res = await fetch(`/api/admin/season-major?player_id=${player.player_id}`, {
          method: 'DELETE'
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to remove major')
        }
      } else {
        const res = await fetch('/api/admin/season-major', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_id: player.player_id })
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to set major')
        }
      }
      fetchMajors()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/admin')}
              className="text-blue-600 hover:text-blue-800 mb-2 flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Admin
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Player Management</h1>
            <p className="mt-2 text-gray-600">Manage all player information</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Player
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search player name or alias"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="統一獅">統一獅</option>
                <option value="中信兄弟">中信兄弟</option>
                <option value="樂天桃猿">樂天桃猿</option>
                <option value="富邦悍將">富邦悍將</option>
                <option value="味全龍">味全龍</option>
                <option value="台鋼雄鷹">台鋼雄鷹</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="batter">Batter</option>
                <option value="pitcher">Pitcher</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Identity</label>
              <select
                value={identityFilter}
                onChange={(e) => setIdentityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="local">Local</option>
                <option value="foreigner">Foreigner</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={availableFilter}
                onChange={(e) => setAvailableFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="true">Available</option>
                <option value="false">Unavailable</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">季初登錄</label>
              <select
                value={registrationFilter}
                onChange={(e) => setRegistrationFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="true">已登錄</option>
                <option value="false">未登錄</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開季一軍</label>
              <select
                value={majorFilter}
                onChange={(e) => setMajorFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="true">一軍</option>
                <option value="false">非一軍</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="add_date">Date Added (Newest)</option>
                <option value="add_date_asc">Date Added (Oldest)</option>
                <option value="name">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="team">Team</option>
              </select>
            </div>
          </div>
        </div>

        {/* Players Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alias</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">季初登錄</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">開季一軍</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {players.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                      No players found
                    </td>
                  </tr>
                ) : (
                  players.map((player) => (
                    <tr key={player.player_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {player.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.team || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {player.original_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs ${player.batter_or_pitcher === 'batter'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                          }`}>
                          {player.batter_or_pitcher === 'batter' ? 'Batter' : 'Pitcher'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs ${player.identity === 'local'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-orange-100 text-orange-800'
                          }`}>
                          {player.identity === 'local' ? 'Local' : 'Foreigner'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleAvailable(player)}
                          className={`px-2 py-1 rounded-full text-xs ${player.available
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}
                        >
                          {player.available ? 'Available' : 'Unavailable'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleRegistration(player)}
                          className={`px-2 py-1 rounded-full text-xs ${registeredPlayerIds.has(player.player_id)
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-500'
                            }`}
                        >
                          {registeredPlayerIds.has(player.player_id) ? '已登錄' : '未登錄'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleMajor(player)}
                          disabled={!registeredPlayerIds.has(player.player_id)}
                          className={`px-2 py-1 rounded-full text-xs ${!registeredPlayerIds.has(player.player_id)
                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                            : majorPlayerIds.has(player.player_id)
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-500'
                            }`}
                        >
                          {majorPlayerIds.has(player.player_id) ? '一軍' : '非一軍'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.add_date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleOpenModal(player)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(player.player_id, player.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-6">
              {editingPlayer ? 'Edit Player' : 'Add Player'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Player Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                  <select
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a team</option>
                    <option value="統一獅">統一獅</option>
                    <option value="中信兄弟">中信兄弟</option>
                    <option value="樂天桃猿">樂天桃猿</option>
                    <option value="富邦悍將">富邦悍將</option>
                    <option value="味全龍">味全龍</option>
                    <option value="台鋼雄鷹">台鋼雄鷹</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alias (comma separated for multiple)
                  </label>
                  <input
                    type="text"
                    value={formData.original_name}
                    onChange={(e) => setFormData({ ...formData, original_name: e.target.value })}
                    placeholder="e.g., Chen Chieh-Hsien,Hsien"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Separate multiple aliases with commas
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.batter_or_pitcher}
                    onChange={(e) => setFormData({ ...formData, batter_or_pitcher: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="batter">Batter</option>
                    <option value="pitcher">Pitcher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Identity <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.identity}
                    onChange={(e) => setFormData({ ...formData, identity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="local">Local</option>
                    <option value="foreigner">Foreigner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.available}
                    onChange={(e) => setFormData({ ...formData, available: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="true">Available</option>
                    <option value="false">Unavailable</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingPlayer ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
