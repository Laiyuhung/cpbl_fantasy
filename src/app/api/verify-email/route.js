import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Find user with this token
    const { data: users, error: findError } = await supabase
      .from('managers')
      .select('manager_id, email_verified, verification_token_expires, name')
      .eq('verification_token', token);

    if (findError) {
      console.error('Error finding user:', findError);
      return NextResponse.json(
        { error: 'Failed to verify email' },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 404 }
      );
    }

    const user = users[0];

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'Email already verified',
          alreadyVerified: true 
        },
        { status: 200 }
      );
    }

    // Check if token expired
    const now = new Date();
    const expiresAt = new Date(user.verification_token_expires);
    
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Verification token has expired. Please request a new verification email.' },
        { status: 410 }
      );
    }

    // Update user as verified
    const { error: updateError } = await supabase
      .from('managers')
      .update({
        email_verified: true,
        verification_token: null,
        verification_token_expires: null
      })
      .eq('manager_id', user.manager_id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { error: 'Failed to verify email' },
        { status: 500 }
      );
    }

    console.log('✅ Email verified for user:', user.name);

    return NextResponse.json(
      {
        success: true,
        message: 'Email verified successfully! You can now log in.',
        userName: user.name
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Email verification error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
