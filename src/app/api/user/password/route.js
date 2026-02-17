import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function PUT(request) {
    try {
        const body = await request.json();
        const { user_id, currentPassword, newPassword } = body;

        if (!user_id || !currentPassword || !newPassword) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        // 1. Fetch current password hash
        const { data: user, error: fetchError } = await supabase
            .from('managers')
            .select('password')
            .eq('manager_id', user_id)
            .single();

        if (fetchError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 2. Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return NextResponse.json({ error: 'Incorrect current password' }, { status: 401 });
        }

        // 3. Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Update password and force re-login (optional: set must_change_password to false if it was true)
        const { error: updateError } = await supabase
            .from('managers')
            .update({
                password: hashedPassword,
                updated_at: new Date().toISOString(),
                // verification_token: null // Optional: Invalidate any tokens if you have session management logic
            })
            .eq('manager_id', user_id);

        if (updateError) {
            console.error('Error updating password:', updateError);
            return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Password updated successfully. Please log in again.' });

    } catch (error) {
        console.error('Unexpected error changing password:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
