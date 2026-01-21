const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authenticateMerchant = require('../middleware/auth');
const { generateOrderId } = require('../utils/idGenerator');

// Create order
router.post('/', authenticateMerchant, async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;
    const merchantId = req.merchant.id;

    if (!amount) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Amount is required'
        }
      });
    }

    const orderId = generateOrderId();

    await pool.query(
      `INSERT INTO orders (id, merchant_id, amount, currency, receipt, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'created', CURRENT_TIMESTAMP)`,
      [orderId, merchantId, amount, currency, receipt || null]
    );

    res.status(201).json({
      id: orderId,
      amount,
      currency,
      receipt: receipt || null,
      status: 'created',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to create order'
      }
    });
  }
});

module.exports = router;
