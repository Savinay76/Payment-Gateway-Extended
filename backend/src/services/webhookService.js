const pool = require('../config/database');
const { webhookQueue } = require('../config/queues');
const { generateWebhookSignature } = require('../utils/webhookSignature');

async function enqueueWebhook(merchantId, event, data) {
  try {
    // Check if merchant has webhook URL configured
    const merchantResult = await pool.query(
      'SELECT webhook_url, webhook_secret FROM merchants WHERE id = $1',
      [merchantId]
    );

    if (merchantResult.rows.length === 0 || !merchantResult.rows[0].webhook_url) {
      console.log(`Skipping webhook for merchant ${merchantId}: no webhook URL configured`);
      return;
    }

    const merchant = merchantResult.rows[0];
    const payload = {
      event,
      timestamp: Math.floor(Date.now() / 1000),
      data
    };

    // Create webhook log entry
    const logResult = await pool.query(
      `INSERT INTO webhook_logs (merchant_id, event, payload, status, attempts)
       VALUES ($1, $2, $3, 'pending', 0)
       RETURNING id`,
      [merchantId, event, JSON.stringify(payload)]
    );

    const webhookLogId = logResult.rows[0].id;

    // Enqueue webhook delivery job
    await webhookQueue.add('deliver-webhook', {
      webhookLogId: webhookLogId.toString(),
      merchantId: merchantId.toString(),
      webhookUrl: merchant.webhook_url,
      webhookSecret: merchant.webhook_secret,
      event,
      payload
    });

    console.log(`Webhook enqueued: ${event} for merchant ${merchantId}`);
  } catch (error) {
    console.error('Error enqueueing webhook:', error);
  }
}

module.exports = {
  enqueueWebhook
};
