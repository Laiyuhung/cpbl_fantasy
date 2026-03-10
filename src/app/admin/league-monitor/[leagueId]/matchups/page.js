'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';

export default function AdminMatchupsPage() {
    const params = useParams();
    const { leagueId } = params;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [schedules, setSchedules] = useState([]);
    const [matchups, setMatchups] = useState([]);
    const [memberMap, setMemberMap] = useState({});
    const [selectedWeek, setSelectedWeek] = useState(null);

    useEffect(() => {
        const fetchMatchups = async () => {
            try {
                const res = await fetch(`/api/admin/leagues/${leagueId}/matchups`);
                if (!res.ok) throw new Error('Failed to load matchups');

                const data = await res.json();
                if (data.success) {
                    setSchedules(data.schedules);
                    setMatchups(data.matchups);
                    setMemberMap(data.memberMap);

                    // Auto-select current week or 1st week
                    if (data.schedules.length > 0) {
                        const now = new Date();
                        const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

                        let current = data.schedules.find(w => {
                            const start = new Date(new Date(w.week_start).getTime() + (8 * 60 * 60 * 1000));
                            const end = new Date(new Date(w.week_end).getTime() + (8 * 60 * 60 * 1000));
                            end.setUTCHours(23, 59, 59, 999);
                            return taiwanTime >= start && taiwanTime <= end;
                        });

                        setSelectedWeek(current ? current.week_number : data.schedules[0].week_number);
                    }
                } else {
                    throw new Error(data.error);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchMatchups();
    }, [leagueId]);

    const weeklyMatchups = useMemo(() => {
        if (!selectedWeek || schedules.length === 0) return [];

        // Find schedule for this week
        const schedule = schedules.find(s => s.week_number === selectedWeek);
        if (!schedule) return [];

        const weekScheduleIds = schedules.filter(s => s.week_number === selectedWeek).map(s => s.id);
        const thisWeekMatchups = matchups.filter(m => weekScheduleIds.includes(m.schedule_id));

        // Group by matchup
        const pairs = [];
        const usedMatchups = new Set();

        for (const m1 of thisWeekMatchups) {
            if (usedMatchups.has(m1.id)) continue;

            const m2 = thisWeekMatchups.find(m => m.manager_id !== m1.manager_id && m.schedule_id === m1.schedule_id && !usedMatchups.has(m.id));

            pairs.push([m1, m2]);
            usedMatchups.add(m1.id);
            if (m2) usedMatchups.add(m2.id);
        }

        return pairs;
    }, [selectedWeek, schedules, matchups]);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading matchups...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>;
    }

    if (schedules.length === 0) {
        return <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">No schedules generated for this league yet.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">League Matchups</h2>
                <select
                    value={selectedWeek || ''}
                    onChange={(e) => setSelectedWeek(Number(e.target.value))}
                    className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                    {schedules.map(s => (
                        <option key={s.week_number} value={s.week_number}>
                            Week {s.week_number} ({new Date(s.week_start).toLocaleDateString()} - {new Date(s.week_end).toLocaleDateString()})
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {weeklyMatchups.map((pair, idx) => {
                    const [team1, team2] = pair;

                    return (
                        <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-500">Matchup {idx + 1}</span>
                            </div>
                            <div className="p-4 flex-1">
                                {/* Team 1 */}
                                <div className="flex justify-between items-center mb-4">
                                    <div className="font-bold text-gray-900 truncate pr-4">
                                        {team1 ? (memberMap[team1.manager_id] || team1.manager_id) : 'TBD / Bye'}
                                    </div>
                                    <div className="text-xl font-black text-blue-600">
                                        {team1 ? Number(team1.score || 0).toFixed(2) : '-'}
                                    </div>
                                </div>

                                <div className="h-px bg-gray-100 my-4"></div>

                                {/* Team 2 */}
                                <div className="flex justify-between items-center">
                                    <div className="font-bold text-gray-900 truncate pr-4">
                                        {team2 ? (memberMap[team2.manager_id] || team2.manager_id) : 'TBD / Bye'}
                                    </div>
                                    <div className="text-xl font-black text-blue-600">
                                        {team2 ? Number(team2.score || 0).toFixed(2) : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {weeklyMatchups.length === 0 && (
                    <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200 shadow-sm">
                        No matchups found for this week.
                    </div>
                )}
            </div>
        </div>
    );
}
