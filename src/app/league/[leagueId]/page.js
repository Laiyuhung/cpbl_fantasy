'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LeaguePage() {
  const params = useParams();
  const leagueId = params.leagueId;

  const [leagueSettings, setLeagueSettings] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!leagueId) return;

    const fetchLeagueData = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/league/${leagueId}`);
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Failed to load league data');
          return;
        }

        if (result.success) {
          setLeagueSettings(result.league);
          setScheduleData(result.schedule || []);
          setMembers(result.members || []);
        } else {
          setError('Failed to load league data');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading league data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 flex items-center justify-center">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    );
  }

  if (!leagueSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 flex items-center justify-center">
        <div className="text-xl text-gray-600">League not found</div>
      </div>
    );
  }

  const getWeekTypeLabel = (weekType) => {
    switch (weekType) {
      case 'regular_season':
        return 'Regular Season';
      case 'playoffs':
        return 'Playoffs';
      case 'makeup':
        return 'Makeup Week';
      default:
        return weekType;
    }
  };

  const getWeekTypeColor = (weekType) => {
    switch (weekType) {
      case 'regular_season':
        return 'bg-blue-100 text-blue-800';
      case 'playoffs':
        return 'bg-purple-100 text-purple-800';
      case 'makeup':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            {leagueSettings.league_name}
          </h1>
        </div>

        {/* League Members Section */}
        <Card className="shadow-lg mb-8">
          <CardHeader className="bg-gradient-to-r from-green-600 to-green-700">
            <CardTitle className="text-white text-2xl">League Members</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {members.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No members in this league yet
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {members.map((member) => (
                  <div
                    key={member.manager_id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="text-xl font-bold text-gray-900">
                      {member.nickname}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {member.managers?.name || 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700">
            <CardTitle className="text-white text-2xl">League Schedule</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {scheduleData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No schedule data available for this league
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Week #
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Week Label
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Start Date
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        End Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleData.map((week, index) => (
                      <tr
                        key={week.id}
                        className={`${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        } border-b border-gray-200 hover:bg-blue-50 transition-colors`}
                      >
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {week.week_number}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {week.week_label || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${getWeekTypeColor(
                              week.week_type
                            )}`}
                          >
                            {getWeekTypeLabel(week.week_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {new Date(week.week_start).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {new Date(week.week_end).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Total Weeks</div>
              <div className="text-2xl font-bold text-gray-800">
                {scheduleData.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Regular Season</div>
              <div className="text-2xl font-bold text-blue-600">
                {scheduleData.filter((w) => w.week_type === 'regular_season').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Playoff Weeks</div>
              <div className="text-2xl font-bold text-purple-600">
                {scheduleData.filter((w) => w.week_type === 'playoffs').length}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
