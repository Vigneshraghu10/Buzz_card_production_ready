import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createRazorpayOrder, verifyRazorpaySignature } from "./razorpay";

export async function registerRoutes(app: Express): Promise<Server> {
  // Razorpay order creation endpoint
  app.post('/api/create-razorpay-order', async (req, res) => {
    try {
      const { planId, amount, userId } = req.body;
      
      if (!planId || !amount || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const orderData = createRazorpayOrder(planId, amount);
      
      // You would typically create this order with Razorpay SDK here
      // For now, we'll create a mock order ID
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      res.json({
        orderId,
        amount: orderData.amount,
        currency: orderData.currency,
        receipt: orderData.receipt
      });
    } catch (error: any) {
      console.error('Error creating Razorpay order:', error);
      res.status(500).json({ error: 'Failed to create payment order' });
    }
  });

  // Razorpay payment verification endpoint
  app.post('/api/verify-razorpay-payment', async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        userId,
        planId
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Missing payment verification data' });
      }

      const isValidSignature = verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValidSignature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }

      // Payment is verified - you can update your database here
      console.log(`Payment verified for user ${userId}, plan ${planId}`);
      
      res.json({
        success: true,
        message: 'Payment verified successfully'
      });
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      res.status(500).json({ error: 'Payment verification failed' });
    }
  });

  // Subscription status endpoint
  app.get('/api/subscription/:userId', (req, res) => {
    // For now, return a default response since subscription system is not fully implemented
    // In a real implementation, you would query your database for subscription data
    res.json({
      hasSubscription: false,
      planName: null,
      endDate: null,
      isActive: false
    });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);

  return httpServer;
}
