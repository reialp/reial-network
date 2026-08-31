import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

async function getPesapalToken() {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim();
  const environment = process.env.PESAPAL_ENVIRONMENT || 'production';
  const baseUrl = environment === 'sandbox'
    ? 'https://cybqa.pesapal.com/pesapalv3/api'
    : 'https://pay.pesapal.com/v3/api';

  console.log('🔑 Getting Pesapal token... Environment:', environment);

  const authResponse = await fetch(`${baseUrl}/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  });

  if (!authResponse.ok) {
    const errorText = await authResponse.text();
    console.error('❌ Auth failed:', authResponse.status, errorText);
    throw new Error(`Auth failed: ${authResponse.status} ${errorText}`);
  }

  const authData = await authResponse.json();
  console.log('✅ Auth token obtained');
  return { token: authData.token, baseUrl };
}

async function verifyTransactionStatus(orderTrackingId: string) {
  console.log('🔍 Verifying transaction:', orderTrackingId);
  
  const { token, baseUrl } = await getPesapalToken();
  const res = await fetch(
    `${baseUrl}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { 
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Accept': 'application/json' 
      } 
    }
  );
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ GetTransactionStatus failed:', res.status, errorText);
    throw new Error(`GetTransactionStatus failed: ${res.status} ${errorText}`);
  }
  
  const data = await res.json();
  console.log('✅ Verification result:', data);
  return data;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderMerchantReference = url.searchParams.get('OrderMerchantReference');
  const orderTrackingId = url.searchParams.get('OrderTrackingId');

  console.log('🔍 Callback received:', { 
    orderMerchantReference, 
    orderTrackingId,
    allParams: Object.fromEntries(url.searchParams.entries())
  });

  if (!orderMerchantReference) {
    console.error('❌ Missing OrderMerchantReference');
    return NextResponse.redirect(new URL('/library?payment=failed&reason=missing_ref', req.url));
  }

  try {
    const supabase = await createClient();

    // ✅ If we have a tracking ID, verify with Pesapal directly
    if (orderTrackingId) {
      console.log('🔍 Verifying transaction with Pesapal using tracking ID:', orderTrackingId);
      
      try {
        const verified = await verifyTransactionStatus(orderTrackingId);
        console.log('🔒 Verified status:', verified.status_code, verified.payment_status_description);

        if (verified.status_code === 1) {
          // ✅ Payment is COMPLETED - update purchase immediately
          console.log('✅ Payment completed! Updating purchase:', orderMerchantReference);
          
          const { error: updateError } = await supabase
            .from('purchases')
            .update({
              pesapal_transaction_id: orderTrackingId,
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', orderMerchantReference);

          if (updateError) {
            console.error('❌ Failed to update purchase:', updateError);
            return NextResponse.redirect(new URL('/library?payment=failed&reason=update_error', req.url));
          }

          console.log('✅ Purchase updated to completed via callback:', orderMerchantReference);
          
          // ✅ Get the watch token and redirect to library with success
          const { data: purchase } = await supabase
            .from('purchases')
            .select('watch_token')
            .eq('id', orderMerchantReference)
            .single();

          return NextResponse.redirect(new URL('/library?payment=success', req.url));
        } else if (verified.status_code === 2) {
          // Payment FAILED
          console.log('❌ Payment failed:', verified.payment_status_description);
          return NextResponse.redirect(new URL('/library?payment=failed', req.url));
        } else {
          // Payment is still pending or invalid
          console.log('⏳ Payment status:', verified.status_code, verified.payment_status_description);
          return NextResponse.redirect(
            new URL(`/library?payment=pending&ref=${orderMerchantReference}`, req.url)
          );
        }
      } catch (verifyError) {
        console.error('❌ Verification failed:', verifyError);
        // Don't fail completely - check database as fallback
      }
    }

    // ✅ Fallback: Check database status
    console.log('🔍 Checking database status for purchase:', orderMerchantReference);
    const { data: purchase, error } = await supabase
      .from('purchases')
      .select('status, watch_token')
      .eq('id', orderMerchantReference)
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.redirect(new URL('/library?payment=failed&reason=db_error', req.url));
    }

    console.log('📊 Database status:', purchase?.status);

    if (purchase?.status === 'completed') {
      return NextResponse.redirect(new URL('/library?payment=success', req.url));
    }

    // Still pending - show pending page
    console.log('⏳ Payment still pending in database');
    return NextResponse.redirect(
      new URL(`/library?payment=pending&ref=${orderMerchantReference}`, req.url)
    );
  } catch (error) {
    console.error('❌ Callback error:', error);
    return NextResponse.redirect(new URL('/library?payment=failed&reason=exception', req.url));
  }
}
