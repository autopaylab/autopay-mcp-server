const { buildPaymentRequest } = require('../shared/payment');
const config = require('../config');

// Online v1.1 ("classic") checkout: the merchant redirects the payer's
// browser to Autopay's hosted payment page with these signed fields — this
// server never collects card data or a CVV, Autopay's own page does.
function createCheckout(input) {
  const fields = buildPaymentRequest(input);

  return {
    gatewayUrl: config.onlineGatewayUrl || `${config.gatewayHost}/`,
    method: 'POST',
    fields,
    note: config.onlineGatewayUrl
      ? undefined
      : 'AUTOPAY_GATEWAY_URL is not set — this is a dry run. The exact test-form URL ("Adres testowego formularza") is partner-specific and handed out by Autopay during test-environment onboarding.',
  };
}

module.exports = { createCheckout };
