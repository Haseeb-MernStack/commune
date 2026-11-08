# Commits, pull requests and releases

Releases are automatic. You write clear commit messages; a bot turns them into version numbers, a changelog and
GitHub releases.

## 1. Name every pull request like this

```
type(optional-scope): short description
```

| Type | Use it for | Version change |
| --- | --- | --- |
| `feat` | a new feature | minor (0.2.0 → 0.3.0) |
| `fix` | a bug fix | patch (0.2.0 → 0.2.1) |
| `perf` | a speed improvement | patch |
| `refactor` | code cleanup with no behaviour change | patch |
| `docs` | documentation only | none |
| `test`, `ci`, `build`, `chore`, `style` | tests, pipelines, tooling, formatting | none |
| any type with `!`, e.g. `feat!:` | a breaking change | minor while the version is 0.x, major after 1.0 |

Good titles: `feat: add hashtags`, `fix(api): stop duplicate notifications`, `docs: explain push setup`.
The **Conventional PR title** check fails with a clear message when the title does not match.

**Why the title matters:** pull requests are squash-merged and the pull request title becomes the commit message.
In Settings → General → Pull Requests → *Allow squash merging*, set **Default commit message** to
*Pull request title* so GitHub does not replace it with the branch name or the first commit.

## 2. How a release happens

1. You merge pull requests into `main` as usual.
2. The **Release** workflow keeps one pull request open, titled like `chore(main): release 0.2.0`. It holds the
   new version number and the changelog text, built from the titles merged since the last release.
3. When you are ready to publish, merge that pull request. The bot creates the tag `v0.2.0`, a GitHub release
   with the notes, and updates `CHANGELOG.md` and the version in `package.json`.

Nothing is published to npm: Commune is deployed through Vercel and Render, so a release is a labelled,
documented point in history that you can roll back to.

## 3. One-time setup

1. **Settings → Actions → General → Workflow permissions**: tick **Allow GitHub Actions to create and approve
   pull requests**. Without it the release bot cannot open its pull request.
2. **The release pull request and CI.** Pull requests opened by the default token do not start other workflows,
   so the required checks (`verify`, `CodeQL static analysis`) will not appear on it and the pull request cannot
   be merged. Pick one fix:
   - *Quick way (no setup):* open the release pull request, press **Close pull request**, then **Reopen**. Your
     click starts the checks. Repeat after the bot updates it.
   - *Permanent way:* create a fine-grained personal access token (Settings → Developer settings → Personal
     access tokens → Fine-grained) limited to this repository, with **Contents: Read and write** and
     **Pull requests: Read and write**. Save it in the repository as a secret named `RELEASE_PLEASE_TOKEN`
     (Settings → Secrets and variables → Actions). The workflow already uses it when it exists.
3. Optional: add **Conventional PR title** to the required checks in the `Protect main` ruleset, once you have
   seen it pass on a pull request.

## 4. Pull request labels

The **Label pull requests** workflow adds `web`, `api`, `realtime`, `shared`, `docs`, `ci`, `tests` and
`dependencies` from the files a pull request changes, so you can filter the list at a glance. Edit
`.github/labeler.yml` to change the rules.

## 5. Dependabot

Dependabot titles follow the same format (`chore(deps): bump ...`, `ci(deps): bump ...`) and carry the
`dependencies` label. Dependency bumps do not trigger a release by themselves; they appear in the next one only if
they are `fix` or `feat`.

## Before the first release

The first release pull request lists every conventional commit already in `main`. Commits that do not follow the
format are skipped, which is fine. Review the changelog text in that pull request before you merge it.
