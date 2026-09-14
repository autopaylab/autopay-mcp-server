const { computeHash } = require('./hash');
const config = require('../config');

// Shared by Online v1.1 ("rozpoczęcie transakcji") and WhiteLabel ("payment")
// — both docs describe the same endpoint/field set; WhiteLabel just adds two
// discovery calls (gatewayList, legalData) before it and may attach legal
// acceptance IDs from that legalData response.
//
// Field order for the Hash:
//   ServiceID, OrderID, Amount            <- CONFIRMED: matches the docs' own
//                                             worked example verbatim:
//                                             Hash=SHA256("2|100|1.50|2test2")
//   Description, GatewayID, Currency,
//   CustomerEmail, ValidityTime,
//   LinkValidityTime                      <- from an automated extraction of
//                                             the docs page (quoted rule:
//                                             "Kolejność atrybutów do
//                                             wyliczenia Hash musi być zgodna
//                                             z ich numeracją"), NOT
//                                             cross-checked against a full
//                                             worked-example hash string.
//                                             Treat as best-effort — verify
//                                             against Autopay's own numbered
//                                             parameter table before
//                                             production use.
//   DefaultRegulationAcceptanceID,
//   RecurringAcceptanceID                 <- WhiteLabel-only, position NOT
//                                             documented anywhere found —
//                                             pure best guess. Confirm with
//                                             Autopay.
const FIELD_ORDER = [
  'ServiceID',
  'OrderID',
  'Amount',
  'Description',
  'GatewayID',
  'Currency',
  'CustomerEmail',
  'ValidityTime',
  'LinkValidityTime',
  'DefaultRegulationAcceptanceID',
  'RecurringAcceptanceID',
];

function buildPaymentRequest(input) {
  const values = {
    ServiceID: config.serviceId,
    OrderID: input.orderId,
    Amount: input.amount,
    Description: input.description,
    GatewayID: input.gatewayId,
    Currency: input.currency,
    CustomerEmail: input.customerEmail,
    ValidityTime: input.validityTime,
    LinkValidityTime: input.linkValidityTime,
    DefaultRegulationAcceptanceID: input.defaultRegulationAcceptanceId,
    RecurringAcceptanceID: input.recurringAcceptanceId,
  };

  const hash = computeHash(FIELD_ORDER.map((key) => values[key]), config.sharedKey, config.hashAlgorithm);

  const fields = {};
  FIELD_ORDER.forEach((key) => {
    if (values[key] !== undefined && values[key] !== null && String(values[key]) !== '') {
      fields[key] = String(values[key]);
    }
  });
  fields.Hash = hash;

  return fields;
}

module.exports = { buildPaymentRequest, FIELD_ORDER };
