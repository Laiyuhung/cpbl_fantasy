'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatStatDisplayValue } from '@/lib/statDisplayFormat';

const BATTER_LOWER_BETTER = new Set(['cs', 'k', 'gidp']);
const PITCHER_LOWER_BETTER = new Set(['era', 'whip', 'bb/9', 'bb', 'er', 'ra', 'h/9', 'h', 'hbp', 'hr', 'ibb', 'l', 'obpa', 'rl']);

const BATTER_SUM_FIELDS = ['b_gp', 'b_pa', 'b_ab', 'b_r', 'b_h', 'b_1b', 'b_2b', 'b_3b', 'b_hr', 'b_xbh', 'b_tb', 'b_rbi', 'b_bb', 'b_ibb', 'b_hbp', 'b_k', 'b_sb', 'b_cs', 'b_sh', 'b_sf', 'b_gidp', 'b_e', 'b_cyc'];
const PITCHER_SUM_FIELDS = ['p_app', 'p_gs', 'p_rapp', 'p_tbf', 'p_pc', 'p_w', 'p_l', 'p_sv', 'p_hld', 'p_svhld', 'p_rw', 'p_rl', 'p_k', 'p_bb', 'p_ibb', 'p_hbp', 'p_h', 'p_hr', 'p_ra', 'p_er', 'p_qs', 'p_cg', 'p_sho', 'p_pg', 'p_nh'];

function getCategoryAbbr(category) {
  const matches = String(category || '').match(/\(([^)]+)\)/g);
  if (matches && matches.length > 0) {
    return matches[matches.length - 1].replace(/[()]/g, '').trim().toUpperCase();
  }
  return (category || '').trim().toUpperCase();
}

function getCategoryType(category, settings) {
  if (settings?.batter_categories?.includes(category)) return 'batter';
  if (settings?.pitcher_categories?.includes(category)) return 'pitcher';
  return null;
}

function getCategoryRecordKey(type, category) {
  return `${type}:${category}`;
}

function parseBaseballIpToOuts(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.floor(parsed) * 3 + Math.round((parsed % 1) * 10);
}

function formatOutsToIp(outs) {
  const safeOuts = Number.isFinite(Number(outs)) ? Number(outs) : 0;
  return `${Math.floor(safeOuts / 3)}.${safeOuts % 3}`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'string' && value.toUpperCase() === 'INF') return Number.POSITIVE_INFINITY;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatRow(row) {
  return {
    ...row,
    pitchingOuts: parseBaseballIpToOuts(row?.p_ip ?? row?.p_outs ?? row?.p_out),
  };
}

function makeEmptyAggregate() {
  return {
    ...BATTER_SUM_FIELDS.reduce((acc, field) => ({ ...acc, [field]: 0 }), {}),
    ...PITCHER_SUM_FIELDS.reduce((acc, field) => ({ ...acc, [field]: 0 }), {}),
    pitchingOuts: 0,
  };
}

function addRowToAggregate(target, row) {
  BATTER_SUM_FIELDS.forEach((field) => {
    target[field] += toNumber(row?.[field]);
  });

  PITCHER_SUM_FIELDS.forEach((field) => {
    target[field] += toNumber(row?.[field]);
  });

  target.pitchingOuts += parseBaseballIpToOuts(row?.p_ip ?? row?.p_outs ?? row?.p_out);
  return target;
}

function resolveCategoryValue(stats, category, type) {
  const abbr = getCategoryAbbr(category).toLowerCase();

  if (type === 'batter') {
    const batterValue = (key) => toNumber(stats?.[`b_${key}`]);

    switch (abbr) {
      case 'avg':
        return batterValue('ab') > 0 ? batterValue('h') / batterValue('ab') : 0;
      case 'obp': {
        const denominator = batterValue('ab') + batterValue('bb') + batterValue('hbp') + batterValue('sf');
        return denominator > 0 ? (batterValue('h') + batterValue('bb') + batterValue('hbp')) / denominator : 0;
      }
      case 'slg':
        return batterValue('ab') > 0 ? batterValue('tb') / batterValue('ab') : 0;
      case 'ops': {
        const denominator = batterValue('ab') + batterValue('bb') + batterValue('hbp') + batterValue('sf');
        const obp = denominator > 0 ? (batterValue('h') + batterValue('bb') + batterValue('hbp')) / denominator : 0;
        const slg = batterValue('ab') > 0 ? batterValue('tb') / batterValue('ab') : 0;
        return obp + slg;
      }
      default:
        return batterValue(abbr);
    }
  }

  const pitcherValue = (key) => toNumber(stats?.[`p_${key}`]);
  const innings = (toNumber(stats?.pitchingOuts) || 0) / 3;

  switch (abbr) {
    case 'ip':
    case 'out':
    case 'outs':
      return toNumber(stats?.pitchingOuts);
    case 'era':
      return innings > 0 ? (pitcherValue('er') * 9) / innings : 0;
    case 'whip':
      return innings > 0 ? (pitcherValue('h') + pitcherValue('bb')) / innings : 0;
    case 'k/9':
      return innings > 0 ? (pitcherValue('k') * 9) / innings : 0;
    case 'bb/9':
      return innings > 0 ? (pitcherValue('bb') * 9) / innings : 0;
    case 'k/bb':
      if (pitcherValue('bb') === 0) return pitcherValue('k') > 0 ? Number.POSITIVE_INFINITY : 0;
      return pitcherValue('k') / pitcherValue('bb');
    case 'h/9':
      return innings > 0 ? (pitcherValue('h') * 9) / innings : 0;
    case 'obpa':
      return pitcherValue('tbf') > 0 ? (pitcherValue('h') + pitcherValue('bb') + pitcherValue('hbp')) / pitcherValue('tbf') : 0;
    case 'win%':
      return (pitcherValue('w') + pitcherValue('l')) > 0 ? pitcherValue('w') / (pitcherValue('w') + pitcherValue('l')) : 0;
    case 'sv+hld':
      return pitcherValue('sv') + pitcherValue('hld');
    default:
      return pitcherValue(abbr);
  }
}

function isLowerBetter(category, type) {
  const abbr = getCategoryAbbr(category).toLowerCase();
  if (type === 'batter') return BATTER_LOWER_BETTER.has(abbr);
  return PITCHER_LOWER_BETTER.has(abbr);
}

function compareCategoryValues(aValue, bValue, category, type) {
  const lowerBetter = isLowerBetter(category, type);
  const a = aValue === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : (Number.isFinite(aValue) ? aValue : 0);
  const b = bValue === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : (Number.isFinite(bValue) ? bValue : 0);

  if (a === b) return 0;
  if (Math.abs(a - b) < 1e-9) return 0;
  if (lowerBetter) return a < b ? -1 : 1;
  return a > b ? -1 : 1;
}

function formatCategoryValue(category, value) {
  const abbr = getCategoryAbbr(category);

  if (value === null || value === undefined) return '-';
  if (value === Number.POSITIVE_INFINITY) return 'INF';

  if (abbr === 'IP') return formatOutsToIp(value);
  if (abbr === 'OUT' || abbr === 'OUTS') return String(Math.round(Number(value) || 0));
  if (abbr === 'WIN%') return Number(value || 0).toFixed(3);

  const formatted = formatStatDisplayValue(value, category);
  return formatted !== value ? String(formatted) : String(value);
}

function getManagerLabel(member) {
  return member?.nickname || member?.managers?.name || member?.name || 'Unknown';
}

function StatTable({ title, description, categories, managers, totalsByManager, type }) {
  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl shadow-black/30 overflow-hidden">
      <CardHeader className="space-y-1 border-b border-white/10 bg-white/5">
        <CardTitle className="text-xl sm:text-2xl font-black text-white">{title}</CardTitle>
        <p className="text-sm text-slate-300">{description}</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableHead className="sticky left-0 z-30 min-w-[140px] sm:min-w-[180px] bg-[#020617] text-cyan-100 font-bold shadow-[8px_0_16px_-12px_rgba(0,0,0,0.9)]">Manager</TableHead>
                {categories.map((category) => (
                  <TableHead key={category} className="min-w-[72px] sm:min-w-[100px] text-center text-cyan-100 font-bold px-2 sm:px-3" title={category}>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs sm:text-sm leading-tight">{getCategoryAbbr(category)}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map((manager) => {
                const totals = totalsByManager.get(String(manager.manager_id)) || makeEmptyAggregate();
                return (
                  <TableRow key={manager.manager_id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="sticky left-0 z-20 bg-[#020617] font-bold text-white align-top shadow-[8px_0_16px_-12px_rgba(0,0,0,0.9)]">
                      <div className="flex flex-col gap-0.5 whitespace-normal break-words leading-snug">
                        <span>{getManagerLabel(manager)}</span>
                      </div>
                    </TableCell>
                    {categories.map((category) => {
                      const value = resolveCategoryValue(totals, category, type);
                      return (
                        <TableCell key={category} className="text-center font-mono text-white/90 whitespace-nowrap px-2 sm:px-3 py-2 text-xs sm:text-sm">
                          {formatCategoryValue(category, value)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RecordTable({ title, description, categories, managers, recordsByManager, type }) {
  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl shadow-black/30 overflow-hidden">
      <CardHeader className="space-y-1 border-b border-white/10 bg-white/5">
        <CardTitle className="text-xl sm:text-2xl font-black text-white">{title}</CardTitle>
        <p className="text-sm text-slate-300">{description}</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableHead className="sticky left-0 z-30 min-w-[140px] sm:min-w-[180px] bg-[#020617] text-cyan-100 font-bold shadow-[8px_0_16px_-12px_rgba(0,0,0,0.9)]">Manager</TableHead>
                {categories.map((category) => (
                  <TableHead key={category} className="min-w-[72px] sm:min-w-[100px] text-center text-cyan-100 font-bold px-2 sm:px-3" title={category}>
                    <span className="text-xs sm:text-sm leading-tight">{getCategoryAbbr(category)}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map((manager) => {
                const record = recordsByManager.get(String(manager.manager_id)) || {};
                return (
                  <TableRow key={manager.manager_id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="sticky left-0 z-20 bg-[#020617] font-bold text-white align-top shadow-[8px_0_16px_-12px_rgba(0,0,0,0.9)]">
                      <div className="flex flex-col gap-0.5 whitespace-normal break-words leading-snug">
                        <span>{getManagerLabel(manager)}</span>
                      </div>
                    </TableCell>
                    {categories.map((category) => {
                      const value = record[getCategoryRecordKey(type, category)] || { w: 0, l: 0, t: 0 };
                      return (
                        <TableCell key={category} className="text-center px-2 sm:px-3 py-2">
                          <Badge className="bg-white/10 text-white border border-white/10 font-mono text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 whitespace-nowrap">
                            {value.w}-{value.l}-{value.t}
                          </Badge>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AllCompletedWeeksBestWorst({
  title,
  description,
  categories,
  weeklyBestWorstByCategory,
  type,
}) {
  if (Object.keys(weeklyBestWorstByCategory).length === 0) {
    return (
      <Card className="border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl shadow-black/30 overflow-hidden">
        <CardHeader className="space-y-1 border-b border-white/10 bg-white/5">
          <CardTitle className="text-xl sm:text-2xl font-black text-white">{title}</CardTitle>
          <p className="text-sm text-slate-300">{description}</p>
        </CardHeader>
        <CardContent className="p-6 text-center text-slate-400">
          No completed weeks yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl shadow-black/30 overflow-hidden">
      <CardHeader className="space-y-1 border-b border-white/10 bg-white/5">
        <CardTitle className="text-xl sm:text-2xl font-black text-white">{title}</CardTitle>
        <p className="text-sm text-slate-300">{description}</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableHead className="min-w-[100px] text-left text-cyan-100 font-bold">Category</TableHead>
                <TableHead className="min-w-[200px] text-left text-emerald-100 font-bold">Best</TableHead>
                <TableHead className="min-w-[200px] text-left text-rose-100 font-bold">Worst</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => {
                const data = weeklyBestWorstByCategory[getCategoryRecordKey(type, category)];
                if (!data) return null;

                const bestEntry = data.best[0];
                const worstEntry = data.worst[0];

                return (
                  <TableRow key={category} className="border-white/10 hover:bg-white/5">
                    <TableCell className="font-bold text-slate-200 py-3">{getCategoryAbbr(category)}</TableCell>
                    <TableCell className="text-emerald-200 font-semibold py-3">
                      {bestEntry ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold">{bestEntry.managerName}</span>
                          <span className="text-xs text-emerald-300/80">{formatCategoryValue(category, bestEntry.value)} (W{bestEntry.week})</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-rose-200 font-semibold py-3">
                      {worstEntry ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold">{worstEntry.managerName}</span>
                          <span className="text-xs text-rose-300/80">{formatCategoryValue(category, worstEntry.value)} (W{worstEntry.week})</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyExtremes({
  title,
  description,
  categories,
  managers,
  rowsByManager,
  selectedWeek,
  weekLabel,
  weekRange,
  type,
}) {
  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl shadow-black/30 overflow-hidden">
      <CardHeader className="space-y-2 border-b border-white/10 bg-white/5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-xl sm:text-2xl font-black text-white">{title}</CardTitle>
            <p className="text-sm text-slate-300 mt-1">{description}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-cyan-200">{weekLabel}</div>
            <div className="text-xs text-slate-400">{weekRange}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const abbr = getCategoryAbbr(category);
            const rows = managers.map((manager) => {
              const row = rowsByManager.get(String(manager.manager_id)) || normalizeStatRow({ manager_id: manager.manager_id });
              return {
                manager,
                value: resolveCategoryValue(row, category, type),
              };
            });

            const sorted = [...rows].sort((a, b) => compareCategoryValues(a.value, b.value, category, type));
            const bestValue = sorted[0]?.value ?? 0;
            const worstValue = sorted[sorted.length - 1]?.value ?? 0;
            const normalizeComparableValue = (value) => (value === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : (Number.isFinite(value) ? value : 0));
            const bestComparable = normalizeComparableValue(bestValue);
            const worstComparable = normalizeComparableValue(worstValue);
            const bestManagers = rows.filter((entry) => Math.abs(normalizeComparableValue(entry.value) - bestComparable) < 1e-9).map((entry) => getManagerLabel(entry.manager));
            const worstManagers = rows.filter((entry) => Math.abs(normalizeComparableValue(entry.value) - worstComparable) < 1e-9).map((entry) => getManagerLabel(entry.manager));

            return (
              <div key={category} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 sm:p-4 shadow-lg shadow-black/20">
                <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
                  <div>
                    <div className="sticky left-0 z-20 inline-flex items-center rounded-md bg-[#020617] px-2 py-1 text-sm sm:text-base font-black text-white shadow-[8px_0_16px_-12px_rgba(0,0,0,0.9)]" title={category}>{abbr}</div>
                    <div className={`text-[10px] uppercase tracking-[0.2em] mt-1 ${isLowerBetter(category, type) ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {isLowerBetter(category, type) ? 'Lower is better' : 'Higher is better'}
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-white/10 text-white border border-white/10">
                    {selectedWeek}
                  </Badge>
                </div>

                <div className="space-y-2.5 sm:space-y-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 sm:p-3">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-emerald-300 font-bold">Best</div>
                    <div className="mt-1 font-mono text-emerald-200 text-sm sm:text-base">{formatCategoryValue(category, bestValue)}</div>
                    <div className="mt-1 text-xs sm:text-sm font-bold text-white leading-snug break-words">{bestManagers.join(', ')}</div>
                  </div>
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 sm:p-3">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-rose-300 font-bold">Worst</div>
                    <div className="mt-1 font-mono text-rose-200 text-sm sm:text-base">{formatCategoryValue(category, worstValue)}</div>
                    <div className="mt-1 text-xs sm:text-sm font-bold text-white leading-snug break-words">{worstManagers.join(', ')}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RecordBookPage() {
  const params = useParams();
  const leagueId = params.leagueId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leagueName, setLeagueName] = useState('Record Book');
  const [schedule, setSchedule] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [members, setMembers] = useState([]);
  const [settings, setSettings] = useState({ batter_categories: [], pitcher_categories: [] });
  const [selectedWeek, setSelectedWeek] = useState('');

  useEffect(() => {
    if (!leagueId) return;

    const fetchRecordBook = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/league/${leagueId}/record-book`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to load record book');
        }

        setSchedule(result.schedule || []);
        setAvailableWeeks(result.availableWeeks || []);
        setMatchups(result.matchups || []);
        setWeeklyStats(result.weeklyStats || []);
        setMembers(result.members || []);
        setSettings(result.settings || { batter_categories: [], pitcher_categories: [] });

        if ((result.availableWeeks || []).length > 0) {
          const nextSelectedWeek = String(result.availableWeeks[result.availableWeeks.length - 1]);
          setSelectedWeek(nextSelectedWeek);
        }

        if (result.settings?.league_name) {
          setLeagueName(result.settings.league_name);
        }
      } catch (fetchError) {
        console.error('Record book load error:', fetchError);
        setError(fetchError.message || 'Failed to load record book');
      } finally {
        setLoading(false);
      }
    };

    fetchRecordBook();
  }, [leagueId]);

  useEffect(() => {
    if (!selectedWeek && availableWeeks.length > 0) {
      setSelectedWeek(String(availableWeeks[availableWeeks.length - 1]));
    }
  }, [selectedWeek, availableWeeks]);

  const managerList = useMemo(() => {
    return (members || [])
      .map((member) => ({ ...member, displayName: getManagerLabel(member) }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'en', { numeric: true }));
  }, [members]);

  const statsByWeekAndManager = useMemo(() => {
    const map = new Map();
    (weeklyStats || []).forEach((row) => {
      const weekKey = String(row.week_number);
      const managerKey = String(row.manager_id);
      if (!map.has(weekKey)) map.set(weekKey, new Map());
      map.get(weekKey).set(managerKey, normalizeStatRow(row));
    });
    return map;
  }, [weeklyStats]);

  const totalsByManager = useMemo(() => {
    const map = new Map();
    managerList.forEach((manager) => map.set(String(manager.manager_id), makeEmptyAggregate()));

    (weeklyStats || []).forEach((row) => {
      const managerKey = String(row.manager_id);
      const current = map.get(managerKey) || makeEmptyAggregate();
      addRowToAggregate(current, row);
      map.set(managerKey, current);
    });

    return map;
  }, [managerList, weeklyStats]);

  const recordsByManager = useMemo(() => {
    const createRecordBucket = () => {
      const bucket = {};
      (settings.batter_categories || []).forEach((category) => {
        bucket[getCategoryRecordKey('batter', category)] = { w: 0, l: 0, t: 0 };
      });
      (settings.pitcher_categories || []).forEach((category) => {
        bucket[getCategoryRecordKey('pitcher', category)] = { w: 0, l: 0, t: 0 };
      });
      return bucket;
    };

    const map = new Map();
    managerList.forEach((manager) => map.set(String(manager.manager_id), createRecordBucket()));
    const completedWeekKeys = new Set(
      (schedule || [])
        .filter((week) => isWeekCompleted(week.week_end))
        .map((week) => String(week.week_number))
    );

    (matchups || []).forEach((matchup) => {
      const weekKey = String(matchup.week_number);
      if (!completedWeekKeys.has(weekKey)) return;

      const managerA = String(matchup.manager_id_a || '');
      const managerB = String(matchup.manager_id_b || '');
      if (!managerA || !managerB) return;

      const weekRows = statsByWeekAndManager.get(weekKey) || new Map();
      const rowA = weekRows.get(managerA) || normalizeStatRow({ manager_id: managerA, week_number: matchup.week_number });
      const rowB = weekRows.get(managerB) || normalizeStatRow({ manager_id: managerB, week_number: matchup.week_number });

        // Process batter categories explicitly with 'batter' type (b_h, b_k, b_bb, etc.)
        (settings.batter_categories || []).forEach((category) => {
          const valueA = resolveCategoryValue(rowA, category, 'batter');
          const valueB = resolveCategoryValue(rowB, category, 'batter');
          const comparison = compareCategoryValues(valueA, valueB, category, 'batter');
          const bucketA = map.get(managerA);
          const bucketB = map.get(managerB);
          const recordKey = getCategoryRecordKey('batter', category);
          if (!bucketA || !bucketB) return;
          if (comparison < 0) {
            bucketA[recordKey].w += 1;
            bucketB[recordKey].l += 1;
          } else if (comparison > 0) {
            bucketA[recordKey].l += 1;
            bucketB[recordKey].w += 1;
          } else {
            bucketA[recordKey].t += 1;
            bucketB[recordKey].t += 1;
          }
        });

        // Process pitcher categories explicitly with 'pitcher' type (p_h, p_k, p_bb, etc.)
        (settings.pitcher_categories || []).forEach((category) => {
          const valueA = resolveCategoryValue(rowA, category, 'pitcher');
          const valueB = resolveCategoryValue(rowB, category, 'pitcher');
          const comparison = compareCategoryValues(valueA, valueB, category, 'pitcher');
          const bucketA = map.get(managerA);
          const bucketB = map.get(managerB);
          const recordKey = getCategoryRecordKey('pitcher', category);
          if (!bucketA || !bucketB) return;

          if (comparison < 0) {
            bucketA[recordKey].w += 1;
            bucketB[recordKey].l += 1;
          } else if (comparison > 0) {
            bucketA[recordKey].l += 1;
            bucketB[recordKey].w += 1;
          } else {
            bucketA[recordKey].t += 1;
            bucketB[recordKey].t += 1;
          }
        });
    });

    return map;
  }, [matchups, managerList, schedule, settings, statsByWeekAndManager]);

  const selectedWeekRowsByManager = useMemo(() => {
    const weekRows = statsByWeekAndManager.get(String(selectedWeek)) || new Map();
    const map = new Map();

    managerList.forEach((manager) => {
      const row = weekRows.get(String(manager.manager_id)) || normalizeStatRow({ manager_id: manager.manager_id, week_number: selectedWeek });
      map.set(String(manager.manager_id), row);
    });

    return map;
  }, [managerList, selectedWeek, statsByWeekAndManager]);

  const sectionData = useMemo(() => {
    const buildCategories = (type) => (type === 'batter' ? settings.batter_categories : settings.pitcher_categories);

    return {
      batter: buildCategories('batter'),
      pitcher: buildCategories('pitcher'),
    };
  }, [settings]);

  const selectedWeekMeta = useMemo(() => {
    return schedule.find((week) => String(week.week_number) === String(selectedWeek));
  }, [schedule, selectedWeek]);

  // 判断周次是否已完成 (week_end < 当前日期)
  function isWeekCompleted(weekEndStr) {
    if (!weekEndStr) return false;
    const weekEndDate = new Date(weekEndStr);
    return new Date() > weekEndDate;
  }

  // 获取已完成的周次
  const completedWeeks = useMemo(() => {
    return (schedule || []).filter((week) => isWeekCompleted(week.week_end));
  }, [schedule]);

  // 计算 Weekly Best / Worst
  const weeklyBestWorstByCategory = useMemo(() => {
    if (completedWeeks.length === 0) return {};

    const result = {};
    const allCategories = [...(settings.batter_categories || []), ...(settings.pitcher_categories || [])];

    allCategories.forEach((category) => {
      const type = getCategoryType(category, settings);
      if (!type) return;
      const recordKey = getCategoryRecordKey(type, category);

      const entries = []; // { manager, value, managerName }

      completedWeeks.forEach((week) => {
        const weekKey = String(week.week_number);
        const weekRows = statsByWeekAndManager.get(weekKey) || new Map();

        managerList.forEach((manager) => {
          const row = weekRows.get(String(manager.manager_id));
          if (row) {
            const value = resolveCategoryValue(row, category, type);
            if (Number.isFinite(value)) {
              entries.push({
                manager,
                managerName: manager.displayName,
                value,
                week: week.week_number,
              });
            }
          }
        });
      });

      if (entries.length === 0) return;

      // 排序：lower is better 则升序，否则降序
      const isLower = isLowerBetter(category, type);
      entries.sort((a, b) => isLower ? a.value - b.value : b.value - a.value);

      // 取最佳3个和最差3个
      const best = entries.slice(0, 3);
      const worst = entries.slice(-3).reverse();

      result[recordKey] = { best, worst };
    });

    return result;
  }, [completedWeeks, managerList, statsByWeekAndManager, settings]);

  const totalMatchups = matchups.length;
  const weekCount = availableWeeks.length;
  const managerCount = managerList.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
          <div className="text-cyan-200 font-black tracking-[0.2em] uppercase text-sm">Loading Record Book</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-center px-4">
        <Card className="max-w-xl w-full border-red-500/20 bg-red-950/40 backdrop-blur-sm shadow-2xl shadow-black/40">
          <CardHeader>
            <CardTitle className="text-2xl font-black text-red-200">Failed to load record book</CardTitle>
          </CardHeader>
          <CardContent className="text-red-100">{error}</CardContent>
        </Card>
      </div>
    );
  }

  const selectedWeekRange = selectedWeekMeta
    ? `${selectedWeekMeta.week_start} to ${selectedWeekMeta.week_end}`
    : 'No week selected';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.15),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.16),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#111827_45%,_#0f172a_100%)] text-white">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <StatTable
            title="Season Totals - Batting"
            description="Frontend sums the raw weekly manager stats and recalculates rate categories from the season totals."
            categories={sectionData.batter}
            managers={managerList}
            totalsByManager={totalsByManager}
            type="batter"
          />

          <StatTable
            title="Season Totals - Pitching"
            description="Pitching totals are accumulated from weekly rows, with IP converted from baseball outs for correct season rates."
            categories={sectionData.pitcher}
            managers={managerList}
            totalsByManager={totalsByManager}
            type="pitcher"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <RecordTable
            title="Category Records - Batting"
            description="Each matchup week contributes one W/L/T per active batting category."
            categories={sectionData.batter}
            managers={managerList}
            recordsByManager={recordsByManager}
            type="batter"
          />

          <RecordTable
            title="Category Records - Pitching"
            description="Each matchup week contributes one W/L/T per active pitching category."
            categories={sectionData.pitcher}
            managers={managerList}
            recordsByManager={recordsByManager}
            type="pitcher"
          />
        </div>

        {completedWeeks.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-2">
            <AllCompletedWeeksBestWorst
              title="All Completed Weeks - Batting Best/Worst"
              description="Across all completed weeks, the top and bottom performer in each batting category."
              categories={sectionData.batter}
              weeklyBestWorstByCategory={weeklyBestWorstByCategory}
              type="batter"
            />

            <AllCompletedWeeksBestWorst
              title="All Completed Weeks - Pitching Best/Worst"
              description="Across all completed weeks, the top and bottom performer in each pitching category."
              categories={sectionData.pitcher}
              weeklyBestWorstByCategory={weeklyBestWorstByCategory}
              type="pitcher"
            />
          </div>
        )}
      </div>
    </div>
  );
}