'use client';

import { useState, useEffect } from 'react';

export default function CpblScheduleAdmin() {
    // Stage 1: Series Configuration
    const [config, setConfig] = useState({
        startDate: '',
        startGameNo: '',
        count: 3,
        time: '18:35',
        homeTeam: '',
        awayTeam: '',
        stadium: ''
    });

    // Stage 2: Generated Games (Editable)
    const [games, setGames] = useState([]);

    // Existing Schedule (Sidebar)
    const [existingSchedule, setExistingSchedule] = useState([]);
    const [editingId, setEditingId] = useState(null); // UUID of game being edited
    const [editForm, setEditForm] = useState({}); // Form data for editing

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Teams List
    const teams = [
        '統一獅', '中信兄弟', '樂天桃猿',
        '富邦悍將', '味全龍', '台鋼雄鷹'
    ];

    const teamColors = {
        '統一獅': 'text-orange-400',
        '中信兄弟': 'text-yellow-400',
        '樂天桃猿': 'text-red-400',
        '富邦悍將': 'text-blue-400',
        '味全龍': 'text-red-500',
        '台鋼雄鷹': 'text-green-500',
    };

    // --- Data Fetching ---
    const fetchSchedule = async () => {
        setFetching(true);
        try {
            const res = await fetch('/api/admin/cpbl-schedule');
            const data = await res.json();
            if (data.success) {
                setExistingSchedule(data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch schedule:', err);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        fetchSchedule();
    }, []);

    // --- Handlers ---

    const handleConfigChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerate = (e) => {
        e.preventDefault();
        setMessage('');

        if (!config.startDate || !config.startGameNo || !config.count || !config.homeTeam || !config.awayTeam) {
            setMessage('Please fill in all required configuration fields.');
            return;
        }

        const generatedGames = [];
        const start = new Date(config.startDate);
        let startNo = parseInt(config.startGameNo, 10);
        let count = parseInt(config.count, 10);

        for (let i = 0; i < count; i++) {
            const gameDate = new Date(start);
            gameDate.setDate(gameDate.getDate() + i);
            const dateStr = gameDate.toISOString().split('T')[0];

            const day = gameDate.getDay();
            let defaultTime = config.time;
            if (day === 0 || day === 6) {
                defaultTime = '17:05';
            } else {
                defaultTime = '18:35';
            }

            generatedGames.push({
                date: dateStr,
                game_no: startNo + i,
                time: defaultTime,
                home: config.homeTeam,
                away: config.awayTeam,
                stadium: config.stadium
            });
        }
        setGames(generatedGames);
    };

    const handleGameChange = (index, field, value) => {
        const newGames = [...games];
        newGames[index] = { ...newGames[index], [field]: value };
        setGames(newGames);
    };

    const handleReset = () => {
        setGames([]);
        setMessage('');
    };

    const handleSubmit = async () => {
        setLoading(true);
        setMessage('');

        try {
            const res = await fetch('/api/admin/cpbl-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schedules: games })
            });

            const data = await res.json();

            if (data.success) {
                setMessage(`Successfully inserted ${data.count} games!`);
                const lastGame = games[games.length - 1];
                const nextNo = parseInt(lastGame.game_no) + 1;

                setConfig(prev => ({
                    ...prev,
                    startGameNo: nextNo,
                }));
                setGames([]);
                fetchSchedule();
            } else {
                setMessage(`Error: ${data.error}`);
            }

        } catch (err) {
            console.error(err);
            setMessage('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    // --- Sidebar Editing Handlers ---

    const startEditing = (game) => {
        setEditingId(game.uuid);
        setEditForm({ ...game });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleEditChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const saveEdit = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/cpbl-schedule', {
                method: 'PUT', // We added PUT support to the API
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid: editingId, updates: editForm })
            });

            const data = await res.json();
            if (data.success) {
                // Update local state to reflect change without full refresh
                setExistingSchedule(prev => prev.map(g => g.uuid === editingId ? { ...g, ...editForm } : g));
                setEditingId(null);
            } else {
                alert(`Update failed: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            alert('Update failed');
        } finally {
            setSaving(false);
        }
    };

    // --- Render ---

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col md:flex-row gap-8">

            {/* MAIN CONTENT (Insert Form) - Left Side */}
            <div className="flex-1 max-w-4xl">
                <h1 className="text-3xl font-bold mb-6 text-purple-400">CPBL Schedule Bulk Insert</h1>

                {message && (
                    <div className={`p-4 mb-6 rounded-lg ${message.includes('Error') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                        {message}
                    </div>
                )}

                {/* STAGE 1: CONFIGURATION */}
                {games.length === 0 && (
                    <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700 mb-8">
                        <h2 className="text-xl font-semibold mb-4 text-slate-200 border-b border-slate-700 pb-2">Step 1: Series Configuration</h2>
                        <form onSubmit={handleGenerate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Row 1 */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        name="startDate"
                                        value={config.startDate}
                                        onChange={handleConfigChange}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Start Game No.</label>
                                    <input
                                        type="number"
                                        name="startGameNo"
                                        value={config.startGameNo}
                                        onChange={handleConfigChange}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="e.g. 1"
                                        required
                                    />
                                </div>
                                {/* Row 2 */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Number of Games</label>
                                    <input
                                        type="number"
                                        name="count"
                                        value={config.count}
                                        onChange={handleConfigChange}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                        min="1"
                                        max="10"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Default Time</label>
                                    <input
                                        type="time"
                                        name="time"
                                        value={config.time}
                                        onChange={handleConfigChange}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Away Team</label>
                                    <select
                                        name="awayTeam"
                                        value={config.awayTeam}
                                        onChange={handleConfigChange}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                        required
                                    >
                                        <option value="">Select Team</option>
                                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Home Team</label>
                                    <select
                                        name="homeTeam"
                                        value={config.homeTeam}
                                        onChange={handleConfigChange}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                        required
                                    >
                                        <option value="">Select Team</option>
                                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Stadium</label>
                                    <input
                                        type="text"
                                        name="stadium"
                                        value={config.stadium}
                                        onChange={handleConfigChange}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="e.g. Taipei Dome"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className="w-full py-3 px-4 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 hover:shadow-lg transition-all"
                                >
                                    Generate Forms
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* STAGE 2: EDIT GAMES */}
                {games.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-slate-200">Step 2: Review & Edit Games</h2>
                            <button
                                onClick={handleReset}
                                className="text-sm text-slate-400 hover:text-white underline"
                            >
                                Reset / Go Back
                            </button>
                        </div>

                        {games.map((game, idx) => (
                            <div key={idx} className="bg-slate-800 rounded-xl p-4 shadow-md border border-slate-700 flex flex-wrap gap-4 items-end">
                                <div className="w-24">
                                    <label className="block text-xs text-slate-500 mb-1">Game #</label>
                                    <input
                                        type="number"
                                        value={game.game_no}
                                        onChange={(e) => handleGameChange(idx, 'game_no', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={game.date}
                                        onChange={(e) => handleGameChange(idx, 'date', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Time</label>
                                    <input
                                        type="time"
                                        value={game.time}
                                        onChange={(e) => handleGameChange(idx, 'time', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    />
                                </div>
                                <div className="flex-1 min-w-[140px]">
                                    <label className="block text-xs text-slate-500 mb-1">Away</label>
                                    <select
                                        value={game.away}
                                        onChange={(e) => handleGameChange(idx, 'away', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    >
                                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="text-slate-500 pb-2">@</div>
                                <div className="flex-1 min-w-[140px]">
                                    <label className="block text-xs text-slate-500 mb-1">Home</label>
                                    <select
                                        value={game.home}
                                        onChange={(e) => handleGameChange(idx, 'home', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    >
                                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1 min-w-[120px]">
                                    <label className="block text-xs text-slate-500 mb-1">Stadium</label>
                                    <input
                                        type="text"
                                        value={game.stadium}
                                        onChange={(e) => handleGameChange(idx, 'stadium', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    />
                                </div>
                            </div>
                        ))}

                        <div className="pt-6">
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className={`w-full py-4 text-lg rounded-lg font-bold text-white transition-all duration-200 shadow-xl ${loading
                                        ? 'bg-purple-500/50 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transform hover:-translate-y-1'
                                    }`}
                            >
                                {loading ? 'Inserting Games...' : `Insert All ${games.length} Games`}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* SIDEBAR (Existing Schedule) - Right Side */}
            <div className="w-full md:w-96 bg-slate-800 p-4 rounded-xl border border-slate-700 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto ml-auto">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-white">Recent Games</h3>
                    <button
                        onClick={fetchSchedule}
                        className="text-xs text-blue-400 hover:text-blue-300"
                        disabled={fetching}
                    >
                        {fetching ? '...' : 'Refresh'}
                    </button>
                </div>

                {existingSchedule.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No games found.</p>
                ) : (
                    <div className="space-y-3">
                        {existingSchedule.map((game) => (
                            <div key={game.uuid || game.id} className="bg-slate-700/50 p-3 rounded border border-slate-600 hover:bg-slate-700 transition-colors relative group">
                                {editingId === game.uuid ? (
                                    // EDIT MODE
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                className="w-16 bg-slate-900 border border-slate-500 rounded px-1 py-1 text-xs"
                                                value={editForm.game_no}
                                                onChange={(e) => handleEditChange('game_no', e.target.value)}
                                            />
                                            <input
                                                type="date"
                                                className="flex-1 bg-slate-900 border border-slate-500 rounded px-1 py-1 text-xs"
                                                value={editForm.date}
                                                onChange={(e) => handleEditChange('date', e.target.value)}
                                            />
                                            <input
                                                type="time"
                                                className="w-20 bg-slate-900 border border-slate-500 rounded px-1 py-1 text-xs"
                                                value={editForm.time}
                                                onChange={(e) => handleEditChange('time', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <select
                                                className="flex-1 bg-slate-900 border border-slate-500 rounded px-1 py-1 text-xs"
                                                value={editForm.away}
                                                onChange={(e) => handleEditChange('away', e.target.value)}
                                            >
                                                {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <span className="text-xs self-center">@</span>
                                            <select
                                                className="flex-1 bg-slate-900 border border-slate-500 rounded px-1 py-1 text-xs"
                                                value={editForm.home}
                                                onChange={(e) => handleEditChange('home', e.target.value)}
                                            >
                                                {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex gap-2 text-xs text-slate-300 items-center">
                                            <label>Postponed:</label>
                                            <input
                                                type="checkbox"
                                                checked={editForm.is_postponed || false}
                                                onChange={(e) => handleEditChange('is_postponed', e.target.checked)}
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-900 border border-slate-500 rounded px-1 py-1 text-xs"
                                                value={editForm.stadium}
                                                onChange={(e) => handleEditChange('stadium', e.target.value)}
                                                placeholder="Stadium"
                                            />
                                        </div>
                                        <div className="flex gap-2 justify-end mt-2">
                                            <button
                                                onClick={cancelEditing}
                                                className="px-2 py-1 text-xs bg-slate-600 rounded hover:bg-slate-500"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={saveEdit}
                                                disabled={saving}
                                                className="px-2 py-1 text-xs bg-green-600 rounded hover:bg-green-500 text-white font-bold"
                                            >
                                                {saving ? '...' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // VIEW MODE
                                    <>
                                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                                            <span>#{game.game_no}</span>
                                            <div className="flex gap-2">
                                                <span>{game.date} {game.time}</span>
                                                {/* Edit Button (Visible on Hover) */}
                                                <button
                                                    onClick={() => startEditing(game)}
                                                    className="opacity-0 group-hover:opacity-100 text-purple-400 hover:text-purple-300 transition-opacity"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center font-medium text-sm">
                                            <span className={`flex-1 text-left ${teamColors[game.away] || 'text-slate-200'}`}>
                                                {game.away}
                                            </span>
                                            <span className="text-slate-500 text-xs px-2">@</span>
                                            <span className={`flex-1 text-right ${teamColors[game.home] || 'text-slate-200'}`}>
                                                {game.home}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                            <div className="text-xs text-slate-500 truncate max-w-[150px]">
                                                {game.stadium}
                                            </div>
                                            {game.is_postponed && (
                                                <span className="text-xs bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded border border-red-800">
                                                    Postponed
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
