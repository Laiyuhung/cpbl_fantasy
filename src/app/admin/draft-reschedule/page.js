'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

function toLocalInputValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (v) => String(v).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function DraftRescheduleAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [minGapMinutes, setMinGapMinutes] = useState(90);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingLeagueId, setSavingLeagueId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPreDraft, setShowOnlyPreDraft] = useState(false);

  const [editMap, setEditMap] = useState({});

  const fetchData = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/draft-reschedule');
      if (res.status === 401 || res.status === 403) {
        alert('You do not have admin privileges');
        router.push('/home');
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to fetch draft reschedule data');
        return;
      }

      const rows = data.leagues || [];
      setLeagues(rows);
      setMinGapMinutes(data.minGapMinutes || 90);

      const nextEditMap = {};
      rows.forEach((league) => {
        nextEditMap[league.league_id] = {
          queueNumber: league.queue_number ?? '',
          draftTime: toLocalInputValue(league.rescheduled_draft_time || league.live_draft_time),
        };
      });
      setEditMap(nextEditMap);
    } catch (err) {
      console.error(err);
      setError('Unexpected error while loading draft reschedule data');
    } finally {
      if (manual) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredLeagues = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return leagues.filter((league) => {
      if (showOnlyPreDraft && league.status !== 'pre-draft') return false;
      if (!term) return true;
      return (
        String(league.league_name || '').toLowerCase().includes(term) ||
        String(league.commissioner || '').toLowerCase().includes(term) ||
        String(league.league_id || '').toLowerCase().includes(term)
      );
    });
  }, [leagues, searchTerm, showOnlyPreDraft]);

  const updateEditField = (leagueId, field, value) => {
    setEditMap((prev) => ({
      ...prev,
      [leagueId]: {
        ...(prev[leagueId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = async (league) => {
    const edit = editMap[league.league_id] || {};
    const queueNumber = Number.parseInt(edit.queueNumber, 10);

    if (Number.isNaN(queueNumber) || queueNumber <= 0) {
      setError(`聯盟 ${league.league_name} 的號碼牌必須是正整數`);
      setSuccess('');
      return;
    }

    if (!edit.draftTime) {
      setError(`聯盟 ${league.league_name} 的重排時間不能為空`);
      setSuccess('');
      return;
    }

    const draftDate = new Date(edit.draftTime);
    if (Number.isNaN(draftDate.getTime())) {
      setError(`聯盟 ${league.league_name} 的重排時間格式不正確`);
      setSuccess('');
      return;
    }

    setSavingLeagueId(league.league_id);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/draft-reschedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: league.league_id,
          queueNumber,
          draftTime: draftDate.toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (Array.isArray(data.conflicts) && data.conflicts.length > 0) {
          const firstConflict = data.conflicts[0];
          setError(
            `${league.league_name} 時間衝突：與 ${firstConflict.league_name || firstConflict.league_id} 相差僅 ${firstConflict.minutes_apart} 分鐘`
          );
        } else {
          setError(data.error || 'Failed to save reschedule data');
        }
        return;
      }

      setSuccess(`已更新 ${league.league_name}：號碼牌 ${data.queue_number}，時間 ${formatTime(data.draft_time)}`);
      await fetchData(true);
    } catch (err) {
      console.error(err);
      setError('儲存失敗，請稍後再試');
    } finally {
      setSavingLeagueId(null);
    }
  };

  const handleClear = async (league) => {
    const confirmed = window.confirm(`確定要清除 ${league.league_name} 的 draft time 嗎？號碼牌會保留。`);
    if (!confirmed) return;

    setSavingLeagueId(league.league_id);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/admin/draft-reschedule?leagueId=${encodeURIComponent(league.league_id)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to clear reschedule data');
        return;
      }

      setSuccess(`已清除 ${league.league_name} 的 draft time（號碼牌已保留）`);
      await fetchData(true);
    } catch (err) {
      console.error(err);
      setError('清除失敗，請稍後再試');
    } finally {
      setSavingLeagueId(null);
    }
  };

  const getStatusClassName = (status) => {
    switch (status) {
      case 'pre-draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'drafting now':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in season':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'playoffs':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'finished':
        return 'bg-gray-200 text-gray-700 border-gray-300';
      case 'post-draft & pre-season':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading draft reschedule data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700"
            >
              返回 Admin
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Draft Reschedule Control</h1>
              <p className="text-sm text-gray-500">
                顯示各聯盟 status/finalized，並寫入號碼牌與重排選秀時間（全聯盟需至少間隔 {minGapMinutes} 分鐘）
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋聯盟/聯盟ID/Commissioner"
            className="flex-1 min-w-[280px] border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showOnlyPreDraft}
              onChange={(e) => setShowOnlyPreDraft(e.target.checked)}
            />
            只看 pre-draft
          </label>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase">League</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">Finalized</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">Members</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">Current Time</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">號碼牌</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">重新安排時間</th>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeagues.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400">沒有符合條件的聯盟</td>
                  </tr>
                ) : (
                  filteredLeagues.map((league) => {
                    const edit = editMap[league.league_id] || {};
                    const isSaving = savingLeagueId === league.league_id;
                    return (
                      <tr key={league.league_id} className="hover:bg-blue-50/40">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-gray-900 max-w-[240px] truncate" title={league.league_name}>
                            {league.league_name}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono max-w-[240px] truncate" title={league.league_id}>
                            {league.league_id}
                          </div>
                          <div className="text-[11px] text-gray-500">Comm: {league.commissioner || '-'}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex px-2 py-1 rounded border text-xs font-semibold ${getStatusClassName(league.status)}`}>
                            {league.status || 'unknown'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {league.is_finalized ? (
                            <span className="text-green-600 font-bold">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-gray-700">
                          {league.current_members}/{league.max_teams}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-700 whitespace-nowrap">
                          {formatTime(league.effective_draft_time)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={edit.queueNumber ?? ''}
                            onChange={(e) => updateEditField(league.league_id, 'queueNumber', e.target.value)}
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="datetime-local"
                            value={edit.draftTime ?? ''}
                            onChange={(e) => updateEditField(league.league_id, 'draftTime', e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSave(league)}
                              disabled={isSaving}
                              className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => handleClear(league)}
                              disabled={isSaving}
                              className="px-3 py-1.5 rounded bg-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-300 disabled:opacity-60"
                            >
                              Clear
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
