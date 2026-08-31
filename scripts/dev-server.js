// Zero-dependency local runner for api/mcp.js, mirroring Vercel's
// pre-parsed req.body/res.status()/res.json() so the handler doesn't need
// to know it isn't running on Vercel.
const http = require('http');
const { URL } = require('url');
const mcpHandler = require('../api/mcp');

const PORT = process.env.PORT || 3002;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/api/mcp') {
    res.statusCode = 404;
    res.end('Not found — only /api/mcp is served here.');
    return;
  }

  const raw = await readBody(req);
  req.body = raw ? JSON.parse(raw) : undefined;

  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };

  await mcpHandler(req, res);
});

server.listen(PORT, () => {
  console.log(`Autopay MCP server on http://localhost:${PORT}/api/mcp`);
  console.log('Test it with: npm run test:mcp');
});
