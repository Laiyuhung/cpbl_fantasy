'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PlayerManagePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [players, setPlayers] = useState([])
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    team: '',
    original_name: '',
    batter_or_pitcher: 'batter',
    identity: 'local'
  })

  useEffect(() => {
    checkAdminStatus()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchPlayers()
    }
  }, [isAdmin, search, teamFilter, typeFilter])

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

  const fetchPlayers = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (teamFilter) params.append('team', teamFilter)
      if (typeFilter) params.append('type', typeFilter)

      const res = await fetch(`/api/admin/players?${params}`)
      const data = await res.json()
      
      if (data.players) {
        setPlayers(data.players)
      }
    } catch (err) {
      console.error('Failed to fetch players:', err)
    }
  }

  const handleOpenModal = (player = null) => {
    if (player) {
      setEditingPlayer(player)
      setFormData({
        name: player.name || '',
        team: player.team || '',
        original_name: player.original_name || '',
        batter_or_pitcher: player.batter_or_pitcher || 'batter',
        identity: player.identity || 'local'
      })
    } else {
      setEditingPlayer(null)
      setFormData({
        name: '',
        team: '',
        original_name: '',
        batter_or_pitcher: 'batter',
        identity: 'local'
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
      identity: 'local'
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
      fetchPlayers()
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
      fetchPlayers()
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
      
      fetchPlayers()
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {players.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
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
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          player.batter_or_pitcher === 'batter' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {player.batter_or_pitcher === 'batter' ? 'Batter' : 'Pitcher'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          player.identity === 'local' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {player.identity === 'local' ? 'Local' : 'Foreigner'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleAvailable(player)}
                          className={`px-2 py-1 rounded-full text-xs ${
                            player.available
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {player.available ? 'Available' : 'Unavailable'}
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
