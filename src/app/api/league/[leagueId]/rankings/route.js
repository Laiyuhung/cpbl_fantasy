import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Map League Settings strings to View Columns
const BATTER_STAT_MAP = {
    'Games Played (GP)': 'z_gp',
    'Plate Appearances (PA)': 'z_pa',
    'At Bats (AB)': 'z_ab',
    'Hits (H)': 'z_h',
    'Singles (1B)': 'z_1b',
    'Doubles (2B)': 'z_2b',
    'Triples (3B)': 'z_3b',
    'Home Runs (HR)': 'z_hr',
    'Extra Base Hits (XBH)': 'z_xbh',
    'Total Bases (TB)': 'z_tb',
    'Runs (R)': 'z_r',
    'Runs Batted In (RBI)': 'z_rbi',
    'Strikeouts (K)': 'z_k', // Already inverted in view if bad? usually bad for batters? No, usually K is bad for batters. View handles inversion? I'll assume Yes as per previous SQL logic context.
    'Walks (BB)': 'z_bb',
    'Hit By Pitch (HBP)': 'z_hbp',
    'Sacrifice Hits (SH)': 'z_sh',
    'Sacrifice Flies (SF)': 'z_sf',
    'Stolen Bases (SB)': 'z_sb',
    'Caught Stealing (CS)': 'z_cs', // Inverted in view
    'Ground Into Double Play (GIDP)': 'z_gidp', // Inverted in view
    'Hitting for the Cycle (CYC)': 'z_cyc',
    'Batting Average (AVG)': 'z_avg',
    'On-base Percentage (OBP)': 'z_obp',
    'Slugging Percentage (SLG)': 'z_slg',
    'On-base + Slugging Percentage (OPS)': 'z_ops'
};

const PITCHER_STAT_MAP = {
    'Appearances (APP)': 'z_app',
    'Games Started (GS)': 'z_gs',
    'Relief Appearances (RAPP)': 'z_rapp',
    'Innings Pitched (IP)': 'z_ip',
    'Outs (OUT)': 'z_out',
    'Total Batters Faced (TBF)': 'z_tbf',
    'Pitch Count (PC)': 'z_pc',
    'Wins (W)': 'z_w',
    'Losses (L)': 'z_l', // Inverted
    'Holds (HLD)': 'z_hld',
    'Saves (SV)': 'z_sv',
    'Saves + Holds (SV+HLD)': 'z_svhld',
    'Relief Wins (RW)': 'z_rw',
    'Relief Losses (RL)': 'z_rl', // Inverted
    'Hits (H)': 'z_h', // Inverted
    'Home Runs (HR)': 'z_hr', // Inverted
    'Strikeouts (K)': 'z_k',
    'Walks (BB)': 'z_bb', // Inverted
    'Intentional Walks (IBB)': 'z_ibb', // Inverted
    'Hit Batters (HBP)': 'z_hbp', // Inverted
    'Runs Allowed (RA)': 'z_ra', // Inverted
    'Earned Runs (ER)': 'z_er', // Inverted
    'Quality Starts (QS)': 'z_qs',
    'Complete Games (CG)': 'z_cg',
    'Shutouts (SHO)': 'z_sho',
    'Perfect Games (PG)': 'z_pg',
    'No Hitters (NH)': 'z_nh',
    'Earned Run Average (ERA)': 'z_era', // Inverted
    '(Walks + Hits)/ Innings Pitched (WHIP)': 'z_whip', // Inverted
    'Winning Percentage (WIN%)': 'z_win%',
    'Strikeouts per Nine Innings (K/9)': 'z_k/9',
    'Walks Per Nine Innings (BB/9)': 'z_bb/9', // Inverted
    'Strikeout to Walk Ratio (K/BB)': 'z_k/bb',
    'Hits Per Nine Innings (H/9)': 'z_h/9', // Inverted
    'On-base Percentage Against (OBPA)': 'z_obpa' // Inverted
};

export async function GET(request, { params }) {
    try {
        const { leagueId } = params;
        const { searchParams } = new URL(request.url);
        const timeWindow = searchParams.get('time_window') || '2025 Season'; // Fallback

        if (!leagueId) {
            return NextResponse.json({ error: 'League ID required' }, { status: 400 });
        }

        // 1. Fetch League Settings
        const { data: leagueSettings, error: settingsError } = await supabase
            .from('league_settings')
            .select('batter_stat_categories, pitcher_stat_categories')
            .eq('league_id', leagueId)
            .single();

        if (settingsError) {
            return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
        }

        const activeBatterCats = leagueSettings.batter_stat_categories || [];
        const activePitcherCats = leagueSettings.pitcher_stat_categories || [];

        // 2. Fetch Z-Score Views
        const [batResponse, pitchResponse, playersResponse] = await Promise.all([
            supabase.from('v_batting_scoring').select('*').eq('time_window', timeWindow),
            supabase.from('v_pitching_scoring').select('*').eq('time_window', timeWindow),
            // Fetch player details (team, position) separately if views don't have them
            supabase.from('players').select('player_id, team, position_list')
        ]);

        if (batResponse.error || pitchResponse.error || playersResponse.error) {
            console.error('Data fetch error', batResponse.error, pitchResponse.error, playersResponse.error);
            return NextResponse.json({
                error: 'Failed to fetch stats',
                details: {
                    bat: batResponse.error,
                    pitch: pitchResponse.error,
                    players: playersResponse.error
                }
            }, { status: 500 });
        }

        const batData = batResponse.data || [];
        const pitchData = pitchResponse.data || [];

        // Map player details
        const playerMap = new Map();
        (playersResponse.data || []).forEach(p => {
            playerMap.set(p.player_id, p);
        });

        const rankingsMap = new Map();

        // 3. Calculate Batter Scores
        batData.forEach(player => {
            let batTotal = 0;
            activeBatterCats.forEach(cat => {
                const col = BATTER_STAT_MAP[cat];
                if (col && player[col] !== undefined && player[col] !== null) {
                    batTotal += Number(player[col]);
                }
            });

            const current = rankingsMap.get(player.player_id) || {
                player_id: player.player_id,
                name: player.player_name,
                bat_z: 0,
                pitch_z: 0,
                total_z: 0
            };

            current.bat_z = batTotal;
            current.total_z += batTotal;
            rankingsMap.set(player.player_id, current);
        });

        // 4. Calculate Pitcher Scores
        pitchData.forEach(player => {
            let pitchTotal = 0;
            activePitcherCats.forEach(cat => {
                const col = PITCHER_STAT_MAP[cat];
                if (col && player[col] !== undefined && player[col] !== null) {
                    // Special handling for columns with special chars like % or /
                    // Supabase/PostgREST usually returns them as keys. 
                    // We need to double check if the view returns 'z_k/9' as a key or something else.
                    // Assuming standard JSON response keys match the column names.
                    pitchTotal += Number(player[col]);
                }
            });

            const current = rankingsMap.get(player.player_id) || {
                player_id: player.player_id,
                name: player.player_name,
                bat_z: 0,
                pitch_z: 0,
                total_z: 0
            };

            current.pitch_z = pitchTotal;
            current.total_z += pitchTotal;
            rankingsMap.set(player.player_id, current);
        });

        // 5. Convert to Array, Enrich, and Sort
        const rankings = Array.from(rankingsMap.values()).map(r => {
            const details = playerMap.get(r.player_id);
            return {
                ...r,
                team: details?.team || null,
                positions: details?.position_list || null,
                // Round for display
                bat_z: Number(r.bat_z.toFixed(2)),
                pitch_z: Number(r.pitch_z.toFixed(2)),
                total_z: Number(r.total_z.toFixed(2))
            };
        });

        // Sort by Total Z Descending
        rankings.sort((a, b) => b.total_z - a.total_z);

        // Add Rank index
        const rankedList = rankings.map((item, index) => ({
            rank: index + 1,
            ...item
        }));

        return NextResponse.json({
            success: true,
            rankings: rankedList
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
