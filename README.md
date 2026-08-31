# Autopay MCP server

Exposes the Paytalk demo checkout as [MCP](https://modelcontextprotocol.io)
tools — any MCP-compatible agent (Claude, and per the Agentic Commerce
Protocol's 2026-04-17 spec update, ChatGPT-family agents too) can browse the
cart, start a payment, and confirm it **without a human touching the widget
UI at all**. A separate, independently deployable project (Root Directory =
`autopay-mcp-server/`), same pattern as the other two sandboxes in this repo.

## Why this exists

Wrapping a checkout as a conversational widget UI is easy for any competing
PSP to copy via their own WhiteLabel integration — the UI isn't the moat.
Exposing the *same* checkout as MCP tools is a different claim: it says the
integration is agent-native, not just human-native. Worth being honest about
scope, though — Adyen, Stripe, and Worldpay already publish payment MCP
servers, so "we support MCP" alone isn't a unique differentiator among major
global PSPs. The realistic pitch is being early/best **in Autopay's actual
competitive set** (regional PSPs), not inventing something nobody else has.

## Tools

| Tool | What it does |
| --- | --- |
| `get_cart` | Returns the demo cart (same items as `Component.DEFAULT_CART` in the widget) — items, quantities, total. |
| `initiate_payment` | Calls the live Online v1.1 sandbox's `POST /api/initiate` — real hash-signing, not a mock. |
| `confirm_payment` | Calls `POST /api/simulate-bank` — builds a correctly-signed ITN and verifies it through the same code path a real notification would use. |

All three hit `https://sndbx.autopaylab.com` by default (`autopay-sandbox/`
in this repo) — the exact same backend the widget's "Sandbox: Online v1.1"
option talks to. `AUTOPAY_SANDBOX_URL` overrides the target.

## Running locally

```bash
npm install
npm run dev              # starts http://localhost:3002/api/mcp
npm run test:mcp         # in another terminal — full initialize -> tools/list
                          # -> get_cart -> initiate_payment -> confirm_payment
                          # round trip against the real sandbox
```

## Connecting a real MCP client

Claude Code / Claude Desktop (`claude mcp add` or the equivalent config
entry) — point it at the deployed `/api/mcp` URL as a Streamable HTTP
server. For the official test client:

```bash
npx @modelcontextprotocol/inspector
# then connect to http://localhost:3002/api/mcp (or the deployed URL)
```

## Deploying

Create a **separate** Vercel project pointing at this repo with **Root
Directory** set to `autopay-mcp-server/`. Framework Preset: "Other", no
build command. Set `AUTOPAY_SANDBOX_URL` if you want it to drive a
different sandbox (e.g. the WhiteLabel one) instead of the default.

## Locking it down with a token

The server is open by default (anyone with the URL can call it — fine for a
sandbox, not fine once it's doing anything real). To require a password:

1. In the Vercel project → Settings → Environment Variables, add
   `MCP_ACCESS_TOKEN` with a random secret value.
2. Every client must now send `Authorization: Bearer <that secret>` or get a
   401. `AUTOPAY_SANDBOX_URL`-style: unset = open, set = enforced — no code
   change needed either way.
3. Configure the MCP client to send it:
   - **Claude Code**: `claude mcp add --transport http autopay-checkout https://your-mcp-server.vercel.app/api/mcp --header "Authorization: Bearer <secret>"`
   - **Claude Desktop** (`claude_desktop_config.json`): add a `"headers": { "Authorization": "Bearer <secret>" }` entry alongside the server's `url`.
   - **Local testing**: `MCP_ACCESS_TOKEN=<secret> npm run test:mcp` (the script picks it up automatically).

This is a shared-secret check, not OAuth — enough to keep a demo/sandbox
private, not a substitute for real per-user auth if this ever handles real
money.

## Implementation notes

- Stateless Streamable HTTP transport (`sessionIdGenerator: undefined`) — a
  fresh `McpServer` + transport per request, no session state kept between
  invocations. This is the documented pattern for serverless deployment
  (Vercel/Lambda/Workers): different requests may land on different
  function instances, so there's nothing to keep "alive" between them.
- Tool input schemas are plain Zod shapes (`{ orderId: z.string(), ... }`) —
  the SDK auto-derives the JSON Schema clients see from these.
