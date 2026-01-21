const axios = require('axios');
const pool = require('../config/database');
const { generateWebhookSignature } = require('../utils/webhookSignature');

function getRetryDelay(attempt, testMode) {
  if (testMode) {
    // Test intervals: 0s, 5s, 10s, 15s, 20s
    return [0, 5, 10, 15, 20][attempt - 1] * 1000;
  } else {
    // Production intervals: immediate, 1min, 5min, 30min, 2hr
    return [0, 60, 300, 1800, 7200][attempt - 1] * 1000;
  }
}

async function deliverWebhook(job) {
  const { webhookLogId, merchantId, webhookUrl, webhookSecret, event, payload } = job.data;
  
  try {
    // Fetch webhook log
    const logResult = await pool.query(
      'SELECT * FROM webhook_logs WHERE id = $1',
      [webhookLogId]
    );

    if (logResult.rows.length === 0) {
      throw new Error(`Webhook log ${webhookLogId} not found`);
    }

    const webhookLog = logResult.rows[0];
    const attempts = webhookLog.attempts + 1;

    // Generate signature
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signature = generateWebhookSignature(payloadString, webhookSecret);

    // Send webhook
    let responseCode = null;
    let responseBody = null;
    let success = false;

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature
        },
        timeout: 5000
      });

      responseCode = response.status;
      responseBody = response.data?.toString() || '';
      success = response.status >= 200 && response.status < 300;
    } catch (error) {
      if (error.response) {
        responseCode = error.response.status;
        responseBody = error.response.data?.toString() || '';
      } else {
        responseCode = 0;
        responseBody = error.message;
      }
      success = false;
    }

    // Update webhook log
    const testMode = process.env.WEBHOOK_RETRY_INTERVALS_TEST === 'true';
    
    if (success) {
      await pool.query(
        `UPDATE webhook_logs
         SET status = 'success', attempts = $1, last_attempt_at = CURRENT_TIMESTAMP,
             response_code = $2, response_body = $3
         WHERE id = $4`,
        [attempts, responseCode, responseBody, webhookLogId]
      );
      console.log(`Webhook ${webhookLogId} delivered successfully`);
    } else {
      if (attempts >= 5) {
        // Max attempts reached, mark as failed
        await pool.query(
          `UPDATE webhook_logs
           SET status = 'failed', attempts = $1, last_attempt_at = CURRENT_TIMESTAMP,
               response_code = $2, response_body = $3
           WHERE id = $4`,
          [attempts, responseCode, responseBody, webhookLogId]
        );
        console.log(`Webhook ${webhookLogId} failed after ${attempts} attempts`);
      } else {
        // Schedule retry
        const delay = getRetryDelay(attempts, testMode);
        const nextRetryAt = new Date(Date.now() + delay);

        await pool.query(
          `UPDATE webhook_logs
           SET status = 'pending', attempts = $1, last_attempt_at = CURRENT_TIMESTAMP,
               next_retry_at = $2, response_code = $3, response_body = $4
           WHERE id = $5`,
          [attempts, nextRetryAt, responseCode, responseBody, webhookLogId]
        );

        // Re-enqueue with delay
        const { webhookQueue } = require('../config/queues');
        await webhookQueue.add(
          'deliver-webhook',
          {
            webhookLogId,
            merchantId,
            webhookUrl,
            webhookSecret,
            event,
            payload
          },
          {
            delay: delay
          }
        );

        console.log(`Webhook ${webhookLogId} failed, retry scheduled (attempt ${attempts}/5)`);
      }
    }

    return { success, attempts, responseCode };
  } catch (error) {
    console.error(`Error delivering webhook ${webhookLogId}:`, error);
    throw error;
  }
}

module.exports = deliverWebhook;
