# Scaling and traffic spikes

What to check and change before a busy day (for example a launch post that brings a thousand people in a few hours). Nothing here has been load tested yet, so treat the numbers as planning guidance, not measurements.

## What is already in place

- Every feed is cursor paginated and sorted by `_id`, with indexes that let MongoDB read exactly one page (`models/Post.ts`).
- Likes, bookmarks and comment counts are stored counters, so a feed page never counts rows.
- Access tokens are checked without a database lookup. Only routes that change data look the account up.
- Public pages (Explore, news, share previews) send `Cache-Control` headers, so Vercel's edge answers repeat visits.
- Built files under `/assets` are cached for a year by file name.
- Messages and notifications arrive over Socket.IO, so the app only polls when realtime is down.
- The database connection is reused between requests on a warm serverless instance, and each instance keeps a small pool (`MONGODB_MAX_POOL`, default 10).
- Limits on emails, uploads and edits live in MongoDB, so every instance shares one count (see [LIMITS.md](LIMITS.md)).

## Request limits

The first-line limit (`middleware/rateLimit.ts`) counts a signed-in request against the **account**, not the IP address, because many real people share one address on mobile networks, campuses and offices. Visitors who are not signed in are counted by address.

| Limit | Who | Per 15 minutes |
| --- | --- | --- |
| All requests | signed-in account | 1500 |
| All requests | visitor (IP) | 300 |
| Keeping a session alive (`/auth/refresh`) | IP | 300 |
| Sign in, register, Google sign in | IP | 20 |

Counts are per server instance, so the real ceiling is a little higher than the table.

## Before a big day: checklist

1. **MongoDB Atlas tier.** The free M0 cluster is shared, throttles operations and allows 500 connections in total. Move to a dedicated tier (M10 or above) before an announcement.
2. **Connections.** Total connections are about `instances x MONGODB_MAX_POOL`. If you see connection errors under load, lower `MONGODB_MAX_POOL` (for example to 5) rather than raising the cluster limit.
3. **Realtime service.** A free Render instance sleeps after about 15 minutes idle and the first visitor waits for it to wake. Use an always-on plan for launch day. If it is down, the app falls back to polling, so it stays usable, only slower.
4. **Verification emails.** `EMAIL_DAILY_LIMIT` defaults to 100 a day. A thousand sign-ups would use it up in minutes. Raise it, and check the sending limits of your email provider, before the day.
5. **Image and payment quotas.** Check the Cloudinary and Lemon Squeezy plan limits.
6. **Vercel plan.** Check function concurrency and execution limits for your plan.
7. **Monitoring.** Watch the Admin error list and the Atlas metrics (connections, operations per second, slow queries) during the spike.

## Load testing (suggested)

Run against a staging copy, never production. [k6](https://k6.io) is a good fit:

```js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = { stages: [{ duration: "2m", target: 200 }, { duration: "5m", target: 200 }] };

export default function () {
  const res = http.get(`${__ENV.API_URL}/api/public/posts`);
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}
```

Look at the 95th percentile response time, the error rate and Atlas operations per second. Raise `target` step by step until something gives, then fix that first.
