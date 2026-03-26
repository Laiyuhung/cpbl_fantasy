import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') || searchParams.get('manager_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 1) 查玩家資料（manager）
    const { data: managerRows, error: managerError } = await supabase
      .from('managers')
      .select('manager_id, email_address')
      .eq('manager_id', userId);

    const managerCount = managerRows?.length || 0;
    console.log(`[create_league_quota] 玩家 ${userId} 查找到 managers 資料筆數: ${managerCount}`);

    if (managerError || managerCount === 0) {
      return NextResponse.json(
        { error: 'Manager not found' },
        { status: 404 }
      );
    }

    const email_address = managerRows[0].email_address;
    console.log(`[create_league_quota] 玩家 ${userId} 對應 email: ${email_address || 'null'}`);

    if (!email_address) {
      return NextResponse.json(
        { error: 'Manager email_address is missing' },
        { status: 400 }
      );
    }

    // 2) 查該 email 全部付款（含已用/未用）
    const { data: allPayments, error: allPaymentError } = await supabase
      .from('portaly_payments')
      .select('id, order_id, product_id, verified_at')
      .eq('buyer_email', email_address);

    if (allPaymentError) {
      return NextResponse.json(
        { error: 'Failed to fetch all payments' },
        { status: 500 }
      );
    }

    console.log(`[create_league_quota] email=${email_address} 查到訂單筆數: ${(allPayments || []).length}`);

    const allProductIds = (allPayments || []).map(payment => payment.product_id).filter(Boolean);

    if (!allProductIds.length) {
      console.log(`[create_league_quota] 玩家 ${userId} 的付款紀錄中，聯盟新增額度總筆數: 0`);
      console.log(`[create_league_quota] 玩家 ${userId} 的付款紀錄中，聯盟新增額度且未使用(verified_at is null)筆數: 0`);
      return NextResponse.json({ success: true, quota: 0, products: [] });
    }

    // 2-1) 顯示訂單 product_id 對應 product_name 比對過程
    const { data: allProductMaps, error: allProductMapError } = await supabase
      .from('protaly_product_id_match')
      .select('protaly_product_id, product_name')
      .in('protaly_product_id', allProductIds);

    if (allProductMapError) {
      return NextResponse.json(
        { error: 'Failed to fetch full product mapping' },
        { status: 500 }
      );
    }

    const allProductNameMap = new Map((allProductMaps || []).map(item => [item.protaly_product_id, item.product_name]));

    (allPayments || []).forEach((payment) => {
      const mappedName = allProductNameMap.get(payment.product_id) || '未對應到產品名稱';
      const usedText = payment.verified_at == null ? '未使用' : '已使用';
      console.log(
        `[create_league_quota] 訂單比對 order_id=${payment.order_id || payment.id}, product_id=${payment.product_id}, product_name=${mappedName}, verified_at=${payment.verified_at || 'null'} (${usedText})`
      );
    });

    // 3) 先找出 product_name=新增聯盟額度 的 product_id 清單
    const { data: quotaProductMaps, error: quotaMapError } = await supabase
      .from('protaly_product_id_match')
      .select('protaly_product_id, product_name')
      .in('protaly_product_id', allProductIds)
      .eq('product_name', '新增聯盟額度');

    if (quotaMapError) {
      return NextResponse.json(
        { error: 'Failed to fetch product matches' },
        { status: 500 }
      );
    }

    const quotaProductIdSet = new Set((quotaProductMaps || []).map(item => item.protaly_product_id));

    // 聯盟新增額度「總筆數」（含已使用）
    const allLeagueQuotaPayments = (allPayments || []).filter(payment => quotaProductIdSet.has(payment.product_id));
    const allLeagueQuotaCount = allLeagueQuotaPayments.length;

    // 聯盟新增額度「未使用筆數」（verified_at is null）
    const unusedLeagueQuotaPayments = allLeagueQuotaPayments.filter(payment => payment.verified_at == null);
    const unusedLeagueQuotaCount = unusedLeagueQuotaPayments.length;

    console.log(`[create_league_quota] 玩家 ${userId} 的付款紀錄中，聯盟新增額度總筆數: ${allLeagueQuotaCount}`);
    console.log(`[create_league_quota] 玩家 ${userId} 的付款紀錄中，聯盟新增額度且未使用(verified_at is null)筆數: ${unusedLeagueQuotaCount}`);

    // 保持原先 API 回傳: quota = 可用(未使用)額度數
    const { data: payments, error: paymentError } = await supabase
      .from('portaly_payments')
      .select('product_id')
      .eq('buyer_email', email_address)
      .is('verified_at', null);

    if (paymentError) {
      return NextResponse.json(
        { error: 'Failed to fetch payments' },
        { status: 500 }
      );
    }

    const productIds = payments.map(payment => payment.product_id);

    if (!productIds.length) {
      return NextResponse.json({ success: true, quota: 0, products: [] });
    }

    // Fetch product names and quotas from product_id_match
    const { data: products, error: productError } = await supabase
      .from('protaly_product_id_match')
      .select('product_name')
      .in('protaly_product_id', productIds);

    if (productError) {
      return NextResponse.json(
        { error: 'Failed to fetch product matches' },
        { status: 500 }
      );
    }

    const filteredProducts = (products || []).filter(product => product.product_name === '新增聯盟額度');

    return NextResponse.json({
      success: true,
      quota: filteredProducts.length,
      products: filteredProducts
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}