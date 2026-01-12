'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    'Batter Stat Categories': [
      'Runs (R)',
      'Home Runs (HR)',
      'Runs Batted In (RBI)',
      'Stolen Bases (SB)',
      'Batting Average (AVG)',
    ],
    'Pitcher Stat Categories': [
      'Wins (W)',
      'Saves (SV)',
      'Strikeouts (K)',
      'Earned Run Average (ERA)',
      '(Walks + Hits)/ Innings Pitched (WHIP)',
    ],
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
  'Playoffs': ['2 teams - 1 week', '4 teams - 2 weeks', '6 teams - 3 weeks', '8 teams - 4 weeks', 'No playoffs'],
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

const mapDbToSettings = (data) => ({
  general: {
    'League Name': data.league_name ?? baseSettings.general['League Name'],
    'Draft Type': data.draft_type ?? baseSettings.general['Draft Type'],
    'Live Draft Pick Time': data.live_draft_pick_time ?? baseSettings.general['Live Draft Pick Time'],
    'Live Draft Time': data.live_draft_time ?? baseSettings.general['Live Draft Time'],
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
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
        setTimeout(() => setSaveMessage(''), 5000);
      } else {
        setSaveMessage(`❌ 更新失敗: ${result.error || '未知錯誤'}`);
      }
    } catch (err) {
      console.error('更新錯誤:', err);
      setSaveMessage(`❌ 更新失敗: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-700">
        Loading league settings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-red-700">
        <div className="text-xl font-semibold">Failed to load league settings</div>
        <div className="text-sm">{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">編輯聯盟設定</h1>
            <p className="text-gray-600 text-lg">Edit league settings (ID: {leagueId})</p>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-sm font-semibold border border-blue-200">
              <span>Status:</span>
              <span>{status || 'unknown'}</span>
            </div>
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
                          // playoffs 不再因 No playoffs 而收起
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
                                  {settingOptions[key] && settingOptions[key].map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
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
                setSettings(cloneSettings(baseSettings));
                setSaveMessage('');
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
              {isSaving ? 'Saving...' : 'Update league settings'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditLeagueSettingsPage;
