const express = require('express');
const router = express.Router();
const { paymentQueue, webhookQueue, refundQueue } = require('../config/queues');

// Job queue status endpoint
router.get('/jobs/status', async (req, res) => {
  try {
    const [paymentWaiting, paymentActive, paymentCompleted, paymentFailed] = await Promise.all([
      paymentQueue.getWaitingCount(),
      paymentQueue.getActiveCount(),
      paymentQueue.getCompletedCount(),
      paymentQueue.getFailedCount()
    ]);

    const [webhookWaiting, webhookActive] = await Promise.all([
      webhookQueue.getWaitingCount(),
      webhookQueue.getActiveCount()
    ]);

    const [refundWaiting, refundActive] = await Promise.all([
      refundQueue.getWaitingCount(),
      refundQueue.getActiveCount()
    ]);

    const totalPending = paymentWaiting + webhookWaiting + refundWaiting;
    const totalProcessing = paymentActive + webhookActive + refundActive;
    const totalCompleted = paymentCompleted;
    const totalFailed = paymentFailed;

    res.status(200).json({
      pending: totalPending,
      processing: totalProcessing,
      completed: totalCompleted,
      failed: totalFailed,
      worker_status: 'running'
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Failed to fetch job status'
      }
    });
  }
});

module.exports = router;
