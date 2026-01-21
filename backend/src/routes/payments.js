const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authenticateMerchant = require('../middleware/auth');
const { handleIdempotency, cacheIdempotentResponse } = require('../middleware/idempotency');
const { paymentQueue } = require('../config/queues');
const { generatePaymentId } = require('../utils/idGenerator');
const { enqueueWebhook } = require('../services/webhookService');

// Create payment
router.post('/', authenticateMerchant, handleIdempotency, async (req, res) => {
  try {
    const { order_id, method, vpa, card_number, cvv, expiry } = req.body;
    const merchantId = req.merchant.id;

    // Validation
    if (!order_id || !method) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Missing required fields: order_id, method'
        }
      });
    }

    // Validate payment method
    if (!['upi', 'card'].includes(method)) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Invalid payment method. Must be "upi" or "card"'
        }
      });
    }

    // Method-specific validation
    if (method === 'upi' && !vpa) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'VPA is required for UPI payments'
        }
      });
    }

    if (method === 'card' && (!card_number || !cvv || !expiry)) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Card details are required for card payments'
        }
      });
    }

    // Fetch order to get amount
    const orderResult = await pool.query(
      'SELECT amount, currency FROM orders WHERE id = $1 AND merchant_id = $2',
      [order_id, merchantId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Order not found'
        }
      });
    }

    const order = orderResult.rows[0];
    const paymentId = generatePaymentId();

    // Create payment record
    await pool.query(
      `INSERT INTO payments (id, order_id, amount, currency, method, vpa, card_number, cvv, expiry, status, merchant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)`,
      [paymentId, order_id, order.amount, order.currency || 'INR', method, vpa, card_number, cvv, expiry, merchantId]
    );

    // Enqueue payment processing job
    await paymentQueue.add('process-payment', {
      paymentId,
      merchantId: merchantId.toString()
    });

    // Enqueue payment.created webhook
    await enqueueWebhook(merchantId, 'payment.created', {
      payment: {
        id: paymentId,
        order_id,
        amount: order.amount,
        currency: order.currency || 'INR',
        method,
        vpa,
        status: 'pending',
        created_at: new Date().toISOString()
      }
    });

    const response = {
      id: paymentId,
      order_id,
      amount: order.amount,
      currency: order.currency || 'INR',
      method,
      vpa,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // Cache idempotent response if key provided
    if (req.idempotencyKey) {
      await cacheIdempotentResponse(req, response);
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to create payment'
      }
    });
  }
});

// Capture payment
router.post('/:paymentId/capture', authenticateMerchant, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount } = req.body;
    const merchantId = req.merchant.id;

    // Fetch payment
    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
      [paymentId, merchantId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Payment not found'
        }
      });
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'success') {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Payment not in capturable state'
        }
      });
    }

    // Update captured status
    await pool.query(
      'UPDATE payments SET captured = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [paymentId]
    );

    const response = {
      id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      captured: true,
      created_at: payment.created_at,
      updated_at: new Date().toISOString()
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error capturing payment:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to capture payment'
      }
    });
  }
});

// Get payment
router.get('/:paymentId', authenticateMerchant, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const merchantId = req.merchant.id;

    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
      [paymentId, merchantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Payment not found'
        }
      });
    }

    const payment = result.rows[0];
    res.status(200).json({
      id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      vpa: payment.vpa,
      status: payment.status,
      error_code: payment.error_code,
      error_description: payment.error_description,
      captured: payment.captured,
      created_at: payment.created_at,
      updated_at: payment.updated_at
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to fetch payment'
      }
    });
  }
});

// Create refund
router.post('/:paymentId/refunds', authenticateMerchant, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;
    const merchantId = req.merchant.id;

    if (!amount) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Amount is required'
        }
      });
    }

    // Fetch payment
    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
      [paymentId, merchantId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Payment not found'
        }
      });
    }

    const payment = paymentResult.rows[0];

    // Verify payment is refundable
    if (payment.status !== 'success') {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Only successful payments can be refunded'
        }
      });
    }

    // Calculate total refunded amount
    const refundsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_refunded
       FROM refunds
       WHERE payment_id = $1 AND status IN ('pending', 'processed')`,
      [paymentId]
    );

    const totalRefunded = parseInt(refundsResult.rows[0].total_refunded) || 0;
    const availableAmount = payment.amount - totalRefunded;

    if (amount > availableAmount) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Refund amount exceeds available amount'
        }
      });
    }

    // Generate refund ID
    const { generateRefundId } = require('../utils/idGenerator');
    let refundId = generateRefundId();
    let exists = true;
    while (exists) {
      const checkResult = await pool.query('SELECT id FROM refunds WHERE id = $1', [refundId]);
      if (checkResult.rows.length === 0) {
        exists = false;
      } else {
        refundId = generateRefundId();
      }
    }

    // Create refund record
    await pool.query(
      `INSERT INTO refunds (id, payment_id, merchant_id, amount, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [refundId, paymentId, merchantId, amount, reason || null]
    );

    // Enqueue refund processing job
    const { refundQueue } = require('../config/queues');
    await refundQueue.add('process-refund', {
      refundId,
      merchantId: merchantId.toString()
    });

    // Enqueue refund.created webhook
    await enqueueWebhook(merchantId, 'refund.created', {
      refund: {
        id: refundId,
        payment_id: paymentId,
        amount,
        reason,
        status: 'pending',
        created_at: new Date().toISOString()
      }
    });

    res.status(201).json({
      id: refundId,
      payment_id: paymentId,
      amount,
      reason: reason || null,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to create refund'
      }
    });
  }
});

module.exports = router;
