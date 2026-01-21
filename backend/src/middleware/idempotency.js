const pool = require('../config/database');

async function handleIdempotency(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];
  
  if (!idempotencyKey) {
    return next();
  }

  try {
    const merchantId = req.merchant.id;
    
    // Check for existing idempotency key
    const result = await pool.query(
      `SELECT response, expires_at FROM idempotency_keys 
       WHERE key = $1 AND merchant_id = $2`,
      [idempotencyKey, merchantId]
    );

    if (result.rows.length > 0) {
      const record = result.rows[0];
      
      // Check if expired
      if (new Date(record.expires_at) > new Date()) {
        // Return cached response
        return res.status(200).json(record.response);
      } else {
        // Delete expired record
        await pool.query(
          'DELETE FROM idempotency_keys WHERE key = $1 AND merchant_id = $2',
          [idempotencyKey, merchantId]
        );
      }
    }

    // Store idempotency key for later response caching
    req.idempotencyKey = idempotencyKey;
    next();
  } catch (error) {
    console.error('Idempotency check error:', error);
    next(); // Continue on error
  }
}

async function cacheIdempotentResponse(req, response) {
  if (!req.idempotencyKey) {
    return;
  }

  try {
    const merchantId = req.merchant.id;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await pool.query(
      `INSERT INTO idempotency_keys (key, merchant_id, response, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key, merchant_id) DO NOTHING`,
      [req.idempotencyKey, merchantId, JSON.stringify(response), expiresAt]
    );
  } catch (error) {
    console.error('Failed to cache idempotent response:', error);
  }
}

module.exports = {
  handleIdempotency,
  cacheIdempotentResponse
};
