const Queue = require('bull');

// Parse Redis URL or use individual components
function getRedisConfig() {
  if (process.env.REDIS_URL) {
    // Parse Redis URL (e.g., redis://localhost:6379)
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  };
}

const redisConfig = getRedisConfig();

const paymentQueue = new Queue('payment-processing', {
  redis: redisConfig
});

const webhookQueue = new Queue('webhook-delivery', {
  redis: redisConfig
});

const refundQueue = new Queue('refund-processing', {
  redis: redisConfig
});

module.exports = {
  paymentQueue,
  webhookQueue,
  refundQueue
};
