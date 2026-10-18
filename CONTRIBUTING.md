# Contributing to Commune

Thanks for helping out.

1. Fork the repo and create a branch: `git checkout -b feat/short-description`
2. `npm install` and `npm run dev`
3. Keep changes focused. Add or update tests for backend logic.
4. Run `npm run typecheck && npm test` before opening a pull request.
5. Open a PR describing what changed and why.

## Conventions

- TypeScript strict mode everywhere.
- Validation schemas live in `packages/shared` so web and API stay in sync.
- Controllers stay thin; business logic goes in `apps/api/src/services`.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`).

## Reporting security issues

Please do not open a public issue. Email the maintainers privately.
