# Autopay MCP server

Exposes Autopay checkout as [MCP](https://modelcontextprotocol.io) tools —
any MCP-compatible agent can list payment channels, start a payment, and
verify its confirmation end to end, without a human touching any UI. Covers
**both** Autopay integration models:

- **Online v1.1** — classic redirect: the merchant signs a request and sends
  the payer's browser to Autopay's hosted payment page.
  Docs: https://developers.autopay.pl/online/dokumentacja-v1-1
- **WhiteLabel** — API-driven: the merchant calls Autopay server-to-server to
  discover channels (`gatewayList`) and required consents (`legalData`)
  before starting the transaction (`payment`) on its own UI.
  Docs: https://autopay.gitbook.io/autopay-sdk/schemat-transakcji-whitelabel

**Deploy:** `https://mcp-ap.autopaylab.com/api/mcp` (Bearer-token protected —
see "Locking it down" below for how to get a token).

**Landing page:** https://claude.ai/code/artifact/16135f3d-b5a9-4f54-9d9c-c269031c8e62
— what this is and why, in less time than this README (source: `landing.html`).

> **Official Autopay MCP server — Open Beta.** Actively developed and open
> to review and feedback: file issues, open PRs, or ask questions against
> this repository.

## Status: mock credentials, real hash math

No real Autopay test credentials are configured. `lib/config.js` defaults to
the documentation's own worked-example values (`ServiceID=2`, shared key
`2test2`) purely so the hash calculation is verifiable against the docs —
confirmed byte-for-byte against three of the docs' own worked examples (see
`lib/shared/hash.js`). These will **not** authenticate against a real Autopay
environment. Swap in real values via `.env` / Vercel project env vars once
Autopay issues them during test-environment onboarding (copy `.env.example`).

Every tool here builds/verifies the **actual** Autopay-shaped request (real
field names, real Hash) itself — there's no dependency on a separately
deployed sandbox backend. That means once real credentials arrive, this
starts talking to the real Autopay environment just by setting
`AUTOPAY_GATEWAY_URL` / `AUTOPAY_WHITELABEL_HOST`; nothing to rewrite. Until
then, `whitelabel_list_gateways` / `whitelabel_get_legal_data` /
`whitelabel_start_payment` return a **dry run**: the exact, correctly-signed
request they would have sent, without sending it. `online_create_checkout`
always returns the redirect URL + signed fields — that part of the flow is a
browser redirect, not a server call, so there's nothing to dry-run.

## What this server does NOT do

- **No shopping cart API.** Autopay has no "cart" concept — the calling agent
  computes `orderId` / `amount` / `description` itself and passes them to
  `online_create_checkout` / `whitelabel_start_payment`.
- **No card numbers or CVV ever pass through this server.** Every flow here
  is redirect-based: the payer enters card details on Autopay's own hosted
  page or Payment Channel. Tool schemas deliberately have no card fields.
- **No general refund of a settled payment.** `transactionCancel` is only
  documented for releasing a card *preauthorization* hold — see
  `lib/testData.js` → `knownDocumentationGaps`.
- **Not a substitute for running the deployment.** `verify_itn` validates and
  builds the reply for a given ITN message; `api/itn.js` is the real
  endpoint Autopay's servers should be configured to call — you still need
  this server running (e.g. this Vercel deployment) for a live integration.

## Tools

| Tool | Flow | Purpose |
|---|---|---|
| `list_test_scenarios` | both | Reference sandbox data: test hosts, gatewayIDs, real test card numbers / BLIK codes with expected outcomes, known doc gaps |
| `online_create_checkout` | Online v1.1 | Cart summary → signed redirect fields |
| `whitelabel_list_gateways` | WhiteLabel | Step 1: available channels |
| `whitelabel_get_legal_data` | WhiteLabel | Step 2: required consents for a channel |
| `whitelabel_start_payment` | WhiteLabel | Step 3: start the transaction |
| `verify_itn` | both | Step 4: verify an inbound ITN, get the confirmation XML to reply with |
| `build_test_itn` | both (sandbox) | Build a correctly-signed fake ITN to test `verify_itn` without a live bank |

## What's confirmed vs. best-effort

See inline comments in `lib/shared/payment.js`, `lib/whitelabel/*.js`, and
`lib/testData.js` → `knownDocumentationGaps` for a field-by-field breakdown.
Highlights:

- **Confirmed, byte-for-byte against the docs' own worked examples:** the
  Hash algorithm itself, the `ServiceID|OrderID|Amount` hash prefix, the full
  ITN request/response XML shape, and real test card numbers / BLIK codes
  (pulled from Autopay's own published test-scenario workbook — this fills a
  gap the docs page itself doesn't cover).
- **Best-effort, not independently cross-checked:** the exact hash field
  order beyond `ServiceID|OrderID|Amount` (`Description`, `GatewayID`,
  `Currency`, ...), and the WhiteLabel `gatewayList`/`legalData`/`payment`
  JSON response shapes (no worked examples exist for these on the WhiteLabel
  doc page itself).
- **Confirmed gaps in the public docs** (do not guess — confirm with
  Autopay): no consolidated gatewayID table, no complete error-code catalog,
  `transactionCancel` only covers preauth release, and no detection guidance
  for the documented FAILURE→SUCCESS edge case.

## Why this exists

Wrapping a checkout as a conversational widget UI is easy for any competing
PSP to copy via their own WhiteLabel integration — the UI isn't the moat.
Exposing checkout as MCP tools is a different claim: it says the integration
is agent-native, not just human-native. Worth being honest about scope,
though — Adyen, Stripe, and Worldpay already publish payment MCP servers, so
"we support MCP" alone isn't a unique differentiator among major global PSPs.
The realistic pitch is being early/best **in Autopay's actual competitive
set** (regional PSPs), not inventing something nobody else has.

## Running locally

```bash
npm install
cp .env.example .env    # optional — defaults work for exploring the flow
npm run dev              # http://localhost:3002/api/mcp (and /api/itn)
npm run test:mcp         # in another terminal — full initialize -> tools/list
                          # -> list_test_scenarios -> checkout tools ->
                          # build_test_itn -> verify_itn round trip
npm run start:stdio       # optional: run over stdio instead, for MCP clients
                          # that spawn a process directly (Claude Desktop,
                          # Claude Code) rather than connecting over HTTP
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

This repo deploys as its own Vercel project — Root Directory stays the repo
root, Framework Preset: "Other", no build command. Set `AUTOPAY_SERVICE_ID`,
`AUTOPAY_SHARED_KEY`, `AUTOPAY_GATEWAY_URL`, `AUTOPAY_WHITELABEL_HOST` once
Autopay issues real test credentials. Point Autopay's ITN configuration at
`https://<your-deploy>/api/itn`.

## Locking it down with a token

The server is open by default (anyone with the URL can call it — fine for a
sandbox, not fine once it's doing anything real). To require a password:

1. In the Vercel project → Settings → Environment Variables, add
   `MCP_ACCESS_TOKEN` with a random secret value.
2. Every client must now send `Authorization: Bearer <that secret>` on
   `POST /api/mcp` or get a 401. Unset = open, set = enforced — no code
   change needed either way.
3. Configure the MCP client to send it:
   - **Claude Code**: `claude mcp add --transport http autopay-checkout https://your-mcp-server.vercel.app/api/mcp --header "Authorization: Bearer <secret>"`
   - **Claude Desktop** (`claude_desktop_config.json`): add a `"headers": { "Authorization": "Bearer <secret>" }` entry alongside the server's `url`.
   - **Local testing**: `MCP_ACCESS_TOKEN=<secret> npm run test:mcp` (the script picks it up automatically).

`POST /api/itn` is never Bearer-protected — Autopay authenticates that
message itself via its own Hash, verified before any reply is sent.

This is a shared-secret check, not OAuth — enough to keep a demo/sandbox
private, not a substitute for real per-user auth if this ever handles real
money.

## Implementation notes

- Stateless Streamable HTTP transport (`sessionIdGenerator: undefined`) — a
  fresh `McpServer` + transport per request, no session state kept between
  invocations. This is the documented pattern for serverless deployment
  (Vercel/Lambda/Workers): different requests may land on different function
  instances, so there's nothing to keep "alive" between them.
- Tool input schemas are plain Zod shapes (`{ orderId: z.string(), ... }`) —
  the SDK auto-derives the JSON Schema clients see from these.
- `scripts/dev-server.js` is a zero-dependency local runner that mirrors
  Vercel's pre-parsed `req.body` / `res.status()` / `res.json()` / `res.send()`
  so `api/*.js` handlers don't need to know they aren't running on Vercel.

## Layout

```
api/mcp.js            — MCP endpoint (Streamable HTTP), Vercel serverless function
api/itn.js             — real Autopay-facing ITN receiver, Vercel serverless function
lib/tools.js            — tool definitions (input schemas, wiring)
lib/shared/hash.js       — the SHA256/512(fields|key) signer, confirmed against docs
lib/shared/xml.js        — XML escape/unescape/tag-extraction for ITN messages
lib/shared/itn.js        — ITN parse/verify/build, shared by both flows
lib/shared/payment.js    — shared "start transaction" request builder
lib/onlineV1/            — Online v1.1 checkout
lib/whitelabel/          — WhiteLabel gatewayList/legalData/payment
lib/testData.js           — sandbox reference data + known documentation gaps
lib/config.js             — env-driven credentials/config (mock defaults)
scripts/dev-server.js     — local runner for api/*.js
scripts/test-mcp.js       — end-to-end test against the running dev server
scripts/stdio.js          — optional stdio entrypoint for local MCP clients
```

## Related repos

- [paytalk](https://github.com/autopaylab/paytalk) — conversational checkout
  widget, plus the Online v1.1 and WhiteLabel sandbox mocks
  (`autopay-sandbox/`, `autopay-whitelabel-sandbox/`) this server's algorithms
  were cross-checked against. Independent of this repo; no code or deploy
  dependency in either direction.
