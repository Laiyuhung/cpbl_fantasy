'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import supabase from '@/lib/supabase';

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
      'Minor': 3
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
  'Trade Reject percentage needed': [ '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'],
  'Post Draft Players Unfreeze Time': [ '1 day', '2 days', '3 days'],
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
    'Extra Base Hits (XBH)'
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
    'Winning Percentage (WIN%)'
  ],
  'Playoffs': ['2 teams - 1 week', '4 teams - 2 weeks', '6 teams - 3 weeks', '8 teams - 4 weeks', 'No playoffs'],
  'Playoffs start': ['2026.8.10', '2026.8.17', '2026.8.24', '2026.8.31', '2026.9.7','2026.9.14'],
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
function SchedulePreview({ settings }) {
  const [allScheduleData, setAllScheduleData] = useState([]);
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
          .order('week', { ascending: true });

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

  // 當設定改變時，即時篩選週次
  useEffect(() => {
    if (!allScheduleData || allScheduleData.length === 0) {
      setFilteredSchedule([]);
      return;
    }

    const startScoringOn = settings?.scoring?.['Start Scoring On'];
    const playoffsStart = settings?.playoffs?.['Playoffs start'];

    if (!startScoringOn) {
      setFilteredSchedule([]);
      return;
    }

    // 解析日期 (格式: YYYY.M.D)
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      const parts = dateStr.split('.');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    };

    const startDate = parseDate(startScoringOn);
    const endDate = playoffsStart ? parseDate(playoffsStart) : null;

    if (!startDate) {
      setFilteredSchedule([]);
      return;
    }

    // 篩選從 startDate 開始、到 endDate（或最後）的週次
    const filtered = allScheduleData.filter((week) => {
      const weekStart = new Date(week.start);
      const weekEnd = new Date(week.end);

      // 週次開始日期必須 >= startScoringOn
      if (weekStart < startDate) {
        return false;
      }

      // 如果有 playoffsStart，週次必須在季後賽前結束
      if (endDate && weekStart >= endDate) {
        return false;
      }

      return true;
    });

    setFilteredSchedule(filtered);
  }, [allScheduleData, settings]);

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
      <div className="mb-8 p-6 bg-white border border-blue-200 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📅 Schedule Preview</h2>
        <p className="text-gray-600">No schedule data available for the selected dates</p>
      </div>
    );
  }

  return (
    <div className="mb-8 p-6 bg-white border border-blue-200 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">📅 Schedule Preview</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-blue-100 border-b-2 border-blue-300">
              <th className="px-4 py-2 text-left font-semibold text-gray-800">Week</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-800">Start Date</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-800">End Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchedule.map((week, index) => (
              <tr
                key={index}
                className="border-b bg-white hover:bg-blue-50"
              >
                <td className="px-4 py-2 font-semibold text-gray-800">{week.week}</td>
                <td className="px-4 py-2 text-gray-600">{week.start}</td>
                <td className="px-4 py-2 text-gray-600">{week.end}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-gray-700">
          <p className="font-semibold">Total: {filteredSchedule.length} weeks</p>
        </div>
      </div>
    </div>
  );
}

const CreateLeaguePage = () => {
  const [settings, setSettings] = useState(() => cloneSettings(initialSettings));
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [leagueId, setLeagueId] = useState(null);

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

  const minDraftDateTime = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1); // tomorrow 00:00
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

    // Validate Playoff fields when Playoffs is not No playoffs
    if (settings.playoffs['Playoffs'] !== 'No playoffs') {
      // Extract playoff teams count from format like "4 teams - 2 weeks"
      const playoffMatch = settings.playoffs['Playoffs'].match(/^(\d+) teams/);
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setLeagueId(result.league_id);
        setSaveMessage(`✅ ${result.message}\nLeague ID: ${result.league_id}`);
        setTimeout(() => setSaveMessage(''), 5000);
      } else {
        setSaveMessage(`❌ 保存失敗: ${result.error || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('保存錯誤:', error);
      setSaveMessage(`❌ 保存失敗: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">建立聯盟</h1>
            <p className="text-gray-600 text-lg">Create a new league</p>
          </div>

          <div className="space-y-8">
            {sections.map((section) => (
              <Card key={section.key} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <CardTitle className="flex items-center gap-3 text-2xl">
                    <span className="text-2xl">{section.icon}</span>
                    {section.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
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
                          return (
                          <tr
                            key={key}
                            className={`${
                              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            } hover:bg-blue-50 transition-colors border-b border-gray-200`}
                          >
                            <td className="px-6 py-4 font-semibold text-gray-700 w-2/5">
                              {key}
                            </td>
                            <td className="px-6 py-4 text-gray-600 w-3/5">
                              {isMultilineField(key) ? (
                                <textarea
                                  value={value}
                                  onChange={(e) =>
                                    handleSettingChange(section.key, key, e.target.value)
                                  }
                                  rows="3"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                />
                              ) : isDateTimeField(key) ? (
                                <input
                                  type="datetime-local"
                                  min={minDraftDateTime()}
                                  value={value}
                                  onChange={(e) => handleSettingChange(section.key, key, e.target.value)}
                                  disabled={settings.general['Draft Type'] !== 'Live Draft'}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                                />
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
                                      
                                      return (
                                        <div key={position} className="flex flex-col gap-1">
                                          <label className="text-sm font-medium text-gray-700">
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
                                            className={`px-2 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                              isOverLimit || isMinorOverLimit
                                                ? 'border-red-500 bg-red-50'
                                                : 'border-gray-300'
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
                                        ? 'text-red-600 font-semibold'
                                        : 'text-gray-600'
                                    }`}>
                                      Non-Minor total: {
                                        Object.entries(value)
                                          .filter(([pos]) => pos !== 'Minor')
                                          .reduce((sum, [, cnt]) => sum + cnt, 0)
                                      } / 25 (max)
                                    </div>
                                    <div className={`${
                                      (value['Minor'] || 0) > 5
                                        ? 'text-red-600 font-semibold'
                                        : 'text-gray-600'
                                    }`}>
                                      Minor: {value['Minor'] || 0} / 5 (max)
                                    </div>
                                  </div>
                                </div>
                              ) : isMultiSelectField(key) ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {settingOptions[key]?.map((option) => (
                                    <label key={option} className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={Array.isArray(value) && value.includes(option)}
                                        disabled={
                                          (!Array.isArray(value) || !value.includes(option)) &&
                                          ((Array.isArray(settings.scoring['Batter Stat Categories']) ? settings.scoring['Batter Stat Categories'].length : 0) +
                                            (Array.isArray(settings.scoring['Pitcher Stat Categories']) ? settings.scoring['Pitcher Stat Categories'].length : 0)) >= 30
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
                                      <span>{option}</span>
                                    </label>
                                  ))}
                                  <div className="text-xs text-gray-500 mt-2">
                                    selected: {(
                                      (Array.isArray(settings.scoring['Batter Stat Categories']) ? settings.scoring['Batter Stat Categories'].length : 0) +
                                      (Array.isArray(settings.scoring['Pitcher Stat Categories']) ? settings.scoring['Pitcher Stat Categories'].length : 0)
                                    )} / 30
                                  </div>
                                </div>
                              ) : isTextField(key) ? (
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) =>
                                    handleSettingChange(section.key, key, e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              ) : (
                                <select
                                  value={value}
                                  onChange={(e) =>
                                    handleSettingChange(section.key, key, e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            {/* 週次預覽表 - 根據設定即時推算 */}
            <SchedulePreview settings={settings} />
          </div>

          <div className="mt-8 flex justify-end gap-4">
            {saveMessage && (
              <div className={`px-4 py-2 rounded-md ${
                saveMessage.includes('✅') 
                  ? 'bg-green-100 text-green-800 border border-green-300' 
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}>
                {saveMessage.split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                setSettings(cloneSettings(initialSettings));
                setSaveMessage('');
                setLeagueId(null);
              }}
              className="px-6 py-2 bg-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-400 transition-colors"
            >
              Reset to Default
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2 font-semibold rounded-md transition-colors ${
                isSaving
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSaving ? 'Creating...' : 'Create a new league'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateLeaguePage;
