import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

// GET - Fetch chat messages for a league
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueId = searchParams.get('league_id');
        const limit = parseInt(searchParams.get('limit') || '50');
        const before = searchParams.get('before'); // For pagination (timestamp)

        if (!leagueId) {
            return NextResponse.json({ success: false, error: 'league_id is required' }, { status: 400 });
        }

        let query = supabaseAdmin
            .from('league_chat')
            .select(`
                id,
                league_id,
                manager_id,
                message,
                message_type,
                created_at,
                managers:manager_id (
                    manager_name,
                    nickname
                )
            `)
            .eq('league_id', leagueId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (before) {
            query = query.lt('created_at', before);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching chat:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Reverse to show oldest first in the array
        const messages = (data || []).reverse();

        return NextResponse.json({ success: true, messages });
    } catch (err) {
        console.error('Unexpected error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Send a new chat message
export async function POST(request) {
    try {
        const body = await request.json();
        const { league_id, manager_id, message, message_type = 'chat' } = body;

        if (!league_id || !manager_id || !message) {
            return NextResponse.json({ success: false, error: 'league_id, manager_id, and message are required' }, { status: 400 });
        }

        // Validate message length
        if (message.length > 500) {
            return NextResponse.json({ success: false, error: 'Message is too long (max 500 characters)' }, { status: 400 });
        }

        // Insert the message
        const { data, error } = await supabaseAdmin
            .from('league_chat')
            .insert({
                league_id,
                manager_id,
                message: message.trim(),
                message_type
            })
            .select(`
                id,
                league_id,
                manager_id,
                message,
                message_type,
                created_at,
                managers:manager_id (
                    manager_name,
                    nickname
                )
            `)
            .single();

        if (error) {
            console.error('Error sending message:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: data });
    } catch (err) {
        console.error('Unexpected error:', err);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
