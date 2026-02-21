import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

// Helper: parse W/L/SV/HLD from record string
function parseRecord(record) {
    const w = record && (record.includes('W') || record.includes('勝')) ? 1 : 0;
    const l = record && (record.includes('L') || record.includes('敗')) ? 1 : 0;
    const sv = record && (record.includes('SV') || record.includes('S') || record.includes('救援')) ? 1 : 0;
    const hld = record && (record.includes('HLD') || record.includes('H') || record.includes('中繼')) ? 1 : 0;
    return { w, l, sv, hld };
}

// Helper: calculate pitching derived stats
function calcPitchingStats(g) {
    const ip = parseFloat(g.innings_pitched) || 0;
    // IP format: 5.1 = 5 innings + 1 out = 16 outs, 5.2 = 17 outs
    const outs = Math.floor(ip) * 3 + Math.round((ip * 10) % 10);

    // All calculations use outs/3 as the denominator
    // ERA = ER * 9 / (outs/3) = ER * 27 / outs
    const era = outs > 0 ? ((g.earned_runs || 0) * 27 / outs).toFixed(2) : '-';
    // WHIP = (BB + H) / (outs/3) = (BB + H) * 3 / outs
    const whip = outs > 0 ? (((g.walks || 0) + (g.hits_allowed || 0)) * 3 / outs).toFixed(2) : '-';
    // K/9 = K * 9 / (outs/3) = K * 27 / outs
    const k9 = outs > 0 ? ((g.strikeouts || 0) * 27 / outs).toFixed(2) : '-';
    // BB/9 = BB * 9 / (outs/3) = BB * 27 / outs
    const bb9 = outs > 0 ? ((g.walks || 0) * 27 / outs).toFixed(2) : '-';
    // H/9 = H * 9 / (outs/3) = H * 27 / outs
    const h9 = outs > 0 ? ((g.hits_allowed || 0) * 27 / outs).toFixed(2) : '-';
    const kbb = (g.walks || 0) > 0 ? ((g.strikeouts || 0) / (g.walks || 1)).toFixed(2) : (g.strikeouts || 0);

    // QS: position contains SP, outs >= 18 (6 IP), ER <= 3
    const isStarter = g.position && g.position.includes('SP');
    const qs = isStarter && outs >= 18 && (g.earned_runs || 0) <= 3 ? 1 : 0;

    // SHO: complete_game = 1, runs_allowed = 0
    const sho = g.complete_game === 1 && (g.runs_allowed || 0) === 0 ? 1 : 0;

    // NH: complete_game = 1, hits_allowed = 0
    const nh = g.complete_game === 1 && (g.hits_allowed || 0) === 0 ? 1 : 0;

    const { w, l, sv, hld } = parseRecord(g.record);

    return {
        OUT: outs,
        ERA: era,
        WHIP: whip,
        'K/9': k9,
        'BB/9': bb9,
        'H/9': h9,
        'K/BB': kbb,
        W: w,
        L: l,
        SV: sv,
        HLD: hld,
        'SV+HLD': sv + hld,
        QS: qs,
        SHO: sho,
        NH: nh,
        CG: g.complete_game || 0
    };
}

// Helper: calculate batting derived stats
function calcBattingStats(b) {
    const ab = b?.at_bats ?? 0;
    const h = b?.hits ?? 0;
    const doubles = b?.doubles ?? 0;
    const triples = b?.triples ?? 0;
    const hr = b?.home_runs ?? 0;
    const bb = b?.walks ?? 0;
    const hbp = b?.hbp ?? 0;
    const sf = b?.sacrifice_flies ?? 0;
    const sh = b?.sacrifice_bunts ?? 0;

    const singles = h - doubles - triples - hr;
    const xbh = doubles + triples + hr;
    const tb = singles + doubles * 2 + triples * 3 + hr * 4;
    const pa = ab + bb + hbp + sf + sh;

    const avg = ab > 0 ? (h / ab).toFixed(3) : '-';
    const obp = (ab + bb + hbp + sf) > 0 ? ((h + bb + hbp) / (ab + bb + hbp + sf)).toFixed(3) : '-';
    const slg = ab > 0 ? (tb / ab).toFixed(3) : '-';
    const ops = obp !== '-' && slg !== '-' ? (parseFloat(obp) + parseFloat(slg)).toFixed(3) : '-';

    return {
        '1B': singles,
        '2B': doubles,
        '3B': triples,
        XBH: xbh,
        TB: tb,
        PA: pa,
        AVG: avg,
        OBP: obp,
        SLG: slg,
        OPS: ops
    };
}

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
                .select('game_date, innings_pitched, batters_faced, pitches_thrown, hits_allowed, home_runs_allowed, walks, ibb, hbp, strikeouts, wild_pitches, balks, runs_allowed, earned_runs, errors, era, whip, record, position, complete_game, is_major')
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

                enrichedPitchingGames = enrichedPitchingGames.map(g => {
                    const derived = calcPitchingStats(g);
                    return {
                        game_date: g.game_date,
                        opponent: scheduleMap[g.game_date] || '-',
                        IP: g.innings_pitched,
                        H: g.hits_allowed,
                        R: g.runs_allowed,
                        ER: g.earned_runs,
                        BB: g.walks,
                        K: g.strikeouts,
                        HR: g.home_runs_allowed,
                        HBP: g.hbp,
                        IBB: g.ibb,
                        WP: g.wild_pitches,
                        BK: g.balks,
                        TBF: g.batters_faced,
                        PC: g.pitches_thrown,
                        ...derived
                    };
                });
            } else {
                enrichedPitchingGames = enrichedPitchingGames.map(g => {
                    const derived = calcPitchingStats(g);
                    return {
                        game_date: g.game_date,
                        opponent: '-',
                        IP: g.innings_pitched,
                        H: g.hits_allowed,
                        R: g.runs_allowed,
                        ER: g.earned_runs,
                        BB: g.walks,
                        K: g.strikeouts,
                        HR: g.home_runs_allowed,
                        HBP: g.hbp,
                        IBB: g.ibb,
                        WP: g.wild_pitches,
                        BK: g.balks,
                        TBF: g.batters_faced,
                        PC: g.pitches_thrown,
                        ...derived
                    };
                });
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
            .select('game_date, at_bats, hits, rbis, runs, home_runs, stolen_bases, walks, strikeouts, double_plays, sacrifice_flies, hbp, is_major, caught_stealing, doubles, triples, avg, errors, sacrifice_bunts, ibb')
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
            
            if (!b) {
                return {
                    game_date: sg.date,
                    opponent,
                    has_stats: false,
                    AB: '-', H: '-', R: '-', RBI: '-', HR: '-', SB: '-', BB: '-', K: '-',
                    CS: '-', '2B': '-', '3B': '-', '1B': '-', XBH: '-', TB: '-', PA: '-',
                    AVG: '-', OBP: '-', SLG: '-', OPS: '-', E: '-', SF: '-', SH: '-',
                    HBP: '-', GIDP: '-', IBB: '-'
                };
            }

            const derived = calcBattingStats(b);
            return {
                game_date: sg.date,
                opponent,
                has_stats: true,
                AB: b.at_bats ?? 0,
                H: b.hits ?? 0,
                R: b.runs ?? 0,
                RBI: b.rbis ?? 0,
                HR: b.home_runs ?? 0,
                SB: b.stolen_bases ?? 0,
                BB: b.walks ?? 0,
                K: b.strikeouts ?? 0,
                CS: b.caught_stealing ?? 0,
                '2B': b.doubles ?? 0,
                '3B': b.triples ?? 0,
                E: b.errors ?? 0,
                SF: b.sacrifice_flies ?? 0,
                SH: b.sacrifice_bunts ?? 0,
                HBP: b.hbp ?? 0,
                GIDP: b.double_plays ?? 0,
                IBB: b.ibb ?? 0,
                ...derived
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
