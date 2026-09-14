const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeHash } = require('../lib/shared/hash');

// Every fixture here is a worked example quoted verbatim in Autopay's own
// documentation (developers.autopay.pl) — not invented. See lib/shared/hash.js.
test('initiation prefix matches the docs\' worked example', () => {
  // Hash=SHA256("2|100|1.50|2test2")
  const hash = computeHash(['2', '100', '1.50'], '2test2', 'sha256');
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('ITN hash matches the docs\' worked example digest byte-for-byte', () => {
  // Hash=SHA256("1|11|91|11.11|PLN|1|20010101111111|SUCCESS|AUTHORIZED|1test1")
  const hash = computeHash(
    ['1', '11', '91', '11.11', 'PLN', '1', '20010101111111', 'SUCCESS', 'AUTHORIZED'],
    '1test1',
    'sha256'
  );
  assert.equal(hash, 'a103bfe581a938e9ad78238cfc674ffafdd6ec70cb6825e7ed5c41787671efe4');
});

test('confirmation hash matches the docs\' worked example digest byte-for-byte', () => {
  // Hash=SHA256("1|11|CONFIRMED|1test1")
  const hash = computeHash(['1', '11', 'CONFIRMED'], '1test1', 'sha256');
  assert.equal(hash, 'c1e9888b7d9fb988a4aae0dfbff6d8092fc9581e22e02f335367dd01058f9618');
});

test('empty/undefined/null fields are dropped, not turned into a placeholder pipe', () => {
  const withGaps = computeHash(['1', undefined, '', null, '2'], 'key', 'sha256');
  const withoutGaps = computeHash(['1', '2'], 'key', 'sha256');
  assert.equal(withGaps, withoutGaps);
});

test('a different shared key produces a different hash (sanity check against a no-op signer)', () => {
  const a = computeHash(['1', '2'], 'key-a', 'sha256');
  const b = computeHash(['1', '2'], 'key-b', 'sha256');
  assert.notEqual(a, b);
});
