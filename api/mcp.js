const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { registerCheckoutTools } = require('../lib/tools');

function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// One fresh McpServer + transport per request, stateless (sessionIdGenerator
// undefined) — the documented pattern for serverless: no session state to
// keep alive between invocations of what may be different function
// instances. See node_modules/@modelcontextprotocol/sdk .../streamableHttp.d.ts.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const server = new McpServer({ name: 'paytalk-autopay-checkout', version: '0.1.0' });
  registerCheckoutTools(server);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request failed', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error: ' + err.message },
        id: null,
      });
    }
  }
};
