const { computeHash } = require('./hash');
const { escapeXml, tag } = require('./xml');
const config = require('../config');

// Confirmed identical mechanism for Online v1.1 and WhiteLabel (same
// underlying gateway, same signing scheme — see docs).
//
// Request XML sent BY Autopay TO the merchant (single base64-encoded
// "transactions" POST parameter):
//   <?xml version="1.0" encoding="UTF-8"?>
//   <transactionList>
//     <serviceID>1</serviceID>
//     <transactions><transaction>
//       <orderID>11</orderID><remoteID>91</remoteID><amount>11.11</amount>
//       <currency>PLN</currency><gatewayID>1</gatewayID>
//       <paymentDate>20010101111111</paymentDate>
//       <paymentStatus>SUCCESS</paymentStatus>
//       <paymentStatusDetails>AUTHORIZED</paymentStatusDetails>
//     </transaction></transactions>
//     <hash>...</hash>
//   </transactionList>
// Hash=SHA256("1|11|91|11.11|PLN|1|20010101111111|SUCCESS|AUTHORIZED|1test1")

function parseItnXml(xml) {
  const transactionXml = (xml.match(/<transaction>([\s\S]*?)<\/transaction>/) || [, ''])[1];
  return {
    serviceID: tag('serviceID', xml),
    orderID: tag('orderID', transactionXml),
    remoteID: tag('remoteID', transactionXml),
    amount: tag('amount', transactionXml),
    currency: tag('currency', transactionXml),
    gatewayID: tag('gatewayID', transactionXml),
    paymentDate: tag('paymentDate', transactionXml),
    paymentStatus: tag('paymentStatus', transactionXml),
    paymentStatusDetails: tag('paymentStatusDetails', transactionXml),
    hash: tag('hash', xml),
  };
}

function itnHashFields(d) {
  return [d.serviceID, d.orderID, d.remoteID, d.amount, d.currency, d.gatewayID, d.paymentDate, d.paymentStatus, d.paymentStatusDetails];
}

// Runs the exact same verification a real ITN goes through: recompute the
// hash from the fields and compare against the one the message carried.
// Also builds the confirmation reply Autopay expects (CONFIRMED only when
// the hash actually matches — never trust an unverified message).
function verifyItnXml(xml) {
  const data = parseItnXml(xml);
  const expectedHash = computeHash(itnHashFields(data), config.sharedKey, config.hashAlgorithm);
  const hashOk = expectedHash === data.hash;
  const confirmation = hashOk ? 'CONFIRMED' : 'NOTCONFIRMED';
  const confirmationHash = computeHash([data.serviceID, data.orderID, confirmation], config.sharedKey, config.hashAlgorithm);
  return { data, hashOk, confirmation, confirmationHash };
}

function buildConfirmationXml(serviceID, orderID, confirmation, hash) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<confirmationList>\n' +
    `  <serviceID>${escapeXml(serviceID)}</serviceID>\n` +
    '  <transactionsConfirmations>\n' +
    '    <transactionConfirmed>\n' +
    `      <orderID>${escapeXml(orderID)}</orderID>\n` +
    `      <confirmation>${escapeXml(confirmation)}</confirmation>\n` +
    '    </transactionConfirmed>\n' +
    '  </transactionsConfirmations>\n' +
    `  <hash>${escapeXml(hash)}</hash>\n` +
    '</confirmationList>'
  );
}

// Sandbox-only helper: builds a correctly-signed fake ITN, as if Autopay had
// sent it, so a caller can exercise verify_itn without a live bank action.
function buildTestItnXml({ orderID, remoteID, amount, currency, gatewayID, paymentDate, paymentStatus, paymentStatusDetails }) {
  const serviceID = config.serviceId;
  const fields = [serviceID, orderID, remoteID, amount, currency, gatewayID, paymentDate, paymentStatus, paymentStatusDetails];
  const hash = computeHash(fields, config.sharedKey, config.hashAlgorithm);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<transactionList>' +
    `<serviceID>${escapeXml(serviceID)}</serviceID>` +
    '<transactions><transaction>' +
    `<orderID>${escapeXml(orderID)}</orderID>` +
    `<remoteID>${escapeXml(remoteID)}</remoteID>` +
    `<amount>${escapeXml(amount)}</amount>` +
    `<currency>${escapeXml(currency)}</currency>` +
    `<gatewayID>${escapeXml(gatewayID)}</gatewayID>` +
    `<paymentDate>${escapeXml(paymentDate)}</paymentDate>` +
    `<paymentStatus>${escapeXml(paymentStatus)}</paymentStatus>` +
    (paymentStatusDetails ? `<paymentStatusDetails>${escapeXml(paymentStatusDetails)}</paymentStatusDetails>` : '') +
    '</transaction></transactions>' +
    `<hash>${escapeXml(hash)}</hash>` +
    '</transactionList>'
  );
}

module.exports = { parseItnXml, verifyItnXml, buildConfirmationXml, buildTestItnXml };
