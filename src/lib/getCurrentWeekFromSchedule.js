import { getTaiwanDateString } from '@/lib/taiwanDate';

function normalizeReferenceDate(referenceDate) {
  if (typeof referenceDate === 'string') {
    return referenceDate.slice(0, 10);
  }

  if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
    return getTaiwanDateString(referenceDate);
  }

  return getTaiwanDateString(new Date());
}

export function getCurrentWeekFromSchedule(schedule, referenceDate = new Date()) {
  if (!Array.isArray(schedule) || schedule.length === 0) return 1;

  const targetDate = normalizeReferenceDate(referenceDate);
  const firstWeek = schedule[0];
  const lastWeek = schedule[schedule.length - 1];

  if (targetDate < firstWeek.week_start) return firstWeek.week_number || 1;
  if (targetDate > lastWeek.week_end) return lastWeek.week_number || 1;

  const current = schedule.find((week) => {
    return targetDate >= week.week_start && targetDate <= week.week_end;
  });

  return current?.week_number || firstWeek.week_number || 1;
}