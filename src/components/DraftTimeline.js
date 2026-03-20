'use client';

import React, { useEffect, useState } from 'react';

/**
 * DraftTimeline 元件 - 顯示 now 到 4/20 的已排選秀時間（只顯示時間）
 * @param {string} proposedTime - 提議的選秀時間 (ISO string)
 * @param {string} excludeLeagueId - 要排除的聯盟 ID（例如正在編輯的聯盟）
 * @param {boolean} showAvailableSlots - 是否顯示可用時間槽位
 * @param {callback} onConflictDetected - 偵測到衝突時的回調
 */
export default function DraftTimeline({
  proposedTime = null,
  excludeLeagueId = null,
  showAvailableSlots = false,
  onConflictDetected = null,
}) {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 獲取時間線資料
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

      // 同步衝突資訊（包含無衝突）
      if (onConflictDetected) {
        onConflictDetected(data.conflicts || []);
      }
    } catch (err) {
      console.error('Error fetching timeline:', err);
      setError('載入時間線失敗，請稍後重試');
    } finally {
      setLoading(false);
    }
  };

  // 初次載入 + proposedTime 變更時重新載入
  useEffect(() => {
    fetchTimeline();
  }, [proposedTime, excludeLeagueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-slate-400">載入時間線...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
        {error}
      </div>
    );
  }

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
    <div className="space-y-4">
      {/* 警告：衝突顯示 */}
      {conflicts && conflicts.length > 0 && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <h4 className="font-bold text-red-300 mb-2">⚠️ 時間衝突</h4>
          <div className="space-y-1 text-sm text-red-200">
            {conflicts.map((conflict, idx) => (
              <div key={idx}>
                與「{conflict.league_name}」相差僅 {conflict.minutes_apart} 分鐘（最少需 {minGapMinutes} 分鐘）
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

      <div className="text-xs text-slate-500">間隔需 ≥ {minGapMinutes} 分鐘</div>
    </div>
  );
}
