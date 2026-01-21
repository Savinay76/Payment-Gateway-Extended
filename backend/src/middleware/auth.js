const pool = require('../config/database');

async function authenticateMerchant(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    if (!apiKey || !apiSecret) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          description: 'Missing API credentials'
        }
      });
    }

    const result = await pool.query(
      'SELECT * FROM merchants WHERE api_key = $1 AND api_secret = $2',
      [apiKey, apiSecret]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          description: 'Invalid API credentials'
        }
      });
    }

    req.merchant = result.rows[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        description: 'Authentication failed'
      }
    });
  }
}

module.exports = authenticateMerchant;
