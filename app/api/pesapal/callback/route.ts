import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

async function getPesapalToken() {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim();
  const environment = process.env.PESAPAL_ENVIRONMENT || 'production';
  const baseUrl = environment === 'sandbox'
    ? 'https://cybqa.pesapal.com/pesapalv3/api'
    : 'https://pay.pesapal.com/v3/api';

  const authResponse = await fetch(`${baseUrl}/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  });

  if (!authResponse.ok) {
    throw new Error(`Auth failed: ${authResponse.status}`);
  }

  const authData = await authResponse.json();
  return { token: authData.token, baseUrl };
}

async function verifyTransactionStatus(orderTrackingId: string) {
  const { token, baseUrl } = await getPesapalToken();
  const res = await fetch(
    `${baseUrl}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
  );
  if (!res.ok) {
    throw new Error(`GetTransactionStatus failed: ${res.status}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderMerchantReference = url.searchParams.get('OrderMerchantReference');
  const orderTrackingId = url.searchParams.get('OrderTrackingId');

  console.log('🔍 Callback received:', { orderMerchantReference, orderTrackingId });

  if (!orderMerchantReference) {
    return NextResponse.redirect(new URL('/library?payment=failed', req.url));
  }

  try {
    const supabase = await createClient();

    // ✅ If we have a tracking ID, verify with Pesapal directly
    if (orderTrackingId) {
      console.log('🔍 Verifying transaction with Pesapal:', orderTrackingId);
      
      try {
        const verified = await verifyTransactionStatus(orderTrackingId);
        console.log('🔒 Verified status:', verified.status_code, verified.payment_status_description);

        if (verified.status_code === 1) {
          // ✅ Payment is COMPLETED - update purchase immediately
          const { error: updateError } = await supabase
            .from('purchases')
            .update({
              pesapal_transaction_id: orderTrackingId,
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', orderMerchantReference);

          if (!updateError) {
            console.log('✅ Purchase updated to completed via callback:', orderMerchantReference);
            
            // ✅ Get the watch token and redirect
            const { data: purchase } = await supabase
              .from('purchases')
              .select('watch_token')
              .eq('id', orderMerchantReference)
              .single();

            if (purchase?.watch_token) {
              return NextResponse.redirect(new URL(`/library?payment=success`, req.url));
            }
          }
        } else if (verified.status_code === 2) {
          // Payment FAILED
          console.log('❌ Payment failed:', verified.payment_status_description);
          return NextResponse.redirect(new URL('/library?payment=failed', req.url));
        }
      } catch (verifyError) {
        console.error('❌ Verification failed:', verifyError);
        // Continue to fallback
      }
    }

    // ✅ Fallback: Check database status
    const { data: purchase, error } = await supabase
      .from('purchases')
      .select('status, watch_token')
      .eq('id', orderMerchantReference)
      .single();

    if (purchase?.status === 'completed') {
      return NextResponse.redirect(new URL(`/library?payment=success`, req.url));
    }

    // Still pending - try one more verification with retry
    if (orderTrackingId) {
      // If we have a tracking ID but verification failed, retry after 2 seconds
      console.log('⏳ Payment still pending, will retry verification...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const verified = await verifyTransactionStatus(orderTrackingId);
        if (verified.status_code === 1) {
          const { error: updateError } = await supabase
            .from('purchases')
            .update({
              pesapal_transaction_id: orderTrackingId,
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', orderMerchantReference);

          if (!updateError) {
            console.log('✅ Purchase updated to completed via retry:', orderMerchantReference);
            return NextResponse.redirect(new URL('/library?payment=success', req.url));
          }
        }
      } catch (retryError) {
        console.error('❌ Retry failed:', retryError);
      }
    }

    // Still pending - show pending page
    console.log('⏳ Payment still pending, showing pending page');
    return NextResponse.redirect(
      new URL(`/library?payment=pending&ref=${orderMerchantReference}`, req.url)
    );
  } catch (error) {
    console.error('❌ Callback error:', error);
    return NextResponse.redirect(new URL('/library?payment=failed', req.url));
  }
}
