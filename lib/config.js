// Defaults reuse the documentation's own worked-example values (ServiceID "2"
// / shared key "2test2") so the hash math is verifiable against the docs even
// with no real Autopay credentials configured. These will NOT authenticate
// against a real Autopay test environment — replace via env vars once Autopay
// issues real test credentials (see .env.example).
const config = {
  serviceId: process.env.AUTOPAY_SERVICE_ID || '2',
  sharedKey: process.env.AUTOPAY_SHARED_KEY || '2test2',
  hashAlgorithm: process.env.AUTOPAY_HASH_ALGO || 'sha256',

  // Host confirmed by the docs.
  gatewayHost: process.env.AUTOPAY_GATEWAY_HOST || 'https://testpay.autopay.eu',

  // Both are partner-specific, handed out by Autopay during onboarding — not
  // guessable public paths. Left empty, the relevant tools return a dry-run
  // result (signed fields, no live request sent) instead of guessing a URL.
  onlineGatewayUrl: process.env.AUTOPAY_GATEWAY_URL || '',
  whitelabelHost: process.env.AUTOPAY_WHITELABEL_HOST || '',

  // Optional Bearer token for api/mcp.js. Unset = open (today's demo
  // default); set it (and in Vercel's project settings) to require every
  // client to send "Authorization: Bearer <token>".
  accessToken: process.env.MCP_ACCESS_TOKEN || '',
};

module.exports = config;
