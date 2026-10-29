# Security

How Commune protects its users and what you must configure yourself. To report a vulnerability,
see [SECURITY.md](../SECURITY.md).

## Built in

| Area | What is done |
| --- | --- |
| Passwords | bcrypt (cost 12); login answers are identical for unknown email, wrong password and locked account; dummy hash keeps timing similar |
| Brute force | IP rate limits on auth and email routes, plus a database-backed lock: 8 wrong passwords lock the account for 15 minutes (works across serverless instances) |
| Sessions | 15-minute access token (HS256 pinned, kept in memory only); refresh token is an opaque random value, stored hashed, rotated on every use, httpOnly + Secure + SameSite=Lax cookie scoped to `/api/auth` |
| CSRF | SameSite cookies, Bearer tokens for writes, and an Origin check that refuses cross-origin writes in production |
| Input | Zod validation on every body and query; objects such as `{"$ne": ""}` are rejected, so NoSQL operator injection is not possible through validated routes; 10 kB JSON limit |
| Output | React escapes all text; no raw HTML is rendered; uploaded image URLs must match a strict pattern; external links use `rel="noopener noreferrer"` |
| Uploads | Random file names, server-checked image type, size limits, signed direct upload tickets, deletion only when unreferenced |
| Payments | Webhook signature verified over the raw body; amounts and ownership come from the database, not the client |
| Responses | `Cache-Control: no-store` on API answers, Helmet headers, no `X-Powered-By`, generic 500 errors (details only in server logs) |
| Logging | Request logs contain only method, path (no query string) and status. Headers, cookies, tokens and client IPs are never written; a redaction list covers hand-written logs |
| Browser console | Production builds strip every `console.*` call and `debugger` statement; source maps are off |
| Privacy | Emails are never returned to other users; only the public profile is cached in the browser |
| CI | CodeQL, `npm audit`, dependency review on pull requests, secret scanning of the full git history, weekly Dependabot updates, least-privilege workflow tokens |

## You must do these (cannot be done from code)

1. **Turn on 2FA** on GitHub, Vercel, MongoDB Atlas, Cloudinary, Resend and Lemon Squeezy.
2. **GitHub → Settings → Branches**: protect `main`: require a pull request, require the `CI` and
   `Security` checks to pass, block force pushes.
3. **GitHub → Settings → Code security**: enable *Private vulnerability reporting*, *Dependabot
   alerts* and *Secret scanning with push protection*.
4. **Vercel**: mark every secret environment variable as **Sensitive**. Use different secrets for
   Preview and Production, or leave secrets out of Preview.
5. **MongoDB Atlas**: use a strong database password, a user limited to this one database with
   `readWrite`, and enable backups. Allowing `0.0.0.0/0` is required on Vercel, so the password
   and TLS are your protection.
6. **Rotate secrets** if they were ever pasted into a chat, issue or log: `JWT_ACCESS_SECRET`
   (this signs everyone out), Cloudinary, Resend, Lemon Squeezy keys.
7. **Never commit `.env`**. Run `git status` before every commit.
8. **Least-privilege keys**: give Resend a sending-only key and Cloudinary a key that can only upload.

## Web security headers (Vercel)

Add the `headers` block from the pull request description to `apps/web/vercel.json`. The
`Content-Security-Policy-Report-Only` header only reports problems in the browser console. After
a week of clean browsing (sign-in with Google, ads, uploads, payments), rename it to
`Content-Security-Policy` to enforce it.

## Known limits

- Rate limit counters held in memory are per serverless instance, so they are best-effort. The
  login lock is stored in MongoDB and is exact.
- A login lock can be triggered by someone else for 15 minutes. This is the usual trade-off; the
  owner can still use "Forgot password", which also unlocks the account.
- Messages are protected in transit and at rest by the platform, but are not end-to-end encrypted.
