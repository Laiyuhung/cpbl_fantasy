'use client';

import { useState } from 'react';

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

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Teams List
    const teams = [
        '統一獅', '中信兄弟', '樂天桃猿',
        '富邦悍將', '味全龍', '台鋼雄鷹'
    ];

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

            // Use the day of the week to guess time (e.g. Sat/Sun = 17:05)
            // 0 = Sunday, 6 = Saturday
            const day = gameDate.getDay();
            let defaultTime = config.time;
            if (day === 0 || day === 6) {
                defaultTime = '17:05'; // Weekend default
            } else {
                defaultTime = '18:35'; // Weekday default (from config, usually)
            }
            // Ideally use user input config.time as base, but let's be smart if user didn't change it from default
            // If user explicitly set something else, respect it? 
            // Let's just use config.time as the base default for all, user can edit.
            // Actually, let's stick to config.time to avoid confusion.

            generatedGames.push({
                date: dateStr,
                game_no: startNo + i,
                time: config.time,
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
                // Prepare for next series:
                // Start Date = Last Date + 1? Or just clear?
                // Start Game No = Last Game No + 1
                const lastGame = games[games.length - 1];
                const nextNo = parseInt(lastGame.game_no) + 1;

                setConfig(prev => ({
                    ...prev,
                    startGameNo: nextNo,
                    // Keep teams/stadium as they might play another series nearby? 
                    // Or keep them.
                }));
                setGames([]); // Go back to config mode
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

    // --- Render ---

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
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
        </div>
    );
}
