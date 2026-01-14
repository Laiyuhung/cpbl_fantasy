import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📥 Received registration data:', body);
    const { name, email_address, password } = body;

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

    // Insert new manager
    const { data, error } = await supabase
      .from('managers')
      .insert([
        {
          name,
          email_address,
          password,
          must_change_password: false
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

    return NextResponse.json(
      {
        success: true,
        message: 'User registered successfully',
        user: {
          manager_id: data[0].manager_id,
          name: data[0].name,
          email_address: data[0].email_address
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
