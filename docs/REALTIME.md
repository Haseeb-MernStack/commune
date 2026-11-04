# Realtime (Socket.IO)

Live messages, typing, online status, "Seen" and instant notifications.

## Why a separate service

Your API runs on Vercel serverless functions, which cannot keep a WebSocket open. So Socket.IO runs
as a small always-on Node service (`apps/realtime`) and the API pushes events to it.

```
Browser ──REST (send, save, read)──► Vercel API ──► MongoDB
   ▲                                      │ POST /internal/emit  (shared secret)
   │                                      ▼
   └────── WebSocket (deliver) ◄──── Realtime service (Socket.IO)
                                          │ GET /api/internal/conversations/:id/participants
                                          └──────────► Vercel API   (who is in a conversation)
```

- **REST stays the source of truth.** Messages are validated, rate limited and saved by the API
  exactly as before. The socket only delivers. If the realtime service is down, nothing breaks:
  the app polls like before and refetches when the connection returns.
- The realtime service holds **no database credentials**.

## What the socket does

| Event | Direction | Purpose |
| --- | --- | --- |
| `message:new` | API → user's tabs | A message arrived (also syncs the sender's other tabs) |
| `message:read` | API → sender | The other person read the conversation ("Seen") |
| `notification:new` | API → user | A like, comment or follow: the client refetches |
| `conversation:join/leave` | browser → service | Verified membership, needed for typing and presence |
| `typing` | browser ↔ browser | Throttled to one event per 2.5 s |
| `presence` | service → conversation | Other person came online or went offline |

## Security

- Connection needs a valid, unexpired **access token** (HS256, same secret as the API). The token is
  sent in the handshake `auth`, never in the URL, so it is not logged.
- A connection is closed when its token expires; the browser refreshes the token and reconnects.
- Only the web app's origin may connect from a browser (`CLIENT_ORIGIN`).
- Typing and presence work only for conversations the user belongs to (checked with the API).
- The browser cannot emit anything except `conversation:join/leave` and `typing`. Rate limited per
  socket; payloads are capped at 10 kB; at most 8 connections per user.
- `/internal/*` needs `REALTIME_SECRET` (constant-time check) and only whitelisted events are
  accepted. The matching API route answers 404 to everyone else.
- Suspending a user disconnects them immediately.
- Events carry only what the recipient could already read through the API; notifications are a
  content-free hint.

## Deploy the service

Any host that keeps a Node process running and supports WebSockets works: Render, Railway, Fly.io,
a VPS. A `render.yaml` blueprint is included.

1. Generate a secret (32+ characters) and keep it: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. **Render**: New → Blueprint → this repository → service `commune-realtime`. Set its variables:

   | Variable | Value |
   | --- | --- |
   | `JWT_ACCESS_SECRET` | exactly the API's value |
   | `REALTIME_SECRET` | the secret from step 1 |
   | `CLIENT_ORIGIN` | `https://commune-mu.vercel.app` |
   | `API_URL` | `https://commune-8im5.vercel.app` |

   Open `https://<your-service>.onrender.com/health`: you should see `{"status":"ok"}`.
3. **Vercel → API project** → add `REALTIME_URL` (`https://<your-service>.onrender.com`) and
   `REALTIME_SECRET` (same value). Redeploy the API.
4. **Vercel → web project** → add `VITE_REALTIME_URL` (same URL). Redeploy the web project
   (`VITE_*` values are baked in at build time).
5. Open the site in two browsers, sign in as two users and message each other.

Free hosting note: a sleeping service means the first connection can take around a minute and
drops after idle time. The app keeps working through polling meanwhile, but for real users use an
always-on plan.

## Local development

Add to `.env` (see `.env.example`):

```
REALTIME_URL=http://localhost:4100
REALTIME_SECRET=<any 32+ characters>
API_URL=http://localhost:4000
VITE_REALTIME_URL=http://localhost:4100
```

`npm run dev` then starts the API, the web app and the realtime service.

## Content-Security-Policy

If you enforce the CSP from `docs/SECURITY.md`, add the realtime origin to `connect-src`, both
`https://<service>` and `wss://<service>`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Messages only arrive after a few seconds | `VITE_REALTIME_URL` missing (rebuild web), service asleep, or `connect_error` in the browser Network tab |
| `connect_error: unauthorized` repeatedly | `JWT_ACCESS_SECRET` differs from the API's |
| Connects but no live messages | `REALTIME_URL` / `REALTIME_SECRET` missing or different on the API; check API logs for "Realtime service unreachable" |
| Typing / online never shows | `API_URL` wrong on the realtime service (membership lookup fails) |
| Browser blocks the connection | `CLIENT_ORIGIN` must match the site exactly, with no trailing slash |

## Limits and scaling

- One service instance. To run several, add the Socket.IO Redis adapter and sticky sessions.
- Online status exists only inside open conversations, by design (privacy).
- Messages are not end-to-end encrypted.
- A suspended user whose access token is still valid (up to 15 minutes) could reconnect, but can
  no longer send anything (the API blocks it) and only receives events addressed to them.
