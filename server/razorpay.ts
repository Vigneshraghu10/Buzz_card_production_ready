import crypto from 'crypto';

// Razorpay configuration
export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

/**
 * Verify Razorpay payment signature
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  if (!RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay key secret not configured');
  }

  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Create Razorpay order data
 */
export function createRazorpayOrder(planId: string, amount: number) {
  return {
    amount: amount * 100, // Convert to paise
    currency: 'INR',
    receipt: `receipt_${planId}_${Date.now()}`,
    notes: {
      planId: planId
    }
  };
}