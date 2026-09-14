// Zero-dependency local runner for api/*.js, mirroring Vercel's pre-parsed
// req.body/res.status()/res.json()/res.send() so the handlers don't need to
// know they aren't running on Vercel.
const http = require('http');
const { URL } = require('url');
const mcpHandler = require('../api/mcp');
const itnHandler = require('../api/itn');

const PORT = process.env.PORT || 3002;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function parseBody(raw, contentType) {
  if (!raw) return undefined;
  if (contentType.includes('application/json')) return JSON.parse(raw);
  if (contentType.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  const raw = await readBody(req);
  req.body = parseBody(raw, req.headers['content-type'] || '');

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  res.send = (body) => res.end(body);

  if (url.pathname === '/api/mcp') return mcpHandler(req, res);
  if (url.pathname === '/api/itn') return itnHandler(req, res);

  res.status(404).send('Not found — only /api/mcp and /api/itn are served here.');
});

server.listen(PORT, () => {
  console.log(`Autopay MCP server on http://localhost:${PORT}/api/mcp (and /api/itn)`);
  console.log('Test it with: npm run test:mcp');
});
