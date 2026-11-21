# Content-Security-Policy

A Content-Security-Policy (CSP) tells the browser which scripts, images and connections a page may
use, so injected code cannot run or send data away. Commune uses two policies, both set in
`apps/web/vercel.json`.

## What is enforced today

`Content-Security-Policy` blocks things that are safe to block without any risk to the app:
framing the site (`frame-ancestors 'none'`), changing the base URL, plugins (`object-src 'none'`),
forms posting to other sites, and plain `http` subresources (`upgrade-insecure-requests`).

## What is only reported

`Content-Security-Policy-Report-Only` holds the full policy (scripts, styles, images, connections,
frames). The browser does not block anything because of it. It only reports what it would block,
to `/api/csp-report`. The API stores each kind of violation once with a counter, and they appear on
the **Admin page, Errors tab** with the source "Security policy". No email is sent for them.

Example line: `script-src-elem would block https://example.com`. Only the host is stored, never
paths, queries or tokens.

## Moving to enforcement

1. Deploy and use the site normally for a week: sign in (password and Google), post, upload an
   image, open a paid post, check out, use messages (live updates), and view pages with ads.
2. Open the Errors tab. Each "Security policy" row is something the policy would block.
   - A host you trust and need (for example a new analytics or payment domain): add it to the
     matching directive in the report-only header.
   - Browser extensions cause stray reports (`blob`, `data`, unknown hosts). You can ignore these
     if they appear once and only for a few visitors.
3. When the list has stayed empty for a few days, rename `Content-Security-Policy-Report-Only` to
   `Content-Security-Policy` (or add the same value under that name). Keep watching the Errors tab
   after the change, because blocked things now break instead of being reported.

Two things to check first:

- **Live messaging** connects to your Render service. The policy allows `*.onrender.com` and
  `wss://*.onrender.com`. If you use a custom domain for the realtime server, add it
  (`https://realtime.example.com wss://realtime.example.com`) to `connect-src`.
- **Inline scripts.** `index.html` has three small inline scripts (token cleaner, early request,
  Google tag). The policy allows them with `'unsafe-inline'`, which also lets injected inline
  scripts run, so it is the weakest part of the policy. To remove it, run
  `node apps/web/scripts/csp-hashes.mjs`, put the printed `'sha256-...'` values in `script-src`
  in place of `'unsafe-inline'`, and test. The hashes change whenever an inline script is edited,
  so repeat this after editing `index.html`. Google's ad scripts may still need extra hosts; the
  reports will show which.

## What the policy cannot do

It limits what a page can load. It does not replace safe coding: the app already escapes user
content and keeps tokens out of the URL and storage. Do not enforce `script-src` without
reading the reports first, because a blocked ad or sign-in script fails quietly.
