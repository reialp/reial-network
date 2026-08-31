import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

async function getPesapalToken() {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim()
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim()
  const environment = process.env.PESAPAL_ENVIRONMENT || 'production'

  const baseUrl = environment === 'sandbox'
    ? 'https://cybqa.pesapal.com/pesapalv3/api'
    : 'https://pay.pesapal.com/v3/api'

  if (!consumerKey || !consumerSecret ) {
    throw new Error('Pesapal credentials are missing')
  }

  const response = await fetch(`${baseUrl}/Auth/RequestToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Pesapal authentication failed: ${response.status} ${errorText}`
    )
  }

  const data = await response.json()

  if (!data.token) {
    throw new Error('Pesapal did not return an authentication token')
  }

  return {
    token: data.token as string,
    baseUrl,
  }
}

async function verifyTransactionStatus(orderTrackingId: string) {
  const { token, baseUrl } = await getPesapalToken()

  const response = await fetch(
    `${baseUrl}/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Pesapal status lookup failed: ${response.status} ${errorText}`
    )
  }

  return response.json()
}

export type FinalizeResult = {
  state:
    | 'completed'
    | 'already_completed'
    | 'not_completed'
    | 'amount_mismatch'
    | 'not_found'
  purchaseId?: string
}

export async function finalizePurchase(
  purchaseId: string,
  orderTrackingId: string
): Promise<FinalizeResult> {
  if (!purchaseId || !orderTrackingId) {
    throw new Error('Missing purchase ID or Pesapal tracking ID')
  }

  // Ask Pesapal directly whether the payment really succeeded.
  const verified = await verifyTransactionStatus(orderTrackingId)

  const statusCode = Number(verified.status_code)

  // Status code 1 means the transaction is completed.
  if (statusCode !== 1) {
    return {
      state: 'not_completed',
      purchaseId,
    }
  }

  const verifiedAmount = Number(verified.amount)

  if (!Number.isFinite(verifiedAmount)) {
    throw new Error('Pesapal returned an invalid payment amount')
  }

  // This uses the Supabase service-role key on the server only.
  const supabase = createAdminClient()

  // This database function completes the purchase, credits the creator,
  // and increments sales exactly once.
  const { data, error } = await supabase.rpc('finalize_purchase', {
    p_purchase_id: purchaseId,
    p_tracking_id: orderTrackingId,
    p_verified_amount: verifiedAmount,
  })

  if (error) {
    throw new Error(`Purchase finalization failed: ${error.message}`)
  }

  const result = data as { state?: FinalizeResult['state'] } | null

  return {
    state: result?.state || 'completed',
    purchaseId,
  }
}
