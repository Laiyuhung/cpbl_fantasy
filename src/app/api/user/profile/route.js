import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/email';

// GET: Fetch user profile
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const { data: user, error } = await supabaseAdmin
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

        // 1. Fetch current user data to check if email changed
        const { data: currentUser, error: fetchError } = await supabaseAdmin
            .from('managers')
            .select('email_address')
            .eq('manager_id', user_id)
            .single();

        if (fetchError) {
            console.error('Error fetching current user:', fetchError);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const emailChanged = currentUser.email_address !== email;
        const updateData = {
            name,
            updated_at: new Date().toISOString()
        };

        let message = 'Profile updated successfully';

        if (emailChanged) {
            // Check if new email is already taken
            const { data: existingUsers, error: checkError } = await supabaseAdmin
                .from('managers')
                .select('manager_id')
                .eq('email_address', email);

            if (checkError) {
                return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }

            if (existingUsers && existingUsers.length > 0) {
                return NextResponse.json({ error: 'Email address already in use' }, { status: 409 });
            }

            // Prepare verification data
            const verification_token = crypto.randomBytes(32).toString('hex');
            const verification_token_expires = new Date();
            verification_token_expires.setHours(verification_token_expires.getHours() + 24);

            updateData.email_address = email;
            updateData.email_verified = false;
            updateData.verification_token = verification_token;
            updateData.verification_token_expires = verification_token_expires.toISOString();

            message = 'Profile updated. Please verify your new email address (check inbox and spam).';

            // Send Verification Email
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cpblfantasy.vercel.app';
            const verificationLink = `${baseUrl}/verify-email?token=${verification_token}`;

            try {
                await sendVerificationEmail(email, verificationLink, name);
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
                // Continue with update even if email fails, but warn user? 
                // Ideally we rollback or warn, but for now we proceed.
            }
        }

        const { error } = await supabaseAdmin
            .from('managers')
            .update(updateData)
            .eq('manager_id', user_id);

        if (error) {
            console.error('Error updating profile:', error);
            return NextResponse.json({ error: 'Failed to update profile', details: error.message, code: error.code }, { status: 500 });
        }

        return NextResponse.json({ success: true, message });
    } catch (error) {
        console.error('Unexpected error updating profile:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
