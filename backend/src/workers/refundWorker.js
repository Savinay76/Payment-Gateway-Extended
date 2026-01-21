const pool = require('../config/database');
const { enqueueWebhook } = require('../services/webhookService');

async function processRefund(job) {
  const { refundId, merchantId } = job.data;
  
  try {
    // Fetch refund
    const result = await pool.query(
      'SELECT * FROM refunds WHERE id = $1',
      [refundId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Refund ${refundId} not found`);
    }

    const refund = result.rows[0];

    // Fetch payment
    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [refund.payment_id]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error(`Payment ${refund.payment_id} not found`);
    }

    const payment = paymentResult.rows[0];

    // Verify payment is refundable
    if (payment.status !== 'success') {
      throw new Error('Payment not in refundable state');
    }

    // Verify total refunded amount
    const refundsResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_refunded
       FROM refunds
       WHERE payment_id = $1 AND status = 'processed'`,
      [refund.payment_id]
    );

    const totalRefunded = parseInt(refundsResult.rows[0].total_refunded) || 0;
    if (totalRefunded + refund.amount > payment.amount) {
      throw new Error('Refund amount exceeds payment amount');
    }

    // Simulate processing delay (3-5 seconds)
    const delay = Math.floor(Math.random() * 2000) + 3000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Update refund status
    await pool.query(
      `UPDATE refunds
       SET status = 'processed', processed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [refundId]
    );

    // Enqueue refund.processed webhook
    await enqueueWebhook(
      merchantId,
      'refund.processed',
      {
        refund: {
          id: refund.id,
          payment_id: refund.payment_id,
          amount: refund.amount,
          reason: refund.reason,
          status: 'processed',
          created_at: refund.created_at,
          processed_at: new Date().toISOString()
        }
      }
    );

    console.log(`Refund ${refundId} processed successfully`);
    return { success: true, refundId };
  } catch (error) {
    console.error(`Error processing refund ${refundId}:`, error);
    throw error;
  }
}

module.exports = processRefund;
