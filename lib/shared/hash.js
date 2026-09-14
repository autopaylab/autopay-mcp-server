const crypto = require('crypto');

/**
 * Autopay signs every message by concatenating non-empty field values with
 * "|", appending the shared key, then hashing the whole string:
 *   Hash = SHA256(field1 + "|" + field2 + ... + "|" + sharedKey)
 * Confirmed against the docs' own worked examples:
 *   Hash=SHA256("2|100|1.50|2test2")                                     -> initiation (ServiceID|OrderID|Amount)
 *   Hash=SHA256("1|11|91|11.11|PLN|1|20010101111111|SUCCESS|AUTHORIZED|1test1") -> ITN
 *   Hash=SHA256("1|11|CONFIRMED|1test1")                                 -> ITN confirmation
 * Fields that are empty/null/undefined are dropped entirely (no placeholder
 * pipe left behind).
 */
function computeHash(fields, sharedKey, algorithm = 'sha256') {
  const parts = fields
    .filter((v) => v !== undefined && v !== null && String(v) !== '')
    .map(String);
  parts.push(sharedKey);
  return crypto.createHash(algorithm).update(parts.join('|'), 'utf8').digest('hex');
}

module.exports = { computeHash };
