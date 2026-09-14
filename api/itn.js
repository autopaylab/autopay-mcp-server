const { verifyItnXml, buildConfirmationXml } = require('../lib/shared/itn');

// Real Autopay-facing endpoint: point Autopay's ITN configuration at
// https://<this-deploy>/api/itn for a live integration. Deliberately NOT
// Bearer-protected — Autopay authenticates the message itself via its own
// Hash, which is verified below before any reply is sent.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const transactionsParam = req.body && req.body.transactions;
  if (!transactionsParam) {
    res.status(400).send('Missing "transactions" parameter');
    return;
  }

  let xml;
  try {
    xml = Buffer.from(transactionsParam, 'base64').toString('utf8');
  } catch {
    res.status(400).send('Malformed transactions payload');
    return;
  }

  const result = verifyItnXml(xml);
  console.log('[ITN]', { orderID: result.data.orderID, paymentStatus: result.data.paymentStatus, hashOk: result.hashOk });

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.status(200).send(buildConfirmationXml(result.data.serviceID, result.data.orderID, result.confirmation, result.confirmationHash));
};
