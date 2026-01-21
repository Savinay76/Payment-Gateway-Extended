# Quick Start Guide

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (optional, for local development)

## Start the System

```bash
# Clone or navigate to the project directory
cd "Production-Ready Payment Gateway"

# Start all services
docker-compose up -d

# Wait for services to be healthy (about 30 seconds)
docker-compose ps

# View logs
docker-compose logs -f
```

## Verify Services

```bash
# Check API health
curl http://localhost:8000/health

# Check job queue status
curl http://localhost:8000/api/v1/test/jobs/status
```

## Test the System

### 1. Create an Order

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

### 2. Create a Payment

```bash
curl -X POST http://localhost:8000/api/v1/payments \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "YOUR_ORDER_ID_HERE",
    "method": "upi",
    "vpa": "user@paytm"
  }'
```

Save the `payment_id` from the response.

### 3. Check Payment Status

Wait 5-10 seconds, then:

```bash
curl -X GET http://localhost:8000/api/v1/payments/YOUR_PAYMENT_ID_HERE \
  -H "X-Api-Key: key_test_abc123" \
  -H "X-Api-Secret: secret_test_xyz789"
```

Status should change from `pending` to `success` or `failed`.

### 4. Access Dashboard

Open http://localhost:3000 in your browser to view the dashboard.

### 5. Test SDK

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
                orderId: 'YOUR_ORDER_ID_HERE',
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

Replace `YOUR_ORDER_ID_HERE` with an order ID from step 1.

## Stop Services

```bash
docker-compose down
```

## Test Mode

For faster testing with deterministic results:

```bash
TEST_MODE=true \
TEST_PROCESSING_DELAY=1000 \
TEST_PAYMENT_SUCCESS=true \
WEBHOOK_RETRY_INTERVALS_TEST=true \
docker-compose up -d
```

## Troubleshooting

### Services not starting

```bash
# Check logs
docker-compose logs

# Restart services
docker-compose restart
```

### Worker not processing jobs

```bash
# Check worker logs
docker-compose logs worker

# Restart worker
docker-compose restart worker
```

### Database connection issues

```bash
# Check database logs
docker-compose logs postgres

# Verify database is accessible
docker-compose exec postgres psql -U gateway_user -d payment_gateway -c "SELECT 1;"
```

For more detailed testing instructions, see [TESTING.md](./TESTING.md).
