# Production-Ready Payment Gateway

A production-ready payment gateway system with asynchronous job processing, webhook delivery, embeddable SDK, and refund management.

## Features

- ✅ Asynchronous payment processing using Redis-based job queues
- ✅ Webhook system with HMAC signature verification and automatic retry logic
- ✅ Embeddable JavaScript SDK for merchant integration
- ✅ Refund API with full and partial refund support
- ✅ Idempotency keys to prevent duplicate charges
- ✅ Enhanced dashboard with webhook configuration and API docs

## Architecture

- **Backend API**: Node.js/Express REST API
- **Worker Service**: Background job processing with Bull (Redis-based)
- **Database**: PostgreSQL
- **Queue**: Redis
- **Dashboard**: React frontend
- **Checkout Widget**: Embeddable JavaScript SDK

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Services

- **API**: http://localhost:8000
- **Dashboard**: http://localhost:3000
- **Checkout Widget**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## API Endpoints

### Create Order

```bash
curl -X POST http://localhost:8000/api/v1/orders \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "currency": "INR",
    "receipt": "receipt_123"
  }'
```

### Create Payment

```bash
curl -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique_request_id_123" \
  -d '{
    "order_id": "order_xyz",
    "method": "upi",
    "vpa": "user@paytm"
  }'
```

### Create Refund

```bash
curl -X POST http://localhost:8000/api/v1/payments/{payment_id}/refunds \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "reason": "Customer requested refund"
  }'
```

### List Webhook Logs

```bash
curl -X GET "http://localhost:8000/api/v1/webhooks?limit=10&offset=0" \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789"
```

### Job Queue Status

```bash
curl -X GET http://localhost:8000/api/v1/test/jobs/status
```

## SDK Integration

### HTML Integration

```html
<script src="http://localhost:3001/checkout.js"></script>
<button id="pay-button">Pay Now</button>

<script>
document.getElementById('pay-button').addEventListener('click', function() {
  const checkout = new PaymentGateway({
    key: 'key_test_abc123',
    orderId: 'order_xyz',
    onSuccess: function(response) {
      console.log('Payment successful:', response.paymentId);
    },
    onFailure: function(error) {
      console.log('Payment failed:', error);
    }
  });
  
  checkout.open();
});
</script>
```

## Webhook Verification

### Node.js Example

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

// In your webhook endpoint
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;
  
  if (!verifyWebhook(payload, signature, 'whsec_test_abc123')) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  console.log('Webhook verified:', payload.event);
  res.status(200).send('OK');
});
```

## Testing

### Test Mode

Set environment variables for deterministic testing:

```bash
TEST_MODE=true
TEST_PROCESSING_DELAY=1000
TEST_PAYMENT_SUCCESS=true
WEBHOOK_RETRY_INTERVALS_TEST=true
```

### Test Merchant Webhook Receiver

Create a simple webhook receiver for testing:

```javascript
// test-merchant/webhook-receiver.js
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  const expectedSignature = crypto
    .createHmac('sha256', 'whsec_test_abc123')
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    console.log('❌ Invalid signature');
    return res.status(401).send('Invalid signature');
  }
  
  console.log('✅ Webhook verified:', req.body.event);
  console.log('Payment ID:', req.body.data.payment?.id);
  
  res.status(200).send('OK');
});

app.listen(4000, () => {
  console.log('Test merchant webhook running on port 4000');
});
```

Configure webhook URL in dashboard: `http://host.docker.internal:4000/webhook`

## Step-by-Step Testing Commands

### 1. Start Services

```bash
docker-compose up -d
```

### 2. Wait for Services to be Healthy

```bash
docker-compose ps
```

### 3. Create an Order

```bash
curl -X POST http://localhost:8000/api/v1/orders \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "currency": "INR",
    "receipt": "receipt_123"
  }'
```

Save the `order_id` from the response.

### 4. Create a Payment

```bash
curl -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORDER_ID_FROM_STEP_3",
    "method": "upi",
    "vpa": "user@paytm"
  }'
```

Save the `payment_id` from the response.

### 5. Check Payment Status

```bash
curl -X GET http://localhost:8000/api/v1/payments/PAYMENT_ID_FROM_STEP_4 \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789"
```

Wait a few seconds and check again - status should change from `pending` to `success` or `failed`.

### 6. Check Job Queue Status

```bash
curl -X GET http://localhost:8000/api/v1/test/jobs/status
```

### 7. Create a Refund (after payment succeeds)

```bash
curl -X POST http://localhost:8000/api/v1/payments/PAYMENT_ID_FROM_STEP_4/refunds \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "reason": "Customer requested refund"
  }'
```

### 8. Check Webhook Logs

```bash
curl -X GET "http://localhost:8000/api/v1/webhooks?limit=10&offset=0" \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789"
```

### 9. Test Idempotency

```bash
# First request
curl -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Idempotency-Key: test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORDER_ID_FROM_STEP_3",
    "method": "upi",
    "vpa": "user@paytm"
  }'

# Second request with same idempotency key (should return cached response)
curl -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Idempotency-Key: test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORDER_ID_FROM_STEP_3",
    "method": "upi",
    "vpa": "user@paytm"
  }'
```

### 10. Test SDK Integration

Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>SDK Test</title>
</head>
<body>
    <button id="pay-button">Pay Now</button>
    
    <script src="http://localhost:3001/checkout.js"></script>
    <script>
        document.getElementById('pay-button').addEventListener('click', function() {
            const checkout = new PaymentGateway({
                key: 'key_test_abc123',
                orderId: 'ORDER_ID_FROM_STEP_3',
                onSuccess: function(response) {
                    alert('Payment successful: ' + response.paymentId);
                },
                onFailure: function(error) {
                    alert('Payment failed: ' + JSON.stringify(error));
                }
            });
            checkout.open();
        });
    </script>
</body>
</html>
```

Open this file in a browser and click "Pay Now".

## Environment Variables

### API Service

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `PORT`: API server port (default: 8000)
- `TEST_MODE`: Enable test mode (default: false)
- `TEST_PROCESSING_DELAY`: Processing delay in test mode (ms, default: 1000)
- `TEST_PAYMENT_SUCCESS`: Force payment success in test mode (default: true)
- `WEBHOOK_RETRY_INTERVALS_TEST`: Use test retry intervals (default: false)

### Worker Service

Same as API service.

## Database Schema

- **merchants**: Merchant accounts
- **orders**: Payment orders
- **payments**: Payment transactions
- **refunds**: Refund records
- **webhook_logs**: Webhook delivery logs
- **idempotency_keys**: Idempotency key cache

## Webhook Retry Schedule

### Production
- Attempt 1: Immediate
- Attempt 2: After 1 minute
- Attempt 3: After 5 minutes
- Attempt 4: After 30 minutes
- Attempt 5: After 2 hours

### Test Mode (WEBHOOK_RETRY_INTERVALS_TEST=true)
- Attempt 1: 0 seconds
- Attempt 2: 5 seconds
- Attempt 3: 10 seconds
- Attempt 4: 15 seconds
- Attempt 5: 20 seconds

## Troubleshooting

### Worker not processing jobs

1. Check worker container is running: `docker-compose ps`
2. Check worker logs: `docker-compose logs worker`
3. Verify Redis connection: `docker-compose logs redis`
4. Check job queue status: `curl http://localhost:8000/api/v1/test/jobs/status`

### Webhooks not delivering

1. Verify merchant has webhook URL configured
2. Check webhook logs: `curl http://localhost:8000/api/v1/webhooks`
3. Verify webhook receiver is accessible from Docker network
4. Check webhook signature matches

### Payment stuck in pending

1. Check worker is running
2. Check job queue for failed jobs
3. Review worker logs for errors
4. Verify Redis connection

## License

MIT
