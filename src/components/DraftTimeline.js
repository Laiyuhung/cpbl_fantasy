'use client';

import React, { useEffect, useState } from 'react';

/**
 * DraftTimeline 元件 - 顯示【雙時間線】表示目前各時段選秀狀況
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

      // 如果有衝突，觸發回調
      if (onConflictDetected && data.conflicts && data.conflicts.length > 0) {
        onConflictDetected(data.conflicts);
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

  const { timeline, conflicts, availableSlots, minGapMinutes, draftDurationMinutes } = timelineData;
  const lineA = timeline?.lineA || [];
  const lineB = timeline?.lineB || [];

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

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

      {/* 時間線說明 */}
      <div className="text-xs text-slate-500 mb-2">
        <span>最多 2 個選秀同時進行（每個選秀預設 {draftDurationMinutes} 分鐘）</span>
        <span className="mx-2">|</span>
        <span>時間線 A 和 B 可同時進行，但不同時間線間需至少 {minGapMinutes} 分鐘間隔</span>
      </div>

      {/* 雙時間線顯示 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Timeline A */}
        <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-500/5">
          <h3 className="font-bold text-blue-300 mb-3 text-sm uppercase tracking-wider">時間線 A</h3>
          {lineA.length > 0 ? (
            <div className="space-y-2">
              {lineA.map((league) => (
                <div
                  key={league.league_id}
                  className="px-3 py-2 bg-blue-600/20 border border-blue-500/50 rounded-lg"
                >
                  <div className="font-semibold text-blue-200 text-sm">{league.league_name}</div>
                  <div className="text-xs text-blue-300/80 mt-1">
                    {league.queue_number && (
                      <span className="inline-block mr-2 px-2 py-1 bg-blue-600 rounded">
                        #{league.queue_number}
                      </span>
                    )}
                    {formatTime(league.draft_time)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">無安排的選秀</div>
          )}
        </div>

        {/* Timeline B */}
        <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5">
          <h3 className="font-bold text-amber-300 mb-3 text-sm uppercase tracking-wider">時間線 B</h3>
          {lineB.length > 0 ? (
            <div className="space-y-2">
              {lineB.map((league) => (
                <div
                  key={league.league_id}
                  className="px-3 py-2 bg-amber-600/20 border border-amber-500/50 rounded-lg"
                >
                  <div className="font-semibold text-amber-200 text-sm">{league.league_name}</div>
                  <div className="text-xs text-amber-300/80 mt-1">
                    {league.queue_number && (
                      <span className="inline-block mr-2 px-2 py-1 bg-amber-600 rounded">
                        #{league.queue_number}
                      </span>
                    )}
                    {formatTime(league.draft_time)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">無安排的選秀</div>
          )}
        </div>
      </div>

      {/* 可用時間槽位 */}
      {showAvailableSlots && availableSlots && availableSlots.length > 0 && (
        <div className="border border-green-500/30 rounded-lg p-4 bg-green-500/5">
          <h3 className="font-bold text-green-300 mb-3 text-sm uppercase tracking-wider">✓ 可用時間</h3>
          <div className="grid grid-cols-2 gap-2">
            {availableSlots.slice(0, 6).map((slot, idx) => (
              <div
                key={idx}
                className="px-3 py-2 text-xs bg-green-600/20 border border-green-500/50 rounded-lg text-green-300 cursor-pointer hover:bg-green-600/30 transition-colors"
              >
                {slot.displayTime}
              </div>
            ))}
          </div>
          {availableSlots.length > 6 && (
            <div className="text-xs text-green-400 mt-2">
              還有 {availableSlots.length - 6} 個可用時間...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
