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
        const today = new Date().toISOString().split('T')[0];

        // If pitcher: get last 8 games from pitching_stats_2026
        if (type === 'pitcher') {
            const TARGET_GAMES = 8;

            // First get pitcher's recent games
            const { data: pitchingGames, error: pitchingError } = await supabaseAdmin
                .from('pitching_stats_2026')
                .select('game_date, innings_pitched, batters_faced, pitches_thrown, hits_allowed, home_runs_allowed, walks, ibb, hbp, strikeouts, wild_pitches, balks, runs_allowed, earned_runs, errors, era, whip, record, position, complete_game, is_major')
                .eq('player_id', playerId)
                .eq('is_major', true)
                .order('game_date', { ascending: false })
                .limit(TARGET_GAMES);

            if (pitchingError) {
                console.error('[Recent Games API] Pitching Error:', pitchingError);
                return NextResponse.json({ success: false, error: pitchingError.message }, { status: 500 });
            }

            let enrichedPitchingGames = [];
            const existingDates = new Set();

            // Process existing pitching stats
            if (pitchingGames && pitchingGames.length > 0 && team) {
                const gameDates = pitchingGames.map(g => g.game_date);
                gameDates.forEach(d => existingDates.add(d));

                const { data: scheduleData } = await supabaseAdmin
                    .from('cpbl_schedule_2026')
                    .select('date, home, away')
                    .or(`home.eq.${team},away.eq.${team}`)
                    .in('date', gameDates);

                const scheduleMap = {};
                (scheduleData || []).forEach(s => {
                    scheduleMap[s.date] = s.home === team ? s.away : s.home;
                });

                enrichedPitchingGames = pitchingGames.map(g => {
                    const derived = calcPitchingStats(g);
                    return {
                        game_date: g.game_date,
                        opponent: scheduleMap[g.game_date] || '-',
                        has_stats: true,
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

            // If not enough games, fill with team's upcoming schedule
            if (team && enrichedPitchingGames.length < TARGET_GAMES) {
                const neededGames = TARGET_GAMES - enrichedPitchingGames.length;

                const { data: futureGames } = await supabaseAdmin
                    .from('cpbl_schedule_2026')
                    .select('date, home, away')
                    .or(`home.eq.${team},away.eq.${team}`)
                    .gt('date', today)
                    .order('date', { ascending: true })
                    .limit(neededGames);

                if (futureGames && futureGames.length > 0) {
                    const futureEnriched = futureGames.map(fg => ({
                        game_date: fg.date,
                        opponent: fg.home === team ? fg.away : fg.home,
                        has_stats: false,
                        is_future: true,
                        IP: '-', H: '-', R: '-', ER: '-', BB: '-', K: '-', HR: '-',
                        HBP: '-', IBB: '-', WP: '-', BK: '-', TBF: '-', PC: '-',
                        OUT: '-', ERA: '-', WHIP: '-', 'K/9': '-', 'BB/9': '-', 'H/9': '-', 'K/BB': '-',
                        W: '-', L: '-', SV: '-', HLD: '-', 'SV+HLD': '-', QS: '-', SHO: '-', NH: '-', CG: '-'
                    }));
                    enrichedPitchingGames = [...enrichedPitchingGames, ...futureEnriched];
                }
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

        const TARGET_GAMES = 10;

        // Step 1: Get team's recent completed games from cpbl_schedule_2026
        const { data: pastGames, error: pastError } = await supabaseAdmin
            .from('cpbl_schedule_2026')
            .select('date, home, away, is_postponed')
            .or(`home.eq.${team},away.eq.${team}`)
            .lte('date', today)
            .or('is_postponed.is.null,is_postponed.eq.false') // not postponed
            .order('date', { ascending: false })
            .limit(TARGET_GAMES);

        if (pastError) {
            console.error('[Recent Games API] Schedule Error:', pastError);
            return NextResponse.json({ success: false, error: pastError.message }, { status: 500 });
        }

        let allScheduleGames = pastGames || [];

        // If not enough past games, fill with future games
        if (allScheduleGames.length < TARGET_GAMES) {
            const neededGames = TARGET_GAMES - allScheduleGames.length;

            const { data: futureGames } = await supabaseAdmin
                .from('cpbl_schedule_2026')
                .select('date, home, away')
                .or(`home.eq.${team},away.eq.${team}`)
                .gt('date', today)
                .order('date', { ascending: true })
                .limit(neededGames);

            if (futureGames && futureGames.length > 0) {
                // Mark future games
                const markedFutureGames = futureGames.map(fg => ({ ...fg, is_future: true }));
                allScheduleGames = [...allScheduleGames, ...markedFutureGames];
            }
        }

        if (allScheduleGames.length === 0) {
            return NextResponse.json({
                success: true,
                type: 'batter',
                games: []
            });
        }

        // Step 2: Get batting stats for past game dates only
        const pastGameDates = allScheduleGames.filter(g => !g.is_future).map(g => g.date);

        let battingMap = {};
        if (pastGameDates.length > 0) {
            const { data: battingGames, error: battingError } = await supabaseAdmin
                .from('batting_stats_2026')
                .select('game_date, at_bats, hits, rbis, runs, home_runs, stolen_bases, walks, strikeouts, double_plays, sacrifice_flies, hbp, is_major, caught_stealing, doubles, triples, avg, errors, sacrifice_bunts, ibb')
                .eq('player_id', playerId)
                .eq('is_major', true)
                .in('game_date', pastGameDates)
                .order('game_date', { ascending: false });

            if (battingError) {
                console.error('[Recent Games API] Batting Error:', battingError);
                return NextResponse.json({ success: false, error: battingError.message }, { status: 500 });
            }

            (battingGames || []).forEach(g => {
                battingMap[g.game_date] = g;
            });
        }

        // Build enriched games
        const enrichedGames = allScheduleGames.map(sg => {
            const opponent = sg.home === team ? sg.away : sg.home;

            // Future game - no stats possible
            if (sg.is_future) {
                return {
                    game_date: sg.date,
                    opponent,
                    has_stats: false,
                    is_future: true,
                    AB: '-', H: '-', R: '-', RBI: '-', HR: '-', SB: '-', BB: '-', K: '-',
                    CS: '-', '2B': '-', '3B': '-', '1B': '-', XBH: '-', TB: '-', PA: '-',
                    AVG: '-', OBP: '-', SLG: '-', OPS: '-', E: '-', SF: '-', SH: '-',
                    HBP: '-', GIDP: '-', IBB: '-'
                };
            }

            const b = battingMap[sg.date];
            
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
