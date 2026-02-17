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

        if (!user_id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // 1. Fetch current user data
        const { data: currentUser, error: fetchError } = await supabaseAdmin
            .from('managers')
            .select('name, email_address, verification_email_sent_count, last_verification_email_sent_at')
            .eq('manager_id', user_id)
            .single();

        if (fetchError) {
            console.error('Error fetching current user:', fetchError);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const updateData = {};
        let message = 'Profile updated successfully';
        let emailUpdateSuccess = false;

        // --- Handle Name Update ---
        if (name && name !== currentUser.name) {
            updateData.name = name;
        }

        // --- Handle Email Update ---
        if (email && email !== currentUser.email_address) {
            // Check availability
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

            // --- Rate Limiting Logic ---
            const taiwanTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' });
            const nowInTaiwan = new Date(taiwanTime);

            let currentCount = currentUser.verification_email_sent_count || 0;
            const lastSent = currentUser.last_verification_email_sent_at ? new Date(new Date(currentUser.last_verification_email_sent_at).toLocaleString('en-US', { timeZone: 'Asia/Taipei' })) : null;

            // Check if last sent was "today" in Taiwan
            const isSameDay = lastSent &&
                lastSent.getFullYear() === nowInTaiwan.getFullYear() &&
                lastSent.getMonth() === nowInTaiwan.getMonth() &&
                lastSent.getDate() === nowInTaiwan.getDate();

            if (!isSameDay) {
                currentCount = 0;
            }

            if (currentCount >= 5) {
                return NextResponse.json({ error: 'Daily email verification limit reached (5/day). Please try again tomorrow.' }, { status: 429 });
            }

            // Prepare verification data
            const verification_token = crypto.randomBytes(32).toString('hex');
            const verification_token_expires = new Date();
            verification_token_expires.setHours(verification_token_expires.getHours() + 24);

            updateData.email_address = email;
            updateData.email_verified = false;
            updateData.verification_token = verification_token;
            updateData.verification_token_expires = verification_token_expires.toISOString();
            updateData.verification_email_sent_count = currentCount + 1;
            updateData.last_verification_email_sent_at = new Date().toISOString(); // Store UTC for timestamp

            message = 'Profile updated. Please verify your new email address (check inbox and spam).';
            emailUpdateSuccess = true;

            // Send Verification Email
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cpblfantasy.vercel.app';
            const verificationLink = `${baseUrl}/verify-email?token=${verification_token}`;

            try {
                await sendVerificationEmail(email, verificationLink, name || currentUser.name || 'Manager');
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError);
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ success: true, message: 'No changes made.' });
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
