const { buildPaymentRequest } = require('../shared/payment');
const config = require('../config');

// WhiteLabel step 3: POST https://{host_bramki}/payment
// (application/x-www-form-urlencoded, per docs). Same field set and Hash
// algorithm as Online v1.1's "rozpoczęcie transakcji" — see
// lib/shared/payment.js for what is confirmed vs. best-effort in the field
// order. Response "may contain a continuation link, an order-acceptance
// status, or validation error info" (docs) — the payer is redirected there
// for channels that need it (e.g. card entry); this server never sees card
// data. BLIK does not redirect: confirmation arrives via ITN instead.
async function startPayment(input) {
  const fields = buildPaymentRequest(input);

  if (!config.whitelabelHost) {
    return {
      dryRun: true,
      note: 'AUTOPAY_WHITELABEL_HOST is not set — this is a dry run. "{host_bramki}" is partner-specific, handed out by Autopay during onboarding.',
      wouldCallUrl: '{host_bramki}/payment',
      fields,
    };
  }

  const url = `${config.whitelabelHost}/payment`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
  const text = await res.text();
  return { dryRun: false, url, httpStatus: res.status, responseBody: text };
}

module.exports = { startPayment };
