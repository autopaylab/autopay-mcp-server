// Exercises the running dev server with real JSON-RPC MCP messages —
// initialize, tools/list, then a build_test_itn -> verify_itn round trip
// (including a tampered-hash case), plus one call per checkout flow. Run
// `npm run dev` first.
// 127.0.0.1, not "localhost": on some environments "localhost" resolves
// IPv6 (::1) first and fails fast if the stack isn't dual-homed there.
const BASE = `http://127.0.0.1:${process.env.PORT || 3002}/api/mcp`;

async function rpc(method, params, id) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (process.env.MCP_ACCESS_TOKEN) headers.Authorization = 'Bearer ' + process.env.MCP_ACCESS_TOKEN;

  const res = await fetch(BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: id ?? 1, method, params }),
  });
  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();
  let body = raw;
  if (contentType.includes('text/event-stream')) {
    const line = raw.split('\n').find((l) => l.startsWith('data:'));
    body = line ? line.slice(5).trim() : raw;
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  console.log(`\n--- ${method}${params && params.name ? ' (' + params.name + ')' : ''} (HTTP ${res.status}) ---`);
  console.log(JSON.stringify(parsed, null, 2));
  return parsed;
}

function toolResult(rpcResponse) {
  return JSON.parse(rpcResponse.result.content[0].text);
}

async function main() {
  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-mcp-script', version: '0.1.0' },
  }, 1);

  await rpc('tools/list', {}, 2);

  await rpc('tools/call', { name: 'list_test_scenarios', arguments: {} }, 3);

  const orderId = 'mcp-' + Date.now();

  await rpc('tools/call', {
    name: 'online_create_checkout',
    arguments: { orderId, amount: '11.11', customerEmail: 'agent@example.com' },
  }, 4);

  await rpc('tools/call', { name: 'whitelabel_list_gateways', arguments: {} }, 5);
  await rpc('tools/call', { name: 'whitelabel_get_legal_data', arguments: { gatewayId: '509' } }, 6);
  await rpc('tools/call', {
    name: 'whitelabel_start_payment',
    arguments: { orderId: orderId + '-wl', amount: '1.00', gatewayId: '509', customerEmail: 'agent@example.com' },
  }, 7);

  const built = await rpc('tools/call', {
    name: 'build_test_itn',
    arguments: { orderId, amount: '11.11', gatewayId: '509', paymentStatus: 'SUCCESS', paymentStatusDetails: 'AUTHORIZED' },
  }, 8);
  const { transactionsBase64, xml } = toolResult(built);

  const verified = await rpc('tools/call', { name: 'verify_itn', arguments: { transactionsBase64 } }, 9);
  if (!toolResult(verified).hashOk) throw new Error('Expected hashOk=true for an untampered ITN');

  const tamperedXml = xml.replace('11.11', '99.99');
  const tampered = await rpc('tools/call', {
    name: 'verify_itn',
    arguments: { transactionsBase64: Buffer.from(tamperedXml, 'utf8').toString('base64') },
  }, 10);
  if (toolResult(tampered).hashOk) throw new Error('Expected hashOk=false for a tampered ITN');

  console.log('\nAll checks passed.');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
