// Optional local-only entrypoint: run this server over stdio for MCP
// clients that spawn a process directly (Claude Desktop, Claude Code)
// instead of connecting over HTTP. The deployed/official entrypoint is
// api/mcp.js (Streamable HTTP, see README).
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { registerCheckoutTools } = require('../lib/tools');

async function main() {
  const server = new McpServer({ name: 'autopay-checkout', version: '0.2.0' });
  registerCheckoutTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
