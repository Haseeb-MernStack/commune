# Monitoring

Three layers, all built in. None needs a paid service.

## 1. Health checks

| URL | Meaning |
| --- | --- |
| `/api/health` | The API process is up (no database check) |
| `/api/health/ready` | The database answers. `200 {"status":"ok"}` or `503 {"status":"degraded"}` |

Neither reveals versions, settings or paths. Point an uptime monitor at the **ready** URL:
`https://commune-mu.vercel.app/api/health/ready`.

Free options: UptimeRobot, Better Stack, or Vercel's own alerts. Set it to check every 5 minutes
and email you on failure.

## 2. Error tracking

- **API:** every unexpected 500 is recorded (message, short stack, route). The response contains a
  `requestId`, also sent as the `X-Request-Id` header and written to the server log, so a user's
  report can be matched to the exact log line.
- **Browser:** uncaught errors, unhandled promise rejections and React render crashes are sent to
  `POST /api/client-errors`. Noise from the visitor's network, browser extensions and
  `ResizeObserver` is ignored; at most 5 different errors are sent per visit.
- Errors are grouped by fingerprint (the same bug for different ids is one line with a counter).
  Tokens, emails and query strings are removed before storing. Rows are deleted 30 days after
  they last happened, and the table is capped at 2000 kinds of error.

View them in the app: **Admin → Errors**. Press **Mark as fixed**; if the same error appears
again it is reopened.

## 3. Alerts

The first time a **new** kind of error appears, an email goes to `ALERT_EMAIL` (or
`CONTACT_EMAIL` when empty). Needs `RESEND_API_KEY`. At most 5 alert emails per hour per server
instance, so an outage cannot flood your inbox.

## Stale tabs after a deploy

When you deploy, a tab that was already open can ask for page files that no longer exist. The app
detects this and reloads once automatically instead of showing a blank page.

## Also useful (outside the code)

- **Vercel → Logs** for the API project: search for a `requestId` from a user report.
- **Vercel → Settings → Notifications:** turn on failed-deployment emails.
- **MongoDB Atlas → Alerts:** turn on connection and storage alerts.
- **Resend / Lemon Squeezy / Cloudinary:** each has its own dashboard of failed deliveries,
  payments and uploads.

## Limits

This is a lightweight tracker: no source maps (production builds ship none), no performance
traces, no user sessions. If the site grows, add Sentry later; the report call sites
(`apps/web/src/lib/report.ts` and `apps/api/src/services/errorTracker.ts`) are the two places
to change.
