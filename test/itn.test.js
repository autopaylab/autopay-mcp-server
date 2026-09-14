const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyItnXml, buildConfirmationXml, buildTestItnXml, parseItnXml } = require('../lib/shared/itn');

test('build_test_itn -> verify_itn round trip: an untampered message verifies', () => {
  const xml = buildTestItnXml({
    orderID: 'ORDER1',
    remoteID: 'REMOTE1',
    amount: '11.11',
    currency: 'PLN',
    gatewayID: '509',
    paymentDate: '20260101120000',
    paymentStatus: 'SUCCESS',
    paymentStatusDetails: 'AUTHORIZED',
  });

  const result = verifyItnXml(xml);
  assert.equal(result.hashOk, true);
  assert.equal(result.confirmation, 'CONFIRMED');
  assert.equal(result.data.orderID, 'ORDER1');
});

test('a tampered field (amount changed after signing) is rejected, never trusted', () => {
  const xml = buildTestItnXml({
    orderID: 'ORDER1',
    remoteID: 'REMOTE1',
    amount: '11.11',
    currency: 'PLN',
    gatewayID: '509',
    paymentDate: '20260101120000',
    paymentStatus: 'SUCCESS',
    paymentStatusDetails: 'AUTHORIZED',
  });
  const tampered = xml.replace('11.11', '99999.99');

  const result = verifyItnXml(tampered);
  assert.equal(result.hashOk, false);
  assert.equal(result.confirmation, 'NOTCONFIRMED');
});

test('a hostile orderID containing XML metacharacters round-trips safely through build -> parse', () => {
  const hostile = `1</orderID><amount>0.01</amount><orderID>1`;
  const xml = buildTestItnXml({
    orderID: hostile,
    remoteID: 'R1',
    amount: '5.00',
    currency: 'PLN',
    gatewayID: '106',
    paymentDate: '20260101120000',
    paymentStatus: 'SUCCESS',
  });

  // Escaped on the way out: no forged sibling <amount> tag in the XML.
  assert.equal((xml.match(/<amount>/g) || []).length, 1);

  // Unescaped correctly on the way back in, and the hash still verifies —
  // hashing runs on the raw value, escaping is purely a serialization concern.
  const result = verifyItnXml(xml);
  assert.equal(result.data.orderID, hostile);
  assert.equal(result.hashOk, true);
});

test('buildConfirmationXml produces the documented confirmationList shape', () => {
  const xml = buildConfirmationXml('1', '11', 'CONFIRMED', 'deadbeef');
  assert.match(xml, /<confirmationList>/);
  assert.match(xml, /<serviceID>1<\/serviceID>/);
  assert.match(xml, /<orderID>11<\/orderID>/);
  assert.match(xml, /<confirmation>CONFIRMED<\/confirmation>/);
  assert.match(xml, /<hash>deadbeef<\/hash>/);
});

test('verifyItnXml validates the docs\' own worked ITN example, byte for byte', () => {
  // Reload lib/config with the docs' own ServiceID=1 / sharedKey=1test1 so
  // this exercises the real published example, not just internal
  // self-consistency. Scoped to this test file only (node --test isolates
  // each file in its own process).
  const prevService = process.env.AUTOPAY_SERVICE_ID;
  const prevKey = process.env.AUTOPAY_SHARED_KEY;
  process.env.AUTOPAY_SERVICE_ID = '1';
  process.env.AUTOPAY_SHARED_KEY = '1test1';
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../lib/shared/itn')];
  const { verifyItnXml: verifyWithDocsConfig } = require('../lib/shared/itn');

  const docsExampleXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<transactionList><serviceID>1</serviceID><transactions><transaction>' +
    '<orderID>11</orderID><remoteID>91</remoteID><amount>11.11</amount>' +
    '<currency>PLN</currency><gatewayID>1</gatewayID>' +
    '<paymentDate>20010101111111</paymentDate><paymentStatus>SUCCESS</paymentStatus>' +
    '<paymentStatusDetails>AUTHORIZED</paymentStatusDetails></transaction></transactions>' +
    '<hash>a103bfe581a938e9ad78238cfc674ffafdd6ec70cb6825e7ed5c41787671efe4</hash></transactionList>';

  const result = verifyWithDocsConfig(docsExampleXml);

  if (prevService === undefined) delete process.env.AUTOPAY_SERVICE_ID;
  else process.env.AUTOPAY_SERVICE_ID = prevService;
  if (prevKey === undefined) delete process.env.AUTOPAY_SHARED_KEY;
  else process.env.AUTOPAY_SHARED_KEY = prevKey;
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../lib/shared/itn')];

  assert.equal(result.hashOk, true);
  assert.equal(result.confirmation, 'CONFIRMED');
});

test('parseItnXml extracts every documented field', () => {
  const xml = buildTestItnXml({
    orderID: 'O1', remoteID: 'R1', amount: '1.00', currency: 'PLN',
    gatewayID: '106', paymentDate: '20260101000000', paymentStatus: 'PENDING',
  });
  const data = parseItnXml(xml);
  assert.equal(data.orderID, 'O1');
  assert.equal(data.remoteID, 'R1');
  assert.equal(data.amount, '1.00');
  assert.equal(data.currency, 'PLN');
  assert.equal(data.gatewayID, '106');
  assert.equal(data.paymentStatus, 'PENDING');
});
