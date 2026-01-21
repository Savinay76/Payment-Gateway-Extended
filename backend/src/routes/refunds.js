const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authenticateMerchant = require('../middleware/auth');
const { refundQueue } = require('../config/queues');
const { generateRefundId } = require('../utils/idGenerator');
const { enqueueWebhook } = require('../services/webhookService');

// Create refund
router.post('/', authenticateMerchant, async (req, res) => {
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

// Get refund
router.get('/:refundId', authenticateMerchant, async (req, res) => {
  try {
    const { refundId } = req.params;
    const merchantId = req.merchant.id;

    const result = await pool.query(
      'SELECT * FROM refunds WHERE id = $1 AND merchant_id = $2',
      [refundId, merchantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Refund not found'
        }
      });
    }

    const refund = result.rows[0];
    res.status(200).json({
      id: refund.id,
      payment_id: refund.payment_id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      created_at: refund.created_at,
      processed_at: refund.processed_at
    });
  } catch (error) {
    console.error('Error fetching refund:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to fetch refund'
      }
    });
  }
});

module.exports = router;
