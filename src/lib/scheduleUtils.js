// 計算聯盟周次
export const generateLeagueSchedule = (startScoringOn, playoffsStart, playoffsType) => {
  const schedule = [];
  const maxWeeks = 23; // 总共可用周次（week_id 1-23）
  const reservedWeek = 23; // 保留周（补赛周）
  const maxRegularAndPlayoff = 21; // 例行赛+季后赛不能超过21周（留1周给补赛）

  // 解析日期 (格式: YYYY.M.D)
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  };

  const startDate = parseDate(startScoringOn);
  if (!startDate) return { schedule: [], error: null };

  let weekNumber = 1;
  let currentDate = new Date(startDate);

  // 計算例行賽周次
  const playoffDate = parseDate(playoffsStart);
  const endDate = playoffDate || new Date(startDate.getFullYear(), 8, 30);

  while (currentDate < endDate && weekNumber < reservedWeek) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);

    if (playoffDate && weekEnd >= playoffDate) {
      weekEnd.setTime(playoffDate.getTime() - 86400000);
    }

    schedule.push({
      week_number: weekNumber,
      week_type: 'regular_season',
      week_label: `Week ${weekNumber}`,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
    });

    weekNumber++;
    currentDate.setDate(currentDate.getDate() + 7);

    if (playoffDate && currentDate >= playoffDate) {
      break;
    }
  }

  const regularSeasonWeeks = schedule.length;

  // 計算季後賽周次
  if (playoffsStart && playoffsType && playoffsType !== 'No playoffs') {
    const teamsMatch = playoffsType.match(/^(\d+) teams/);
    const weeksMatch = playoffsType.match(/(\d+) weeks?$/);
    const playoffTeams = teamsMatch ? parseInt(teamsMatch[1]) : 0;
    const playoffWeeks = weeksMatch ? parseInt(weeksMatch[1]) : 0;

    let playoffLabels = [];
    if (playoffTeams === 2) {
      playoffLabels = ['Final'];
    } else if (playoffTeams === 4) {
      playoffLabels = ['Semifinal', 'Final'];
    } else if (playoffTeams >= 5 && playoffTeams <= 8) {
      playoffLabels = ['Quarterfinal', 'Semifinal', 'Final'];
    }

    // 在季后赛前插入补赛周
    if (weekNumber < reservedWeek) {
      schedule.push({
        week_number: weekNumber,
        week_type: 'makeup',
        week_label: 'Makeup Week',
        week_start: playoffDate.toISOString().split('T')[0],
        week_end: new Date(playoffDate.getTime() + 6 * 86400000).toISOString().split('T')[0],
      });
      weekNumber++;
    }

    let playoffCurrentDate = new Date(playoffDate);
    playoffCurrentDate.setDate(playoffCurrentDate.getDate() + 7); // 跳过补赛周

    for (let i = 0; i < playoffWeeks; i++) {
      // 检查是否会超过保留周
      if (weekNumber >= reservedWeek) {
        return {
          schedule: [],
          error: `❌ Playoff configuration has too many weeks! Playoffs would exceed week ${reservedWeek - 1}. Please reduce playoff weeks or shorten regular season weeks. Current configuration: Regular Season ${regularSeasonWeeks} weeks + Makeup Week 1 week + Playoffs ${playoffWeeks} weeks = ${regularSeasonWeeks + 1 + playoffWeeks} weeks (maximum ${maxRegularAndPlayoff} weeks)`
        };
      }

      const weekStart = new Date(playoffCurrentDate);
      const weekEnd = new Date(playoffCurrentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);

      schedule.push({
        week_number: weekNumber,
        week_type: 'playoffs',
        week_label: playoffLabels[i] || `Playoff Week ${i + 1}`,
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
      });

      weekNumber++;
      playoffCurrentDate.setDate(playoffCurrentDate.getDate() + 7);
    }
  }

  // 檢查總周次是否超過限制
  const totalWeeks = schedule.length;
  if (totalWeeks > maxRegularAndPlayoff) {
    return {
      schedule: [],
      error: `❌ Schedule configuration exceeds limit! Total weeks is ${totalWeeks}, maximum allowed is ${maxRegularAndPlayoff} weeks (week ${reservedWeek} must be reserved as makeup week). Please adjust regular season or playoff settings.`
    };
  }

  return { schedule, error: null };
};
