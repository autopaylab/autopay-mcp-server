const config = require('../config');

// WhiteLabel step 2: POST https://{host_bramki}/legalData
// Docs confirm only the *purpose* (fetch required regulation/consent
// acceptances such as DefaultRegulationAcceptanceID, RecurringAcceptanceID
// for the chosen channel) and that the result must be carried into the
// payment call. No worked JSON request/response example was found anywhere
// in either source — request shape below (and whether it needs a Hash at
// all) is NOT confirmed. Verify with Autopay before production use.
async function getLegalData(input) {
  const body = { ServiceID: config.serviceId, GatewayID: input.gatewayId };

  if (!config.whitelabelHost) {
    return {
      dryRun: true,
      note: 'AUTOPAY_WHITELABEL_HOST is not set — this is a dry run. Request/response shape for legalData is unconfirmed in the docs; do not rely on this beyond exploring the flow.',
      wouldCallUrl: '{host_bramki}/legalData',
      body,
    };
  }

  const url = `${config.whitelabelHost}/legalData`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { dryRun: false, url, httpStatus: res.status, responseBody: text };
}

module.exports = { getLegalData };
