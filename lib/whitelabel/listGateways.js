const crypto = require('crypto');
const { computeHash } = require('../shared/hash');
const config = require('../config');

// WhiteLabel step 1. Docs give the endpoint path explicitly:
//   POST https://{host_bramki}/gatewayList/v3
// but the request/response field names below come from a *different*
// section of the docs (the "self-embedding channel list" query) that was the
// only place an actual worked example was found — verify this is the same
// method before relying on it in production:
//   Hash=SHA256("100|11111111111111111111111111111111|PLN,EUR|PL|1test1")
//   -> fields in order: ServiceID, MessageID, Currencies, Language
const FIELD_ORDER = ['ServiceID', 'MessageID', 'Currencies', 'Language'];

function buildMessageId() {
  return crypto.randomBytes(16).toString('hex'); // 32 hex chars
}

async function listGateways(input) {
  const values = {
    ServiceID: config.serviceId,
    MessageID: input.messageId || buildMessageId(),
    Currencies: input.currencies || 'PLN',
    Language: input.language || 'PL',
  };
  const hash = computeHash(FIELD_ORDER.map((k) => values[k]), config.sharedKey, config.hashAlgorithm);
  const body = { ...values, Hash: hash };

  if (!config.whitelabelHost) {
    return {
      dryRun: true,
      note: 'AUTOPAY_WHITELABEL_HOST is not set — this is a dry run. "{host_bramki}" is partner-specific, handed out by Autopay during onboarding.',
      wouldCallUrl: '{host_bramki}/gatewayList/v3',
      body,
    };
  }

  const url = `${config.whitelabelHost}/gatewayList/v3`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { dryRun: false, url, httpStatus: res.status, responseBody: text };
}

module.exports = { listGateways };
