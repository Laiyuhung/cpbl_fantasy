'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/Navbar';

const LeagueSettingsPage = () => {
  const [settings, setSettings] = useState({
    general: {
      'Auto-renew Enabled': 'No',
      'Draft Type': 'Live Standard Draft',
      'Live Draft Pick Time': '1 Minute',
      'Max Teams': '10',
      'Player Universe': 'All baseball',
      'New Players Become Available': 'As soon as Yahoo adds them',
    },
    acquisitions: {
      'Max Acquisitions for Entire Season': 'No maximum',
      'Max Trades for Entire Season': 'No maximum',
      'Trade End Date': 'August 7, 2025',
      'Allow Draft Pick Trades': 'No',
      'Max Acquisitions per Week': '6',
    },
    waivers: {
      'Waiver Time': '2 days',
      'Waiver Type': 'FAB Continual rolling list',
      'Waiver Mode': 'Continuous',
      'Allow injured players from waivers or free agents to be added directly to the injury slot': 'No',
    },
    trading: {
      "Can't Cut List Provider": 'Yahoo Sports',
      'Trade Review': 'League votes',
      'Trade Reject Time': '2 days',
      'Post Draft Players': 'Follow Waiver Rules',
    },
    roster: {
      'Roster Changes': 'Daily - Today',
      'Min Innings pitched per team per week': '20',
      'Roster Positions': 'C, 1B, 2B, 3B, SS, OF, OF, OF, Util, Util, SP, SP, RP, RP, P, P, P, P, BN, BN, BN, BN, BN, IL, IL, IL, IL',
    },
    scoring: {
      'Start Scoring On': 'Week 1',
      'Batter Stat Categories': 'Runs (R), Home Runs (HR), Runs Batted In (RBI), Stolen Bases (SB), Batting Average (AVG)',
      'Pitcher Stat Categories': 'Wins (W), Saves (SV), Strikeouts (K), Earned Run Average (ERA), (Walks + Hits)/ Innings Pitched (WHIP)',
    },
    playoffs: {
      'Playoffs': '6 teams - Weeks 23, 24 and 25 (ends Sunday, September 28th)',
      'Playoff Tie-Breaker': 'Higher seed wins',
      'Playoff Reseeding': 'Yes',
      'Lock Eliminated Teams': 'Yes',
    },
    league: {
      'Divisions': 'No',
      'Make League Publicly Viewable': 'No',
      'Invite Permissions': 'Commissioner Only',
      'Send unjoined players email reminders': 'Yes',
    },
  });

  // 下拉菜單選項
  const settingOptions = {
    'Auto-renew Enabled': ['Yes', 'No'],
    'Draft Type': ['Live Standard Draft', 'Snake Draft', 'Auction Draft', 'Keeper Draft'],
    'Live Draft Pick Time': ['30 Seconds', '1 Minute', '2 Minutes', '3 Minutes', '5 Minutes', '10 Minutes'],
    'Max Teams': ['2', '4', '6', '8', '10', '12', '14'],
    'Player Universe': ['All baseball', 'Home League', 'Own League'],
    'New Players Become Available': ['As soon as Yahoo adds them', 'Immediately', 'Next week'],
    'Max Acquisitions for Entire Season': ['No maximum', '10', '20', '30', '40', '50'],
    'Max Trades for Entire Season': ['No maximum', '5', '10', '15', '20', '25'],
    'Trade End Date': ['No trade deadline', 'June 15', 'July 1', 'July 15', 'August 1', 'August 7', 'August 15', 'August 30'],
    'Allow Draft Pick Trades': ['Yes', 'No'],
    'Waiver Time': ['0 days', '1 day', '2 days', '3 days', '5 days', '7 days'],
    'Waiver Type': ['FAB (Fixed Acquisition Budget)', 'Continual rolling list', 'FAB Continual rolling list'],
    'Waiver Mode': ['Continuous', 'One-time per period', 'Weekly'],
    'Allow injured players from waivers or free agents to be added directly to the injury slot': ['Yes', 'No'],
    "Can't Cut List Provider": ['Yahoo Sports', 'Roster Assistant', 'None'],
    'Trade Review': ['League votes', 'Commissioner reviews', 'No review'],
    'Trade Reject Time': ['0 days', '1 day', '2 days', '3 days', '7 days'],
    'Post Draft Players': ['Follow Waiver Rules', 'First-come-first-served'],
    'Max Acquisitions per Week': ['1', '2', '3', '4', '5', '6', '10', 'No maximum'],
    'Min Innings pitched per team per week': ['0', '5', '10', '15', '20', '25', '30'],
    'Roster Changes': ['Daily - Today', 'Daily - Any day', 'Weekly', 'Every other week'],
    'Start Scoring On': ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    'Playoffs': ['2 teams - 1 week', '4 teams - 2 weeks', '6 teams - 3 weeks', '8 teams - 4 weeks', 'No playoffs'],
    'Playoff Tie-Breaker': ['Higher seed wins', 'Better record wins', 'Head-to-head'],
    'Playoff Reseeding': ['Yes', 'No'],
    'Lock Eliminated Teams': ['Yes', 'No'],
    'Divisions': ['Yes', 'No'],
    'Make League Publicly Viewable': ['Yes', 'No'],
    'Invite Permissions': ['Commissioner Only', 'Managers can invite'],
    'Send unjoined players email reminders': ['Yes', 'No'],
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

  // 判斷是否為多行文本（Roster Positions 和 Stat Categories）
  const isMultilineField = (key) => {
    return ['Roster Positions', 'Batter Stat Categories', 'Pitcher Stat Categories'].includes(key);
  };

  return (
    <>
      <Navbar />
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
                // Reset to default
                setSettings({
                  general: {
                    'Auto-renew Enabled': 'No',
                    'Draft Type': 'Live Standard Draft',
                    'Live Draft Pick Time': '1 Minute',
                    'Max Teams': '10',
                    'Player Universe': 'All baseball',
                    'New Players Become Available': 'As soon as Yahoo adds them',
                  },
                  acquisitions: {
                    'Max Acquisitions for Entire Season': 'No maximum',
                    'Max Trades for Entire Season': 'No maximum',
                    'Trade End Date': 'August 7, 2025',
                    'Allow Draft Pick Trades': 'No',
                    'Max Acquisitions per Week': '6',
                  },
                  waivers: {
                    'Waiver Time': '2 days',
                    'Waiver Type': 'FAB Continual rolling list',
                    'Waiver Mode': 'Continuous',
                    'Allow injured players from waivers or free agents to be added directly to the injury slot': 'No',
                  },
                  trading: {
                    "Can't Cut List Provider": 'Yahoo Sports',
                    'Trade Review': 'League votes',
                    'Trade Reject Time': '2 days',
                    'Post Draft Players': 'Follow Waiver Rules',
                  },
                  roster: {
                    'Roster Changes': 'Daily - Today',
                    'Min Innings pitched per team per week': '20',
                    'Roster Positions': 'C, 1B, 2B, 3B, SS, OF, OF, OF, Util, Util, SP, SP, RP, RP, P, P, P, P, BN, BN, BN, BN, BN, IL, IL, IL, IL',
                  },
                  scoring: {
                    'Start Scoring On': 'Week 1',
                    'Batter Stat Categories': 'Runs (R), Home Runs (HR), Runs Batted In (RBI), Stolen Bases (SB), Batting Average (AVG)',
                    'Pitcher Stat Categories': 'Wins (W), Saves (SV), Strikeouts (K), Earned Run Average (ERA), (Walks + Hits)/ Innings Pitched (WHIP)',
                  },
                  playoffs: {
                    'Playoffs': '6 teams - Weeks 23, 24 and 25 (ends Sunday, September 28th)',
                    'Playoff Tie-Breaker': 'Higher seed wins',
                    'Playoff Reseeding': 'Yes',
                    'Lock Eliminated Teams': 'Yes',
                  },
                  league: {
                    'Divisions': 'No',
                    'Make League Publicly Viewable': 'No',
                    'Invite Permissions': 'Commissioner Only',
                    'Send unjoined players email reminders': 'Yes',
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
