# Contributing

This is Autopay's official MCP server, currently in **Open Beta** — it's
built openly and improves through outside review. Bug reports, corrections
to the documentation-gap notes below, and pull requests are all welcome.

## Setup

```bash
npm install
cp .env.example .env   # optional — defaults work for exploring the flow
npm test                # unit tests (lib/) — no network, no credentials needed
npm run dev             # local server: http://localhost:3002/api/mcp (+ /api/itn)
npm run test:mcp        # in another terminal — full MCP round trip against the dev server
```

## Before opening a PR

- `npm test` and `npm run test:mcp` both pass.
- New logic in `lib/` gets a matching test in `test/`. See `test/hash.test.js`
  for the pattern: real Autopay worked examples as fixtures, not invented ones.
- If you're touching hash field order, XML shape, or anything else marked
  `CONFIRMED` / `best-effort` / a documentation gap (see `lib/testData.js` and
  the comments in `lib/shared/payment.js`, `lib/whitelabel/*.js`), say in the
  PR description **what you verified it against** — a worked example from
  Autopay's docs, a real sandbox response, or a reply from Autopay directly.
  Don't upgrade a "best-effort" comment to "confirmed" without a source.
- Keep commit messages in the `type: short description` style already used
  in this repo's history (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).

## Reporting a documentation gap or a wrong assumption

If you've confirmed (or disproven) one of the items in `lib/testData.js`'s
`knownDocumentationGaps`, or found the real field order/JSON shape for
something marked best-effort — that's exactly the kind of contribution this
Open Beta is asking for. Open an issue or a PR; either is fine.

## Reporting a security issue

See [SECURITY.md](./SECURITY.md) — please don't open a public issue for
anything that looks like a real vulnerability.

## Scope

This server builds and verifies Autopay-shaped requests (real field names,
real Hash) for both the Online v1.1 and WhiteLabel flows. It intentionally
does **not** handle card numbers, CVV, or a general refund/cart API — see
"What this server does NOT do" in the README before proposing a feature
that would need one of those.
