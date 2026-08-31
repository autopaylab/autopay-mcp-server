// Exercises the running dev server with real JSON-RPC MCP messages —
// initialize, tools/list, then a full initiate_payment -> confirm_payment
// round trip against the live Autopay sandbox. Run `npm run dev` first.
const BASE = `http://localhost:${process.env.PORT || 3002}/api/mcp`;

async function rpc(method, params, id) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
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
  try { parsed = JSON.parse(body); } catch { parsed = body; }
  console.log(`\n--- ${method} (HTTP ${res.status}) ---`);
  console.log(JSON.stringify(parsed, null, 2));
  return parsed;
}

async function main() {
  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test-mcp-script', version: '0.1.0' },
  }, 1);

  await rpc('tools/list', {}, 2);

  const cart = await rpc('tools/call', { name: 'get_cart', arguments: {} }, 3);
  const total = JSON.parse(cart.result.content[0].text).totalAmount;

  const orderId = 'mcp-' + Date.now();
  await rpc('tools/call', {
    name: 'initiate_payment',
    arguments: { orderId, amount: total, customerEmail: 'agent@example.com', gatewayId: '1' },
  }, 4);

  await rpc('tools/call', {
    name: 'confirm_payment',
    arguments: { orderId, amount: total, gatewayId: '1', status: 'SUCCESS' },
  }, 5);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
