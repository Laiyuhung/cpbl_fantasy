import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // 1. Check user status
        const { data: user, error: userError } = await supabaseAdmin
            .from('managers')
            .select('manager_id, name, email_verified, verification_email_sent_count, last_verification_email_sent_at')
            .eq('email_address', email)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.email_verified) {
            return NextResponse.json({ message: 'Email already verified' }, { status: 200 });
        }

        // 2. Rate Limiting Logic (Taiwan Time)
        const MAX_DAILY_EMAILS = 5;
        const taiwanTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' });
        const nowInTaiwan = new Date(taiwanTime);
        const lastSent = user.last_verification_email_sent_at ? new Date(new Date(user.last_verification_email_sent_at).toLocaleString('en-US', { timeZone: 'Asia/Taipei' })) : null;

        let newCount = user.verification_email_sent_count || 0;

        // Reset count if last sent was on a different day
        if (lastSent) {
            const isSameDay = nowInTaiwan.getDate() === lastSent.getDate() &&
                nowInTaiwan.getMonth() === lastSent.getMonth() &&
                nowInTaiwan.getFullYear() === lastSent.getFullYear();
            if (!isSameDay) {
                newCount = 0;
            }
        } else {
            newCount = 0;
        }

        if (newCount >= MAX_DAILY_EMAILS) {
            return NextResponse.json({
                error: 'Daily verification email limit reached (5/day). Please try again tomorrow.'
            }, { status: 429 });
        }

        // 3. Generate new token
        const verification_token = crypto.randomBytes(32).toString('hex');
        const verification_token_expires = new Date();
        verification_token_expires.setHours(verification_token_expires.getHours() + 24);

        // 4. Update user record
        const { error: updateError } = await supabaseAdmin
            .from('managers')
            .update({
                verification_token,
                verification_token_expires: verification_token_expires.toISOString(),
                verification_email_sent_count: newCount + 1,
                last_verification_email_sent_at: new Date().toISOString()
            })
            .eq('manager_id', user.manager_id);

        if (updateError) {
            console.error('Error updating verification token:', updateError);
            return NextResponse.json({ error: 'Failed to update verification status' }, { status: 500 });
        }

        // 5. Send Email
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cpblfantasy.vercel.app';
        const verificationLink = `${baseUrl}/verify-email?token=${verification_token}`;

        await sendVerificationEmail(email, verificationLink, user.name);

        return NextResponse.json({
            success: true,
            message: 'Verification email sent'
        });

    } catch (error) {
        console.error('Resend verification error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
