# Deploying Commune

The production setup uses four free services:

| Piece | Service | Why |
| --- | --- | --- |
| Web app (React) | **Vercel** | Static hosting and a global CDN |
| API (Express) | **Render** | A long-running Node server, which Vercel's serverless functions are a poor fit for |
| Database | **MongoDB Atlas** | Free M0 cluster |
| Images | **Cloudinary** | Render's free disk is wiped on every restart, so uploads need cloud storage |

```
Browser ──> Vercel (your-app.vercel.app)
              ├─ /            -> React app
              ├─ /api/*       -> rewritten to Render (Express API)
              └─ /uploads/*   -> rewritten to Render -> redirects to Cloudinary
```

Because the browser only ever talks to the Vercel domain, the login cookie is first-party and
works without any cross-site cookie settings.

## 1. Push the project to GitHub

Make sure `.env` is not committed (`git status` should not list it).

## 2. MongoDB Atlas

1. Create a free account at mongodb.com/atlas and create a free **M0** cluster.
2. **Database Access** -> add a user with a password.
3. **Network Access** -> add `0.0.0.0/0`. Render's free plan has no fixed IP address, so Atlas cannot
   be restricted to one. The database user's password is what protects it, so make it long.
4. **Connect** -> **Drivers** -> copy the connection string and add the database name before the
   `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/commune?retryWrites=true&w=majority`
   If the password has special characters (`@`, `:`, `/`), URL-encode them.

## 3. Cloudinary

Create a free account at cloudinary.com. On the dashboard copy the **Cloud name**, **API key** and
**API secret**.

## 4. Render (the API)

1. Render dashboard -> **New** -> **Blueprint** -> select your repository. Render reads `render.yaml`.
2. Fill in the variables it asks for:
   - `MONGODB_URI`: the Atlas connection string from step 2
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: from step 3
   - `RESEND_API_KEY` and `EMAIL_FROM`: optional but needed for verification and password-reset
     emails (see "Email" below)
   - `CLIENT_ORIGIN`: put `https://placeholder.vercel.app` for now; you will fix it in step 7
3. Deploy. When it finishes, open `https://YOUR-API-NAME.onrender.com/api/health`. You should see
   `{"status":"ok", ...}`.

## 5. Point the Vercel config at your API

Open `apps/web/vercel.json` and replace both `YOUR-API-NAME.onrender.com` with your real Render
address. Commit and push.

## 6. Vercel (the web app)

1. Vercel -> **Add New** -> **Project** -> import your repository.
2. Set **Root Directory** to `apps/web`. Leave **Include source files outside of the Root
   Directory** enabled, because the app imports the shared package from `packages/shared`.
3. The framework is detected as Vite. No environment variables are needed: production builds call
   `/api` automatically.
4. Deploy. Note the address, for example `https://commune-abc.vercel.app`.

## 7. Finish the wiring

In Render, set `CLIENT_ORIGIN` to your real Vercel address (no trailing slash) and let it redeploy.

## 8. Create your admin account

Register in the live app first. Then, from your computer in the project folder, run the script
against the production database (PowerShell shown):

```powershell
$env:MONGODB_URI = "your-atlas-connection-string"
npm run make-admin -w @commune/api -- you@example.com
```

Log out and back in; the **Admin** link appears.

## 9. Check that everything works

- Register, log out, log in.
- **Reload the page while logged in.** You should stay logged in. If you are logged out on every
  reload, the cookie is not getting through (see Troubleshooting).
- Post with an image, then reload and confirm the image still shows.
- Open the app in a private window, create a second account, follow, report, and so on.

## Email (verification and password reset)

Commune sends emails through [Resend](https://resend.com) (free tier, plain HTTPS, no SMTP).

1. Create a Resend account and an API key; set it as `RESEND_API_KEY` on Render.
2. To send to **any** address you must verify a domain you own in Resend and set `EMAIL_FROM` to an
   address on it, e.g. `Commune <no-reply@yourdomain.com>`. Without a verified domain Resend only
   delivers to your own account email, which is fine for testing.
3. `CLIENT_ORIGIN` must be your real Vercel address, because it is used to build the links in the
   emails.
4. Optional: set `REQUIRE_VERIFIED_EMAIL=true` to block posting, liking, commenting and following
   until the email is confirmed. Leave it `false` until emails are working.

Without `RESEND_API_KEY`, nothing is sent: in development the email is printed in the API log (copy
the link from there); in production it is skipped with a warning.

## Paid posts (pay per view)

Authors can mark a post as paid: everyone sees a free teaser, and the rest unlocks for a one-time
price ($1 to $500). Checkout runs on [Lemon Squeezy](https://lemonsqueezy.com), which charges the
buyer and handles sales tax. Commune keeps `PLATFORM_FEE_PERCENT` of each sale (default 20%) and
credits the rest to the author's earnings, shown on their profile.

**Before you rely on this: check that Lemon Squeezy (or Paddle) can pay out to your country and
bank or PayPal, and read their seller terms.** Commune only records who bought what; it does not
move money to authors.

Setup:

1. In Lemon Squeezy create a store and **one** product with one variant, priced anything (for
   example $1). Commune overrides the price per post at checkout. Use test mode first.
2. Settings -> API: create a key -> `LEMONSQUEEZY_API_KEY`. Copy the store id -> `LEMONSQUEEZY_STORE_ID`
   and the variant id -> `LEMONSQUEEZY_VARIANT_ID`.
3. Settings -> Webhooks -> add `https://<your-api>/api/webhooks/lemonsqueezy` (your API address, not
   the website's), choose the events **order_created** and **order_refunded**, and set a signing
   secret -> `LEMONSQUEEZY_WEBHOOK_SECRET`.
4. Set all four variables on the API host and redeploy. Then buy a post with a test card.

Without these variables, local development simulates purchases (nothing is charged), and
production refuses checkout with "Payments are not set up yet".

**Paying authors.** Earnings are a ledger (database rows), not payouts. At the end of each period,
sum each author's earnings and pay them yourself (PayPal, bank transfer), outside Commune. A refund
in Lemon Squeezy removes the sale from the author's earnings and re-locks the post for that buyer.

## Sign in with Google

1. Google Cloud Console -> create a project -> **APIs & Services** -> **OAuth consent screen**
   (External; app name Commune; your support email). Publish it to production when ready.
2. **Credentials** -> **Create credentials** -> **OAuth client ID** -> type **Web application**.
   Under **Authorized JavaScript origins** add `https://your-site.vercel.app` (your real address,
   no trailing slash) and `http://localhost:5173`. You do not need a redirect URI.
3. Copy the client ID (ends in `.apps.googleusercontent.com`) and set it in **two** places:
   - API project: `GOOGLE_CLIENT_ID`
   - Web project: `VITE_GOOGLE_CLIENT_ID` (rebuild without cache; Vite bakes it in at build time)
4. Visit /login: the Google button appears. New Google users get an account with a username made
   from their name, a verified email, and no usable password (they can set one with "Forgot
   password").

If someone had already registered the same email with a password but never verified it, signing in
with Google links the accounts, cancels that password and signs out its sessions.

## Ads (Google AdSense)

Ads appear only on the public **Explore** page (also the home page for logged-out visitors) in
production builds, labelled "Advertisement", one after every 5 posts. Nothing renders until the
variables below are set.

**Read this first:**
- AdSense approval is **not guaranteed** and is decided by Google. They review the live site. Use a
  domain you own (a `*.vercel.app` address is often rejected; add a custom domain in Vercel), and
  make sure the home page has real public content (the Explore page provides this).
- Ads are only allowed on pages Google's crawler can read. The logged-in app is not, so Commune
  does **not** show ads there. Do not add ad slots to logged-in pages without checking AdSense
  policy for login-protected content.
- Never click your own ads or ask friends to; it gets the account banned. Avoid ads next to paid
  content. Check AdSense's rules for user-generated content and your payout options for your
  country before relying on this income.
- If you serve visitors in the EU, UK or Switzerland you need a consent message: enable
  **Privacy & messaging** in the AdSense dashboard (free) and publish a privacy policy page.
- Expect small earnings until the site has steady traffic. Treat it as a bonus, not a salary.

Setup once AdSense approves the site:

1. Replace the placeholder in `apps/web/public/ads.txt` with your line
   (`google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`).
2. Create a **Display ad** unit (responsive) in AdSense and copy its slot id.
3. Web project environment variables: `VITE_ADSENSE_CLIENT` = `ca-pub-XXXXXXXXXXXXXXXX` and
   `VITE_ADSENSE_FEED_SLOT` = the slot id. Redeploy without build cache.

## Troubleshooting

### Vercel build fails

- **`error TS2307: Cannot find module '@commune/shared'`.** The shared package must be consumed as
  TypeScript source. Check that `packages/shared/package.json` has `"main": "src/index.ts"`,
  `"types": "src/index.ts"` and `"exports": { ".": "./src/index.ts" }` (no `dist`), and that
  `apps/web/tsconfig.json` has the `paths` entry for `@commune/shared`.
- **Same error, config is correct.** In Vercel -> Settings -> General, **Root Directory** must be
  `apps/web` with **Include source files outside of the Root Directory** enabled; the install
  command comes from `apps/web/vercel.json` (`cd ../.. && npm install`).
- **`vercel.json still contains YOUR-API-NAME`.** Expected: the build stops on purpose until you
  put your real Render address in `apps/web/vercel.json` (step 5).
- **Build passes, but login or API calls return 404 or HTML.** The `/api` rewrite points at the
  wrong address. Open `https://<your-vercel-app>/api/health`; it should return JSON from Render.

- **First request is slow (30-60 seconds).** Render's free plan puts the API to sleep after
  15 minutes without traffic. This is normal on the free plan; a paid plan or a free uptime monitor
  that pings `/api/health` every 10 minutes avoids it.
- **Logged out on every reload.** Check `vercel.json` has your real Render address, and that the
  site is opened on the Vercel domain, not on the Render address directly.
- **Every user shares one rate limit, or you get "Too many requests" quickly.** `TRUST_PROXY` does not
  match the number of proxies in front of the API. It is `2` in `render.yaml` for Vercel in front of
  Render; try `1` or `3` and redeploy.
- **Image upload fails with 502.** The Cloudinary variables are missing or wrong. Check the Render logs.
- **Uploads of 4-5 MB fail but small ones work.** Some proxies cap request sizes. Lower
  `MAX_IMAGE_BYTES` in `packages/shared/src/index.ts` (for example to 4 MB) and redeploy.
- **Build fails on Render with "tsup: not found".** The build command must include `--include=dev`
  (it does in `render.yaml`).
- **Browser console shows CORS errors.** Open the site on the Vercel domain and set `CLIENT_ORIGIN`
  to exactly that address.

## Notes

- **Vercel Hobby is for personal, non-commercial use.** If you start charging for Commune, move to a
  paid Vercel plan.
- **Custom domain.** Add it in Vercel -> Settings -> Domains, then update `CLIENT_ORIGIN` on Render.
- **Costs when you outgrow free tiers.** Render's paid plan (always on) and Atlas M10 are the first
  upgrades; Cloudinary's free tier covers a lot of images.
- **Environment variables** are listed in `.env.example`.

## Alternative: API on Vercel (no card needed)

Instead of Render, the API can run as a Vercel serverless function from a second Vercel project.

1. Vercel -> **Add New** -> **Project** -> same repository, but **Root Directory** = `apps/api`
   (keep "Include source files outside of the Root Directory" enabled). Name it e.g. `commune-api`.
2. Environment variables for this project: `MONGODB_URI`, `JWT_ACCESS_SECRET` (32+ random
   characters), `CLIENT_ORIGIN` (the web project's URL), `NODE_ENV=production`, `TRUST_PROXY=2`,
   and the three `CLOUDINARY_*` values. Uploads **must** use Cloudinary here, because a function has
   no persistent disk. In Atlas, Network Access must allow `0.0.0.0/0`.
3. Deploy. `https://<api-project>.vercel.app/api/health` should return `{"status":"ok", ...}`.
4. In `apps/web/vercel.json`, point both rewrites at `https://<api-project>.vercel.app` instead of
   Render, push, and remove `ALLOW_PLACEHOLDER_API` from the web project.

Limits: the first request after idle is slower (cold start) and rate-limit counters are per
instance, so they are weaker than on a single server.
