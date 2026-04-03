const TAIWAN_TIME_ZONE = 'Asia/Taipei';

function getTaiwanDateParts(date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIWAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
  };
}

export function getTaiwanDateString(date = new Date()) {
  const { year, month, day } = getTaiwanDateParts(date);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addTaiwanDays(date, days) {
  const baseDate = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : date;
  const { year, month, day } = getTaiwanDateParts(baseDate);
  const shiftedDate = new Date(Date.UTC(year, month - 1, day));
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return getTaiwanDateString(shiftedDate);
}