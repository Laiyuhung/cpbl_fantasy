export const extractStatAbbr = (statKey) => {
  const raw = String(statKey || '').trim();
  if (!raw) return '';

  const matches = raw.match(/\(([^)]+)\)/g);
  if (matches && matches.length > 0) {
    return matches[matches.length - 1].replace(/[()]/g, '').trim().toUpperCase();
  }

  const prefixed = raw.match(/^[bp]_([\w/%+.-]+)$/i);
  if (prefixed && prefixed[1]) {
    return prefixed[1].trim().toUpperCase();
  }

  return raw.toUpperCase();
};

const withLeadingDot = (fixedText) => fixedText.replace(/^(-?)0\./, '$1.');

export const formatStatDisplayValue = (value, statKey) => {
  if (value === null || value === undefined || value === '') return '-';

  if (typeof value === 'string' && value.trim().toUpperCase() === 'INF') return 'INF';

  const num = Number(value);
  if (!Number.isFinite(num)) return value;

  const abbr = extractStatAbbr(statKey);

  if (abbr === 'FP') return num.toFixed(2);

  if (['AVG', 'OBP', 'SLG', 'OPS'].includes(abbr)) {
    return withLeadingDot(num.toFixed(3));
  }

  if (abbr === 'OBPA') {
    return withLeadingDot(num.toFixed(3));
  }

  if (['ERA', 'WHIP', 'K/9', 'BB/9', 'K/BB', 'H/9'].includes(abbr)) {
    return num.toFixed(2);
  }

  if (abbr === 'WIN%') {
    return num.toFixed(1);
  }

  return value;
};
