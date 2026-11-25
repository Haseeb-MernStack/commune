# Contributing to Commune

Thanks for helping out.

1. Fork the repo and create a branch: `git checkout -b feat/short-description`
2. Use Node.js 22 (`nvm use` reads `.nvmrc`), then `npm install` and `npm run dev`
3. Keep changes focused. Add or update tests for backend logic.
4. Run `npm run typecheck`, `npm test` and `npm run lint` before opening a pull request. `npm run format` tidies the formatting.
5. Open a PR describing what changed and why. The pull request template lists what to check.

## Issue labels

Pick an issue by its labels. Start with `good first issue`, comment on the issue to claim it, and ask questions in the issue. Every label in the repo is listed below.

- `good first issue` — A good first task for a new contributor. Start here.
- `help wanted` — The maintainers would like help with this issue.
- `bug` — Something isn't working.
- `enhancement` — A new feature or request.
- `documentation` — Improvements or additions to documentation.
- `question` — Further information is requested.
- `accessibility` — A barrier affecting people with disabilities.
- `performance` — Something is slow or uses too many resources.
- `security` — A security weakness. Report it privately as described in [SECURITY.md](SECURITY.md); do not discuss it in public.
- `incident` — The site is down.
- `api` — Work in the API app (`apps/api`).
- `web` — Work in the web app (`apps/web`).
- `realtime` — Work in the realtime service (`apps/realtime`).
- `shared` — Work in the shared package (`packages/shared`).
- `docs` — Documentation files (`docs/**` and any `*.md` file).
- `ci` — Continuous integration, GitHub Actions workflows, or deploy config (`.github/**`, `render.yaml`).
- `tests` — Pull requests that touch test files (added automatically).
- `testing` — Issues about testing. (The `tests` label is added automatically to pull requests that change test files.)
- `javascript` — Pull requests that update JavaScript code.
- `github_actions` — Pull requests that update GitHub Actions code.
- `dependencies` — Pull requests that update a dependency file.
- `duplicate` — This issue or pull request already exists.
- `invalid` — This doesn't seem right.
- `wontfix` — This will not be worked on.
- `autorelease: pending` — Added automatically to pull requests included in a pending release (release-please); do not add it by hand.

## Conventions

- TypeScript strict mode everywhere.
- Validation schemas live in `packages/shared` so web and API stay in sync.
- Controllers stay thin; business logic goes in `apps/api/src/services`.
- Pull request titles follow Conventional Commits (`feat: add hashtags`, `fix(api): stop duplicates`). They become the commit message and drive the changelog and version number; a check enforces it. See [docs/RELEASING.md](docs/RELEASING.md).

## Community

Be kind and constructive. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). For help, see [SUPPORT.md](SUPPORT.md).

## Reporting security issues

Please do not open a public issue. Use GitHub's private reporting as described in [SECURITY.md](SECURITY.md).
