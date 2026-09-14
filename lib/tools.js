const { z } = require('zod');

const testData = require('./testData');
const { createCheckout } = require('./onlineV1/createCheckout');
const { listGateways } = require('./whitelabel/listGateways');
const { getLegalData } = require('./whitelabel/legalData');
const { startPayment } = require('./whitelabel/startPayment');
const { verifyItnXml, buildConfirmationXml, buildTestItnXml } = require('./shared/itn');

const AMOUNT = z.string().regex(/^\d+(\.\d{1,2})?$/, 'expected an amount like 1.00 (dot separator, up to 2 decimals)');
const GATEWAY_ID = z.union([z.string(), z.number()]);

function jsonResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function nowAsPaymentDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Registers the Autopay checkout tools on an MCP server instance. Unlike the
 * previous version of this repo, every tool here builds/verifies the actual
 * Autopay-shaped request (real field names, real Hash) itself — no
 * dependency on a separately-deployed sandbox backend. That means once
 * Autopay issues real test credentials, this starts talking to the real
 * Autopay environment just by setting env vars (see .env.example) — nothing
 * to rewrite.
 */
function registerCheckoutTools(server) {
  server.registerTool(
    'list_test_scenarios',
    {
      title: 'List Autopay sandbox test scenarios',
      description:
        'Returns reference sandbox data for testing: test environment hosts, known gatewayID values, real test card numbers and BLIK codes with their expected outcomes (from Autopay\'s own published test-scenario workbook), and known gaps in the public documentation. Use this before calling the other tools to pick realistic inputs.',
      inputSchema: {},
    },
    async () => jsonResult(testData)
  );

  server.registerTool(
    'online_create_checkout',
    {
      title: 'Start an Online v1.1 checkout',
      description:
        'Builds a signed redirect (cart summary -> hosted payment page) for the classic Online v1.1 gateway. Returns the URL and form fields (including Hash) to redirect the payer\'s browser to — this server never collects card numbers or CVV, Autopay\'s own hosted page does. Without AUTOPAY_GATEWAY_URL configured, returns a dry run (signed fields only, nothing sent).',
      inputSchema: {
        orderId: z.string().min(1).max(32).describe('Unique order identifier for this ServiceID'),
        amount: AMOUNT,
        currency: z.string().length(3).optional().describe('Default PLN; also EUR/GBP/USD per docs'),
        description: z.string().max(79).optional().describe('Transfer title shown to the payer'),
        gatewayId: GATEWAY_ID.optional().describe('0 = let the payer choose on Autopay\'s page; or a specific channel from list_test_scenarios'),
        customerEmail: z.string().email(),
        validityTime: z.string().optional().describe('Transaction expiry, "YYYY-MM-DD HH:MM:SS", default 6 days'),
        linkValidityTime: z.string().optional().describe('Payment link expiry, "YYYY-MM-DD HH:MM:SS"'),
      },
    },
    async (input) => jsonResult(createCheckout(input))
  );

  server.registerTool(
    'whitelabel_list_gateways',
    {
      title: 'WhiteLabel: list available payment channels',
      description: 'Step 1 of the WhiteLabel flow — queries the current payment channel catalog (gatewayList). Without AUTOPAY_WHITELABEL_HOST configured, returns a dry run (signed request body only).',
      inputSchema: {
        currencies: z.string().optional().describe('Comma-separated, e.g. "PLN,EUR" (default "PLN")'),
        language: z.string().optional().describe('e.g. "PL" (default "PL")'),
        messageId: z.string().optional().describe('32-char unique message id; generated if omitted'),
      },
    },
    async (input) => jsonResult(await listGateways(input))
  );

  server.registerTool(
    'whitelabel_get_legal_data',
    {
      title: 'WhiteLabel: get required legal acceptances',
      description: 'Step 2 of the WhiteLabel flow — fetches required regulation/consent acceptances for a chosen channel (legalData). Response shape is NOT confirmed by a worked example in the docs; treat as best-effort. Without AUTOPAY_WHITELABEL_HOST configured, returns a dry run.',
      inputSchema: {
        gatewayId: GATEWAY_ID.describe('Channel chosen from whitelabel_list_gateways'),
      },
    },
    async (input) => jsonResult(await getLegalData(input))
  );

  server.registerTool(
    'whitelabel_start_payment',
    {
      title: 'WhiteLabel: start the transaction',
      description:
        'Step 3 of the WhiteLabel flow — starts the transaction (payment) for a chosen channel, carrying forward any acceptance IDs from whitelabel_get_legal_data. Response may contain a continuation link the payer must be sent to (e.g. for card entry) — this server never collects card numbers or CVV directly. The synchronous response does NOT replace the ITN: verify_itn is the source of truth for final status. Without AUTOPAY_WHITELABEL_HOST configured, returns a dry run.',
      inputSchema: {
        orderId: z.string().min(1).max(32),
        amount: AMOUNT,
        currency: z.string().length(3).optional(),
        description: z.string().max(79).optional(),
        gatewayId: GATEWAY_ID,
        customerEmail: z.string().email(),
        validityTime: z.string().optional(),
        linkValidityTime: z.string().optional(),
        defaultRegulationAcceptanceId: z.string().optional().describe('From whitelabel_get_legal_data, if required for this channel'),
        recurringAcceptanceId: z.string().optional().describe('From whitelabel_get_legal_data, if required for this channel'),
      },
    },
    async (input) => jsonResult(await startPayment(input))
  );

  server.registerTool(
    'verify_itn',
    {
      title: 'Verify an ITN (payment confirmation) message',
      description:
        'Verifies an Instant Transaction Notification exactly as a merchant must: recomputes the hash from the message fields and compares it to the one supplied, never trusting an unverified message. Returns the parsed transaction, whether the hash matched, and the exact confirmation XML to reply with. Shared by both Online v1.1 and WhiteLabel — same mechanism per the docs. NOTE: this only verifies/builds the reply content — a real deployment still needs an HTTPS endpoint Autopay can POST to (this project\'s api/itn.js is exactly that).',
      inputSchema: {
        transactionsBase64: z.string().min(1).describe('The raw base64 value of the "transactions" POST parameter, exactly as Autopay sends it'),
      },
    },
    async ({ transactionsBase64 }) => {
      let xml;
      try {
        xml = Buffer.from(transactionsBase64, 'base64').toString('utf8');
      } catch {
        return jsonResult({ error: 'transactionsBase64 is not valid base64' });
      }
      const result = verifyItnXml(xml);
      const confirmationXml = buildConfirmationXml(result.data.serviceID, result.data.orderID, result.confirmation, result.confirmationHash);
      return jsonResult({ ...result, confirmationXml });
    }
  );

  server.registerTool(
    'build_test_itn',
    {
      title: 'Build a test ITN (sandbox helper)',
      description:
        'Sandbox-only helper: builds a correctly-signed fake ITN message, base64-encoded exactly as Autopay would send it, so you can exercise verify_itn end-to-end without a live bank action. Use list_test_scenarios for realistic gatewayId/paymentStatusDetails combinations (e.g. BLIK amount-triggered failures).',
      inputSchema: {
        orderId: z.string().min(1),
        remoteId: z.string().optional().describe('Autopay\'s transaction id; a random one is generated if omitted'),
        amount: AMOUNT,
        currency: z.string().length(3).optional().default('PLN'),
        gatewayId: GATEWAY_ID,
        paymentStatus: z.enum(['PENDING', 'SUCCESS', 'FAILURE']),
        paymentStatusDetails: z.string().optional().describe('e.g. AUTHORIZED, or one of the BLIK failure reasons from list_test_scenarios'),
        paymentDate: z.string().optional().describe('"YYYYMMDDhhmmss"; defaults to now'),
      },
    },
    async (input) => {
      const remoteID = input.remoteId || `TEST${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const xml = buildTestItnXml({
        orderID: input.orderId,
        remoteID,
        amount: input.amount,
        currency: input.currency || 'PLN',
        gatewayID: String(input.gatewayId),
        paymentDate: input.paymentDate || nowAsPaymentDate(),
        paymentStatus: input.paymentStatus,
        paymentStatusDetails: input.paymentStatusDetails,
      });
      return jsonResult({ transactionsBase64: Buffer.from(xml, 'utf8').toString('base64'), xml });
    }
  );
}

module.exports = { registerCheckoutTools };
