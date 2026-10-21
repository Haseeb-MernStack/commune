# Deploying Commune

The production setup uses four free services:

| Piece           | Service           | Why                                                                                |
| --------------- | ----------------- | ---------------------------------------------------------------------------------- |
| Web app (React) | **Vercel**        | Static hosting and a global CDN                                                    |
| API (Express)   | **Render**        | A long-running Node server, which Vercel's serverless functions are a poor fit for |
| Database        | **MongoDB Atlas** | Free M0 cluster                                                                    |
| Images          | **Cloudinary**    | Render's free disk is wiped on every restart, so uploads need cloud storage        |

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

## Troubleshooting

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
