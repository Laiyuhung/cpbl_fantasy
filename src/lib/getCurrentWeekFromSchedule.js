import { getTaiwanDateString } from '@/lib/taiwanDate';

export function getCurrentWeekFromSchedule(schedule, referenceDate = new Date()) {
  if (!Array.isArray(schedule) || schedule.length === 0) return 1;

  const targetDate = getTaiwanDateString(referenceDate);
  const firstWeek = schedule[0];
  const lastWeek = schedule[schedule.length - 1];

  if (targetDate < firstWeek.week_start) return firstWeek.week_number || 1;
  if (targetDate > lastWeek.week_end) return lastWeek.week_number || 1;

  const current = schedule.find((week) => {
    return targetDate >= week.week_start && targetDate <= week.week_end;
  });

  return current?.week_number || firstWeek.week_number || 1;
}