const pool = require('../config/database');
const { enqueueWebhook } = require('../services/webhookService');

async function processPayment(job) {
  const { paymentId, merchantId } = job.data;
  
  try {
    // Fetch payment
    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    const payment = result.rows[0];

    // Simulate processing delay
    const testMode = process.env.TEST_MODE === 'true';
    const delay = testMode 
      ? parseInt(process.env.TEST_PROCESSING_DELAY || 1000)
      : Math.floor(Math.random() * 5000) + 5000; // 5-10 seconds

    await new Promise(resolve => setTimeout(resolve, delay));

    // Determine payment outcome
    let success;
    if (testMode) {
      success = process.env.TEST_PAYMENT_SUCCESS === 'true';
    } else {
      // Random success based on payment method
      const successRate = payment.method === 'upi' ? 0.90 : 0.95;
      success = Math.random() < successRate;
    }

    // Update payment status
    if (success) {
      await pool.query(
        `UPDATE payments 
         SET status = 'success', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [paymentId]
      );

      // Enqueue success webhook
      await enqueueWebhook(
        merchantId,
        'payment.success',
        {
          payment: {
            id: payment.id,
            order_id: payment.order_id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            vpa: payment.vpa,
            status: 'success',
            created_at: payment.created_at,
            updated_at: new Date().toISOString()
          }
        }
      );
    } else {
      const errorCode = 'PAYMENT_FAILED';
      const errorDescription = payment.method === 'upi' 
        ? 'UPI payment failed' 
        : 'Card payment failed';

      await pool.query(
        `UPDATE payments 
         SET status = 'failed', error_code = $1, error_description = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [errorCode, errorDescription, paymentId]
      );

      // Enqueue failure webhook
      await enqueueWebhook(
        merchantId,
        'payment.failed',
        {
          payment: {
            id: payment.id,
            order_id: payment.order_id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            vpa: payment.vpa,
            status: 'failed',
            error_code: errorCode,
            error_description: errorDescription,
            created_at: payment.created_at,
            updated_at: new Date().toISOString()
          }
        }
      );
    }

    console.log(`Payment ${paymentId} processed: ${success ? 'success' : 'failed'}`);
    return { success, paymentId };
  } catch (error) {
    console.error(`Error processing payment ${paymentId}:`, error);
    throw error;
  }
}

module.exports = processPayment;
