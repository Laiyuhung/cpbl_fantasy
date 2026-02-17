'use client';

import { useState } from 'react';

export default function CpblScheduleAdmin() {
    const [startDate, setStartDate] = useState('');
    const [startGameNo, setStartGameNo] = useState('');
    const [count, setCount] = useState(3); // Default 3 games
    const [time, setTime] = useState('18:35');
    const [homeTeam, setHomeTeam] = useState('');
    const [awayTeam, setAwayTeam] = useState('');
    const [stadium, setStadium] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // CPBL Teams (Example list, can be expanded)
    const teams = [
        'CTBC Brothers', 'Uni-Lions', 'Rakuten Monkeys',
        'Fubon Guardians', 'Wei Chuan Dragons', 'TSG Hawks'
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        if (!startDate || !startGameNo || !count || !homeTeam || !awayTeam) {
            setMessage('Please fill in all required fields.');
            setLoading(false);
            return;
        }

        try {
            const schedules = [];
            const start = new Date(startDate);
            let currentGameNo = parseInt(startGameNo, 10);

            for (let i = 0; i < count; i++) {
                const gameDate = new Date(start);
                gameDate.setDate(gameDate.getDate() + i);

                // Format date as YYYY-MM-DD
                const dateStr = gameDate.toISOString().split('T')[0];

                schedules.push({
                    date: dateStr,
                    game_no: currentGameNo + i,
                    time,
                    home: homeTeam,
                    away: awayTeam,
                    stadium
                });
            }

            const res = await fetch('/api/admin/cpbl-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schedules })
            });

            const data = await res.json();

            if (data.success) {
                setMessage(`Successfully inserted ${data.count} games!`);
                // Optional: Clear form or increment game No for next batch
                setStartGameNo(currentGameNo + parseInt(count));
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

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-2xl mx-auto bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
                <h1 className="text-2xl font-bold mb-6 text-purple-400">CPBL Schedule Bulk Insert</h1>

                {message && (
                    <div className={`p-4 mb-6 rounded-lg ${message.includes('Error') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Time</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Start Game No.</label>
                            <input
                                type="number"
                                value={startGameNo}
                                onChange={(e) => setStartGameNo(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="e.g. 1"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Number of Games (Series)</label>
                            <input
                                type="number"
                                value={count}
                                onChange={(e) => setCount(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                min="1"
                                max="10"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Away Team</label>
                            <select
                                value={awayTeam}
                                onChange={(e) => setAwayTeam(e.target.value)}
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
                                value={homeTeam}
                                onChange={(e) => setHomeTeam(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                                required
                            >
                                <option value="">Select Team</option>
                                {teams.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Stadium</label>
                        <input
                            type="text"
                            value={stadium}
                            onChange={(e) => setStadium(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="e.g. Taipei Dome"
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all duration-200 ${loading
                                    ? 'bg-purple-500/50 cursor-not-allowed'
                                    : 'bg-purple-600 hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-500/30'
                                }`}
                        >
                            {loading ? 'Inserting...' : `Insert ${count} Games`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
