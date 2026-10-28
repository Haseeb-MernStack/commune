# Performance notes

What makes the first screen fast, and where to change it:

- **Session restore starts at page load.** `index.html` fires the session refresh, the news request and
  (for visitors) the public posts request before the app has downloaded; `src/lib/api.ts` takes those
  responses over. Browsers remember a session hint (`commune_session`) and the last profile
  (`commune_user`), so the left menu and feed shell appear instantly and the session is confirmed in the
  background. Logged-out visitors skip the check entirely.
- **Code splitting.** Only the feed and Explore pages are in the first download; every other page loads
  when opened (`React.lazy` in `App.tsx`). React, the router and React Query are separate cached files.
- **CDN caching.** `/api/news` and `/api/public/posts` send `s-maxage` so Vercel's edge can answer without
  waking the API.
- **Ads load last.** AdSense waits for the first scroll/tap/key press (or 8 seconds after load).
- **Layout stays still.** Placeholders for posts and news, `content-visibility` for long feeds.
- **SEO.** `robots.txt`, `sitemap.xml` (update the domain in both when you add a custom domain), a canonical
  link and a title per page.

Measure with Lighthouse in an incognito window, mobile mode, on the deployed site (not localhost).
