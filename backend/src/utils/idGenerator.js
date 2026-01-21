const crypto = require('crypto');

function generatePaymentId() {
  const random = crypto.randomBytes(8).toString('hex');
  return `pay_${random}`;
}

function generateRefundId() {
  const random = crypto.randomBytes(8).toString('hex');
  return `rfnd_${random}`;
}

function generateOrderId() {
  const random = crypto.randomBytes(12).toString('hex');
  return `order_${random}`;
}

module.exports = {
  generatePaymentId,
  generateRefundId,
  generateOrderId
};
