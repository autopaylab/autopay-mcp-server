const { test } = require('node:test');
const assert = require('node:assert/strict');
const { escapeXml, unescapeXml, tag } = require('../lib/shared/xml');

test('escapeXml escapes all five XML-significant characters', () => {
  assert.equal(escapeXml(`&<>"'`), '&amp;&lt;&gt;&quot;&apos;');
});

test('unescapeXml reverses escapeXml', () => {
  const original = `order & "co" <weird> 'value'`;
  assert.equal(unescapeXml(escapeXml(original)), original);
});

test('a hostile orderID cannot inject a sibling tag', () => {
  // The actual attack this guards against: an orderID value that tries to
  // close </orderID> early and open a forged element next to it.
  const hostile = '11</orderID><amount>999999.99</amount><orderID>11';
  const xml = `<orderID>${escapeXml(hostile)}</orderID>`;
  assert.equal((xml.match(/<orderID>/g) || []).length, 1);
  assert.equal((xml.match(/<amount>/g) || []).length, 0);
});

test('tag() extracts and unescapes a value round-tripped through escapeXml', () => {
  const original = `Jan & Ewa's "order"`;
  const xml = `<customerName>${escapeXml(original)}</customerName>`;
  assert.equal(tag('customerName', xml), original);
});

test('tag() returns empty string for a missing tag', () => {
  assert.equal(tag('missing', '<a>1</a>'), '');
});
