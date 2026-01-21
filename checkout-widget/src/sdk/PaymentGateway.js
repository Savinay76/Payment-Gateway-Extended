require('./styles.css');

class PaymentGateway {
  constructor(options) {
    // Validate required options
    if (!options || !options.key || !options.orderId) {
      throw new Error('PaymentGateway requires key and orderId options');
    }

    this.options = {
      key: options.key,
      orderId: options.orderId,
      onSuccess: options.onSuccess || (() => {}),
      onFailure: options.onFailure || (() => {}),
      onClose: options.onClose || (() => {}),
      apiUrl: options.apiUrl || 'http://localhost:8000',
      checkoutUrl: options.checkoutUrl || 'http://localhost:3001'
    };

    this.modal = null;
    this.setupMessageListener();
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      // In production, validate event.origin
      if (event.data && event.data.type) {
        switch (event.data.type) {
          case 'payment_success':
            this.options.onSuccess(event.data.data);
            this.close();
            break;
          case 'payment_failed':
            this.options.onFailure(event.data.data);
            break;
          case 'close_modal':
            this.close();
            break;
        }
      }
    });
  }

  open() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'payment-gateway-modal';
    modal.setAttribute('data-test-id', 'payment-modal');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content';

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-test-id', 'payment-iframe');
    const checkoutUrl = `${this.options.checkoutUrl}/checkout?order_id=${encodeURIComponent(this.options.orderId)}&key=${encodeURIComponent(this.options.key)}&embedded=true`;
    iframe.src = checkoutUrl;

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.setAttribute('data-test-id', 'close-modal-button');
    closeButton.innerHTML = '×';
    closeButton.onclick = () => this.close();

    content.appendChild(iframe);
    content.appendChild(closeButton);
    modal.appendChild(overlay);
    modal.appendChild(content);
    document.body.appendChild(modal);

    this.modal = modal;
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
      this.options.onClose();
    }
  }
}

// Export for module systems
module.exports = PaymentGateway;

// Expose globally for browser
if (typeof window !== 'undefined') {
  window.PaymentGateway = PaymentGateway;
}
