// Reference sandbox data collected from Autopay's own public documentation
// and its published test-scenario workbook (developers.autopay.pl/scenariuszetestowe),
// for building/testing checkout flows before Autopay issues your own
// dedicated test ServiceID + shared key. None of this authenticates against
// a real environment on its own — see each item's `status`.
module.exports = {
  environments: {
    test: { gateway: 'https://testpay.autopay.eu', cards: 'https://testcards.autopay.eu' },
    production: { gateway: 'https://pay.autopay.eu', cards: 'https://cards.autopay.eu' },
    status: 'CONFIRMED — quoted verbatim from the docs.',
  },

  exampleCredentialsInHashWorkedExamples: {
    serviceId: '2',
    sharedKey: '2test2',
    status: 'CONFIRMED as the docs\' own worked-example values (used to verify hash math), NOT usable to authenticate against any real environment.',
  },

  gatewayIds: [
    { gatewayId: 0, name: 'Show channel picker on Autopay-hosted page', status: 'CONFIRMED' },
    { gatewayId: 106, name: 'Mock PBL (test bank transfer)', status: 'CONFIRMED — used throughout the published test-scenario workbook' },
    { gatewayId: 509, name: 'BLIK', status: 'CONFIRMED — used throughout the published test-scenario workbook' },
    { gatewayId: 701, name: 'Payka (BNPL)', status: 'found via automated doc extraction, not cross-checked' },
    { gatewayId: 1500, name: 'Card (one-time)', status: 'found via automated doc extraction, not cross-checked' },
    { gatewayId: 1503, name: 'Card (recurring/automatic)', status: 'CONFIRMED — used in the published test-scenario workbook' },
    { gatewayId: 1511, name: 'Visa wallet', status: 'found via automated doc extraction, not cross-checked' },
    { gatewayId: 1512, name: 'Google Pay', status: 'found via automated doc extraction, not cross-checked' },
    { gatewayId: 1513, name: 'Apple Pay', status: 'found via automated doc extraction, not cross-checked' },
    {
      gatewayId: null,
      name: null,
      status: 'GAP CONFIRMED BY USER: there is no single consolidated gatewayID table in the docs — values are scattered across pages. The list above is everything found; treat it as partial and verify the full set with Autopay (also visible in the Autopay admin panel per the docs).',
    },
  ],

  testCards: {
    status: 'CONFIRMED — found in Autopay\'s own published test-scenario workbook (developers.autopay.pl/scenariuszetestowe), used with GatewayID 1503 (recurring/automatic card).',
    scenarios: [
      { pan: '4444 4444 4444 4000', cvv: '111', result: 'SUCCESS (paymentStatus=SUCCESS, paymentStatusDetails=AUTHORIZED)' },
      { pan: '4444 4444 4444 4000', cvv: '251', result: 'Registration/charge rejected' },
      { pan: '4444 4444 4444 7714', cvv: '111', result: 'Registers fine; a later automatic charge attempt fails with FAILURE / CARD_LIMIT_EXCEEDED (61)' },
    ],
  },

  testBlikCodes: {
    status: 'CONFIRMED — found in Autopay\'s own published test-scenario workbook, used with GatewayID 509 (BLIK) as the "AuthorizationCode" / "T6" field.',
    scenarios: [
      { code: '111111', result: 'SUCCESS; also registers a OneClick alias (BlikUIDKey/BlikUIDLabel) if supplied' },
      { code: '111112', result: 'SUCCESS, no alias registered (or, combined with specific test amounts below, a FAILURE with a specific reason)' },
      { code: '111115', result: 'Simulates de-registering a previously registered OneClick alias' },
      { code: '111121', result: 'Synchronous rejection: NOTCONFIRMED, reason=WRONG_TICKET (no ITN sent)' },
      { code: '111122', result: 'Synchronous rejection: NOTCONFIRMED, reason=TICKET_EXPIRED (no ITN sent)' },
      { code: '111123', result: 'Synchronous rejection: NOTCONFIRMED, reason=TICKET_USED (no ITN sent)' },
    ],
    amountTriggeredFailures: {
      note: 'With code 111112 and GatewayID 509, these specific amounts trigger a FAILURE ITN with the given paymentStatusDetails instead of SUCCESS:',
      scenarios: [
        { amount: '756.31', paymentStatusDetails: 'INSUFFICIENT_FUNDS' },
        { amount: '756.32', paymentStatusDetails: 'ISSUER_DECLINED' },
        { amount: '756.33', paymentStatusDetails: 'TIMEOUT' },
        { amount: '756.34', paymentStatusDetails: 'USER_TIMEOUT' },
        { amount: '756.35', paymentStatusDetails: 'AM_TIMEOUT' },
        { amount: '756.36', paymentStatusDetails: 'SEC_DECLINED' },
        { amount: '756.37', paymentStatusDetails: 'BAD_PIN' },
        { amount: '756.38', paymentStatusDetails: 'LIMIT_EXCEEDED' },
        { amount: '756.39', paymentStatusDetails: 'SYSTEM_ERROR' },
        { amount: '756.40', paymentStatusDetails: 'GENERAL_ERROR' },
      ],
    },
  },

  paymentStatusValues: {
    status: 'CONFIRMED for PENDING/SUCCESS/FAILURE. ON_HOLD and CONFIRMED (card preauthorization related) found via automated doc extraction, not independently cross-checked.',
    values: ['PENDING', 'SUCCESS', 'FAILURE', 'ON_HOLD', 'CONFIRMED'],
  },

  knownDocumentationGaps: [
    'No single consolidated table of all gatewayID values (confirmed gap — see gatewayIds above).',
    'No complete error-code catalog; only the codes observed in the test-scenario workbook and a handful of pre-transaction BLIK errors (ALIAS_NONUNIQUE, ALIAS_DECLINED, ALIAS_NOT_FOUND, WRONG_TICKET, TICKET_EXPIRED, TICKET_USED, RECURRENCY_NOT_SUPPORTED, INVALID_EMAIL) are documented.',
    'transactionCancel is only documented for releasing a card preauthorization hold (Hold=true), not as a general refund of an already-settled payment — the general refund flow is not described with a worked example anywhere found. Confirm with Autopay before assuming transactionCancel covers settled-payment refunds.',
    'The docs state status can change FAILURE→SUCCESS "in special cases (e.g. after an Autopay consultant approves a transaction with an incorrect amount)... requires special business agreements and is not enabled by default" — no guidance on how to detect this programmatically beyond re-processing every ITN you receive for an order, including ones after a final status.',
    'WhiteLabel gatewayList/legalData/payment response JSON shapes are not published with worked examples on the WhiteLabel doc page itself; the shapes used in this server come from a different, likely-related section of the Online v1.1 docs (see comments in lib/whitelabel/*.js) — verify against Autopay before production.',
  ],
};
