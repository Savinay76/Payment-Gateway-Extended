const pool = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create merchants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS merchants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) NOT NULL UNIQUE,
        api_secret VARCHAR(255) NOT NULL,
        webhook_url TEXT,
        webhook_secret VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64) PRIMARY KEY,
        merchant_id UUID NOT NULL REFERENCES merchants(id),
        amount BIGINT NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        receipt VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'created',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        amount BIGINT NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        method VARCHAR(20) NOT NULL,
        vpa VARCHAR(100),
        card_number VARCHAR(16),
        cvv VARCHAR(3),
        expiry VARCHAR(5),
        status VARCHAR(20) NOT NULL,
        error_code VARCHAR(50),
        error_description TEXT,
        captured BOOLEAN DEFAULT FALSE,
        merchant_id UUID NOT NULL REFERENCES merchants(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create refunds table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refunds (
        id VARCHAR(64) PRIMARY KEY,
        payment_id VARCHAR(64) NOT NULL REFERENCES payments(id),
        merchant_id UUID NOT NULL REFERENCES merchants(id),
        amount BIGINT NOT NULL,
        reason TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Create webhook_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        merchant_id UUID NOT NULL REFERENCES merchants(id),
        event VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_attempt_at TIMESTAMP WITH TIME ZONE,
        next_retry_at TIMESTAMP WITH TIME ZONE,
        response_code INTEGER,
        response_body TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create idempotency_keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key VARCHAR(255) NOT NULL,
        merchant_id UUID NOT NULL REFERENCES merchants(id),
        response JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        PRIMARY KEY (key, merchant_id)
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_merchant_id ON webhook_logs(merchant_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_next_retry ON webhook_logs(next_retry_at) 
      WHERE status = 'pending'
    `);

    // Insert test merchant
    await client.query(`
      INSERT INTO merchants (email, name, api_key, api_secret, webhook_secret)
      VALUES ('test@example.com', 'Test Merchant', 'key_test_abc123', 'secret_test_xyz789', 'whsec_test_abc123')
      ON CONFLICT (email) DO UPDATE SET
        webhook_secret = EXCLUDED.webhook_secret
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = migrate;
