import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('player_id');
    const team = searchParams.get('team');
    const type = searchParams.get('type'); // 'pitcher' or 'batter'

    if (!playerId) {
        return NextResponse.json({ success: false, error: 'player_id is required' }, { status: 400 });
    }

    try {
        // If pitcher: get last 8 games from pitching_stats_2026
        if (type === 'pitcher') {
            const { data: pitchingGames, error: pitchingError } = await supabaseAdmin
                .from('pitching_stats_2026')
                .select('game_date, innings_pitched, hits_allowed, runs_allowed, earned_runs, walks, strikeouts, home_runs_allowed, era, whip, record, is_major, win, loss, save, hold, quality_start, blown_save, pickoff, wild_pitch, hit_by_pitch, balk, games')
                .eq('player_id', playerId)
                .eq('is_major', true)
                .order('game_date', { ascending: false })
                .limit(8);

            if (pitchingError) {
                console.error('[Recent Games API] Pitching Error:', pitchingError);
                return NextResponse.json({ success: false, error: pitchingError.message }, { status: 500 });
            }

            // If team is provided, enrich with opponent info from schedule
            let enrichedPitchingGames = pitchingGames || [];
            if (team && enrichedPitchingGames.length > 0) {
                const gameDates = enrichedPitchingGames.map(g => g.game_date);
                const { data: scheduleData } = await supabaseAdmin
                    .from('cpbl_schedule_2026')
                    .select('date, home_team, away_team')
                    .or(`home_team.eq.${team},away_team.eq.${team}`)
                    .in('date', gameDates);

                const scheduleMap = {};
                (scheduleData || []).forEach(s => {
                    scheduleMap[s.date] = s.home_team === team ? s.away_team : s.home_team;
                });

                enrichedPitchingGames = enrichedPitchingGames.map(g => ({
                    game_date: g.game_date,
                    opponent: scheduleMap[g.game_date] || '-',
                    IP: g.innings_pitched,
                    H: g.hits_allowed,
                    R: g.runs_allowed,
                    ER: g.earned_runs,
                    BB: g.walks,
                    K: g.strikeouts,
                    HR: g.home_runs_allowed,
                    ERA: g.era,
                    WHIP: g.whip,
                    W: g.win,
                    L: g.loss,
                    SV: g.save,
                    HLD: g.hold,
                    QS: g.quality_start,
                    BS: g.blown_save,
                    PO: g.pickoff,
                    WP: g.wild_pitch,
                    HBP: g.hit_by_pitch,
                    BK: g.balk
                }));
            } else {
                // Map to consistent field names
                enrichedPitchingGames = enrichedPitchingGames.map(g => ({
                    game_date: g.game_date,
                    opponent: '-',
                    IP: g.innings_pitched,
                    H: g.hits_allowed,
                    R: g.runs_allowed,
                    ER: g.earned_runs,
                    BB: g.walks,
                    K: g.strikeouts,
                    HR: g.home_runs_allowed,
                    ERA: g.era,
                    WHIP: g.whip,
                    W: g.win,
                    L: g.loss,
                    SV: g.save,
                    HLD: g.hold,
                    QS: g.quality_start,
                    BS: g.blown_save,
                    PO: g.pickoff,
                    WP: g.wild_pitch,
                    HBP: g.hit_by_pitch,
                    BK: g.balk
                }));
            }

            return NextResponse.json({
                success: true,
                type: 'pitcher',
                games: enrichedPitchingGames
            });
        }

        // If batter: need to get team's last 10 game dates, then fetch batting stats for those dates
        if (!team) {
            return NextResponse.json({ success: false, error: 'team is required for batters' }, { status: 400 });
        }

        // Step 1: Get team's recent 10 game dates from cpbl_schedule_2026 (completed games)
        const today = new Date().toISOString().split('T')[0];
        
        const { data: scheduleGames, error: scheduleError } = await supabaseAdmin
            .from('cpbl_schedule_2026')
            .select('date, home_team, away_team, home_score, away_score')
            .or(`home_team.eq.${team},away_team.eq.${team}`)
            .lte('date', today)
            .not('home_score', 'is', null) // completed games only
            .order('date', { ascending: false })
            .limit(10);

        if (scheduleError) {
            console.error('[Recent Games API] Schedule Error:', scheduleError);
            return NextResponse.json({ success: false, error: scheduleError.message }, { status: 500 });
        }

        if (!scheduleGames || scheduleGames.length === 0) {
            return NextResponse.json({
                success: true,
                type: 'batter',
                games: []
            });
        }

        // Step 2: Get batting stats for those dates
        const gameDates = scheduleGames.map(g => g.date);

        const { data: battingGames, error: battingError } = await supabaseAdmin
            .from('batting_stats_2026')
            .select('game_date, at_bat, hits, rbi, runs, homerun, stolen_base, walk, strikeout, double_play, sacrifice_fly, hit_by_pitch, is_major, caught_stealing, double_hit, triple_hit, batting_average, obp, slg, total_bases, error_play, plate_appearance, games')
            .eq('player_id', playerId)
            .eq('is_major', true)
            .in('game_date', gameDates)
            .order('game_date', { ascending: false });

        if (battingError) {
            console.error('[Recent Games API] Batting Error:', battingError);
            return NextResponse.json({ success: false, error: battingError.message }, { status: 500 });
        }

        // Match up with schedule dates to show "no appearance" games
        const battingMap = {};
        (battingGames || []).forEach(g => {
            battingMap[g.game_date] = g;
        });

        const enrichedGames = scheduleGames.map(sg => {
            const b = battingMap[sg.date];
            const opponent = sg.home_team === team ? sg.away_team : sg.home_team;
            return {
                game_date: sg.date,
                opponent,
                has_stats: !!b,
                AB: b?.at_bat ?? '-',
                H: b?.hits ?? '-',
                R: b?.runs ?? '-',
                RBI: b?.rbi ?? '-',
                HR: b?.homerun ?? '-',
                SB: b?.stolen_base ?? '-',
                BB: b?.walk ?? '-',
                K: b?.strikeout ?? '-',
                CS: b?.caught_stealing ?? '-',
                '2B': b?.double_hit ?? '-',
                '3B': b?.triple_hit ?? '-',
                AVG: b?.batting_average ?? '-',
                OBP: b?.obp ?? '-',
                SLG: b?.slg ?? '-',
                TB: b?.total_bases ?? '-',
                E: b?.error_play ?? '-',
                PA: b?.plate_appearance ?? '-',
                SF: b?.sacrifice_fly ?? '-',
                HBP: b?.hit_by_pitch ?? '-',
                GIDP: b?.double_play ?? '-'
            };
        });

        return NextResponse.json({
            success: true,
            type: 'batter',
            games: enrichedGames
        });

    } catch (error) {
        console.error('[Recent Games API] Server Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
