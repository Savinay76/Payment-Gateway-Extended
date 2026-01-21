import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('webhooks');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('whsec_test_abc123');
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWebhookLogs();
  }, []);

  const fetchWebhookLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/v1/webhooks`, {
        headers: {
          'X-Api-Key': 'key_test_abc123',
          'X-Api-Secret': 'secret_test_xyz789'
        },
        params: { limit: 50, offset: 0 }
      });
      setWebhookLogs(response.data.data || []);
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
    }
  };

  const handleSaveWebhook = async (e) => {
    e.preventDefault();
    setLoading(true);
    // In a real implementation, this would update the merchant's webhook URL
    alert('Webhook configuration saved (mock)');
    setLoading(false);
  };

  const handleTestWebhook = async () => {
    setLoading(true);
    // In a real implementation, this would send a test webhook
    alert('Test webhook sent (mock)');
    setLoading(false);
  };

  const handleRetryWebhook = async (webhookId) => {
    try {
      await axios.post(`${API_URL}/api/v1/webhooks/${webhookId}/retry`, {}, {
        headers: {
          'X-Api-Key': 'key_test_abc123',
          'X-Api-Secret': 'secret_test_xyz789'
        }
      });
      fetchWebhookLogs();
    } catch (error) {
      console.error('Error retrying webhook:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Payment Gateway Dashboard</h1>
      </header>

      <nav className="tabs">
        <button 
          className={activeTab === 'webhooks' ? 'active' : ''}
          onClick={() => setActiveTab('webhooks')}
        >
          Webhooks
        </button>
        <button 
          className={activeTab === 'docs' ? 'active' : ''}
          onClick={() => setActiveTab('docs')}
        >
          API Docs
        </button>
      </nav>

      <main className="content">
        {activeTab === 'webhooks' && (
          <div data-test-id="webhook-config">
            <h2>Webhook Configuration</h2>
            
            <form data-test-id="webhook-config-form" onSubmit={handleSaveWebhook}>
              <div className="form-group">
                <label>Webhook URL</label>
                <input
                  data-test-id="webhook-url-input"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://yoursite.com/webhook"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label>Webhook Secret</label>
                <div className="secret-display">
                  <span data-test-id="webhook-secret">{webhookSecret}</span>
                  <button 
                    data-test-id="regenerate-secret-button"
                    type="button"
                    onClick={() => setWebhookSecret('whsec_' + Math.random().toString(36).substring(7))}
                  >
                    Regenerate
                  </button>
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  data-test-id="save-webhook-button"
                  type="submit"
                  disabled={loading}
                >
                  Save Configuration
                </button>
                
                <button 
                  data-test-id="test-webhook-button"
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={loading}
                >
                  Send Test Webhook
                </button>
              </div>
            </form>
            
            <h3>Webhook Logs</h3>
            <table data-test-id="webhook-logs-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Last Attempt</th>
                  <th>Response Code</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhookLogs.map((log) => (
                  <tr key={log.id} data-test-id="webhook-log-item" data-webhook-id={log.id}>
                    <td data-test-id="webhook-event">{log.event}</td>
                    <td data-test-id="webhook-status">{log.status}</td>
                    <td data-test-id="webhook-attempts">{log.attempts}</td>
                    <td data-test-id="webhook-last-attempt">
                      {log.last_attempt_at ? new Date(log.last_attempt_at).toLocaleString() : '-'}
                    </td>
                    <td data-test-id="webhook-response-code">{log.response_code || '-'}</td>
                    <td>
                      {log.status === 'failed' && (
                        <button
                          data-test-id="retry-webhook-button"
                          data-webhook-id={log.id}
                          onClick={() => handleRetryWebhook(log.id)}
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'docs' && (
          <div data-test-id="api-docs">
            <h2>Integration Guide</h2>
            
            <section data-test-id="section-create-order">
              <h3>1. Create Order</h3>
              <pre data-test-id="code-snippet-create-order">
                <code>{`curl -X POST http://localhost:8000/api/v1/orders \\
  -H "X-Api-Key: key_test_abc123" \\
  -H "X-Api-Secret: secret_test_xyz789" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50000,
    "currency": "INR",
    "receipt": "receipt_123"
  }'`}</code>
              </pre>
            </section>
            
            <section data-test-id="section-sdk-integration">
              <h3>2. SDK Integration</h3>
              <pre data-test-id="code-snippet-sdk">
                <code>{`<script src="http://localhost:3001/checkout.js"></script>
<script>
const checkout = new PaymentGateway({
  key: 'key_test_abc123',
  orderId: 'order_xyz',
  onSuccess: (response) => {
    console.log('Payment ID:', response.paymentId);
  }
});
checkout.open();
</script>`}</code>
              </pre>
            </section>
            
            <section data-test-id="section-webhook-verification">
              <h3>3. Verify Webhook Signature</h3>
              <pre data-test-id="code-snippet-webhook">
                <code>{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}`}</code>
              </pre>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
