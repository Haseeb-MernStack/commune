# First contribution walkthrough

This guide takes you from zero to your first merged pull request in commune. No
prior open-source experience is needed. If you get stuck, ask in the issue you
picked — questions are welcome.

## What you need before you start

- A GitHub account.
- Git installed.
- Node.js 22 and npm 10 or newer.
- Docker (for the local MongoDB), or a MongoDB connection string of your own.

Check your versions first:

```bash
git --version
node --version
npm --version
```

## 1. Pick an issue

1. Open the [issues list](https://github.com/Haseeb-MernStack/commune/issues) and
   filter by the `good first issue` label.
2. Read the whole issue, including its acceptance criteria.
3. Comment on the issue to claim it, so two people do not do the same work.
4. Wait for a maintainer to confirm the issue is yours before you start coding.

## 2. Fork and clone the repo

1. On [Haseeb-MernStack/commune](https://github.com/Haseeb-MernStack/commune),
   click **Fork** (top right) and create the fork under your own account.
2. Clone **your fork**, not the original repo. Replace `<your-username>` with your
   GitHub username:

```bash
git clone https://github.com/<your-username>/commune.git
cd commune
```

3. Add the original repo as `upstream` so you can keep your fork up to date:

```bash
git remote add upstream https://github.com/Haseeb-MernStack/commune.git
git fetch upstream
git checkout main
git merge upstream/main
```

## 3. Create a branch

Always branch from an up-to-date `main`. Use the `feat/` prefix for a new
feature, `fix/` for a bug fix, and `docs/` for documentation:

```bash
git checkout main
git checkout -b feat/short-description
```

Replace `feat/short-description` with a short name for your change, for
example `feat/recent-searches` or `docs/first-contribution`.

## 4. Set up and run the app

1. Use Node.js 22:

   **Windows (PowerShell):**

   ```powershell
   nvm install 22
   nvm use 22
   ```

   **macOS / Linux:**

   ```bash
   nvm install 22
   nvm use 22
   ```

2. Start MongoDB with Docker (or set your own `MONGODB_URI` in `.env`):

   ```bash
   docker compose up -d mongo
   ```

3. Copy the example environment file:

   **Windows (PowerShell):**

   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS / Linux:**

   ```bash
   cp .env.example .env
   ```

4. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

5. Open the app and check it works:

   - Web app: <http://localhost:5173>
   - API: <http://localhost:4000/api>

## 5. Make your change

- Keep the change small and focused on the one issue you claimed.
- Follow the existing code style (2-space indent, Prettier formatting).
- If you change backend logic, add a test for it. See [TESTING.md](TESTING.md).
- Do not reformat unrelated lines or files.
- For the full rules, see [CONTRIBUTING.md](../CONTRIBUTING.md) and
  [DEVELOPMENT.md](DEVELOPMENT.md).

## 6. Run the checks

Run all four checks before you commit. Every check must pass:

```bash
npm run typecheck
npm test
npm run lint
npm run format
```

`npm run format` can rewrite files, so run `git status` after it and review
what changed before you commit.

## 7. Commit and push

Stage only the files you changed, then commit with a
[Conventional Commits](https://www.conventionalcommits.org/) message, for
example `feat(web): add bookmarks`:

```bash
git status
git add <changed files>
git commit -m "feat(web): add bookmarks"
git push -u origin feat/short-description
```

Replace the branch name and the commit message with your own. Use the
`feat/`, `fix/` or `docs/` scope that matches your change.

## 8. Open the pull request

1. Go to your fork on GitHub. GitHub shows a **Compare & pull request**
   banner for the branch you just pushed — click it.
2. Check the base is `Haseeb-MernStack/commune` and `main`, and the head is
   your fork and your branch.
3. Give the pull request a Conventional Commits title, for example
   `feat(web): add bookmarks`.
4. Start the body with `Closes #<issue-number>`, then fill in the pull request
   template (what changed, how it was tested).
5. Click **Create pull request**.

## 9. What to expect from review

- Continuous integration runs automatically on your pull request: typecheck,
  tests, lint, the format check and the build. All of them must pass.
- A maintainer reviews the change and may ask for changes. Review takes as
  long as it takes — there is no fixed time.
- To update the pull request after feedback, commit the fix on the **same
  branch** and push again. The pull request updates automatically; do not
  open a new one.
- If CI fails, read the failing check, fix it locally, re-run the checks from
  step 6, and push again.
- Once the pull request is approved and CI is green, a maintainer merges it.
  Your branch is then done — you can delete it from your fork.

## Troubleshooting

- **Wrong Node.js version:** run `nvm use 22` (or `nvm use` if you use the
  version from `.nvmrc`) and check with `node --version`.
- **The app cannot reach MongoDB:** make sure Docker is running, then run
  `docker compose up -d mongo` and `docker compose ps` to confirm the
  container is up. If you use your own MongoDB, set `MONGODB_URI` in `.env`.
- **Port already in use:** stop the other process using the port, or stop a
  previous `npm run dev` that is still running.
- **`.env` is missing:** copy it again — see step 4. Never commit secrets.
- **`npm run format` changed files you did not touch:** review the diff with
  `git diff`, keep only the formatting of files you changed, and restore the
  rest with `git checkout -- <file>`.

## Further reading

- [CONTRIBUTING.md](../CONTRIBUTING.md) — contribution rules and commands
- [DEVELOPMENT.md](DEVELOPMENT.md) — local setup, scripts and architecture
- [TESTING.md](TESTING.md) — how tests are organised and run
- [Pull request template](../.github/PULL_REQUEST_TEMPLATE.md) — what to fill in
- [README.md](../README.md) — project overview
