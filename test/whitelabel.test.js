const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeHash } = require('../lib/shared/hash');

// These three functions read lib/config.js's whitelabelHost at call time via
// the shared config singleton. With AUTOPAY_WHITELABEL_HOST unset (the
// default in this test run), each returns a dry run instead of calling out —
// see lib/whitelabel/*.js for why that's the deliberate default.

test('whitelabel_list_gateways: dry run when AUTOPAY_WHITELABEL_HOST is unset', async () => {
  delete process.env.AUTOPAY_WHITELABEL_HOST;
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../lib/whitelabel/listGateways')];
  const { listGateways } = require('../lib/whitelabel/listGateways');

  const result = await listGateways({});
  assert.equal(result.dryRun, true);
  assert.equal(result.wouldCallUrl, '{host_bramki}/gatewayList/v3');
  assert.equal(result.body.Currencies, 'PLN');
  assert.equal(result.body.Language, 'PL');
  assert.ok(result.body.Hash);
  assert.match(result.body.MessageID, /^[0-9a-f]{32}$/);
});

test('whitelabel_get_legal_data: dry run when AUTOPAY_WHITELABEL_HOST is unset', async () => {
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../lib/whitelabel/legalData')];
  const { getLegalData } = require('../lib/whitelabel/legalData');

  const result = await getLegalData({ gatewayId: '509' });
  assert.equal(result.dryRun, true);
  assert.equal(result.body.GatewayID, '509');
});

test('whitelabel_start_payment: dry run when AUTOPAY_WHITELABEL_HOST is unset', async () => {
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../lib/whitelabel/startPayment')];
  const { startPayment } = require('../lib/whitelabel/startPayment');

  const result = await startPayment({ orderId: '1', amount: '1.00', gatewayId: '509', customerEmail: 'a@b.pl' });
  assert.equal(result.dryRun, true);
  assert.equal(result.fields.GatewayID, '509');
  assert.ok(result.fields.Hash);
});

test('whitelabel_list_gateways: hash matches the docs\' own worked example, and it calls the configured host', async () => {
  const prevService = process.env.AUTOPAY_SERVICE_ID;
  const prevKey = process.env.AUTOPAY_SHARED_KEY;
  const prevHost = process.env.AUTOPAY_WHITELABEL_HOST;
  process.env.AUTOPAY_SERVICE_ID = '100';
  process.env.AUTOPAY_SHARED_KEY = '1test1';
  process.env.AUTOPAY_WHITELABEL_HOST = 'https://example-gateway.test';
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../lib/whitelabel/listGateways')];
  const { listGateways } = require('../lib/whitelabel/listGateways');

  const originalFetch = global.fetch;
  let capturedUrl, capturedBody;
  global.fetch = async (url, opts) => {
    capturedUrl = url;
    capturedBody = JSON.parse(opts.body);
    return { status: 200, text: async () => '{"gatewayList":[]}' };
  };

  const result = await listGateways({ messageId: '11111111111111111111111111111111', currencies: 'PLN,EUR', language: 'PL' });

  global.fetch = originalFetch;
  if (prevService === undefined) delete process.env.AUTOPAY_SERVICE_ID; else process.env.AUTOPAY_SERVICE_ID = prevService;
  if (prevKey === undefined) delete process.env.AUTOPAY_SHARED_KEY; else process.env.AUTOPAY_SHARED_KEY = prevKey;
  if (prevHost === undefined) delete process.env.AUTOPAY_WHITELABEL_HOST; else process.env.AUTOPAY_WHITELABEL_HOST = prevHost;
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../lib/whitelabel/listGateways')];

  assert.equal(result.dryRun, false);
  assert.equal(capturedUrl, 'https://example-gateway.test/gatewayList/v3');
  // Hash=SHA256("100|11111111111111111111111111111111|PLN,EUR|PL|1test1")
  const expected = computeHash(['100', '11111111111111111111111111111111', 'PLN,EUR', 'PL'], '1test1', 'sha256');
  assert.equal(capturedBody.Hash, expected);
});
