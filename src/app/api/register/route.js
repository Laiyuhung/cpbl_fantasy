import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📥 Received registration data:', body);
    const { name, email, password } = body;
    const email_address = email; // Map email to email_address

    console.log('Parsed fields:', {
      name,
      email_address,
      password: password ? '***' : undefined
    });

    // Validate required fields
    if (!name || !email_address || !password) {
      console.log('❌ Validation failed - missing fields');
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('managers')
      .select('manager_id')
      .eq('email_address', email_address);

    if (checkError) {
      console.error('Error checking existing user:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing user' },
        { status: 500 }
      );
    }

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'Email address already registered' },
        { status: 409 }
      );
    }

    // Generate verification token
    const verification_token = crypto.randomBytes(32).toString('hex');
    const verification_token_expires = new Date();
    verification_token_expires.setHours(verification_token_expires.getHours() + 24); // 24 hours expiry

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new manager
    const { data, error } = await supabase
      .from('managers')
      .insert([
        {
          name,
          email_address,
          password: hashedPassword,
          must_change_password: false,
          email_verified: false,
          verification_token,
          verification_token_expires: verification_token_expires.toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Error creating user:', error);
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Send verification email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cpblfantasy.vercel.app';
    const verificationLink = `${baseUrl}/verify-email?token=${verification_token}`;
    
    try {
      await sendVerificationEmail(email_address, verificationLink, name);
      console.log('✅ Verification email sent to:', email_address);
    } catch (emailError) {
      console.error('❌ Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but log it
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
        user: {
          manager_id: data[0].manager_id,
          name: data[0].name,
          email_address: data[0].email_address,
          email_verified: false
        }
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Registration error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
