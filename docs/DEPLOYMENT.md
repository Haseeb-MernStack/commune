# Deployment

Commune deploys as **two Vercel projects** from one repository, plus MongoDB Atlas and a few optional services.

```
Browser → web project (apps/web) ──/api/*, /uploads/* rewrite──► API project (apps/api) → MongoDB Atlas
```

## 1. MongoDB Atlas

1. Create a free cluster and a database user.
2. Network access: allow `0.0.0.0/0` (Vercel uses changing IPs).
3. Copy the connection string; it becomes `MONGODB_URI`.

## 2. API project

Import the repo in Vercel and set:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/api` |
| Framework Preset | Other |
| Build Command | `npm run build:vercel` |
| Output Directory | `public` |

Settings live in `apps/api/vercel.json` (function `api/index.js`, `includeFiles: dist/**`, `maxDuration: 30`, rewrite `/(.*)` to `/api`).

Environment variables:

| Name | Value |
| --- | --- |
| `MONGODB_URI` | Atlas connection string |
| `JWT_ACCESS_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_ORIGIN` | Your web URL, no trailing slash |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `2` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Needed for image uploads |

Optional: `RESEND_API_KEY`, `EMAIL_FROM`, `LEMONSQUEEZY_*`, `PLATFORM_FEE_PERCENT`, `PLUS_FEE_PERCENT`, `PLUS_PRICE_LABEL`, `GOOGLE_CLIENT_ID`, `CONTACT_EMAIL`, `REQUIRE_VERIFIED_EMAIL`.

## 3. Web project

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Framework Preset | Vite |
| Install Command | `cd ../.. && npm install --include=dev` |

`apps/web/vercel.json` rewrites `/api/:path*` and `/uploads/:path*` to the API project URL. **Edit the destination** to your own API URL if you fork.

Do **not** set `VITE_API_URL` on the web project. Optional: `VITE_GOOGLE_CLIENT_ID`, `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_FEED_SLOT`. These are baked in at build time, so redeploy after changing them.

## 4. Optional services

- **Cloudinary**: create an account and copy cloud name, key and secret. Images upload straight from the browser using a signed ticket from `POST /api/uploads/sign`. See [UPLOADS.md](UPLOADS.md).
- **Resend**: verify a domain, set `RESEND_API_KEY` and `EMAIL_FROM`.
- **Lemon Squeezy**: create a store, a one-off product for paid posts and a recurring product for Plus. Add a webhook to `https://<api-domain>/api/webhooks/lemonsqueezy` (one endpoint serves paid posts and Plus; tick the order and subscription events) using the same `LEMONSQUEEZY_WEBHOOK_SECRET`.
- **Google sign-in**: create a Web OAuth client, add your web origin as an authorised JavaScript origin, set `GOOGLE_CLIENT_ID` (API) and `VITE_GOOGLE_CLIENT_ID` (web).
- **AdSense**: needs an approved site; set the two `VITE_ADSENSE_*` values.

## 5. First admin

Run locally with `MONGODB_URI` pointed at Atlas:

```bash
npm run make-admin -w @commune/api -- you@example.com
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Login works then logs out on refresh | `CLIENT_ORIGIN` wrong or has a trailing slash; web not using the `/api` rewrite |
| 500 on every API call | Missing `MONGODB_URI` or `JWT_ACCESS_SECRET`; Atlas network access blocks Vercel |
| Rate limit errors for everyone | `TRUST_PROXY` not set to `2` |
| Image upload fails | `CLOUDINARY_*` not set on the **API** project; or file over 4.5 MB through the fallback path |
| Build fails on shared package | Web install command must run from the repo root |
| Env change has no effect | Redeploy; `VITE_*` need a web rebuild |
| Payments do nothing | Webhook URL or secret mismatch in Lemon Squeezy |
