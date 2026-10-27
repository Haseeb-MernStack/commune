# Live news, direct messages and the contact page

## Layout
Logged-in users on wide screens see three columns: left menu (Home, Explore, News, Communities,
Notifications, Messages, Profile, Plus/Insights, Contact), the feed in the middle, and live news on the right.
Below 1100px the news column is hidden (open **News** from the menu); below 900px the menu moves into the
hamburger drawer.

## News
`GET /api/news?topic=top|world|technology|business|sport` is public. The API reads the public RSS feeds of
BBC, NPR, The Guardian and Al Jazeera, merges them newest first, removes duplicates and caches the result
for 10 minutes (plus a CDN cache header). Only headline, source and time are shown; every item links to the
publisher's own page. No API key is needed. If every feed fails the API answers 503 and the UI shows a
"Try again" link. Feed URLs live in `apps/api/src/services/newsService.ts` (`FEEDS`).

## Messages
One-to-one conversations. New messages appear within a few seconds (the page re-checks every 4 seconds;
this works on Vercel serverless, which has no WebSockets). Limits: 1000 characters per message, 60 messages
per 10 minutes, 20 new conversations per hour. Suspended accounts cannot send or receive. Unread counts show
as badges.

## Contact
`POST /api/contact` saves the message in the `contactmessages` collection. Set `CONTACT_EMAIL` (and
`RESEND_API_KEY`) to also receive it by email. A hidden honeypot field silently discards bot submissions.
