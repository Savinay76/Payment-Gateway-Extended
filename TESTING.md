# Testing Guide

## Step-by-Step Testing Commands

### 1. Start All Services

```bash
docker-compose up -d
```

Wait for all services to be healthy (check with `docker-compose ps`).

### 2. Verify Services are Running

```bash
# Check service status
docker-compose ps

# Check API health
curl http://localhost:8000/health

# Check job queue status
curl http://localhost:8000/api/v1/test/jobs/status
```

### 3. Create an Order

```bash
ORDER_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/orders \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "currency": "INR",
    "receipt": "receipt_123"
  }')

echo $ORDER_RESPONSE | jq .
ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.id')
echo "Order ID: $ORDER_ID"
```

### 4. Create a Payment (UPI)

```bash
PAYMENT_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"method\": \"upi\",
    \"vpa\": \"user@paytm\"
  }")

echo $PAYMENT_RESPONSE | jq .
PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.id')
echo "Payment ID: $PAYMENT_ID"
```

### 5. Check Payment Status (Initially Pending)

```bash
curl -s -X GET http://localhost:8000/api/v1/payments/$PAYMENT_ID \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" | jq .
```

Wait 5-10 seconds, then check again:

```bash
curl -s -X GET http://localhost:8000/api/v1/payments/$PAYMENT_ID \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" | jq .
```

Status should change from `pending` to `success` or `failed`.

### 6. Check Job Queue Status

```bash
curl -s http://localhost:8000/api/v1/test/jobs/status | jq .
```

### 7. Create a Refund (After Payment Succeeds)

```bash
REFUND_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/payments/$PAYMENT_ID/refunds \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "reason": "Customer requested refund"
  }')

echo $REFUND_RESPONSE | jq .
REFUND_ID=$(echo $REFUND_RESPONSE | jq -r '.id')
echo "Refund ID: $REFUND_ID"
```

### 8. Check Refund Status

```bash
curl -s -X GET http://localhost:8000/api/v1/refunds/$REFUND_ID \
  -H "X-Api-Key:X-Api-Key" \
  -H "X-Api-Secret: secret_test_xyz789" | jq .
```

### 9. Check Webhook Logs

```bash
curl -s -X GET "http://localhost:8000/api/v1/webhooks?limit=10&offset=0" \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" | jq .
```

### 10. Test Idempotency

```bash
# First request
IDEMPOTENCY_KEY="test_key_$(date +%s)"
echo "Using idempotency key: $IDEMPOTENCY_KEY"

RESPONSE1=$(curl -s -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"method\": \"upi\",
    \"vpa\": \"user@paytm\"
  }")

echo "First response:"
echo $RESPONSE1 | jq .

# Second request with same key (should return cached response)
RESPONSE2=$(curl -s -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"method\": \"upi\",
    \"vpa\": \"user@paytm\"
  }")

echo "Second response (should be identical):"
echo $RESPONSE2 | jq .

# Verify they're the same
if [ "$RESPONSE1" == "$RESPONSE2" ]; then
  echo "✅ Idempotency test passed"
else
  echo "❌ Idempotency test failed"
fi
```

### 11. Test Webhook Retry (with Test Mode)

Stop your webhook receiver, then:

```bash
# Set test mode for faster retries
docker-compose down
WEBHOOK_RETRY_INTERVALS_TEST=true docker-compose up -d

# Create a payment (webhook will fail)
# Wait and check webhook logs - should see retries happening quickly
```

### 12. Test SDK Integration

Create `test-sdk.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>SDK Test</title>
</head>
<body>
    <h1>Payment Gateway SDK Test</h1>
    <button id="pay-button">Pay Now</button>
    
    <script src="http://localhost:3001/checkout.js"></script>
    <script>
        document.getElementById('pay-button').addEventListener('click', function() {
            const checkout = new PaymentGateway({
                key: 'key_test_abc123',
                orderId: 'YOUR_ORDER_ID_HERE',
                onSuccess: function(response) {
                    alert('Payment successful: ' + response.paymentId);
                    console.log('Success:', response);
                },
                onFailure: function(error) {
                    alert('Payment failed: ' + JSON.stringify(error));
                    console.log('Failure:', error);
                },
                onClose: function() {
                    console.log('Modal closed');
                }
            });
            checkout.open();
        });
    </script>
</body>
</html>
```

Replace `YOUR_ORDER_ID_HERE` with an order ID from step 3, then open the file in a browser.

### 13. Test Webhook Receiver

Create `test-webhook-receiver.js`:

```javascript
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
    console.log('Expected:', expectedSignature);
    console.log('Received:', signature);
    return res.status(401).send('Invalid signature');
  }
  
  console.log('✅ Webhook verified:', req.body.event);
  console.log('Payment ID:', req.body.data.payment?.id);
  console.log('Refund ID:', req.body.data.refund?.id);
  
  res.status(200).send('OK');
});

app.listen(4000, () => {
  console.log('Test merchant webhook running on port 4000');
  console.log('Configure webhook URL in dashboard: http://host.docker.internal:4000/webhook');
});
```

Run it:
```bash
node test-webhook-receiver.js
```

Then configure the webhook URL in the dashboard and create a payment to see webhooks being delivered.

## Test Mode Configuration

For deterministic testing, use these environment variables:

```bash
TEST_MODE=true
TEST_PROCESSING_DELAY=1000
TEST_PAYMENT_SUCCESS=true
WEBHOOK_RETRY_INTERVALS_TEST=true
```

Start services with test mode:

```bash
TEST_MODE=true TEST_PROCESSING_DELAY=1000 TEST_PAYMENT_SUCCESS=true WEBHOOK_RETRY_INTERVALS_TEST=true docker-compose up -d
```

## Common Issues

### Worker not processing jobs

```bash
# Check worker logs
docker-compose logs worker

# Check Redis connection
docker-compose exec worker node -e "const redis = require('redis'); const client = redis.createClient({url: process.env.REDIS_URL}); client.connect().then(() => console.log('Connected')).catch(console.error);"
```

### Webhooks not delivering

```bash
# Check webhook logs
curl -s -X GET "http://localhost:8000/api/v1/webhooks?limit=10" \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" | jq .

# Check worker logs for webhook delivery
docker-compose logs worker | grep webhook
```

### Payment stuck in pending

```bash
# Check job queue
curl -s http://localhost:8000/api/v1/test/jobs/status | jq .

# Check worker logs
docker-compose logs worker | grep payment
```
