import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

// GET: Fetch user profile
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const { data: user, error } = await supabase
            .from('managers')
            .select('name, email_address')
            .eq('manager_id', userId)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
        }

        return NextResponse.json({ success: true, user });
    } catch (error) {
        console.error('Unexpected error fetching profile:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT: Update user profile
export async function PUT(request) {
    try {
        const body = await request.json();
        const { user_id, name, email } = body;

        if (!user_id || !name || !email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { error } = await supabase
            .from('managers')
            .update({ name, email_address: email, updated_at: new Date().toISOString() })
            .eq('manager_id', user_id);

        if (error) {
            console.error('Error updating profile:', error);
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Unexpected error updating profile:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
