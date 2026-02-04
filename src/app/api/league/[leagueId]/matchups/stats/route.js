import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseServer';

export async function GET(request, { params }) {
    const { leagueId } = params;
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');

    if (!leagueId) {
        return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    if (!week) {
        return NextResponse.json({ error: 'Week number is required' }, { status: 400 });
    }

    try {
        // 1. Fetch League Settings (for scoring categories)
        const { data: settings, error: settingsError } = await supabase
            .from('league_settings')
            .select('scoring_type, batter_stat_categories, pitcher_stat_categories')
            .eq('league_id', leagueId)
            .single();

        if (settingsError) {
            console.error('Error fetching league settings:', settingsError);
            return NextResponse.json({ error: 'Failed to fetch league settings' }, { status: 500 });
        }

        // 2. Fetch Matchups for the week
        const { data: matchups, error: matchupsError } = await supabase
            .from('league_matchups')
            .select('*')
            .eq('league_id', leagueId)
            .eq('week_number', week);

        if (matchupsError) {
            console.error('Error fetching matchups:', matchupsError);
            return NextResponse.json({ error: 'Failed to fetch matchups' }, { status: 500 });
        }

        // 3. Fetch Weekly Stats for all managers in this league and week
        const { data: stats, error: statsError } = await supabase
            .from('v_weekly_manager_stats')
            .select('*')
            .eq('league_id', leagueId)
            .eq('week_number', week);

        if (statsError) {
            console.error('Error fetching stats:', statsError);
            return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
        }

        // 4. Combine data
        const statsMap = {};
        if (stats) {
            stats.forEach(stat => {
                statsMap[stat.manager_id] = stat;
            });
        }

        const enrichedMatchups = matchups.map(match => {
            // 使用正確的欄位名稱：manager_id_a 和 manager_id_b
            const manager1Id = match.manager_id_a || match.manager1_id || match.manager_id_1 || match.team_a_id;
            const manager2Id = match.manager_id_b || match.manager2_id || match.manager_id_2 || match.team_b_id;

            const stats1 = statsMap[manager1Id] || generateEmptyStats(settings.batter_stat_categories, settings.pitcher_stat_categories);
            const stats2 = statsMap[manager2Id] || generateEmptyStats(settings.batter_stat_categories, settings.pitcher_stat_categories);

            return {
                ...match,
                manager1_stats: stats1,
                manager2_stats: stats2,
                manager1_id: manager1Id,
                manager2_id: manager2Id
            };
        });

        // Fetch manager details (names, avatars) for the IDs
        const managerIds = [...new Set(enrichedMatchups.flatMap(m => [m.manager1_id, m.manager2_id]).filter(Boolean))];

        let managersMap = {};
        if (managerIds.length > 0) {
            // 查詢 league_members.nickname 和 managers.name
            const { data: members, error: membersError } = await supabase
                .from('league_members')
                .select('manager_id, nickname, managers (name)')
                .eq('league_id', leagueId)
                .in('manager_id', managerIds);

            if (!membersError && members) {
                members.forEach(m => {
                    managersMap[m.manager_id] = {
                        nickname: m.nickname,
                        name: m.managers?.name || ''
                    };
                });
            } else if (membersError) {
                console.error("Error fetching league members:", membersError);
            }
        }

        const finalMatchups = enrichedMatchups.map(m => {
            const manager1Data = managersMap[m.manager1_id];
            const manager2Data = managersMap[m.manager2_id];

            return {
                ...m,
                manager1: manager1Data ? {
                    nickname: manager1Data.nickname || 'Unknown',
                    team_name: manager1Data.name || 'Team A'
                } : { nickname: 'Unknown', team_name: 'Team A' },
                manager2: manager2Data ? {
                    nickname: manager2Data.nickname || 'Unknown',
                    team_name: manager2Data.name || 'Team B'
                } : { nickname: 'Unknown', team_name: 'Team B' }
            };
        });

        return NextResponse.json({
            success: true,
            matchups: finalMatchups,
            settings: {
                batter_categories: settings.batter_stat_categories,
                pitcher_categories: settings.pitcher_stat_categories,
                scoring_type: settings.scoring_type
            }
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}

function generateEmptyStats(batterCats, pitcherCats) {
    const stats = {
        b_gp: 0, b_ab: 0, b_r: 0, b_h: 0, b_1b: 0, b_2b: 0, b_3b: 0, b_hr: 0,
        b_xbh: 0, b_tb: 0, b_rbi: 0, b_bb: 0, b_hbp: 0, b_k: 0, b_sb: 0,
        b_cs: 0, b_gidp: 0, b_cyc: 0, b_e: 0, b_avg: 0, b_obp: 0, b_slg: 0, b_ops: 0,
        p_app: 0, p_gs: 0, p_ip: 0, p_w: 0, p_l: 0, p_sv: 0, p_hld: 0,
        p_svhld: 0, p_k: 0, p_qs: 0, p_cg: 0, p_sho: 0, p_nh: 0, p_era: 0,
        p_whip: 0, "p_k/9": 0, "p_bb/9": 0, "p_k/bb": 0, "p_win%": 0
    };
    return stats;
}
