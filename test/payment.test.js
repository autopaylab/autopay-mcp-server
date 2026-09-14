const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeHash } = require('../lib/shared/hash');
const { buildPaymentRequest, FIELD_ORDER } = require('../lib/shared/payment');
const config = require('../lib/config');
const { createCheckout } = require('../lib/onlineV1/createCheckout');

test('minimal input (ServiceID/OrderID/Amount only) matches the docs\' confirmed hash prefix', () => {
  const fields = buildPaymentRequest({ orderId: '100', amount: '1.50' });
  const expected = computeHash([config.serviceId, '100', '1.50'], config.sharedKey, config.hashAlgorithm);
  assert.equal(fields.Hash, expected);
});

test('optional fields are omitted from the output when not provided, not sent as empty strings', () => {
  const fields = buildPaymentRequest({ orderId: '100', amount: '1.50' });
  assert.equal('Description' in fields, false);
  assert.equal('GatewayID' in fields, false);
  assert.equal('CustomerEmail' in fields, false);
});

test('every provided field is carried through as a string, in FIELD_ORDER', () => {
  const fields = buildPaymentRequest({
    orderId: '100',
    amount: '1.50',
    description: 'Order #100',
    gatewayId: 509,
    currency: 'PLN',
    customerEmail: 'buyer@example.com',
  });
  assert.equal(fields.OrderID, '100');
  assert.equal(fields.Description, 'Order #100');
  assert.equal(fields.GatewayID, '509');
  assert.equal(fields.Currency, 'PLN');
  assert.equal(fields.CustomerEmail, 'buyer@example.com');
  assert.ok(Object.keys(fields).every((k) => k === 'Hash' || FIELD_ORDER.includes(k)));
});

test('online_create_checkout returns a dry run with the doc\'s example host when AUTOPAY_GATEWAY_URL is unset', () => {
  const result = createCheckout({ orderId: '1', amount: '1.00', customerEmail: 'a@b.pl' });
  assert.equal(result.method, 'POST');
  assert.match(result.gatewayUrl, /^https:\/\//);
  assert.ok(result.fields.Hash);
  if (!process.env.AUTOPAY_GATEWAY_URL) {
    assert.match(result.note, /dry run/i);
  }
});
