import { NextResponse } from 'next/server';
import pool from '../../../../../lib/db';

export async function GET(request, { params }) {
    const { leagueId } = params;
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('manager_id');

    if (!leagueId || !managerId) {
        return NextResponse.json({ success: false, error: 'Missing league_id or manager_id' }, { status: 400 });
    }

    try {
        // Calculate Today's Date in Taiwan Time (UTC+8)
        const now = new Date();
        const taiwanDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
        const formattedDate = taiwanDate.toISOString().split('T')[0]; // YYYY-MM-DD

        const client = await pool.connect();
        try {
            const query = `
        SELECT r.id, r.position, r.player_id, p.name, p.team, p.position_list, p.batter_or_pitcher
        FROM league_roster_positions r
        JOIN player_list p ON r.player_id = p.player_id
        WHERE r.league_id = $1 AND r.manager_id = $2 AND r.game_date = $3
        ORDER BY
          CASE
            WHEN r.position = 'C' THEN 1
            WHEN r.position = '1B' THEN 2
            WHEN r.position = '2B' THEN 3
            WHEN r.position = '3B' THEN 4
            WHEN r.position = 'SS' THEN 5
            WHEN r.position = 'OF' THEN 6
            WHEN r.position = 'DH' THEN 7
            WHEN r.position = 'SP' THEN 8
            WHEN r.position = 'RP' THEN 9
            WHEN r.position = 'BN' THEN 10
            WHEN r.position = 'IL' THEN 11
            ELSE 12
          END
      `;
            const values = [leagueId, managerId, formattedDate];
            const res = await client.query(query, values);

            return NextResponse.json({
                success: true,
                date: formattedDate,
                roster: res.rows
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching roster:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
