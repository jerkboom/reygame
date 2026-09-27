import crypto from 'crypto';

export interface PaystackInitResult {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerificationResult {
  success: boolean;
  status: 'success' | 'failed' | 'abandoned' | 'pending' | 'mismatch' | 'unknown';
  reference: string;
  currency?: string;
  amountPesewas?: number;
  amountGHS?: number;
  channel?: string;
  paidAt?: string;
  customerEmail?: string;
  errorMessage?: string;
  raw?: any;
}

export function isRealPaystackKeyConfigured(): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY;
  return Boolean(key && key.startsWith('sk_') && !key.includes('xxxxxxxx'));
}

export function getPaystackGatewayStatus(): {
  provider: string;
  currency: string;
  configured: boolean;
  mode: 'TEST' | 'LIVE' | 'NOT_CONFIGURED';
  publicKey: string | null;
} {
  const key = process.env.PAYSTACK_SECRET_KEY;
  const isConfigured = isRealPaystackKeyConfigured();
  let mode: 'TEST' | 'LIVE' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
  if (isConfigured && key) {
    mode = key.startsWith('sk_test_') ? 'TEST' : 'LIVE';
  }

  const publicKey =
    process.env.VITE_PAYSTACK_PUBLIC_KEY ||
    process.env.PAYSTACK_PUBLIC_KEY ||
    null;

  return {
    provider: 'Paystack',
    currency: 'GHS',
    configured: isConfigured,
    mode,
    publicKey,
  };
}

/**
 * Initializes a real Paystack transaction server-side.
 * Secret key is NEVER exposed to the client.
 * Amount is sent in pesewas (GHS amount * 100).
 */
export async function initializePaystackTransaction(params: {
  email: string;
  amountGHS: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, any>;
}): Promise<PaystackInitResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const amountInPesewas = Math.round(params.amountGHS * 100);

  if (!secretKey || !isRealPaystackKeyConfigured()) {
    console.error('[Paystack] PAYSTACK_SECRET_KEY is not configured on the server.');
    return {
      status: false,
      message: 'Payment gateway configuration required: PAYSTACK_SECRET_KEY is missing or invalid on the server.',
    };
  }

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        amount: amountInPesewas,
        currency: 'GHS',
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
      }),
    });

    const resData = await response.json();
    if (response.ok && resData.status && resData.data?.authorization_url) {
      return {
        status: true,
        message: resData.message || 'Authorization URL created',
        data: {
          authorization_url: resData.data.authorization_url,
          access_code: resData.data.access_code,
          reference: resData.data.reference || params.reference,
        },
      };
    }

    console.error('[Paystack] API initialize error:', resData);
    return {
      status: false,
      message: resData.message || 'Failed to initialize payment transaction with Paystack.',
    };
  } catch (err: any) {
    console.error('[Paystack] Connection error:', err);
    return {
      status: false,
      message: 'Network error communicating with Paystack payment gateway.',
    };
  }
}

/**
 * Verifies a transaction with Paystack server-side via GET /transaction/verify/:reference.
 * Mandatory validations:
 * - data.status === "success"
 * - data.reference === expected reference
 * - data.currency === "GHS"
 * - data.amount === expected amount in pesewas
 */
export async function verifyPaystackTransaction(
  reference: string,
  expectedOrder?: {
    amountGHS: number;
    currency?: string;
  }
): Promise<PaystackVerificationResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey || !isRealPaystackKeyConfigured()) {
    return {
      success: false,
      status: 'unknown',
      reference,
      errorMessage: 'PAYSTACK_SECRET_KEY is not configured on server.',
    };
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    const json = await response.json();

    if (!response.ok || !json.status || !json.data) {
      return {
        success: false,
        status: 'failed',
        reference,
        errorMessage: json.message || 'Paystack could not verify this reference.',
        raw: json,
      };
    }

    const data = json.data;
    const paidPesewas = Number(data.amount) || 0;
    const paidGHS = paidPesewas / 100;
    const currency = data.currency;
    const status = data.status; // 'success', 'failed', 'abandoned'

    // Reference verification: MUST match requested reference (case-insensitive)
    if (
      !data.reference ||
      data.reference.trim().toLowerCase() !== reference.trim().toLowerCase()
    ) {
      return {
        success: false,
        status: 'mismatch',
        reference,
        currency,
        amountPesewas: paidPesewas,
        amountGHS: paidGHS,
        errorMessage: `Reference mismatch: requested "${reference}", received "${data.reference}".`,
        raw: data,
      };
    }

    // Status check
    if (status !== 'success') {
      return {
        success: false,
        status: status === 'abandoned' ? 'abandoned' : 'failed',
        reference: data.reference,
        currency,
        amountPesewas: paidPesewas,
        amountGHS: paidGHS,
        channel: data.channel,
        paidAt: data.paid_at,
        customerEmail: data.customer?.email,
        errorMessage: data.gateway_response || `Payment status is ${status}.`,
        raw: data,
      };
    }

    // Currency verification: MUST be GHS
    if (currency !== 'GHS') {
      return {
        success: false,
        status: 'mismatch',
        reference,
        currency,
        amountPesewas: paidPesewas,
        amountGHS: paidGHS,
        errorMessage: `Currency mismatch: expected GHS, received ${currency}.`,
        raw: data,
      };
    }

    // Exact amount verification if expected amount is provided
    if (expectedOrder && typeof expectedOrder.amountGHS === 'number') {
      const expectedPesewas = Math.round(expectedOrder.amountGHS * 100);
      if (paidPesewas !== expectedPesewas) {
        return {
          success: false,
          status: 'mismatch',
          reference,
          currency,
          amountPesewas: paidPesewas,
          amountGHS: paidGHS,
          errorMessage: `Amount mismatch: expected ${expectedPesewas} pesewas (GH₵ ${expectedOrder.amountGHS.toFixed(2)}), received ${paidPesewas} pesewas (GH₵ ${paidGHS.toFixed(2)}).`,
          raw: data,
        };
      }
    }

    return {
      success: true,
      status: 'success',
      reference: data.reference,
      currency,
      amountPesewas: paidPesewas,
      amountGHS: paidGHS,
      channel: data.channel,
      paidAt: data.paid_at,
      customerEmail: data.customer?.email,
      raw: data,
    };
  } catch (err: any) {
    console.error('[Paystack] Verification connection error:', err);
    return {
      success: false,
      status: 'unknown',
      reference,
      errorMessage: err.message || 'Connection error during Paystack verification.',
    };
  }
}

/**
 * Validates Paystack Webhook HMAC SHA-512 signature using raw request body.
 */
export function verifyPaystackWebhookSignature(
  rawBody: string | Buffer,
  signature: string
): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !signature) {
    return false;
  }
  try {
    const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
    return hash === signature;
  } catch (err) {
    console.error('[Paystack] Error calculating webhook HMAC signature:', err);
    return false;
  }
}
