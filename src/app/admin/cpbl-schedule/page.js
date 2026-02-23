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
        stadium: '',
        majorGame: true,
        stage: 'regular_season'
    });

    // Stage 2: Generated Games (Editable)
    const [games, setGames] = useState([]);

    // Existing Schedule (Sidebar)
    const [existingSchedule, setExistingSchedule] = useState([]);
    const [editingId, setEditingId] = useState(null); // UUID of game being edited
    const [editForm, setEditForm] = useState({}); // Form data for editing
    const [scheduleTab, setScheduleTab] = useState('major'); // 'major' or 'minor'

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
    const fetchSchedule = async (date = null) => {
        setFetching(true);
        try {
            const url = date ? `/api/admin/cpbl-schedule?date=${date}` : '/api/admin/cpbl-schedule';
            const res = await fetch(url);
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
                stadium: config.stadium,
                major_game: config.majorGame,
                stage: config.stage
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

        // Convert UTC timestamp to HH:mm for the time input
        let timeStr = game.time;
        if (game.time && game.time.includes('T')) {
            const dateObj = new Date(game.time);
            // Format to HH:mm (24-hour)
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            timeStr = `${hours}:${minutes}`;
        }

        setEditForm({
            ...game,
            time: timeStr, // Set straightforward HH:mm for the input
            major_game: game.major_game !== false // Default to true if undefined
        });
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
            const payload = { uuid: editingId, updates: editForm };

            // If postponed and reschedule info is filled, add it to payload
            if (editForm.is_postponed && editForm.rescheduleDate && editForm.rescheduleTime) {
                payload.reschedule = {
                    date: editForm.rescheduleDate,
                    time: editForm.rescheduleTime,
                    stadium: editForm.rescheduleStadium
                };
            }

            const res = await fetch('/api/admin/cpbl-schedule', {
                method: 'PUT', // We added PUT support to the API
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                // Update local state to reflect change without full refresh
                // API returns the updated row with proper UTC time
                setExistingSchedule(prev => prev.map(g => g.uuid === editingId ? data.data : g));
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
            {/* ... (Left Side omitted as it works with plain inputs) ... */}
            <div className="flex-1 max-w-4xl">
                {/* ... Content ... */}
                <h1 className="text-3xl font-bold mb-6 text-purple-400">CPBL Schedule Bulk Insert</h1>
                {/* ... */}
                {games.length === 0 && (
                    <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700 mb-8">
                        {/* ... Stage 1 Form ... */}
                        {/* ... */}
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

                            <div className="flex items-center gap-6 mt-4">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="majorGame"
                                        name="majorGame"
                                        checked={config.majorGame}
                                        onChange={(e) => setConfig(prev => ({ ...prev, majorGame: e.target.checked }))}
                                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-purple-500"
                                    />
                                    <label htmlFor="majorGame" className="text-sm font-medium text-slate-300">一軍 (Major League)</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-slate-400">Stage:</label>
                                    <select
                                        name="stage"
                                        value={config.stage}
                                        onChange={handleConfigChange}
                                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="regular_season">Regular Season</option>
                                        <option value="spring_training">Spring Training</option>
                                    </select>
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
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-purple-300">Generated Games ({games.length})</h2>
                            <button onClick={handleReset} className="text-sm text-red-400 hover:text-red-300">Clear All</button>
                        </div>
                        {games.map((game, idx) => (
                            <div key={idx} className="bg-slate-800 rounded-xl p-4 shadow-md border border-slate-700 flex flex-wrap gap-4 items-end">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={game.date}
                                        onChange={(e) => handleGameChange(idx, 'date', e.target.value)}
                                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Game No</label>
                                    <input
                                        type="number"
                                        value={game.game_no}
                                        onChange={(e) => handleGameChange(idx, 'game_no', parseInt(e.target.value))}
                                        className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Time</label>
                                    <input
                                        type="time"
                                        value={game.time}
                                        onChange={(e) => handleGameChange(idx, 'time', e.target.value)}
                                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Away</label>
                                    <select
                                        value={game.away}
                                        onChange={(e) => handleGameChange(idx, 'away', e.target.value)}
                                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                                    >
                                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Home</label>
                                    <select
                                        value={game.home}
                                        onChange={(e) => handleGameChange(idx, 'home', e.target.value)}
                                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                                    >
                                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Stadium</label>
                                    <input
                                        type="text"
                                        value={game.stadium || ''}
                                        onChange={(e) => handleGameChange(idx, 'stadium', e.target.value)}
                                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id={`major_${idx}`}
                                        checked={game.major_game !== false}
                                        onChange={(e) => handleGameChange(idx, 'major_game', e.target.checked)}
                                        className="rounded border-slate-600 bg-slate-700"
                                    />
                                    <label htmlFor={`major_${idx}`} className="text-xs text-blue-400">一軍</label>
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-4 mt-6">
                            <button onClick={handleReset} className="flex-1 py-3 px-4 rounded-lg font-bold bg-slate-600 hover:bg-slate-500 transition-all">
                                Cancel
                            </button>
                            <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 px-4 rounded-lg font-bold bg-green-600 hover:bg-green-500 transition-all disabled:opacity-50">
                                {loading ? 'Inserting...' : `Insert ${games.length} Games`}
                            </button>
                        </div>
                        {message && <div className={`p-3 rounded-lg ${message.includes('Error') ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>{message}</div>}
                    </div>
                )}
            </div>

            {/* SIDEBAR (Existing Schedule) - Right Side */}
            <div className="w-full md:w-96 bg-slate-800 p-4 rounded-xl border border-slate-700 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto ml-auto">
                {/* ... Header ... */}
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-white">Recent Games</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                                fetchSchedule(today);
                            }}
                            className="text-xs px-2 py-1 bg-purple-600/50 hover:bg-purple-600 rounded text-purple-100 transition-colors"
                            disabled={fetching}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => fetchSchedule()}
                            className="text-xs text-blue-400 hover:text-blue-300"
                            disabled={fetching}
                        >
                            {fetching ? '...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {/* Major/Minor Tabs */}
                <div className="flex mb-4 bg-slate-900/50 rounded-lg p-1">
                    <button
                        onClick={() => setScheduleTab('major')}
                        className={`flex-1 py-2 px-3 text-sm font-bold rounded-md transition-all ${scheduleTab === 'major'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                    >
                        一軍 (Major)
                    </button>
                    <button
                        onClick={() => setScheduleTab('minor')}
                        className={`flex-1 py-2 px-3 text-sm font-bold rounded-md transition-all ${scheduleTab === 'minor'
                                ? 'bg-slate-600 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                    >
                        二軍 (Minor)
                    </button>
                </div>

                {existingSchedule.filter(g => scheduleTab === 'major' ? g.major_game !== false : g.major_game === false).length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No games found.</p>
                ) : (
                    <div className="space-y-3">
                        {existingSchedule.filter(g => scheduleTab === 'major' ? g.major_game !== false : g.major_game === false).map((game) => (
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
                                        {/* ... (Other edit fields) ... */}
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
                                        <div className="flex flex-col gap-2 bg-slate-800/50 p-2 rounded border border-white/5 mt-2">
                                            <div className="flex gap-2 text-xs text-slate-300 items-center">
                                                <input
                                                    type="checkbox"
                                                    id="major_game"
                                                    checked={editForm.major_game !== false}
                                                    onChange={(e) => handleEditChange('major_game', e.target.checked)}
                                                    className="rounded border-slate-500 bg-slate-900"
                                                />
                                                <label htmlFor="major_game" className="font-bold text-blue-400">一軍 (Major)</label>
                                            </div>
                                            <div className="flex gap-2 text-xs text-slate-300 items-center">
                                                <input
                                                    type="checkbox"
                                                    id="postponed"
                                                    checked={editForm.is_postponed || false}
                                                    onChange={(e) => handleEditChange('is_postponed', e.target.checked)}
                                                    className="rounded border-slate-500 bg-slate-900"
                                                />
                                                <label htmlFor="postponed" className="font-bold text-red-400">Postponed</label>
                                            </div>

                                            {/* Reschedule Inputs - Only show if Postponed is checked */}
                                            {editForm.is_postponed && (
                                                <div className="pl-4 border-l-2 border-slate-600 mt-1 space-y-2 animate-in slide-in-from-left-2 duration-200">
                                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Reschedule To (New Game)</p>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="date"
                                                            className="flex-1 bg-slate-900 border border-slate-500 rounded px-1 py-1 text-xs"
                                                            value={editForm.rescheduleDate || ''}
                                                            onChange={(e) => handleEditChange('rescheduleDate', e.target.value)}
                                                            placeholder="New Date"
                                                        />
                                                        <input
                                                            type="time"
                                                            className="w-20 bg-slate-900 border border-slate-500 rounded px-1 py-1 text-xs"
                                                            value={editForm.rescheduleTime || ''}
                                                            onChange={(e) => handleEditChange('rescheduleTime', e.target.value)}
                                                            placeholder="New Time"
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-slate-900 border border-slate-500 rounded px-1 py-1 text-xs"
                                                        value={editForm.rescheduleStadium || ''}
                                                        onChange={(e) => handleEditChange('rescheduleStadium', e.target.value)}
                                                        placeholder="New Stadium (Optional)"
                                                    />
                                                </div>
                                            )}
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
                                                <span>{game.date} {game.time ? new Date(game.time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}</span>
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
                                            {game.major_game === false && (
                                                <span className="text-xs bg-slate-600/50 text-slate-300 px-1.5 py-0.5 rounded border border-slate-500">
                                                    二軍
                                                </span>
                                            )}
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
