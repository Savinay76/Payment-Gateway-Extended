# Project Structure

## Overview

This is a production-ready payment gateway system built with Node.js/Express, featuring asynchronous job processing, webhook delivery, embeddable SDK, and refund management.

## Directory Structure

```
.
├── docker-compose.yml          # Docker Compose configuration for all services
├── README.md                   # Main documentation
├── TESTING.md                  # Detailed testing guide
├── QUICK_START.md              # Quick start guide
├── PROJECT_STRUCTURE.md        # This file
│
├── backend/                    # Backend API service
│   ├── Dockerfile              # API container image
│   ├── Dockerfile.worker       # Worker container image
│   ├── package.json            # Node.js dependencies
│   ├── src/
│   │   ├── server.js           # Main API server
│   │   ├── worker.js           # Worker process entry point
│   │   ├── config/
│   │   │   ├── database.js     # PostgreSQL connection
│   │   │   ├── redis.js        # Redis connection
│   │   │   └── queues.js       # Bull queue configuration
│   │   ├── migrations/
│   │   │   └── migrate.js      # Database schema migration
│   │   ├── middleware/
│   │   │   ├── auth.js          # Merchant authentication
│   │   │   └── idempotency.js  # Idempotency key handling
│   │   ├── routes/
│   │   │   ├── orders.js        # Order endpoints
│   │   │   ├── payments.js     # Payment endpoints (includes refunds)
│   │   │   ├── refunds.js      # Refund endpoints
│   │   │   ├── webhooks.js     # Webhook management endpoints
│   │   │   └── test.js         # Test endpoints
│   │   ├── services/
│   │   │   └── webhookService.js # Webhook enqueueing service
│   │   ├── utils/
│   │   │   ├── idGenerator.js  # ID generation utilities
│   │   │   └── webhookSignature.js # HMAC signature generation
│   │   └── workers/
│   │       ├── paymentWorker.js  # Payment processing worker
│   │       ├── webhookWorker.js   # Webhook delivery worker
│   │       └── refundWorker.js   # Refund processing worker
│
├── dashboard/                  # React dashboard
│   ├── Dockerfile              # Dashboard container image
│   ├── package.json            # React dependencies
│   ├── public/
│   │   └── index.html          # HTML template
│   └── src/
│       ├── App.js              # Main React component
│       ├── App.css             # Dashboard styles
│       ├── index.js            # React entry point
│       └── index.css           # Global styles
│
└── checkout-widget/            # Embeddable SDK
    ├── Dockerfile              # Checkout widget container
    ├── package.json            # SDK dependencies
    ├── webpack.config.js       # Webpack bundling config
    ├── server.js               # Static file server
    ├── public/
    │   └── checkout.html       # Checkout iframe page
    ├── src/
    │   ├── sdk/
    │   │   ├── PaymentGateway.js # Main SDK class
    │   │   └── styles.css       # Modal styles
    │   └── iframe-content/
    │       └── CheckoutForm.jsx # React checkout form (optional)
    └── dist/                   # Built SDK (generated)
        └── checkout.js         # Bundled SDK file
```

## Key Components

### Backend API (`backend/`)

- **Express.js** REST API server
- **PostgreSQL** database for persistent storage
- **Redis** for job queue management
- **Bull** for background job processing

### Worker Service (`backend/src/worker.js`)

- Processes payment jobs asynchronously
- Delivers webhooks with retry logic
- Processes refunds
- Handles scheduled webhook retries

### Dashboard (`dashboard/`)

- React-based web interface
- Webhook configuration
- Webhook logs viewing
- API documentation
- Manual webhook retry

### Checkout Widget (`checkout-widget/`)

- Embeddable JavaScript SDK
- Modal/iframe payment interface
- Cross-origin communication via postMessage
- Webpack-bundled for distribution

## Database Schema

### Tables

1. **merchants** - Merchant accounts
2. **orders** - Payment orders
3. **payments** - Payment transactions
4. **refunds** - Refund records
5. **webhook_logs** - Webhook delivery logs
6. **idempotency_keys** - Idempotency key cache

## API Endpoints

### Orders
- `POST /api/v1/orders` - Create order

### Payments
- `POST /api/v1/payments` - Create payment
- `GET /api/v1/payments/:id` - Get payment
- `POST /api/v1/payments/:id/capture` - Capture payment
- `POST /api/v1/payments/:id/refunds` - Create refund

### Refunds
- `GET /api/v1/refunds/:id` - Get refund

### Webhooks
- `GET /api/v1/webhooks` - List webhook logs
- `POST /api/v1/webhooks/:id/retry` - Retry webhook

### Test
- `GET /api/v1/test/jobs/status` - Job queue status

## Environment Variables

### API & Worker Services

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - Server port (default: 8000)
- `TEST_MODE` - Enable test mode (default: false)
- `TEST_PROCESSING_DELAY` - Processing delay in test mode (ms)
- `TEST_PAYMENT_SUCCESS` - Force payment success in test mode
- `WEBHOOK_RETRY_INTERVALS_TEST` - Use test retry intervals

## Job Queues

1. **payment-processing** - Payment processing jobs
2. **webhook-delivery** - Webhook delivery jobs
3. **refund-processing** - Refund processing jobs

## Webhook Events

- `payment.created` - Payment record created
- `payment.pending` - Payment enters pending state
- `payment.success` - Payment succeeds
- `payment.failed` - Payment fails
- `refund.created` - Refund initiated
- `refund.processed` - Refund completes

## Testing

See [TESTING.md](./TESTING.md) for comprehensive testing instructions.

## Quick Start

See [QUICK_START.md](./QUICK_START.md) for quick start guide.

## Documentation

- [README.md](./README.md) - Main documentation
- [TESTING.md](./TESTING.md) - Testing guide
- [QUICK_START.md](./QUICK_START.md) - Quick start
