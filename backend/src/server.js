const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/database');
const paymentRoutes = require('./routes/payments');
// Refund routes are handled in payments.js
const webhookRoutes = require('./routes/webhooks');
const orderRoutes = require('./routes/orders');
const testRoutes = require('./routes/test');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/refunds', require('./routes/refunds'));
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/test', testRoutes);

// Initialize database
async function initializeDatabase() {
  try {
    // Create orders table if it doesn't exist
    await pool.query(`
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
    
    // Run migrations
    const migrate = require('./migrations/migrate');
    await migrate();
    
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Start server
async function startServer() {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`Payment Gateway API running on port ${PORT}`);
  });
}

startServer().catch(console.error);
