const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authenticateMerchant = require('../middleware/auth');
const { webhookQueue } = require('../config/queues');

// List webhook logs
router.get('/', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.merchant.id;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT id, event, status, attempts, last_attempt_at, response_code, created_at
       FROM webhook_logs
       WHERE merchant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [merchantId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM webhook_logs WHERE merchant_id = $1',
      [merchantId]
    );

    res.status(200).json({
      data: result.rows.map(row => ({
        id: row.id,
        event: row.event,
        status: row.status,
        attempts: row.attempts,
        created_at: row.created_at,
        last_attempt_at: row.last_attempt_at,
        response_code: row.response_code
      })),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to fetch webhook logs'
      }
    });
  }
});

// Retry webhook
router.post('/:webhookId/retry', authenticateMerchant, async (req, res) => {
  try {
    const { webhookId } = req.params;
    const merchantId = req.merchant.id;

    // Fetch webhook log
    const result = await pool.query(
      `SELECT wl.*, m.webhook_url, m.webhook_secret
       FROM webhook_logs wl
       JOIN merchants m ON wl.merchant_id = m.id
       WHERE wl.id = $1 AND wl.merchant_id = $2`,
      [webhookId, merchantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          description: 'Webhook log not found'
        }
      });
    }

    const webhookLog = result.rows[0];

    if (!webhookLog.webhook_url) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST_ERROR',
          description: 'Webhook URL not configured'
        }
      });
    }

    // Reset attempts and status
    await pool.query(
      `UPDATE webhook_logs
       SET status = 'pending', attempts = 0, next_retry_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [webhookId]
    );

    // Enqueue webhook delivery job
    await webhookQueue.add('deliver-webhook', {
      webhookLogId: webhookId,
      merchantId: merchantId.toString(),
      webhookUrl: webhookLog.webhook_url,
      webhookSecret: webhookLog.webhook_secret,
      event: webhookLog.event,
      payload: webhookLog.payload
    });

    res.status(200).json({
      id: webhookId,
      status: 'pending',
      message: 'Webhook retry scheduled'
    });
  } catch (error) {
    console.error('Error retrying webhook:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to retry webhook'
      }
    });
  }
});

module.exports = router;
