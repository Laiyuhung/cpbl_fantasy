'use client';

import React, { useEffect, useState } from 'react';

/**
 * DraftTimelineInline 元件 - 顯示 now 到 4/20 的已排選秀時間（只顯示時間）
 * @param {string} proposedTime - 提議的選秀時間 (ISO string)
 * @param {string} excludeLeagueId - 要排除的聯盟 ID
 * @param {callback} onConflictDetected - 偵測到衝突時的回調
 */
export default function DraftTimelineInline({
  proposedTime = null,
  excludeLeagueId = null,
  onConflictDetected = null,
}) {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTimeline = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (proposedTime) params.append('proposedTime', proposedTime);
      if (excludeLeagueId) params.append('excludeLeagueId', excludeLeagueId);

      const res = await fetch(`/api/draft-timeline?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || '無法載入時間線');
        return;
      }

      setTimelineData(data);

      if (onConflictDetected) {
        onConflictDetected(data.conflicts || []);
      }
    } catch (err) {
      console.error('Error fetching timeline:', err);
      setError('載入時間線失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [proposedTime, excludeLeagueId]);

  if (!timelineData) {
    return null;
  }

  const { timeline, conflicts, minGapMinutes } = timelineData;
  const lineA = timeline?.lineA || [];
  const lineB = timeline?.lineB || [];
  const allDrafts = [...lineA, ...lineB];
  const now = new Date();
  const endDate = new Date('2026-04-20T23:59:59');

  const formatTimeWithDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const upcomingDraftTimes = allDrafts
    .map((draft) => new Date(draft.draft_time))
    .filter((d) => !Number.isNaN(d.getTime()) && d >= now && d <= endDate)
    .sort((a, b) => a.getTime() - b.getTime());

  return (
    <div className="space-y-3 mt-3">
      {/* 衝突警告 */}
      {conflicts && conflicts.length > 0 && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <h4 className="font-bold text-red-300 text-sm mb-1">⚠️ 時間衝突</h4>
          <div className="space-y-0.5 text-xs text-red-200">
            {conflicts.map((conflict, idx) => (
              <div key={idx}>
                {conflict.league_name} - 相差 {conflict.minutes_apart} 分鐘
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3">
        <div className="text-xs text-slate-400 mb-2">已排選秀時間（Now ~ 4/20）</div>
        <div className="text-xs text-slate-500 mb-2">規則：最多同時 2 個聯盟選秀；第 3 個聯盟需與任一既有選秀間隔至少 90 分鐘。</div>
        {upcomingDraftTimes.length === 0 ? (
          <div className="text-xs text-slate-500">目前沒有已排選秀時間</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {upcomingDraftTimes.map((d, idx) => (
              <span
                key={`${d.toISOString()}-${idx}`}
                className="px-2 py-1 rounded-md text-xs font-semibold bg-slate-800/80 border border-slate-600/40 text-slate-200"
              >
                {formatTimeWithDate(d.toISOString())}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 圖例 */}
      <div className="text-xs text-slate-500 px-1">
        間隔需 ≥ {minGapMinutes} 分鐘
      </div>
    </div>
  );
}
