# Development setup

## Quick start on your computer

See the [README](../README.md#getting-started). In short: `docker compose up -d mongo`, copy `.env.example` to
`.env`, `npm install`, `npm run dev`.

## Dev container / GitHub Codespaces

`.devcontainer/` gives every contributor the same Node 20 + MongoDB setup with the editor extensions already
installed.

- **VS Code on your computer:** install the *Dev Containers* extension, open the folder and choose
  *Reopen in Container*.
- **GitHub Codespaces:** on the repository page choose **Code → Codespaces → Create codespace on main**.

After it starts, run `npm run dev`. The web app is on port 5173 and the API on 4000.

Known limit: in a Codespace opened **in the browser**, the web app is served from an `app.github.dev` address, while
the API address and the allowed origin default to `localhost`. Open the Codespace from VS Code on your computer (it
forwards the ports to your own `localhost`), or set `VITE_API_URL` and `CLIENT_ORIGIN` to the forwarded addresses.

## Browser (end-to-end) tests

Playwright drives a real browser against a real API and a separate `commune_e2e` database.

```bash
docker compose up -d mongo      # the tests need MongoDB
npx playwright install chromium # once
npm run e2e                     # or: npx playwright test
npx playwright test --ui        # watch it step by step
```

The tests live in `e2e/`. Keep them few and stable: one test that proves a visitor can join, post, sign out and sign
back in catches more breakage than twenty small ones. In CI they run in the **E2E** workflow and attach a report
(screenshots and a trace) when something fails.
