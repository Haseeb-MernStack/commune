# Contributing to Commune

Thanks for helping out.

1. Fork the repo and create a branch: `git checkout -b feat/short-description`
2. Use Node.js 20 (`nvm use` reads `.nvmrc`), then `npm install` and `npm run dev`
3. Keep changes focused. Add or update tests for backend logic.
4. Run `npm run typecheck`, `npm test` and `npm run lint` before opening a pull request. `npm run format` tidies the formatting.
5. Open a PR describing what changed and why. The pull request template lists what to check.

## Conventions

- TypeScript strict mode everywhere.
- Validation schemas live in `packages/shared` so web and API stay in sync.
- Controllers stay thin; business logic goes in `apps/api/src/services`.
- Pull request titles follow Conventional Commits (`feat: add hashtags`, `fix(api): stop duplicates`). They become the commit message and drive the changelog and version number; a check enforces it. See [docs/RELEASING.md](docs/RELEASING.md).

## Community

Be kind and constructive. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). For help, see [SUPPORT.md](SUPPORT.md).

## Reporting security issues

Please do not open a public issue. Use GitHub's private reporting as described in [SECURITY.md](SECURITY.md).
