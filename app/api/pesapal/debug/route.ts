import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
    const baseUrl = 'https://pay.pesapal.com/v3/api';

    // 1. Get Token
    const authRes = await fetch(`${baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret } )
    });
    const { token } = await authRes.json();

    // 2. Get Registered IPNs
    const ipnRes = await fetch(`${baseUrl}/URLSetup/GetIpnList`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    const ipns = await ipnRes.json();
    
    return NextResponse.json(ipns);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
