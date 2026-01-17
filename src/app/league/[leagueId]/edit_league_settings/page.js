'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import supabase from '@/lib/supabase';

const cloneSettings = (settings) => JSON.parse(JSON.stringify(settings));

const baseSettings = {
  general: {
    'League Name': 'My League',
    'Draft Type': 'Live Draft',
    'Live Draft Pick Time': '1 Minute',
    'Live Draft Time': '',
    'Max Teams': '6',
    'Scoring Type': 'Head-to-Head',
  },
  acquisitions: {
    'Trade End Date': 'August 7, 2025',
    'Max Acquisitions per Week': '6',
  },
  waivers: {
    'Waiver Players Unfreeze Time': '2 days',
    'Allow injured players from waivers or free agents to be added directly to the injury slot': 'No',
    'Post Draft Players Unfreeze Time': '1 day',
  },
  trading: {
    'Trade Review': 'League votes',
    'Trade Reject Time': '2 days',
    'Trade Reject percentage needed': '50%',
  },
  roster: {
    'Min Innings pitched per team per week': '20',
    'Roster Positions': {
      'C': 1,
      '1B': 1,
      '2B': 1,
      '3B': 1,
      'SS': 1,
      'OF': 3,
      'Util': 2,
      'SP': 2,
      'RP': 2,
      'P': 4,
      'BN': 5,
      'Minor': 3,
    },
  },
  scoring: {
    'Start Scoring On': '2026.3.28',
    'Batter Stat Categories': [],
    'Pitcher Stat Categories': [],
  },
  playoffs: {
    'Playoffs': '4 teams - 2 weeks',
    'Playoffs start': '2026.9.14',
    'Playoff/ranking Tie-Breaker': 'Higher seed wins',
    'Playoff Reseeding': 'Yes',
    'Lock Eliminated Teams': 'Yes',
  },
  league: {
    'Make League Publicly Viewable': 'No',
    'Invite Permissions': 'Commissioner Only',
  },
};

const settingOptions = {
  'League Name': [],
  'Draft Type': ['Live Draft', 'Offline Draft'],
  'Live Draft Pick Time': ['30 Seconds', '1 Minute', '2 Minutes', '3 Minutes'],
  'Max Teams': ['4', '6', '8', '10'],
  'Scoring Type': ['Head-to-Head', 'Head-to-Head One Win', 'Head-to-Head Fantasy Points'],
  'Trade End Date': ['No trade deadline', 'June 15', 'July 1', 'July 15', 'August 1', 'August 7', 'August 15', 'August 30'],
  'Waiver Players Unfreeze Time': ['0 days', '1 day', '2 days', '3 days', '5 days', '7 days'],
  'Allow injured players from waivers or free agents to be added directly to the injury slot': ['Yes', 'No'],
  'Trade Review': ['League votes', 'Commissioner reviews', 'No review'],
  'Trade Reject Time': ['0 days', '1 day', '2 days', '3 days', '7 days'],
  'Trade Reject percentage needed': ['10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'],
  'Post Draft Players Unfreeze Time': ['1 day', '2 days', '3 days'],
  'Max Acquisitions per Week': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'No maximum'],
  'Min Innings pitched per team per week': ['0', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50'],
  'Start Scoring On': ['2026.3.28', '2026.4.6', '2026.4.13', '2026.4.20'],
  'Batter Stat Categories': [
    'Runs (R)',
    'Home Runs (HR)',
    'Runs Batted In (RBI)',
    'Stolen Bases (SB)',
    'Batting Average (AVG)',
    'Singles (1B)',
    'Doubles (2B)',
    'Triples (3B)',
    'At Bats (AB)',
    'Walks (BB)',
    'Hitting for the Cycle (CYC)',
    'Ground Into Double Play (GIDP)',
    'Games Played (GP)',
    'Hits (H)',
    'Hit By Pitch (HBP)',
    'On-base Percentage (OBP)',
    'On-base + Slugging Percentage (OPS)',
    'Plate Appearances (PA)',
    'Sacrifice Flies (SF)',
    'Sacrifice Hits (SH)',
    'Grand Slam Home Runs (SLAM)',
    'Slugging Percentage (SLG)',
    'Total Bases (TB)',
    'Extra Base Hits (XBH)',
  ],
  'Pitcher Stat Categories': [
    'Wins (W)',
    'Saves (SV)',
    'Strikeouts (K)',
    'Earned Run Average (ERA)',
    '(Walks + Hits)/ Innings Pitched (WHIP)',
    'Appearances (APP)',
    'Walks Per Nine Innings (BB/9)',
    'Walks (BB)',
    'Complete Games (CG)',
    'Earned Runs (ER)',
    'Batters Grounded Into Double Plays (GIDP)',
    'Games Started (GS)',
    'Hits Per Nine Innings (H/9)',
    'Hits (H)',
    'Hit Batters (HBP)',
    'Holds (HLD)',
    'Home Runs (HR)',
    'Intentional Walks (IBB)',
    'Innings Pitched (IP)',
    'Strikeouts per Nine Innings (K/9)',
    'Strikeout to Walk Ratio (K/BB)',
    'Losses (L)',
    'No Hitters (NH)',
    'Saves + Holds (SV+HLD)',
    'On-base Percentage Against (OBPA)',
    'Outs (OUT)',
    'Pitch Count (PC)',
    'Perfect Games (PG)',
    'Quality Starts (QS)',
    'Relief Appearances (RAPP)',
    'Relief Losses (RL)',
    'Relief Wins (RW)',
    'Shutouts (SHO)',
    'Total Bases Allowed (TB)',
    'Total Batters Faced (TBF)',
    'Winning Percentage (WIN%)',
  ],
  'Playoffs': ['2 teams - 1 week', '4 teams - 2 weeks', '6 teams - 3 weeks', '8 teams - 4 weeks'],
  'Playoffs start': ['2026.8.24', '2026.8.31', '2026.9.7', '2026.9.14', '2026.9.21'],
  'Playoff/ranking Tie-Breaker': ['Higher seed wins', 'Better record wins', 'Head-to-head'],
  'Playoff Reseeding': ['Yes', 'No'],
  'Lock Eliminated Teams': ['Yes', 'No'],
  'Make League Publicly Viewable': ['Yes', 'No'],
  'Invite Permissions': ['Commissioner Only', 'Managers can invite'],
};

const sections = [
  { key: 'general', label: 'General Settings', icon: '⚙️' },
  { key: 'acquisitions', label: 'Acquisitions & Trading', icon: '🔄' },
  { key: 'waivers', label: 'Waiver Settings', icon: '📋' },
  { key: 'trading', label: 'Trade Settings', icon: '🤝' },
  { key: 'roster', label: 'Roster Settings', icon: '👥' },
  { key: 'scoring', label: 'Scoring Settings', icon: '📊' },
  { key: 'playoffs', label: 'Playoff Settings', icon: '🏆' },
  { key: 'league', label: 'League Settings', icon: '🏟️' },
];

// SchedulePreview 元件：根據設定值實時推算schedule_date表中的週次
function SchedulePreview({ leagueId, settings, onValidationChange }) {
  const [allScheduleData, setAllScheduleData] = useState([]);
  const [scheduleValidationError, setScheduleValidationError] = useState('');
  const [filteredSchedule, setFilteredSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 首次載入所有 schedule_date 資料
  useEffect(() => {
    const fetchAllSchedule = async () => {
      try {
        setLoading(true);
        const { data, error: queryError } = await supabase
          .from('schedule_date')
          .select('*')
          .order('week_id', { ascending: true });

        if (queryError) {
          setError('Failed to load schedule data');
          setAllScheduleData([]);
          return;
        }

        setAllScheduleData(data || []);
        setError(null);
      } catch (err) {
        setError('Error fetching schedule');
        setAllScheduleData([]);
      } finally {
        setLoading(false);
      }
    };

    if (leagueId) {
      fetchAllSchedule();
    }
  }, [leagueId]);

  // 當設定改變時，即時篩選週次並加入季後賽推算
  useEffect(() => {
    if (!allScheduleData || allScheduleData.length === 0) {
      setFilteredSchedule([]);
      return;
    }

    const startScoringOn = settings?.scoring?.['Start Scoring On'];
    const playoffsStart = settings?.playoffs?.['Playoffs start'];
    const playoffsType = settings?.playoffs?.['Playoffs'];

    if (!startScoringOn) {
      setFilteredSchedule([]);
      return;
    }

    // 解析日期 (格式: YYYY.M.D)
    const parseDate = (dateStr) => {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const parts = dateStr.split('.');
      if (parts.length !== 3) return null;
      
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      
      // 檢查是否為有效數字
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
      
      const date = new Date(year, month, day);
      // 檢查日期是否有效
      if (isNaN(date.getTime())) return null;
      
      return date;
    };

    const startDate = parseDate(startScoringOn);
    const endDate = playoffsStart ? parseDate(playoffsStart) : null;

    if (!startDate) {
      setFilteredSchedule([]);
      return;
    }

    // 計算季後賽週次標籤
    let playoffLabels = [];
    if (playoffsStart && playoffsType && playoffsType !== 'No playoffs') {
      const teamsMatch = playoffsType.match(/^(\d+) teams/);
      const weeksMatch = playoffsType.match(/(\d+) weeks?$/);
      const playoffTeams = teamsMatch ? parseInt(teamsMatch[1]) : 0;
      const playoffWeeks = weeksMatch ? parseInt(weeksMatch[1]) : 0;

      if (playoffTeams === 2) {
        playoffLabels = ['Final'];
      } else if (playoffTeams === 4) {
        playoffLabels = ['Semifinal', 'Final'];
      } else if (playoffTeams === 6) {
        playoffLabels = ['Quarterfinal', 'Semifinal', 'Final'];
      } else if (playoffTeams >= 8) {
        playoffLabels = ['First Round', 'Quarterfinal', 'Semifinal', 'Final'];
      }
    }

    // 找出補賽預備週 (季後賽開始前一週)
    const playoffStartDate = endDate;
    let makeupWeek = null;
    if (playoffStartDate && playoffLabels.length > 0) {
      makeupWeek = allScheduleData.find((week) => {
        const weekEnd = new Date(week.week_end);
        return weekEnd >= new Date(playoffStartDate.getTime() - 24 * 60 * 60 * 1000);
      });
    }

    // 篩選從 startDate 開始，但不包含補賽預備週的週次
    const regularSeasonWeeks = allScheduleData.filter((week) => {
      const weekStart = new Date(week.week_start);

      // 週次開始日期必須 >= startScoringOn
      if (weekStart < startDate) {
        return false;
      }

      // 不包含補賽預備週
      if (makeupWeek && week.week_id === makeupWeek.week_id) {
        return false;
      }

      // 如果有 playoffsStart，週次必須在季後賽前結束
      if (endDate && weekStart >= endDate) {
        return false;
      }

      return true;
    });

    // 組織最終的週次列表，計算相對週號
    let weekCounter = 1;
    const scheduleWithTypes = regularSeasonWeeks.map((week) => {
      const label = `Week ${weekCounter}`;
      weekCounter++;
      return {
        ...week,
        week_type: 'regular_season',
        week_label: label,
      };
    });

    // 如果有季後賽，加入補賽預備週和季後賽週次
    if (playoffStartDate && playoffLabels.length > 0 && makeupWeek) {
      scheduleWithTypes.push({
        ...makeupWeek,
        week_type: 'makeup',
        week_label: 'Makeup Preparation Week',
      });

      // 加入季後賽週次，跳過week_id=23
      const allPlayoffWeeks = allScheduleData
        .filter((week) => {
          const weekStart = new Date(week.week_start);
          return weekStart >= playoffStartDate && week.week_id !== 23;
        })
        .slice(0, playoffLabels.length);

      allPlayoffWeeks.forEach((week, index) => {
        scheduleWithTypes.push({
          ...week,
          week_type: 'playoffs',
          week_label: playoffLabels[index] || `Playoff ${index + 1}`,
        });
      });

      // 加入Preparation Week (在季後賽後)
      const afterPlayoffWeeks = allScheduleData
        .filter((week) => {
          const weekStart = new Date(week.week_start);
          return weekStart > new Date(allPlayoffWeeks[allPlayoffWeeks.length - 1]?.week_end || playoffStartDate);
        })
        .slice(0, 1);

      afterPlayoffWeeks.forEach((week) => {
        scheduleWithTypes.push({
          ...week,
          week_type: 'preparation',
          week_label: 'Preparation Week',
        });
      });

      // 驗證季後賽週次是否足夠
      const weeksMatch = playoffsType.match(/(\d+) weeks?$/);
      if (weeksMatch) {
        const requiredPlayoffWeeks = parseInt(weeksMatch[1]);
        if (allPlayoffWeeks.length < requiredPlayoffWeeks) {
          const errorMsg = `Playoff schedule cannot complete by Week 22. Starting from ${playoffsStart}, only ${allPlayoffWeeks.length} week(s) available but ${requiredPlayoffWeeks} week(s) required. Week 23 is reserved for makeup games.`;
          setScheduleValidationError(errorMsg);
          if (onValidationChange) onValidationChange(errorMsg);
        } else {
          setScheduleValidationError('');
          if (onValidationChange) onValidationChange('');
        }
      }
    } else {
      setScheduleValidationError('');
      if (onValidationChange) onValidationChange('');
    }

    setFilteredSchedule(scheduleWithTypes);
  }, [allScheduleData, settings, onValidationChange]);

  if (loading) {
    return (
      <div className="mb-8 p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">📅 Schedule Preview</h2>
        <p className="text-purple-300">Loading schedule data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8 p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">📅 Schedule Preview</h2>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!settings?.scoring?.['Start Scoring On']) {
    return (
      <div className="mb-8 p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">📅 Schedule Preview</h2>
        <p className="text-purple-300">Please set &quot;Start Scoring On&quot; to see the schedule preview</p>
      </div>
    );
  }

  if (filteredSchedule.length === 0) {
    return (
      <div className="mb-8 p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">📅 Schedule Preview</h2>
        <p className="text-purple-300">No schedule data available for the selected dates</p>
      </div>
    );
  }

  return (
    <div className="mb-8 p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl">
      <h2 className="text-2xl font-bold text-white mb-4">📅 Schedule Preview</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-800/60 border-b-2 border-purple-500/30">
              <th className="px-4 py-2 text-left font-semibold text-purple-300">Week</th>
              <th className="px-4 py-2 text-left font-semibold text-purple-300">Type</th>
              <th className="px-4 py-2 text-left font-semibold text-purple-300">Start Date</th>
              <th className="px-4 py-2 text-left font-semibold text-purple-300">End Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchedule.map((week, index) => (
              <tr
                key={index}
                className={`border-b border-purple-500/20 ${
                  week.week_type === 'playoffs'
                    ? 'bg-purple-500/20 hover:bg-purple-500/30'
                    : week.week_type === 'makeup'
                    ? 'bg-yellow-500/20 hover:bg-yellow-500/30'
                    : week.week_type === 'preparation'
                    ? 'bg-green-500/20 hover:bg-green-500/30'
                    : 'bg-slate-800/20 hover:bg-slate-800/40'
                }`}
              >
                <td className="px-4 py-2 text-white font-medium">{week.week_label}</td>
                <td className="px-4 py-2 text-purple-200">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    week.week_type === 'playoffs'
                      ? 'bg-purple-500/80 text-purple-100'
                      : week.week_type === 'makeup'
                      ? 'bg-yellow-500/80 text-yellow-100'
                      : week.week_type === 'preparation'
                      ? 'bg-green-500/80 text-green-100'
                      : 'bg-blue-500/80 text-blue-100'
                  }`}>
                    {week.week_type === 'playoffs' ? 'Playoffs' : week.week_type === 'makeup' ? 'Makeup' : week.week_type === 'preparation' ? 'Preparation' : 'Regular'}
                  </span>
                </td>
                <td className="px-4 py-2 text-purple-200">{week.week_start}</td>
                <td className="px-4 py-2 text-purple-200">{week.week_end}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {scheduleValidationError && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-300">
            <p className="font-semibold">❌ {scheduleValidationError}</p>
          </div>
        )}
        <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded text-sm text-purple-200">
          <p className="font-semibold">Total: {filteredSchedule.length} weeks</p>
        </div>
      </div>
    </div>
  );
}

const isoToLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => `${n}`.padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
};

const mapDbToSettings = (data) => ({
  general: {
    'League Name': data.league_name ?? baseSettings.general['League Name'],
    'Draft Type': data.draft_type ?? baseSettings.general['Draft Type'],
    'Live Draft Pick Time': data.live_draft_pick_time ?? baseSettings.general['Live Draft Pick Time'],
    'Live Draft Time': isoToLocalInput(data.live_draft_time) ?? baseSettings.general['Live Draft Time'],
    'Max Teams': data.max_teams?.toString() ?? baseSettings.general['Max Teams'],
    'Scoring Type': data.scoring_type ?? baseSettings.general['Scoring Type'],
  },
  acquisitions: {
    'Trade End Date': data.trade_end_date ?? baseSettings.acquisitions['Trade End Date'],
    'Max Acquisitions per Week': data.max_acquisitions_per_week?.toString() ?? baseSettings.acquisitions['Max Acquisitions per Week'],
  },
  waivers: {
    'Waiver Players Unfreeze Time': data.waiver_players_unfreeze_time ?? baseSettings.waivers['Waiver Players Unfreeze Time'],
    'Allow injured players from waivers or free agents to be added directly to the injury slot': data.allow_injured_to_injury_slot ?? baseSettings.waivers['Allow injured players from waivers or free agents to be added directly to the injury slot'],
    'Post Draft Players Unfreeze Time': data.post_draft_players_unfreeze_time ?? baseSettings.waivers['Post Draft Players Unfreeze Time'],
  },
  trading: {
    'Trade Review': data.trade_review ?? baseSettings.trading['Trade Review'],
    'Trade Reject Time': data.trade_reject_time ?? baseSettings.trading['Trade Reject Time'],
    'Trade Reject percentage needed': data.trade_reject_percentage ?? baseSettings.trading['Trade Reject percentage needed'],
  },
  roster: {
    'Min Innings pitched per team per week': data.min_innings_pitched_per_week?.toString() ?? baseSettings.roster['Min Innings pitched per team per week'],
    'Roster Positions': data.roster_positions ?? baseSettings.roster['Roster Positions'],
  },
  scoring: {
    'Start Scoring On': data.start_scoring_on ?? baseSettings.scoring['Start Scoring On'],
    'Batter Stat Categories': data.batter_stat_categories ?? baseSettings.scoring['Batter Stat Categories'],
    'Pitcher Stat Categories': data.pitcher_stat_categories ?? baseSettings.scoring['Pitcher Stat Categories'],
  },
  playoffs: {
    'Playoffs': data.playoffs ?? baseSettings.playoffs['Playoffs'],
    'Playoffs start': data.playoffs_start ?? baseSettings.playoffs['Playoffs start'],
    'Playoff/ranking Tie-Breaker': data.playoff_tie_breaker ?? baseSettings.playoffs['Playoff/ranking Tie-Breaker'],
    'Playoff Reseeding': data.playoff_reseeding ?? baseSettings.playoffs['Playoff Reseeding'],
    'Lock Eliminated Teams': data.lock_eliminated_teams ?? baseSettings.playoffs['Lock Eliminated Teams'],
  },
  league: {
    'Make League Publicly Viewable': data.make_league_publicly_viewable ?? baseSettings.league['Make League Publicly Viewable'],
    'Invite Permissions': data.invite_permissions ?? baseSettings.league['Invite Permissions'],
  },
});

const EditLeagueSettingsPage = ({ params }) => {
  const { leagueId } = params;
  const [settings, setSettings] = useState(() => cloneSettings(baseSettings));
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  const handleScheduleValidation = (error) => {
    setScheduleError(error);
  };

  const handleSettingChange = (section, key, value) => {
    setSettings((prev) => {
      const next = { ...prev };
      next[section] = { ...prev[section], [key]: value };

      if (section === 'general' && key === 'Draft Type' && value !== 'Live Draft') {
        next.general['Live Draft Pick Time'] = '';
        next.general['Live Draft Time'] = '';
      }

      return next;
    });
  };

  const isMultilineField = (key) => {
    return [].includes(key);
  };

  const isMultiSelectField = (key) => {
    return ['Batter Stat Categories', 'Pitcher Stat Categories'].includes(key);
  };

  const isTextField = (key) => {
    return ['League Name'].includes(key);
  };

  const isDateTimeField = (key) => key === 'Live Draft Time';

  // Validate Live Draft Time and Start Scoring On
  const validateDraftAndScoringDates = () => {
    const liveDraftTime = settings.general['Live Draft Time'];
    const startScoringOn = settings.scoring['Start Scoring On'];
    
    console.log('=== Date Validation Check ===');
    console.log('Live Draft Time (input):', liveDraftTime);
    console.log('Start Scoring On (input):', startScoringOn);
    
    const errors = {
      draftTimeError: '',
      scoringDateError: ''
    };

    // Check if Start Scoring On is not in the past (Taiwan time)
    if (startScoringOn) {
      console.log('\n--- Checking Start Scoring On (must be future date) ---');
      const parts = startScoringOn.split('.');
      
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        console.log('Parsed Start Scoring On:', { year, month, day });
        
        // 檢查是否為有效數字
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const scoringDate = new Date(year, month, day);
          
          // 檢查日期是否有效
          if (!isNaN(scoringDate.getTime())) {
            console.log('Scoring Date object:', scoringDate);
            console.log('Scoring Date (Taiwan time):', scoringDate.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            console.log('Today (00:00:00):', today.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
            console.log('Today timestamp:', today.getTime());
            console.log('Scoring Date timestamp:', scoringDate.getTime());
            
            if (scoringDate <= today) {
              errors.scoringDateError = 'Start Scoring On must be a future date';
              console.log('❌ FAIL: Start Scoring On is NOT a future date');
            } else {
              console.log('✅ PASS: Start Scoring On is a future date');
            }
          } else {
            errors.scoringDateError = 'Start Scoring On has an invalid date';
            console.log('❌ FAIL: Start Scoring On date is invalid');
          }
        } else {
          errors.scoringDateError = 'Start Scoring On has invalid format';
          console.log('❌ FAIL: Start Scoring On has invalid numbers');
        }
      } else {
        errors.scoringDateError = 'Start Scoring On must be in YYYY.M.D format';
        console.log('❌ FAIL: Start Scoring On format is incorrect');
      }
    }

    // Check if Live Draft Time is at least 2 days before Start Scoring On (Taiwan time)
    if (liveDraftTime && startScoringOn && settings.general['Draft Type'] === 'Live Draft') {
      console.log('\n--- Checking Live Draft Time (must be at least 2 days before Start Scoring On) ---');
      
      // Parse Live Draft Time (local datetime-local input, treat as Taiwan time)
      const draftDateTime = new Date(liveDraftTime);
      
      // 檢查 draftDateTime 是否有效
      if (!isNaN(draftDateTime.getTime())) {
        console.log('Draft DateTime object:', draftDateTime);
        console.log('Draft DateTime (Taiwan time):', draftDateTime.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
        console.log('Draft DateTime timestamp:', draftDateTime.getTime());
        
        // 檢查 1: Live Draft Time 必須至少是明天 0:00
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        console.log('Tomorrow (00:00:00):', tomorrow.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
        console.log('Tomorrow timestamp:', tomorrow.getTime());
        
        if (draftDateTime < tomorrow) {
          errors.draftTimeError = 'Live Draft Time must be at least tomorrow (00:00)';
          console.log('❌ FAIL: Live Draft Time is before tomorrow');
        } else {
          console.log('✅ PASS: Live Draft Time is at least tomorrow');
        }
        
        // 檢查 2: Live Draft Time 必須至少在 Start Scoring On 的 2 天前
        if (!errors.draftTimeError) {
          // Parse Start Scoring On (format: YYYY.M.D, treat as Taiwan time 00:00:00)
          const parts = startScoringOn.split('.');
          if (parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            
            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
              const scoringDate = new Date(year, month, day);
              
              if (!isNaN(scoringDate.getTime())) {
                scoringDate.setHours(0, 0, 0, 0);
                console.log('Scoring Date (00:00:00):', scoringDate.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
                
                // Calculate the latest allowed draft time (2 days before scoring date, end of day)
                const latestDraftDate = new Date(scoringDate);
                latestDraftDate.setDate(latestDraftDate.getDate() - 2);
                latestDraftDate.setHours(23, 59, 59, 999);
                console.log('Latest Allowed Draft Date (2 days before, 23:59:59):', latestDraftDate.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
                console.log('Latest Allowed Draft Date timestamp:', latestDraftDate.getTime());
                
                console.log('Comparison: draftDateTime > latestDraftDate?', draftDateTime > latestDraftDate);
                console.log('Difference in milliseconds:', draftDateTime.getTime() - latestDraftDate.getTime());
                console.log('Difference in hours:', (draftDateTime.getTime() - latestDraftDate.getTime()) / (1000 * 60 * 60));
                
                if (draftDateTime > latestDraftDate) {
                  errors.draftTimeError = 'Live Draft Time must be at least 2 days before season start';
                  console.log('❌ FAIL: Live Draft Time is TOO LATE');
                } else {
                  console.log('✅ PASS: Live Draft Time is at least 2 days before season start');
                }
              } else {
                errors.draftTimeError = 'Start Scoring On date is invalid';
                console.log('❌ FAIL: Start Scoring On date is invalid');
              }
            }
          }
        }
      } else {
        errors.draftTimeError = 'Live Draft Time is invalid';
        console.log('❌ FAIL: Live Draft Time is invalid');
      }
    }

    console.log('\n=== Validation Errors ===');
    console.log('scoringDateError:', errors.scoringDateError || 'none');
    console.log('draftTimeError:', errors.draftTimeError || 'none');
    console.log('=========================\n');

    return errors;
  };

  const dateValidationErrors = validateDraftAndScoringDates();

  const minDraftDateTime = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    const pad = (n) => `${n}`.padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    return `${y}-${m}-${day}T00:00`;
  };

  const isRosterPositions = (key) => {
    return key === 'Roster Positions';
  };

  const isFieldDisabled = (section, key) => {
    // League Name can always be edited
    if (key === 'League Name') {
      return false;
    }

    // pre-draft: no restrictions
    if (status === 'pre-draft') {
      return false;
    }

    // post-draft & pre-season: restrict specific fields
    const postDraftRestrictedFields = [
      'Draft Type',
      'Start Scoring On',
      'Live Draft Pick Time',
      'Live Draft Time',
      'Max Teams',
      'Scoring Type',
      'Post Draft Players Unfreeze Time',
      'Roster Positions',
      'Batter Stat Categories',
      'Pitcher Stat Categories',
      'Make League Publicly Viewable',
      'Invite Permissions',
    ];

    if (status === 'post-draft & pre-season') {
      return postDraftRestrictedFields.includes(key);
    }

    // in-season: restrict all fields except League Name
    if (status === 'in-season') {
      return true;
    }

    return false;
  };

  const handleMultiSelectChange = (section, key, option, checked) => {
    setSettings((prev) => {
      const current = Array.isArray(prev[section][key]) ? prev[section][key] : [];
      const next = checked
        ? Array.from(new Set([...current, option]))
        : current.filter((o) => o !== option);
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [key]: next,
        },
      };
    });
  };

  const handleRosterPositionChange = (position, value) => {
    const numValue = parseInt(value) || 0;
    setSettings((prev) => ({
      ...prev,
      roster: {
        ...prev.roster,
        'Roster Positions': {
          ...prev.roster['Roster Positions'],
          [position]: numValue,
        },
      },
    }));
  };

  const validateSettings = () => {
    const errors = [];

    // Validate League Name
    if (!settings.general['League Name'] || settings.general['League Name'].trim() === '') {
      errors.push('❌ League Name is required');
    }

    // Validate Max Teams
    if (!settings.general['Max Teams']) {
      errors.push('❌ Max Teams is required');
    }

    // Validate Scoring Type
    if (!settings.general['Scoring Type']) {
      errors.push('❌ Scoring Type is required');
    }

    // Validate Draft Type
    if (!settings.general['Draft Type']) {
      errors.push('❌ Draft Type is required');
    }

    // Validate Live Draft fields when Draft Type is Live Draft
    if (settings.general['Draft Type'] === 'Live Draft') {
      if (!settings.general['Live Draft Pick Time']) {
        errors.push('❌ Live Draft Pick Time is required');
      }
      if (!settings.general['Live Draft Time']) {
        errors.push('❌ Live Draft Time is required');
      }
    }

    // Validate Trade End Date
    if (!settings.acquisitions['Trade End Date']) {
      errors.push('❌ Trade End Date is required');
    }

    // Validate Max Acquisitions per Week
    if (!settings.acquisitions['Max Acquisitions per Week']) {
      errors.push('❌ Max Acquisitions per Week is required');
    }

    // Validate Waiver Players Unfreeze Time
    if (!settings.waivers['Waiver Players Unfreeze Time']) {
      errors.push('❌ Waiver Players Unfreeze Time is required');
    }

    // Validate Post Draft Players Unfreeze Time
    if (!settings.waivers['Post Draft Players Unfreeze Time']) {
      errors.push('❌ Post Draft Players Unfreeze Time is required');
    }

    // Validate Trade Review
    if (!settings.trading['Trade Review']) {
      errors.push('❌ Trade Review is required');
    }

    // Validate Trade Reject fields when Trade Review is not No review
    if (settings.trading['Trade Review'] !== 'No review') {
      if (!settings.trading['Trade Reject Time']) {
        errors.push('❌ Trade Reject Time is required');
      }
      if (!settings.trading['Trade Reject percentage needed']) {
        errors.push('❌ Trade Reject percentage needed is required');
      }
    }

    // Validate Min Innings pitched per team per week
    if (!settings.roster['Min Innings pitched per team per week']) {
      errors.push('❌ Min Innings pitched per team per week is required');
    }

    // Validate Roster Positions
    const nonMinorTotal = Object.entries(settings.roster['Roster Positions'])
      .filter(([pos]) => pos !== 'Minor')
      .reduce((sum, [, cnt]) => sum + cnt, 0);
    const minorCount = settings.roster['Roster Positions']['Minor'] || 0;

    if (nonMinorTotal > 25) {
      errors.push('❌ Non-Minor total positions cannot exceed 25');
    }
    if (minorCount > 5) {
      errors.push('❌ Minor positions cannot exceed 5');
    }
    if (nonMinorTotal === 0) {
      errors.push('❌ At least one non-Minor roster position is required');
    }

    // Validate Start Scoring On
    if (!settings.scoring['Start Scoring On']) {
      errors.push('❌ Start Scoring On is required');
    }

    // Validate date constraints
    const dateErrors = validateDraftAndScoringDates();
    if (dateErrors.scoringDateError) {
      errors.push(`❌ ${dateErrors.scoringDateError}`);
    }
    if (dateErrors.draftTimeError) {
      errors.push(`❌ ${dateErrors.draftTimeError}`);
    }

    // Validate Batter Stat Categories
    if (!Array.isArray(settings.scoring['Batter Stat Categories']) || settings.scoring['Batter Stat Categories'].length === 0) {
      errors.push('❌ At least one Batter Stat Category is required');
    }

    // Validate Pitcher Stat Categories
    if (!Array.isArray(settings.scoring['Pitcher Stat Categories']) || settings.scoring['Pitcher Stat Categories'].length === 0) {
      errors.push('❌ At least one Pitcher Stat Category is required');
    }

    // Validate Playoffs
    if (!settings.playoffs['Playoffs']) {
      errors.push('❌ Playoffs setting is required');
    }

    // Validate Playoff fields
    if (settings.playoffs['Playoffs']) {
      // Extract playoff teams count from format like "4 teams - 2 weeks"
      const playoffMatch = settings.playoffs['Playoffs'].match(/^(\d+) teams/);
      const weeksMatch = settings.playoffs['Playoffs'].match(/(\d+) weeks?$/);
      if (playoffMatch) {
        const playoffTeams = parseInt(playoffMatch[1]);
        const maxTeams = parseInt(settings.general['Max Teams']);
        if (playoffTeams > maxTeams) {
          errors.push(`❌ Playoff teams (${playoffTeams}) cannot exceed Max Teams (${maxTeams})`);
        }
      }

      if (!settings.playoffs['Playoffs start']) {
        errors.push('❌ Playoffs start date is required');
      }
      if (!settings.playoffs['Playoff/ranking Tie-Breaker']) {
        errors.push('❌ Playoff/ranking Tie-Breaker is required');
      }
      if (!settings.playoffs['Playoff Reseeding']) {
        errors.push('❌ Playoff Reseeding is required');
      }
      if (!settings.playoffs['Lock Eliminated Teams']) {
        errors.push('❌ Lock Eliminated Teams is required');
      }
    }

    // Validate League settings
    if (!settings.league['Make League Publicly Viewable']) {
      errors.push('❌ Make League Publicly Viewable setting is required');
    }
    if (!settings.league['Invite Permissions']) {
      errors.push('❌ Invite Permissions setting is required');
    }

    return errors;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get current user ID from cookie
        const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
        const currentUserId = cookie?.split('=')[1];
        
        if (!currentUserId) {
          setError('Not authenticated. Please login.');
          setLoading(false);
          return;
        }

        // Fetch league data to check user role
        const leagueResponse = await fetch(`/api/league/${leagueId}`);
        const leagueResult = await leagueResponse.json();
        
        if (!leagueResponse.ok || !leagueResult.success) {
          setError(leagueResult.error || 'Failed to load league data');
          setLoading(false);
          return;
        }

        // Check if user is a member and has proper role
        const currentMember = leagueResult.members?.find(m => m.manager_id === currentUserId);
        
        if (!currentMember) {
          setError('You are not a member of this league');
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        const userRole = currentMember.role;
        setCurrentUserRole(userRole);

        if (userRole !== 'Commissioner' && userRole !== 'Co-Commissioner') {
          setError('Access denied. Only Commissioner or Co-Commissioner can edit league settings.');
          setIsAuthorized(false);
          setLoading(false);
          return;
        }

        setIsAuthorized(true);

        // Fetch league settings
        const res = await fetch(`/api/league-settings?league_id=${leagueId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || 'Failed to load league settings');
          setLoading(false);
          return;
        }
        setSettings(mapDbToSettings(json.data));
        setStatus(json.status || '');
      } catch (err) {
        setError(err.message || 'Failed to load league settings');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId]);

  const handleSave = async () => {
    const validationErrors = validateSettings();
    if (validationErrors.length > 0) {
      setSaveMessage(validationErrors.join('\n'));
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      const response = await fetch('/api/league-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ league_id: leagueId, settings }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSaveMessage(`✅ ${result.message}`);
        // Redirect to league page after successful save
        setTimeout(() => {
          window.location.href = `/league/${leagueId}`;
        }, 1500);
      } else {
        setSaveMessage(`❌ Update failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Update error:', err);
      setSaveMessage(`❌ Update failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl text-purple-300">Loading league settings...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8 flex items-center justify-center">
        <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 backdrop-blur-lg border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <div className="text-2xl font-bold text-red-300 mb-4">Access Denied</div>
          <div className="text-red-400 mb-6">{error}</div>
          <a
            href="/home"
            className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
            <h1 className="text-5xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent mb-4">Edit League Settings</h1>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/30 text-purple-200 text-sm font-semibold border border-purple-500/50">
              <span>Status:</span>
              <span>{status || 'unknown'}</span>
            </div>
          </div>

          <div className="space-y-8">
            {sections.map((section) => (
              <div key={section.key} className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600/80 to-cyan-600/80 backdrop-blur-sm p-6 border-b border-blue-400/30">
                  <h2 className="flex items-center gap-3 text-3xl font-black text-white">
                    <span className="text-2xl">{section.icon}</span>
                    {section.label}
                  </h2>
                </div>
                <div className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <tbody>
                        {Object.entries(settings[section.key]).map(([key, value], index) => {
                          if (
                            section.key === 'playoffs' &&
                            settings.playoffs['Playoffs'] === 'No playoffs' &&
                            ['Playoffs start', 'Playoff Reseeding', 'Lock Eliminated Teams'].includes(key)
                          ) {
                            return null;
                          }
                          if (section.key === 'trading' && key !== 'Trade Review' && settings.trading['Trade Review'] === 'No review') {
                            return null;
                          }
                          if (
                            section.key === 'general' &&
                            settings.general['Draft Type'] !== 'Live Draft' &&
                            ['Live Draft Pick Time', 'Live Draft Time'].includes(key)
                          ) {
                            return null;
                          }
                          return (
                          <tr
                            key={key}
                            className={`${
                              index % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-800/40'
                            } hover:bg-purple-500/20 transition-colors border-b border-purple-500/20`}
                          >
                            <td className="px-6 py-4 font-bold text-purple-200 w-2/5">
                              {key}
                            </td>
                            <td className="px-6 py-4 text-purple-300 w-3/5">
                              {isMultilineField(key) ? (
                                <div>
                                  <textarea
                                    value={value}
                                    onChange={(e) =>
                                      handleSettingChange(section.key, key, e.target.value)
                                    }
                                    disabled={isFieldDisabled(section.key, key)}
                                    rows="3"
                                    className={`w-full px-3 py-2 bg-slate-800/60 border rounded-md text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm disabled:bg-slate-700/40 disabled:cursor-not-allowed disabled:text-gray-500 ${
                                      !isFieldDisabled(section.key, key) && (!value || value.trim() === '')
                                        ? 'border-red-500 bg-red-900/30'
                                        : 'border-purple-500/30'
                                    }`}
                                  />
                                  {!isFieldDisabled(section.key, key) && (!value || value.trim() === '') && (
                                    <p className="text-red-600 text-sm mt-1">required</p>
                                  )}
                                </div>
                              ) : isDateTimeField(key) ? (
                                <div>
                                  <input
                                    type="datetime-local"
                                    min={minDraftDateTime()}
                                    value={value}
                                    onChange={(e) => handleSettingChange(section.key, key, e.target.value)}
                                    disabled={settings.general['Draft Type'] !== 'Live Draft' || isFieldDisabled(section.key, key)}
                                    className={`w-full px-3 py-2 bg-slate-800/60 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-700/40 disabled:cursor-not-allowed disabled:text-gray-500 ${
                                      ((settings.general['Draft Type'] === 'Live Draft' && !isFieldDisabled(section.key, key)) && (!value || value.trim() === '')) || dateValidationErrors.draftTimeError
                                        ? 'border-red-500 bg-red-900/30'
                                        : 'border-purple-500/30'
                                    }`}
                                  />
                                  {(settings.general['Draft Type'] === 'Live Draft' && !isFieldDisabled(section.key, key)) && (!value || value.trim() === '') && (
                                    <p className="text-red-600 text-sm mt-1">required</p>
                                  )}
                                  {(settings.general['Draft Type'] === 'Live Draft' && !isFieldDisabled(section.key, key)) && value && dateValidationErrors.draftTimeError && (
                                    <p className="text-red-600 text-sm mt-1">{dateValidationErrors.draftTimeError}</p>
                                  )}
                                </div>
                              ) : isRosterPositions(key) ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {Object.entries(value).map(([position, count]) => {
                                      const nonMinorTotal = Object.entries(value)
                                        .filter(([pos]) => pos !== 'Minor')
                                        .reduce((sum, [, cnt]) => sum + cnt, 0);
                                      const minorCount = value['Minor'] || 0;
                                      const isOverLimit = position === 'Minor'
                                        ? false
                                        : nonMinorTotal > 25;
                                      const isMinorOverLimit = position === 'Minor' && minorCount > 5;
                                      const isDisabled = isFieldDisabled(section.key, key);

                                      return (
                                        <div key={position} className="flex flex-col gap-1">
                                          <label className="text-sm font-medium text-purple-300">
                                            {position}
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            max={position === 'Minor' ? '5' : '10'}
                                            value={count}
                                            onChange={(e) =>
                                              handleRosterPositionChange(position, e.target.value)
                                            }
                                            disabled={isDisabled}
                                            className={`px-2 py-1 bg-slate-800/60 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-700/40 disabled:cursor-not-allowed disabled:text-gray-500 ${
                                              isOverLimit || isMinorOverLimit
                                                ? 'border-red-500 bg-red-900/30'
                                                : 'border-purple-500/30'
                                            }`}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="flex gap-4 text-sm">
                                    <div className={`${
                                      Object.entries(value)
                                        .filter(([pos]) => pos !== 'Minor')
                                        .reduce((sum, [, cnt]) => sum + cnt, 0) > 25
                                        ? 'text-red-400 font-semibold'
                                        : 'text-purple-300'
                                    }`}>
                                      Non-Minor total: {
                                        Object.entries(value)
                                          .filter(([pos]) => pos !== 'Minor')
                                          .reduce((sum, [, cnt]) => sum + cnt, 0)
                                      } / 25 (max)
                                    </div>
                                    <div className={`${
                                      (value['Minor'] || 0) > 5
                                        ? 'text-red-400 font-semibold'
                                        : 'text-purple-300'
                                    }`}>
                                      Minor: {value['Minor'] || 0} / 5 (max)
                                    </div>
                                  </div>
                                </div>
                              ) : isMultiSelectField(key) ? (
                                <div>
                                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-md ${
                                    !isFieldDisabled(section.key, key) && (!Array.isArray(value) || value.length === 0)
                                      ? 'border-red-500 bg-red-900/30'
                                      : 'border-purple-500/30 bg-slate-800/40'
                                  }`}>
                                    {settingOptions[key]?.map((option) => (
                                      <label key={option} className="flex items-center gap-2 text-purple-300">
                                        <input
                                          type="checkbox"
                                          checked={Array.isArray(value) && value.includes(option)}
                                          disabled={
                                            (isFieldDisabled(section.key, key)) ||
                                            ((!Array.isArray(value) || !value.includes(option)) &&
                                            ((Array.isArray(settings.scoring['Batter Stat Categories']) ? settings.scoring['Batter Stat Categories'].length : 0) +
                                              (Array.isArray(settings.scoring['Pitcher Stat Categories']) ? settings.scoring['Pitcher Stat Categories'].length : 0)) >= 30)
                                          }
                                          onChange={(e) =>
                                            handleMultiSelectChange(
                                              section.key,
                                              key,
                                              option,
                                              e.target.checked
                                            )
                                          }
                                        />
                                        <span className={isFieldDisabled(section.key, key) ? 'text-gray-500' : 'text-purple-300'}>{option}</span>
                                      </label>
                                    ))}
                                    <div className="text-xs text-purple-400 mt-2 col-span-full">
                                      selected: {(
                                        (Array.isArray(settings.scoring['Batter Stat Categories']) ? settings.scoring['Batter Stat Categories'].length : 0) +
                                        (Array.isArray(settings.scoring['Pitcher Stat Categories']) ? settings.scoring['Pitcher Stat Categories'].length : 0)
                                      )} / 30
                                    </div>
                                  </div>
                                  {!isFieldDisabled(section.key, key) && (!Array.isArray(value) || value.length === 0) && (
                                    <p className="text-red-600 text-sm mt-1">required - select at least one</p>
                                  )}
                                </div>
                              ) : isTextField(key) ? (
                                <div>
                                  <input
                                    type="text"
                                    value={value}
                                    onChange={(e) =>
                                      handleSettingChange(section.key, key, e.target.value)
                                    }
                                    disabled={isFieldDisabled(section.key, key)}
                                    className={`w-full px-3 py-2 bg-slate-800/60 border rounded-md text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-700/40 disabled:cursor-not-allowed disabled:text-gray-500 ${
                                      !isFieldDisabled(section.key, key) && (!value || value.trim() === '')
                                        ? 'border-red-500 bg-red-900/30'
                                        : 'border-purple-500/30'
                                    }`}
                                  />
                                  {!isFieldDisabled(section.key, key) && (!value || value.trim() === '') && (
                                    <p className="text-red-600 text-sm mt-1">required</p>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <select
                                    value={value}
                                    onChange={(e) =>
                                      handleSettingChange(section.key, key, e.target.value)
                                    }
                                    disabled={isFieldDisabled(section.key, key)}
                                    className={`w-full px-3 py-2 bg-slate-800/60 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-700/40 disabled:cursor-not-allowed disabled:text-gray-500 ${
                                      (!isFieldDisabled(section.key, key) && (!value || value.trim() === '')) || (key === 'Start Scoring On' && dateValidationErrors.scoringDateError)
                                        ? 'border-red-500 bg-red-900/30'
                                        : 'border-purple-500/30'
                                    }`}
                                  >
                                    {(() => {
                                      const options = key === 'Playoff/ranking Tie-Breaker' && settings.playoffs['Playoffs'] === 'No playoffs'
                                        ? (settingOptions[key] || []).filter((o) => o !== 'Better record wins')
                                        : settingOptions[key];
                                      return options?.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ));
                                    })()}
                                  </select>
                                  {!isFieldDisabled(section.key, key) && (!value || value.trim() === '') && (
                                    <p className="text-red-600 text-sm mt-1">required</p>
                                  )}
                                  {key === 'Start Scoring On' && value && dateValidationErrors.scoringDateError && (
                                    <p className="text-red-600 text-sm mt-1">{dateValidationErrors.scoringDateError}</p>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            {/* 週次預覽表 - 從schedule_date表顯示，根據設定即時篩選 */}
            <SchedulePreview leagueId={leagueId} settings={settings} onValidationChange={handleScheduleValidation} />
          </div>

          <div className="mt-8 flex justify-end gap-4">
            {saveMessage && (
              <div className={`px-4 py-2 rounded-md ${
                saveMessage.includes('✅')
                  ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                  : 'bg-red-500/20 text-red-300 border border-red-500/50'
              }`}>
                {saveMessage.split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
            {scheduleError && (
              <div className="px-4 py-2 rounded-md bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 text-sm">
                Button disabled: Schedule validation error
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || scheduleError}
              title={scheduleError ? 'Schedule validation failed - please check the Schedule preview below' : ''}
              className={`px-6 py-2 font-semibold rounded-md transition-colors ${
                isSaving || scheduleError
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg'
              }`}
            >
              {isSaving ? 'Saving...' : 'Update League Settings'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditLeagueSettingsPage;
