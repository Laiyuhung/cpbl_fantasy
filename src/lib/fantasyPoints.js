export const FANTASY_POINTS_SCORING_TYPE = 'Head-to-Head Fantasy Points';

export function parseCategoryAbbr(categoryName) {
  if (!categoryName) return '';
  const matches = String(categoryName).match(/\(([^)]+)\)/g);
  return matches ? matches[matches.length - 1].replace(/[()]/g, '') : String(categoryName);
}

export function buildCategoryWeights(rows) {
  const weights = { batter: {}, pitcher: {} };
  if (!Array.isArray(rows)) return weights;

  rows.forEach((row) => {
    if (!row || !row.category_type || !row.category_name) return;
    const type = row.category_type === 'pitcher' ? 'pitcher' : 'batter';
    const parsedWeight = Number(row.weight);
    weights[type][row.category_name] = Number.isFinite(parsedWeight) ? parsedWeight : 1;
  });

  return weights;
}

function getNumericStatValue(stats, abbr) {
  if (!stats || !abbr) return null;

  const lowerKey = String(abbr).toLowerCase();
  const upperKey = String(abbr).toUpperCase();

  if (lowerKey === 'ip' && stats.out !== undefined && stats.out !== null) {
    const outValue = Number(stats.out);
    if (Number.isFinite(outValue)) {
      return outValue / 3;
    }
  }

  const raw = stats[lowerKey] ?? stats[upperKey] ?? stats[abbr];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateFantasyPoints(stats, categories, weightsByCategory) {
  if (!stats || !Array.isArray(categories) || categories.length === 0) return null;

  let total = 0;

  categories.forEach((categoryName) => {
    const abbr = parseCategoryAbbr(categoryName);
    const value = getNumericStatValue(stats, abbr);
    if (value === null) return;

    const configuredWeight = weightsByCategory && Object.prototype.hasOwnProperty.call(weightsByCategory, categoryName)
      ? Number(weightsByCategory[categoryName])
      : 1;
    const weight = Number.isFinite(configuredWeight) ? configuredWeight : 1;

    total += value * weight;
  });

  return total;
}

export function formatFantasyPoints(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  const rounded = Math.round(parsed * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
