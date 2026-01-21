require('dotenv').config();
const { paymentQueue, webhookQueue, refundQueue } = require('./config/queues');
const processPayment = require('./workers/paymentWorker');
const deliverWebhook = require('./workers/webhookWorker');
const processRefund = require('./workers/refundWorker');
const pool = require('./config/database');

console.log('Starting payment gateway worker...');

// Process payment jobs
paymentQueue.process('process-payment', async (job) => {
  console.log(`Processing payment job: ${job.id}`);
  return await processPayment(job);
});

// Process webhook jobs
webhookQueue.process('deliver-webhook', async (job) => {
  console.log(`Processing webhook job: ${job.id}`);
  return await deliverWebhook(job);
});

// Process refund jobs
refundQueue.process('process-refund', async (job) => {
  console.log(`Processing refund job: ${job.id}`);
  return await processRefund(job);
});

// Process scheduled webhook retries
async function processScheduledWebhooks() {
  try {
    const result = await pool.query(
      `SELECT wl.*, m.webhook_url, m.webhook_secret
       FROM webhook_logs wl
       JOIN merchants m ON wl.merchant_id = m.id
       WHERE wl.status = 'pending'
         AND wl.next_retry_at IS NOT NULL
         AND wl.next_retry_at <= CURRENT_TIMESTAMP
         AND wl.attempts < 5
       LIMIT 10`
    );

    for (const webhookLog of result.rows) {
      await webhookQueue.add('deliver-webhook', {
        webhookLogId: webhookLog.id.toString(),
        merchantId: webhookLog.merchant_id.toString(),
        webhookUrl: webhookLog.webhook_url,
        webhookSecret: webhookLog.webhook_secret,
        event: webhookLog.event,
        payload: webhookLog.payload
      });
    }
  } catch (error) {
    console.error('Error processing scheduled webhooks:', error);
  }
}

// Check for scheduled webhooks every 10 seconds
setInterval(processScheduledWebhooks, 10000);

// Error handlers
paymentQueue.on('failed', (job, err) => {
  console.error(`Payment job ${job.id} failed:`, err);
});

webhookQueue.on('failed', (job, err) => {
  console.error(`Webhook job ${job.id} failed:`, err);
});

refundQueue.on('failed', (job, err) => {
  console.error(`Refund job ${job.id} failed:`, err);
});

console.log('Worker started. Listening for jobs...');

// Keep process alive
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await paymentQueue.close();
  await webhookQueue.close();
  await refundQueue.close();
  await pool.end();
  process.exit(0);
});
