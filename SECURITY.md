# Security Policy

This server builds and verifies signed requests for Autopay's payment
gateway. It never collects or forwards card numbers or a CVV (every flow is
redirect-based — the payer enters card details on Autopay's own hosted page
or Payment Channel), but it does handle payment confirmations (ITN), a
signing key, and — when configured — a Bearer token gating the MCP endpoint.
Take reports seriously even when the immediate blast radius looks small.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a suspected vulnerability.**

Use GitHub's private reporting: this repository's **Security** tab →
**Report a vulnerability**. That opens a private draft advisory visible only
to you and the maintainers, so details aren't public before a fix ships.

If that option isn't available when you look (private vulnerability
reporting may not be enabled yet for this repository), open a regular issue
titled only "Security issue — see private channel requested" with no
technical detail, and a maintainer will follow up to arrange a private
channel.

Please include, where you can:

- The affected file(s) or tool(s).
- Steps to reproduce, or a minimal proof of concept.
- What you'd expect to happen instead.
- Whether it requires a configured `MCP_ACCESS_TOKEN` / real Autopay
  credentials to trigger, or reproduces against the open defaults.

## In scope

- Bypassing or weakening the `MCP_ACCESS_TOKEN` Bearer check (`api/mcp.js`).
- Any way to make `verify_itn` / the `/api/itn` endpoint report `CONFIRMED`
  for a message whose hash doesn't actually match (`lib/shared/itn.js`).
- XML injection via a caller-supplied field ending up unescaped in ITN or
  confirmation XML (`lib/shared/xml.js`).
- Anything that would make this server accept, log, or forward a card
  number or CVV — it's designed not to see either at all, so if you find a
  path where it does, that's a design-level bug, not just an oversight to
  patch locally.

## Out of scope

- Vulnerabilities in Autopay's own gateway, hosted payment pages, or
  ConsentManager (consentmanager.net) — report those to Autopay or
  ConsentManager directly.
- Reports that only reproduce with a real, dedicated Autopay ServiceID and
  shared key you were issued — that's between you and Autopay's own
  environment, not this repository.

## Supported versions

This project doesn't cut releases yet — only the `main` branch (Open Beta)
is supported. Fixes land there.
