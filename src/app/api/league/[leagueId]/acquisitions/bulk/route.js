import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

function parseLimit(limitStr) {
  const parsed = parseInt(limitStr, 10);
  if (Number.isNaN(parsed)) return Infinity;
  return parsed;
}

function formatDateRange(start, end) {
  if (!start || !end) return '';
  const startObj = new Date(start);
  const endObj = new Date(end);
  return `${startObj.getMonth() + 1}/${startObj.getDate()} - ${endObj.getMonth() + 1}/${endObj.getDate()}`;
}

export async function POST(request, { params }) {
  const { leagueId } = await params;

  try {
    let managerIds = [];

    try {
      const body = await request.json();
      if (Array.isArray(body?.manager_ids)) {
        managerIds = [...new Set(body.manager_ids.map((id) => String(id).trim()).filter(Boolean))];
      }
    } catch {
      managerIds = [];
    }

    if (managerIds.length === 0) {
      const { data: memberRows, error: membersError } = await supabase
        .from('league_members')
        .select('manager_id')
        .eq('league_id', leagueId);

      if (membersError) {
        throw membersError;
      }

      managerIds = [...new Set((memberRows || []).map((m) => String(m.manager_id).trim()).filter(Boolean))];
    }

    if (managerIds.length === 0) {
      return NextResponse.json({ success: true, acquisitionsByManager: {} });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('league_settings')
      .select('max_acquisitions_per_week')
      .eq('league_id', leagueId)
      .single();

    if (settingsError) {
      throw settingsError;
    }

    const baseLimit = parseLimit(settings?.max_acquisitions_per_week || 'No maximum');
    const todayTw = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

    const { data: week1, error: week1Error } = await supabase
      .from('league_schedule')
      .select('week_start')
      .eq('league_id', leagueId)
      .eq('week_number', 1)
      .single();

    if (week1Error && week1Error.code !== 'PGRST116') {
      throw week1Error;
    }

    const acquisitionsByManager = {};
    managerIds.forEach((managerId) => {
      acquisitionsByManager[managerId] = {
        usage: 0,
        limit: '-',
        remaining: '-',
        week: '',
      };
    });

    const isPreSeason = Boolean(week1?.week_start && todayTw < week1.week_start);

    if (isPreSeason) {
      managerIds.forEach((managerId) => {
        acquisitionsByManager[managerId] = {
          usage: 0,
          limit: 'No Maximum',
          remaining: 'Unlimited',
          week: 'Pre-season',
        };
      });
      return NextResponse.json({ success: true, acquisitionsByManager });
    }

    const { data: weekData, error: weekError } = await supabase
      .from('league_schedule')
      .select('week_start, week_end')
      .eq('league_id', leagueId)
      .lte('week_start', todayTw)
      .gte('week_end', todayTw)
      .single();

    if (weekError && weekError.code !== 'PGRST116') {
      throw weekError;
    }

    if (!weekData) {
      managerIds.forEach((managerId) => {
        acquisitionsByManager[managerId] = {
          usage: 0,
          limit: 0,
          remaining: 0,
          week: 'Off-season',
        };
      });
      return NextResponse.json({ success: true, acquisitionsByManager });
    }

    const { count: scheduleWeeksCount, error: weekCountError } = await supabase
      .from('league_schedule')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId)
      .gte('week_start', weekData.week_start)
      .lte('week_start', weekData.week_end);

    if (weekCountError) {
      throw weekCountError;
    }

    const multiplier = scheduleWeeksCount && scheduleWeeksCount > 0 ? scheduleWeeksCount : 1;
    const effectiveLimit = baseLimit === Infinity ? Infinity : baseLimit * multiplier;

    const startTw = new Date(`${weekData.week_start}T00:00:00+08:00`);
    const endTw = new Date(`${weekData.week_end}T23:59:59.999+08:00`);

    const { data: transactionRows, error: txError } = await supabase
      .from('transactions_2026')
      .select('manager_id')
      .eq('league_id', leagueId)
      .in('manager_id', managerIds)
      .in('transaction_type', ['ADD', 'WAIVER ADD'])
      .gte('transaction_time', startTw.toISOString())
      .lte('transaction_time', endTw.toISOString());

    if (txError) {
      throw txError;
    }

    const usageMap = {};
    (transactionRows || []).forEach((row) => {
      const managerId = String(row.manager_id);
      usageMap[managerId] = (usageMap[managerId] || 0) + 1;
    });

    const weekLabel = formatDateRange(weekData.week_start, weekData.week_end);

    managerIds.forEach((managerId) => {
      const usage = usageMap[managerId] || 0;
      const limitDisplay = effectiveLimit === Infinity ? 'No Maximum' : effectiveLimit;
      const remaining = effectiveLimit === Infinity ? 'Unlimited' : Math.max(0, effectiveLimit - usage);

      acquisitionsByManager[managerId] = {
        usage,
        limit: limitDisplay,
        remaining,
        week: weekLabel,
      };
    });

    return NextResponse.json({ success: true, acquisitionsByManager });
  } catch (error) {
    console.error('Error fetching bulk acquisitions:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
