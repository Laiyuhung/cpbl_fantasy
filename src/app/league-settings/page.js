'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LeagueSettingsPage = () => {
  const [settings, setSettings] = useState({
    general: {
      'League Name': 'My League',
      'Draft Type': 'Live Draft',
      'Live Draft Pick Time': '1 Minute',
      'Max Teams': '6',
    },
    acquisitions: {
      'Trade End Date': 'August 7, 2025',
      'Max Acquisitions per Week': '6',
    },
    waivers: {
      'Waiver Players Unfreeze Time': '2 days',
      'Allow injured players from waivers or free agents to be added directly to the injury slot': 'No',
    },
    trading: {
      'Trade Review': 'League votes',
      'Trade Reject Time': '2 days',
      'Trade Reject percentage': '50%',
      'Post Draft Players  Unfreeze Time': '1 day',
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
      'Batter Stat Categories': [
        'Runs (R)',
        'Home Runs (HR)',
        'Runs Batted In (RBI)',
        'Stolen Bases (SB)',
        'Batting Average (AVG)'
      ],
      'Pitcher Stat Categories': [
        'Wins (W)',
        'Saves (SV)',
        'Strikeouts (K)',
        'Earned Run Average (ERA)',
        '(Walks + Hits)/ Innings Pitched (WHIP)'
      ],
    },
    playoffs: {
      'Playoffs': '6 teams - Weeks 23, 24 and 25 (ends Sunday, September 28th)',
      'Playoff Tie-Breaker': 'Higher seed wins',
      'Playoff Reseeding': 'Yes',
      'Lock Eliminated Teams': 'Yes',
    },
    league: {

      'Make League Publicly Viewable': 'No',
      'Invite Permissions': 'Commissioner Only',
    },
  });

  // 下拉菜單選項
  const settingOptions = {
    'League Name': [],
    'Draft Type': ['Live Draft', 'Offline Draft'],
    'Live Draft Pick Time': ['30 Seconds', '1 Minute', '2 Minutes', '3 Minutes'],
    'Max Teams': ['4', '6', '8', '10'],
    'Trade End Date': ['No trade deadline', 'June 15', 'July 1', 'July 15', 'August 1', 'August 7', 'August 15', 'August 30'],
    'Waiver Players Unfreeze Time': ['0 days', '1 day', '2 days', '3 days', '5 days', '7 days'],
    'Allow injured players from waivers or free agents to be added directly to the injury slot': ['Yes', 'No'],

    'Trade Review': ['League votes', 'Commissioner reviews', 'No review'],
    'Trade Reject Time': ['0 days', '1 day', '2 days', '3 days', '7 days'],
    'Trade Reject percentage': [ '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'],
    'Post Draft Players  Unfreeze Time': [ '1 day', '2 days', '3 days'],

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
    'Playoff Tie-Breaker': ['Higher seed wins', 'Better record wins', 'Head-to-head'],
    'Playoff Reseeding': ['Yes', 'No'],
    'Lock Eliminated Teams': ['Yes', 'No'],

    'Make League Publicly Viewable': ['Yes', 'No'],
    'Invite Permissions': ['Commissioner Only', 'Managers can invite'],
  };

  const sections = [
    { key: 'general', label: '基本設定 (General Settings)', icon: '⚙️' },
    { key: 'acquisitions', label: '交易與獲取 (Acquisitions & Trading)', icon: '🔄' },
    { key: 'waivers', label: '自由球員 (Waiver Settings)', icon: '📋' },
    { key: 'trading', label: '交易審核 (Trade Settings)', icon: '🤝' },
    { key: 'roster', label: '名單 (Roster Settings)', icon: '👥' },
    { key: 'scoring', label: '計分 (Scoring Settings)', icon: '📊' },
    { key: 'playoffs', label: '季後賽 (Playoff Settings)', icon: '🏆' },
    { key: 'league', label: '聯盟 (League Settings)', icon: '🏟️' },
  ];

  const handleSettingChange = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  // 欄位類型判斷
  const isMultilineField = (key) => {
    return [].includes(key);
  };

  const isMultiSelectField = (key) => {
    return ['Batter Stat Categories', 'Pitcher Stat Categories'].includes(key);
  };

  const isTextField = (key) => {
    return ['League Name'].includes(key);
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

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">聯盟設定</h1>
            <p className="text-gray-600 text-lg">League Settings</p>
          </div>

          {/* Settings Sections */}
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
                        {Object.entries(settings[section.key]).map(([key, value], index) => (
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
                                      非 Minor 總計: {
                                        Object.entries(value)
                                          .filter(([pos]) => pos !== 'Minor')
                                          .reduce((sum, [, cnt]) => sum + cnt, 0)
                                      } / 25
                                    </div>
                                    <div className={`${
                                      (value['Minor'] || 0) > 5
                                        ? 'text-red-600 font-semibold'
                                        : 'text-gray-600'
                                    }`}>
                                      Minor: {value['Minor'] || 0} / 5
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
                                    已選擇: {(
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
                                  {settingOptions[key] && settingOptions[key].map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Save Button */}
          <div className="mt-8 flex justify-end gap-4">
            <button
              onClick={() => {
                // Reset to default (aligned with current shapes)
                setSettings({
                  general: {
                    'League Name': 'My League',
                    'Draft Type': 'Live Draft',
                    'Live Draft Pick Time': '1 Minute',
                    'Max Teams': '6',
                  },
                  acquisitions: {
                    'Trade End Date': 'August 7, 2025',
                    'Max Acquisitions per Week': '6',
                  },
                  waivers: {
                    'Waiver Players Unfreeze Time': '2 days',
                    'Allow injured players from waivers or free agents to be added directly to the injury slot': 'No',
                  },
                  trading: {
                    'Trade Review': 'League votes',
                    'Trade Reject Time': '2 days',
                    'Trade Reject percentage': '50%',
                    'Post Draft Players  Unfreeze Time': '1 day',
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
                    'Batter Stat Categories': [
                      'Runs (R)',
                      'Home Runs (HR)',
                      'Runs Batted In (RBI)',
                      'Stolen Bases (SB)',
                      'Batting Average (AVG)'
                    ],
                    'Pitcher Stat Categories': [
                      'Wins (W)',
                      'Saves (SV)',
                      'Strikeouts (K)',
                      'Earned Run Average (ERA)',
                      '(Walks + Hits)/ Innings Pitched (WHIP)'
                    ],
                  },
                  playoffs: {
                    'Playoffs': '6 teams - Weeks 23, 24 and 25 (ends Sunday, September 28th)',
                    'Playoff Tie-Breaker': 'Higher seed wins',
                    'Playoff Reseeding': 'Yes',
                    'Lock Eliminated Teams': 'Yes',
                  },
                  league: {
                    'Make League Publicly Viewable': 'No',
                    'Invite Permissions': 'Commissioner Only',
                  },
                });
              }}
              className="px-6 py-2 bg-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-400 transition-colors"
            >
              重置 (Reset)
            </button>
            <button
              onClick={() => {
                alert('聯盟設定已保存 (League settings saved!)');
              }}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
            >
              保存設定 (Save Settings)
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default LeagueSettingsPage;
