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
            time: timeStr // Set straightforward HH:mm for the input
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
            const res = await fetch('/api/admin/cpbl-schedule', {
                method: 'PUT', // We added PUT support to the API
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid: editingId, updates: editForm })
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
                            {/* ... */}
                            {/* ... */}
                        </form>
                    </div>
                )}

                {/* STAGE 2: EDIT GAMES */}
                {games.length > 0 && (
                    <div className="space-y-4">
                        {/* ... */}
                        {games.map((game, idx) => (
                            <div key={idx} className="bg-slate-800 rounded-xl p-4 shadow-md border border-slate-700 flex flex-wrap gap-4 items-end">
                                {/* ... Pre-insert edit fields use simple values, no change needed ... */}
                                {/* ... */}
                            </div>
                        ))}
                        {/* ... */}
                    </div>
                )}
            </div>

            {/* SIDEBAR (Existing Schedule) - Right Side */}
            <div className="w-full md:w-96 bg-slate-800 p-4 rounded-xl border border-slate-700 h-fit max-h-[calc(100vh-2rem)] overflow-y-auto ml-auto">
                {/* ... Header ... */}
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
