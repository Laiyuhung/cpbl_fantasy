'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import AmericanDatePicker from '@/components/AmericanDatePicker';

const cloneSettings = (settings) => JSON.parse(JSON.stringify(settings));

const initialSettings = {
  general: {
    'League Name': '',
    'Draft Type': 'Live Draft',
    'Live Draft Pick Time': '1 Minute',
    'Live Draft Time': '',
    'Max Teams': '6',
    'Scoring Type': 'Head-to-Head',
  },
  acquisitions: {
    'Trade Deadline': 'August 7, 2025',
    'Max Acquisitions per Week': '6',
  },
  waivers: {
    'Waiver Players Time': '2 days',
    'Allow minor players from waivers or free agents to be added directly to the minor slot': 'No',
    'Post Draft Waiver Time': '1 day',
  },
  trading: {
    'Trade Review': 'League votes',
    'Trade Reject Time': '2 days',
    'Trade Reject percentage needed': '50%',
  },
  roster: {
    'Min Innings pitched per team per week': '20',
    'Foreigner On Team Limit': '4',
    'Foreigner Active Limit': '3',
    'Roster Positions': {
      'C': 1,
      '1B': 1,
      '2B': 1,
      '3B': 1,
      'SS': 1,
      'CI': 1,
      'MI': 1,
      'LF': 1,
      'CF': 1,
      'RF': 1,
      'OF': 1,
      'Util': 1,
      'SP': 1,
      'RP': 1,
      'P': 1,
      'BN': 1,
      'Minor': 1
    },
  },
  scoring: {
    'Start Scoring On': '2026.3.28',
    'Batter Stat Categories': [],
    'Pitcher Stat Categories': [],
  },
  playoffs: {
    'Playoffs': '4 teams - 2 weeks',
    'Playoffs start': '2026.8.24',
    'Playoff/ranking Tie-Breaker': 'Higher seed wins',
    'Playoff Reseeding': 'Yes',
    'Lock Eliminated Teams': 'Yes',
  },
  league: {
    'Make League Publicly Viewable': 'Yes',
    'Invite Permissions': 'Commissioner Only',
  },
};

const settingOptions = {
  'League Name': [],
  'Draft Type': ['Live Draft'],
  'Live Draft Pick Time': ['30 Seconds', '1 Minute', '2 Minutes', '3 Minutes'],
  'Max Teams': ['4', '6', '8', '10'],
  'Scoring Type': ['Head-to-Head', 'Head-to-Head One Win', 'Head-to-Head Fantasy Points'],
  'Trade Deadline': ['No trade deadline', 'June 15, 2026', 'July 1, 2026', 'July 15, 2026', 'August 1, 2026', 'August 7, 2026', 'August 15, 2026', 'August 30, 2026'],
  'Waiver Players Time': ['0 days', '1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days'],
  'Allow minor players from waivers or free agents to be added directly to the minor slot': ['Yes', 'No'],
  'Trade Review': ['League votes', 'Commissioner reviews', 'No review'],
  'Trade Reject Time': ['1 day', '2 days', '3 days'],
  'Trade Reject percentage needed': ['10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'],
  'Post Draft Waiver Time': ['1 day', '2 days', '3 days'],
  'Max Acquisitions per Week': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'No maximum'],
  'Min Innings pitched per team per week': ['0', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50'],
  'Foreigner On Team Limit': ['No limit', '0', '1', '2', '3', '4', '5', '6', '7'],
  'Foreigner Active Limit': ['No limit', '0', '1', '2', '3', '4', '5', '6', '7'],
  'Start Scoring On': ['2026.3.28', '2026.4.6', '2026.4.13', '2026.4.20'],
  'Batter Stat Categories': [
    'Games Played (GP)',
    'Plate Appearances (PA)',
    'At Bats (AB)',
    'Hits (H)',
    'Singles (1B)',
    'Doubles (2B)',
    'Triples (3B)',
    'Home Runs (HR)',
    'Extra Base Hits (XBH)',
    'Total Bases (TB)',
    'Runs (R)',
    'Runs Batted In (RBI)',
    'Strikeouts (K)',
    'Walks (BB)',
    'Hit By Pitch (HBP)',
    'Sacrifice Hits (SH)',
    'Sacrifice Flies (SF)',
    'Stolen Bases (SB)',
    'Caught Stealing (CS)',
    'Ground Into Double Play (GIDP)',
    'Hitting for the Cycle (CYC)',
    'Batting Average (AVG)',
    'On-base Percentage (OBP)',
    'Slugging Percentage (SLG)',
    'On-base + Slugging Percentage (OPS)'
  ],
  'Pitcher Stat Categories': [
    'Appearances (APP)',
    'Games Started (GS)',
    'Relief Appearances (RAPP)',
    'Innings Pitched (IP)',
    'Outs (OUT)',
    'Total Batters Faced (TBF)',
    'Pitch Count (PC)',
    'Wins (W)',
    'Losses (L)',
    'Holds (HLD)',
    'Saves (SV)',
    'Saves + Holds (SV+HLD)',
    'Relief Wins (RW)',
    'Relief Losses (RL)',
    'Hits (H)',
    'Home Runs (HR)',
    'Strikeouts (K)',
    'Walks (BB)',
    'Intentional Walks (IBB)',
    'Hit Batters (HBP)',
    'Runs Allowed (RA)',
    'Earned Runs (ER)',
    'Quality Starts (QS)',
    'Complete Games (CG)',
    'Shutouts (SHO)',
    'Perfect Games (PG)',
    'No Hitters (NH)',
    'Earned Run Average (ERA)',
    '(Walks + Hits)/ Innings Pitched (WHIP)',
    'Winning Percentage (WIN%)',
    'Strikeouts per Nine Innings (K/9)',
    'Walks Per Nine Innings (BB/9)',
    'Strikeout to Walk Ratio (K/BB)',
    'Hits Per Nine Innings (H/9)',
    'On-base Percentage Against (OBPA)'
  ],
  'Playoffs': ['2 teams - 1 week', '4 teams - 2 weeks', '6 teams - 3 weeks', '8 teams - 3 weeks'],
  'Playoffs start': ['2026.8.10', '2026.8.17', '2026.8.24', '2026.8.31', '2026.9.7', '2026.9.14'],
  'Playoff/ranking Tie-Breaker': ['Higher seed wins', 'Head-to-head'],
  'Playoff Reseeding': ['Yes', 'No'],
  'Lock Eliminated Teams': ['Yes', 'No'],
  'Make League Publicly Viewable': ['Yes', 'No'],
  'Invite Permissions': ['Commissioner Only', 'Managers can invite'],
};


const getSettingDescription = (key) => {
  if (key === 'Foreigner On Team Limit') {
    return 'Total foreigners allowed on the roster (including Minor/NA slots)';
  }
  if (key === 'Foreigner Active Limit') {
    return 'Maximum number of foreign players allowed in active slots (excluding Minor/NA slots)';
  }
  return null;
};

// Helper function to check if a category is average-based (incompatible with Fantasy Points)
const isAverageBasedCategory = (category) => {
  const averageCategories = [
    'Batting Average (AVG)',
    'On-base Percentage (OBP)',
    'Slugging Percentage (SLG)',
    'On-base + Slugging Percentage (OPS)',
    'Earned Run Average (ERA)',
    '(Walks + Hits)/ Innings Pitched (WHIP)',
    'Winning Percentage (WIN%)',
    'Strikeouts per Nine Innings (K/9)',
    'Walks Per Nine Innings (BB/9)',
    'Strikeout to Walk Ratio (K/BB)',
    'Hits Per Nine Innings (H/9)',
    'On-base Percentage Against (OBPA)',
  ];
  return averageCategories.includes(category);
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
function SchedulePreview({ settings, onValidationChange, onScheduleChange }) {
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

    fetchAllSchedule();
  }, []);

  // 當設定改變時，即時篩選週次並加入季後賽推算
  useEffect(() => {
    if (!allScheduleData || allScheduleData.length === 0) {
      setFilteredSchedule([]);
      if (onScheduleChange) onScheduleChange([]);
      return;
    }

    const startScoringOn = settings?.scoring?.['Start Scoring On'];
    const playoffsStart = settings?.playoffs?.['Playoffs start'];
    const playoffsType = settings?.playoffs?.['Playoffs'];

    if (!startScoringOn) {
      setFilteredSchedule([]);
      if (onScheduleChange) onScheduleChange([]);
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
      if (onScheduleChange) onScheduleChange([]);
      return;
    }

    // 計算季後賽週次標籤
    let playoffLabels = [];
    if (playoffsStart && playoffsType) {
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
        playoffLabels = ['Quarterfinal', 'Semifinal', 'Final'];
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
      const weekObj = {
        ...week,
        week_number: weekCounter,
        week_type: 'regular_season',
        week_label: label,
      };
      weekCounter++;
      return weekObj;
    });

    // 如果有季後賽，加入補賽預備週和季後賽週次
    if (playoffStartDate && playoffLabels.length > 0 && makeupWeek) {
      scheduleWithTypes.push({
        ...makeupWeek,
        week_number: weekCounter, // Use updated counter for uniqueness
        week_type: 'makeup',
        week_label: 'Makeup Preparation Week',
      });
      weekCounter++;

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
          week_number: weekCounter,
          week_type: 'playoffs',
          week_label: playoffLabels[index] || `Playoff ${index + 1}`,
        });
        weekCounter++;
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
          week_number: weekCounter,
          week_type: 'preparation',
          week_label: 'Preparation Week',
        });
        weekCounter++;
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
    if (onScheduleChange) onScheduleChange(scheduleWithTypes);

  }, [allScheduleData, settings, onValidationChange]); // Remove onScheduleChange from deps

  if (loading) {
    return (
      <div className="mb-8 p-6 bg-white border border-blue-200 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📅 Schedule Preview</h2>
        <p className="text-gray-600">Loading schedule data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8 p-6 bg-white border border-blue-200 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📅 Schedule Preview</h2>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!settings?.scoring?.['Start Scoring On']) {
    return (
      <div className="mb-8 p-6 bg-white border border-blue-200 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📅 Schedule Preview</h2>
        <p className="text-gray-600">Please set &quot;Start Scoring On&quot; to see the schedule preview</p>
      </div>
    );
  }

  if (filteredSchedule.length === 0) {
    return (
      <div className="mb-8 p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl">
        <h2 className="text-2xl font-bold text-purple-300 mb-4">📅 Schedule Preview</h2>
        <p className="text-purple-300/70">No schedule data available for the selected dates</p>
      </div>
    );
  }

  return (
    <div className="mb-8 p-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl">
      <h2 className="text-2xl font-bold text-purple-300 mb-4">📅 Schedule Preview</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 border-b-2 border-purple-500/50">
              <th className="px-4 py-2 text-left font-bold text-purple-200">Week</th>
              <th className="px-4 py-2 text-left font-bold text-purple-200">Type</th>
              <th className="px-4 py-2 text-left font-bold text-purple-200">Start Date</th>
              <th className="px-4 py-2 text-left font-bold text-purple-200">End Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchedule.map((week, index) => (
              <tr
                key={index}
                className={`border-b ${week.week_type === 'playoffs'
                  ? 'bg-purple-900/40 hover:bg-purple-800/40'
                  : week.week_type === 'makeup'
                    ? 'bg-yellow-900/40 hover:bg-yellow-800/40'
                    : week.week_type === 'preparation'
                      ? 'bg-green-900/40 hover:bg-green-800/40'
                      : 'bg-slate-900/40 hover:bg-purple-500/20'
                  } border-purple-500/20 transition-colors`}
              >
                <td className="px-4 py-2 text-white font-medium">{week.week_label}</td>
                <td className="px-4 py-2 text-purple-300">
                  <span className={`px-2 py-1 rounded text-xs font-semibold shadow-lg ${week.week_type === 'playoffs'
                    ? 'bg-purple-500/80 text-purple-100 shadow-purple-500/50'
                    : week.week_type === 'makeup'
                      ? 'bg-yellow-500/80 text-yellow-100 shadow-yellow-500/50'
                      : week.week_type === 'preparation'
                        ? 'bg-green-500/80 text-green-100 shadow-green-500/50'
                        : 'bg-blue-500/80 text-blue-100 shadow-blue-500/50'
                    }`}>
                    {week.week_type === 'playoffs' ? 'Playoffs' : week.week_type === 'makeup' ? 'Makeup' : week.week_type === 'preparation' ? 'Preparation' : 'Regular'}
                  </span>
                </td>
                <td className="px-4 py-2 text-purple-300">{week.week_start}</td>
                <td className="px-4 py-2 text-purple-300">{week.week_end}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {scheduleValidationError && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded text-sm text-red-300">
            <p className="font-semibold">❌ {scheduleValidationError}</p>
          </div>
        )}
        <div className="mt-4 p-3 bg-purple-900/30 border border-purple-500/50 rounded text-sm text-purple-300">
          <p className="font-semibold">Total: {filteredSchedule.length} weeks</p>
        </div>
      </div>
    </div>
  );
}

const CreateLeaguePage = () => {
  const router = useRouter();
  const [settings, setSettings] = useState(() => cloneSettings(initialSettings));
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [leagueId, setLeagueId] = useState(null);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleData, setScheduleData] = useState([]); // Store calculated schedule
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [activeHelpKey, setActiveHelpKey] = useState(null); // State for help modal
  const [categoryWeights, setCategoryWeights] = useState({ batter: {}, pitcher: {} });

  const handleScheduleValidation = (error) => {
    setScheduleError(error);
  };

  const handleScheduleChange = (data) => {
    setScheduleData(data);
  };

  const handleSettingChange = (section, key, value) => {
    setSettings((prev) => {
      const next = { ...prev };
      next[section] = { ...prev[section], [key]: value };

      if (section === 'general' && key === 'Draft Type' && value !== 'Live Draft') {
        next.general['Live Draft Pick Time'] = '';
        next.general['Live Draft Time'] = '';
      }

      // When switching to Head-to-Head Fantasy Points, remove average-based categories
      if (section === 'general' && key === 'Scoring Type' && value === 'Head-to-Head Fantasy Points') {
        // Filter out average-based categories from batter categories
        if (Array.isArray(next.scoring['Batter Stat Categories'])) {
          next.scoring['Batter Stat Categories'] = next.scoring['Batter Stat Categories'].filter(
            cat => !isAverageBasedCategory(cat)
          );
        }
        // Filter out average-based categories from pitcher categories
        if (Array.isArray(next.scoring['Pitcher Stat Categories'])) {
          next.scoring['Pitcher Stat Categories'] = next.scoring['Pitcher Stat Categories'].filter(
            cat => !isAverageBasedCategory(cat)
          );
        }
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

  // Omitted validation logic here for brevity, but needed in full file. 
  // Re-implementing validation logic from original file.
  const validateDraftAndScoringDates = () => {
    const liveDraftTime = settings.general['Live Draft Time'];
    const startScoringOn = settings.scoring['Start Scoring On'];

    const errors = {
      draftTimeError: '',
      scoringDateError: ''
    };

    if (startScoringOn) {
      const parts = startScoringOn.split('.');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);

        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const scoringDate = new Date(year, month, day);

          if (!isNaN(scoringDate.getTime())) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (scoringDate <= today) {
              errors.scoringDateError = 'Start Scoring On must be a future date';
            }
          } else {
            errors.scoringDateError = 'Start Scoring On has an invalid date';
          }
        } else {
          errors.scoringDateError = 'Start Scoring On has invalid format';
        }
      } else {
        errors.scoringDateError = 'Start Scoring On must be in YYYY.M.D format';
      }
    }

    if (liveDraftTime && startScoringOn && settings.general['Draft Type'] === 'Live Draft') {
      const draftDateTime = new Date(liveDraftTime);
      if (!isNaN(draftDateTime.getTime())) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        if (draftDateTime < tomorrow) {
          errors.draftTimeError = 'Live Draft Time must be at least tomorrow (00:00)';
        } else if (!errors.draftTimeError) {
          const parts = startScoringOn.split('.');
          if (parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);

            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
              const scoringDate = new Date(year, month, day);
              if (!isNaN(scoringDate.getTime())) {
                scoringDate.setHours(0, 0, 0, 0);
                const latestDraftDate = new Date(scoringDate);
                latestDraftDate.setDate(latestDraftDate.getDate() - 2);
                latestDraftDate.setHours(23, 59, 59, 999);

                if (draftDateTime > latestDraftDate) {
                  errors.draftTimeError = 'Live Draft Time must be at least 2 days before season start';
                }
              }
            }
          }
        }
      } else {
        errors.draftTimeError = 'Live Draft Time is invalid';
      }
    }
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

  const handleMultiSelectChange = (section, key, option, checked) => {
    setSettings((prev) => {
      const current = Array.isArray(prev[section][key]) ? prev[section][key] : [];
      let next = checked
        ? Array.from(new Set([...current, option]))
        : current.filter((o) => o !== option);

      const optionsList = settingOptions[key] || [];
      if (optionsList.length > 0) {
        next = next.sort((a, b) => {
          const indexA = optionsList.indexOf(a);
          const indexB = optionsList.indexOf(b);
          return indexA - indexB;
        });
      }

      return {
        ...prev,
        [section]: {
          ...prev[section],
          [key]: next,
        },
      };
    });

    if (settings.general['Scoring Type'] === 'Head-to-Head Fantasy Points') {
      const categoryType = key === 'Batter Stat Categories' ? 'batter' : 'pitcher';
      if (checked) {
        setCategoryWeights(prev => ({
          ...prev,
          [categoryType]: {
            ...prev[categoryType],
            [option]: prev[categoryType]?.[option] || 1.0,
          },
        }));
      } else {
        setCategoryWeights(prev => {
          const updated = { ...prev };
          delete updated[categoryType][option];
          return updated;
        });
      }
    }
  };

  const handleRosterPositionChange = (position, value) => {
    let numValue = parseInt(value) || 0;
    const limit = position === 'Minor' ? 5 : 10;
    if (numValue > limit) numValue = limit;
    if (numValue < 0) numValue = 0;

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

  const handleWeightChange = (categoryType, categoryName, weight) => {
    const numWeight = weight === '' || weight === '-' ? weight : parseFloat(weight);
    setCategoryWeights(prev => ({
      ...prev,
      [categoryType]: {
        ...prev[categoryType],
        [categoryName]: numWeight,
      },
    }));
  };

  const validateWeight = (weight) => {
    if (weight === '' || weight === '-') return 'Weight is required';
    const num = parseFloat(weight);
    if (isNaN(num)) return 'Invalid number';
    if (num < -10 || num > 10) return 'Weight must be between -10 and 10';
    const decimalPart = weight.toString().split('.')[1];
    if (decimalPart && decimalPart.length > 1) {
      return 'Only 1 decimal place allowed';
    }
    return null;
  };

  const validateForeignerLimits = (teamLimit, activeLimit) => {
    const parseLimit = (limit) => {
      if (limit === 'No limit') return Infinity;
      const parsed = parseInt(limit, 10);
      return isNaN(parsed) ? 0 : parsed;
    };
    const team = parseLimit(teamLimit);
    const active = parseLimit(activeLimit);
    if (active > team) {
      return 'Foreigner Active Limit MUST be <= Foreigner On Team Limit';
    }
    return null;
  };

  const hasWeightErrors = () => {
    if (settings.general['Scoring Type'] !== 'Head-to-Head Fantasy Points') {
      return false;
    }
    let hasErrors = false;
    const errors = [];
    const batterCategories = settings.scoring['Batter Stat Categories'] || [];
    for (const category of batterCategories) {
      const weight = categoryWeights.batter?.[category];
      const error = validateWeight(weight);
      if (error) {
        hasErrors = true;
        errors.push(`[Batter] ${category}: ${error} (current value: ${weight})`);
      }
    }
    const pitcherCategories = settings.scoring['Pitcher Stat Categories'] || [];
    for (const category of pitcherCategories) {
      const weight = categoryWeights.pitcher?.[category];
      const error = validateWeight(weight);
      if (error) {
        hasErrors = true;
        errors.push(`[Pitcher] ${category}: ${error} (current value: ${weight})`);
      }
    }
    if (hasErrors) {
      console.log('❌ Weight Validation Errors:', errors);
    }
    return hasErrors;
  };

  const validateSettings = () => {
    const errors = [];
    if (!settings.general['League Name'] || settings.general['League Name'].trim() === '') {
      errors.push('❌ League Name is required');
    }
    if (!settings.general['Max Teams']) errors.push('❌ Max Teams is required');
    if (!settings.general['Scoring Type']) errors.push('❌ Scoring Type is required');
    if (!settings.general['Draft Type']) errors.push('❌ Draft Type is required');
    if (settings.general['Draft Type'] === 'Live Draft') {
      if (!settings.general['Live Draft Pick Time']) errors.push('❌ Live Draft Pick Time is required');
      if (!settings.general['Live Draft Time']) errors.push('❌ Live Draft Time is required');
    }
    if (!settings.acquisitions['Trade Deadline']) errors.push('❌ Trade Deadline is required');
    if (!settings.acquisitions['Max Acquisitions per Week']) errors.push('❌ Max Acquisitions per Week is required');
    if (!settings.waivers['Waiver Players Time']) errors.push('❌ Waiver Players Time is required');
    if (!settings.waivers['Post Draft Waiver Time']) errors.push('❌ Post Draft Waiver Time is required');
    if (!settings.trading['Trade Review']) errors.push('❌ Trade Review is required');
    if (settings.trading['Trade Review'] !== 'No review') {
      if (!settings.trading['Trade Reject Time']) errors.push('❌ Trade Reject Time is required');
      if (!settings.trading['Trade Reject percentage needed']) errors.push('❌ Trade Reject percentage needed is required');
    }
    if (!settings.roster['Min Innings pitched per team per week']) errors.push('❌ Min Innings pitched per team per week is required');
    const foreignerTeamLimit = settings.roster['Foreigner On Team Limit'];
    const foreignerActiveLimit = settings.roster['Foreigner Active Limit'];
    if (!foreignerTeamLimit) errors.push('❌ Foreigner On Team Limit is required');
    if (!foreignerActiveLimit) errors.push('❌ Foreigner Active Limit is required');
    if (foreignerTeamLimit && foreignerActiveLimit) {
      const foreignerError = validateForeignerLimits(foreignerTeamLimit, foreignerActiveLimit);
      if (foreignerError) errors.push(`❌ ${foreignerError}`);
    }
    const nonMinorTotal = Object.entries(settings.roster['Roster Positions'])
      .filter(([pos]) => pos !== 'Minor')
      .reduce((sum, [, cnt]) => sum + cnt, 0);
    const minorCount = settings.roster['Roster Positions']['Minor'] || 0;
    if (nonMinorTotal > 25) errors.push('❌ Non-Minor total positions cannot exceed 25');
    if (minorCount > 5) errors.push('❌ Minor positions cannot exceed 5');
    if (nonMinorTotal === 0) errors.push('❌ At least one non-Minor roster position is required');
    if (!settings.scoring['Start Scoring On']) errors.push('❌ Start Scoring On is required');
    const dateErrors = validateDraftAndScoringDates();
    if (dateErrors.scoringDateError) errors.push(`❌ ${dateErrors.scoringDateError}`);
    if (dateErrors.draftTimeError) errors.push(`❌ ${dateErrors.draftTimeError}`);
    if (!Array.isArray(settings.scoring['Batter Stat Categories']) || settings.scoring['Batter Stat Categories'].length === 0) {
      errors.push('❌ At least one Batter Stat Category is required');
    }
    if (!Array.isArray(settings.scoring['Pitcher Stat Categories']) || settings.scoring['Pitcher Stat Categories'].length === 0) {
      errors.push('❌ At least one Pitcher Stat Category is required');
    }
    if (!settings.playoffs['Playoffs']) errors.push('❌ Playoffs setting is required');
    if (settings.playoffs['Playoffs']) {
      const playoffMatch = settings.playoffs['Playoffs'].match(/^(\d+) teams/);
      if (playoffMatch) {
        const playoffTeams = parseInt(playoffMatch[1]);
        const maxTeams = parseInt(settings.general['Max Teams']);
        if (playoffTeams > maxTeams) {
          errors.push(`❌ Playoff teams (${playoffTeams}) cannot exceed Max Teams (${maxTeams})`);
        }
      }
      if (!settings.playoffs['Playoffs start']) errors.push('❌ Playoffs start date is required');
      if (!settings.playoffs['Playoff/ranking Tie-Breaker']) errors.push('❌ Playoff/ranking Tie-Breaker is required');
      if (!settings.playoffs['Playoff Reseeding']) errors.push('❌ Playoff Reseeding is required');
      if (!settings.playoffs['Lock Eliminated Teams']) errors.push('❌ Lock Eliminated Teams is required');
    }
    if (!settings.league['Make League Publicly Viewable']) errors.push('❌ Make League Publicly Viewable setting is required');
    if (!settings.league['Invite Permissions']) errors.push('❌ Invite Permissions setting is required');

    return errors;
  };

  const handleSave = async () => {
    const validationErrors = validateSettings();
    if (validationErrors.length > 0) {
      setSaveMessage(validationErrors.join('\n'));
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      const cookie = document.cookie.split('; ').find(row => row.startsWith('user_id='));
      const manager_id = cookie?.split('=')[1];

      if (!manager_id) {
        setSaveMessage('❌ 請先登入');
        setIsSaving(false);
        return;
      }

      const response = await fetch('/api/league-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings,
          manager_id,
          categoryWeights: settings.general['Scoring Type'] === 'Head-to-Head Fantasy Points' ? categoryWeights : null,
          schedule: scheduleData
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setLeagueId(result.league_id);
        setShowSuccessAnimation(true);
        window.dispatchEvent(new Event('leagues-changed'));
        setTimeout(() => {
          window.location.href = `/league/${result.league_id}`;
        }, 2000);
      } else {
        setSaveMessage(`❌ 保存失敗: ${result.error || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveMessage(`❌ 保存失敗: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Check deadline - disable page after 2026-04-16
  if (new Date() >= new Date('2026-04-16')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-12 shadow-2xl max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-slate-700/50 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">League Creation Period Ended</h2>
          <p className="text-slate-400 mb-6">
            The deadline for creating new leagues was April 15, 2026. New leagues can no longer be created for this season.
          </p>
          <button
            onClick={() => router.push('/home')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.4s ease-out; }
        @media (max-width: 639px) {
          .settings-table tr {
            display: flex;
            flex-direction: column;
          }
          .settings-table td {
            width: 100% !important;
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }
          .settings-table td:first-child {
            padding-bottom: 0.25rem !important;
          }
          .settings-table td:last-child {
            padding-top: 0.25rem !important;
          }
        }
      `}</style>

      {showSuccessAnimation && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-12 shadow-2xl text-center animate-scaleIn">
            <div className="mb-6 animate-bounce">
              <svg className="w-24 h-24 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">League Created!</h2>
            <p className="text-gray-600 text-lg">Redirecting to your league page...</p>
          </div>
        </div>
      )}

      {activeHelpKey && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setActiveHelpKey(null)}>
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-2xl max-w-md w-full animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white">{activeHelpKey}</h3>
              <button
                onClick={() => setActiveHelpKey(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-purple-200 leading-relaxed">
              {getSettingDescription(activeHelpKey)}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveHelpKey(null)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8 pt-20 sm:pt-24 z-0">
        {/* Enhanced Header Section */}
        <div className="max-w-7xl mx-auto mb-6 sm:mb-12">
          <div className="relative">
            {/* Decorative background glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-blue-500/20 blur-3xl -z-10"></div>

            {/* Header content */}
            <div className="relative bg-gradient-to-br from-purple-600/10 to-blue-600/10 backdrop-blur-sm border border-purple-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl">
              <div className="flex items-center gap-3 sm:gap-6">
                {/* Icon */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 blur-2xl opacity-50 animate-pulse"></div>
                  <div className="relative bg-gradient-to-br from-purple-600 to-blue-600 p-3 sm:p-6 rounded-xl sm:rounded-2xl shadow-xl">
                    <svg className="w-8 h-8 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                </div>

                {/* Title and subtitle */}
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent mb-1 sm:mb-2 tracking-tight">
                    CREATE NEW LEAGUE
                  </h1>
                  <p className="text-sm sm:text-lg text-purple-300/80 font-medium">
                    Set up your fantasy baseball league with custom rules and settings
                  </p>
                </div>

                {/* Decorative element */}
                <div className="hidden xl:block">
                  <div className="flex gap-2">
                    <div className="w-2 h-16 bg-gradient-to-b from-purple-500 to-transparent rounded-full"></div>
                    <div className="w-2 h-20 bg-gradient-to-b from-pink-500 to-transparent rounded-full"></div>
                    <div className="w-2 h-16 bg-gradient-to-b from-blue-500 to-transparent rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="max-w-7xl mx-auto space-y-8">
          {sections.map((section) => (
            <div
              key={section.key}
              className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-blue-600/80 to-cyan-600/80 backdrop-blur-sm p-4 sm:p-6 border-b border-blue-400/30">
                <h2 className="flex items-center gap-2 sm:gap-3 text-xl sm:text-3xl font-black text-white">
                  <span className="text-lg sm:text-2xl">{section.icon}</span>
                  {section.label}
                </h2>
              </div>
              <div className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full settings-table">
                    <tbody>
                      {Object.entries(settings[section.key]).map(([key, value], index) => {
                        if (section.key === 'trading' && key !== 'Trade Review' && settings.trading['Trade Review'] === 'No review') return null;
                        if (section.key === 'trading' && key === 'Trade Reject percentage needed' && settings.trading['Trade Review'] !== 'League votes') return null;
                        if (section.key === 'general' && settings.general['Draft Type'] !== 'Live Draft' && ['Live Draft Pick Time', 'Live Draft Time'].includes(key)) return null;
                        return (
                          <tr key={key} className={`${index % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-800/40'} hover:bg-purple-500/20 transition-colors border-b border-purple-500/20`}>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-purple-200 w-2/5 text-sm sm:text-base">
                              <div className="flex items-center gap-2">
                                {key}
                                {getSettingDescription(key) && (
                                  <button onClick={() => setActiveHelpKey(key)} className="cursor-help text-purple-400 hover:text-purple-200 bg-purple-500/20 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold border border-purple-500/50 transition-colors" type="button">?</button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 sm:px-6 py-3 sm:py-4 text-purple-300 w-3/5">
                              {isMultilineField(key) ? (
                                <div>
                                  <textarea value={value} onChange={(e) => handleSettingChange(section.key, key, e.target.value)} rows="3" className={`w-full px-3 py-2 bg-slate-800/60 border rounded-md text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm ${!value || value.trim() === '' ? 'border-red-500 bg-red-900/30' : 'border-purple-500/30'}`} />
                                  {(!value || value.trim() === '') && <p className="text-red-600 text-sm mt-1">required</p>}
                                </div>
                              ) : isDateTimeField(key) ? (
                                <div>
                                  <AmericanDatePicker
                                    value={value}
                                    onChange={(newValue) => handleSettingChange(section.key, key, newValue)}
                                    minDate={minDraftDateTime()}
                                    disabled={settings.general['Draft Type'] !== 'Live Draft'}
                                    className="w-full"
                                  />
                                  {settings.general['Draft Type'] === 'Live Draft' && (!value || value.trim() === '') && <p className="text-red-600 text-sm mt-1">required</p>}
                                  {settings.general['Draft Type'] === 'Live Draft' && value && dateValidationErrors.draftTimeError && <p className="text-red-600 text-sm mt-1">{dateValidationErrors.draftTimeError}</p>}
                                </div>
                              ) : isRosterPositions(key) ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {Object.entries(value).map(([position, count]) => {
                                      const nonMinorTotal = Object.entries(value).filter(([pos]) => pos !== 'Minor').reduce((sum, [, cnt]) => sum + cnt, 0);
                                      const minorCount = value['Minor'] || 0;
                                      const isOverLimit = position === 'Minor' ? false : nonMinorTotal > 25;
                                      const isMinorOverLimit = position === 'Minor' && minorCount > 5;
                                      return (
                                        <div key={position} className="flex flex-col gap-1">
                                          <label className="text-sm font-medium text-purple-300">{position}</label>
                                          <input type="number" min="0" max={position === 'Minor' ? '5' : '10'} value={count} onChange={(e) => handleRosterPositionChange(position, e.target.value)} className={`px-2 py-1 bg-slate-800/60 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${isOverLimit || isMinorOverLimit ? 'border-red-500 bg-red-900/30' : 'border-purple-500/30'}`} />
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="flex gap-4 text-sm">
                                    <div className={`${Object.entries(value).filter(([pos]) => pos !== 'Minor').reduce((sum, [, cnt]) => sum + cnt, 0) > 25 ? 'text-red-400 font-semibold' : 'text-purple-300'}`}>Non-Minor total: {Object.entries(value).filter(([pos]) => pos !== 'Minor').reduce((sum, [, cnt]) => sum + cnt, 0)} / 25 (max)</div>
                                    <div className={`${(value['Minor'] || 0) > 5 ? 'text-red-400 font-semibold' : 'text-purple-300'}`}>Minor: {value['Minor'] || 0} / 5 (max)</div>
                                  </div>
                                </div>
                              ) : isMultiSelectField(key) ? (
                                <div>
                                  {settings.general['Scoring Type'] === 'Head-to-Head Fantasy Points' && <div className="mb-2 p-2 bg-blue-500/20 border border-blue-500/30 rounded text-sm text-blue-300">ℹ️ Set weights for each category (range: -10 to 10, max 1 decimal place, default: 1.0)</div>}
                                  <div className={`grid grid-cols-1 gap-2 p-3 border rounded-md ${(!Array.isArray(value) || value.length === 0) ? 'border-red-500 bg-red-900/30' : 'border-purple-500/30 bg-slate-800/40'}`}>
                                    {settingOptions[key]?.map((option) => {
                                      const isChecked = Array.isArray(value) && value.includes(option);
                                      const categoryType = key === 'Batter Stat Categories' ? 'batter' : 'pitcher';
                                      const currentWeight = categoryWeights[categoryType]?.[option] !== undefined ? categoryWeights[categoryType][option] : 1.0;
                                      const showWeight = settings.general['Scoring Type'] === 'Head-to-Head Fantasy Points' && isChecked;
                                      const weightError = showWeight ? validateWeight(currentWeight) : null;

                                      // Disable average-based categories when Fantasy Points is selected
                                      const isFantasyPoints = settings.general['Scoring Type'] === 'Head-to-Head Fantasy Points';
                                      const isDisabledDueToAverage = isFantasyPoints && isAverageBasedCategory(option);
                                      const isDisabledDueToLimit = (!Array.isArray(value) || !value.includes(option)) && ((Array.isArray(settings.scoring['Batter Stat Categories']) ? settings.scoring['Batter Stat Categories'].length : 0) + (Array.isArray(settings.scoring['Pitcher Stat Categories']) ? settings.scoring['Pitcher Stat Categories'].length : 0)) >= 30;
                                      const isDisabled = isDisabledDueToAverage || isDisabledDueToLimit;

                                      return (
                                        <div key={option} className={`flex items-center gap-2 ${showWeight ? 'justify-between' : ''}`}>
                                          <label className="flex items-center gap-2 text-purple-300 flex-1">
                                            <input type="checkbox" checked={isChecked} disabled={isDisabled} onChange={(e) => handleMultiSelectChange(section.key, key, option, e.target.checked)} />
                                            <span className={isDisabledDueToAverage ? 'text-gray-500' : ''}>{option}</span>
                                          </label>
                                          {showWeight && (
                                            <div className="flex flex-col gap-1">
                                              <div className="flex items-center gap-1">
                                                <span className="text-xs text-purple-400">Weight:</span>
                                                <input type="number" min="-10" max="10" step="0.1" value={currentWeight} onChange={(e) => handleWeightChange(categoryType, option, e.target.value)} className={`w-20 px-2 py-1 bg-slate-700/60 border rounded text-white text-sm focus:outline-none focus:ring-2 ${weightError ? 'border-red-500 focus:ring-red-500' : 'border-purple-500/30 focus:ring-purple-500'}`} />
                                              </div>
                                              {weightError && <span className="text-xs text-red-400">{weightError}</span>}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    <div className="text-xs text-purple-400 mt-2 col-span-full">selected: {((Array.isArray(settings.scoring['Batter Stat Categories']) ? settings.scoring['Batter Stat Categories'].length : 0) + (Array.isArray(settings.scoring['Pitcher Stat Categories']) ? settings.scoring['Pitcher Stat Categories'].length : 0))} / 30 (max)</div>
                                  </div>
                                  {(!Array.isArray(value) || value.length === 0) && <p className="text-red-600 text-sm mt-1">required - select at least one</p>}
                                </div>
                              ) : isTextField(key) ? (
                                <div>
                                  <input type="text" value={value} onChange={(e) => handleSettingChange(section.key, key, e.target.value)} className={`w-full px-3 py-2 bg-slate-800/60 border rounded-md text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${!value || value.trim() === '' ? 'border-red-500 bg-red-900/30' : 'border-purple-500/30'}`} />
                                  {(!value || value.trim() === '') && <p className="text-red-600 text-sm mt-1">required</p>}
                                </div>
                              ) : (
                                <div>
                                  <select value={value} onChange={(e) => handleSettingChange(section.key, key, e.target.value)} className={`w-full px-3 py-2 bg-slate-800/60 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${(!value || value.trim() === '') || (key === 'Start Scoring On' && dateValidationErrors.scoringDateError) ? 'border-red-500 bg-red-900/30' : 'border-purple-500/30'}`}>
                                    {settingOptions[key]?.map((option) => (<option key={option} value={option}>{option}</option>))}
                                  </select>
                                  {(!value || value.trim() === '') && <p className="text-red-600 text-sm mt-1">required</p>}
                                  {key === 'Start Scoring On' && value && dateValidationErrors.scoringDateError && <p className="text-red-600 text-sm mt-1">{dateValidationErrors.scoringDateError}</p>}
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

          <div>
            <SchedulePreview settings={settings} onValidationChange={handleScheduleValidation} onScheduleChange={handleScheduleChange} />
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4">
            {saveMessage && <div className={`px-4 py-2 rounded-md text-sm ${saveMessage.includes('✅') ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>{saveMessage.split('\n').map((line, i) => <div key={i}>{line}</div>)}</div>}
            {scheduleError && <div className="px-4 py-2 rounded-md bg-yellow-100 text-yellow-800 border border-yellow-300 text-sm">Button disabled: Schedule validation error</div>}
            {hasWeightErrors() && <div className="px-4 py-2 rounded-md bg-red-100 text-red-800 border border-red-300 text-sm">Button disabled: Invalid weight values detected</div>}
            <div className="flex gap-3 sm:gap-4">
              <button onClick={() => { setSettings(cloneSettings(initialSettings)); setSaveMessage(''); setLeagueId(null); setScheduleData([]); }} className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-400 transition-colors text-sm sm:text-base">Reset</button>
              <button onClick={handleSave} disabled={isSaving || scheduleError || hasWeightErrors()} title={scheduleError ? 'Schedule validation failed' : hasWeightErrors() ? 'Invalid weight values' : ''} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 font-semibold rounded-md transition-colors text-sm sm:text-base ${isSaving || scheduleError || hasWeightErrors() ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{isSaving ? 'Creating...' : 'Create League'}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateLeaguePage;
