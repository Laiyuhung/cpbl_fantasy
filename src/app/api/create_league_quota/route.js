import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      );
    }

    // Fetch product IDs from payments
    const { data: payments, error: paymentError } = await supabase
      .from('portaly_payments')
      .select('product_id')
      .eq('buyer_email', userEmail)
      .is('verified_at', null);

    if (paymentError) {
      console.error('Error fetching payments:', paymentError);
      return NextResponse.json(
        { error: 'Failed to fetch payments' },
        { status: 500 }
      );
    }

    const productIds = payments.map(payment => payment.product_id);

    // Fetch product names and quotas from product_id_match
    const { data: products, error: productError } = await supabase
      .from('protaly_product_id_match')
      .select('product_name')
      .in('protaly_product_id', productIds);

    if (productError) {
      console.error('Error fetching product matches:', productError);
      return NextResponse.json(
        { error: 'Failed to fetch product matches' },
        { status: 500 }
      );
    }

    // Filter products to only include those with product_name = '新增聯盟額度'
    const filteredProducts = products.filter(product => product.product_name === '新增聯盟額度');

    if (filteredProducts.length === 0) {
      return NextResponse.json(
        { error: 'No valid quota products found' },
        { status: 403 }
      );
    }

    return NextResponse.json({ products: filteredProducts });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}