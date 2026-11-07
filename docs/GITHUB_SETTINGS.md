# GitHub repository settings

Settings that live in GitHub, not in code. Do them once, in this order. Menu names come from GitHub's current
layout and can move; the idea of each setting stays the same.

## 1. Protect `main` with a ruleset (import the file)

1. Repository **Settings → Rules → Rulesets → New ruleset → Import a ruleset**.
2. Choose `.github/rulesets/protect-main.json`, then **Create**. Repeat with
   `.github/rulesets/protect-release-tags.json` (it protects `v*` tags once releases are on).
3. Check **Enforcement status** says *Active*.

What `protect-main` enforces, and why:

| Rule | Why |
| --- | --- |
| No deleting `main`, no force pushes | History cannot be rewritten or lost |
| Pull request required, squash merge only | Every change is reviewed in one place and `main` stays a clean list of commits |
| Linear history | No merge commits |
| Conversations must be resolved | Review comments are not forgotten |
| Stale approvals dismissed on new pushes | An approval always matches the code that is merged |
| Checks `verify` (typecheck, tests, build) and `CodeQL static analysis` must pass | Broken or insecure code cannot be merged |

Choices made on purpose:
- **0 required approvals.** GitHub never lets you approve your own pull request, so requiring one would lock a
  solo maintainer out. When a second maintainer joins, set it to 1 and tick *Require review from Code Owners*
  (`.github/CODEOWNERS` is already in place).
- **The dependency audit is not a required check.** A newly published advisory would block every merge,
  including the fix. It still runs and shows a red mark you should act on.
- **"Require branches to be up to date" is off.** With several open pull requests it forces an *Update branch*
  click after each merge. Turn it on later if you want the stricter rule.
- **No bypass list.** The rules apply to the owner too. In a real emergency, disable the ruleset temporarily and
  turn it back on.

If a required check shows *Expected, waiting for status* forever, its name does not match a job name. The names
are the `name:` of each job in `.github/workflows` (`verify` has no `name:`, so its job id is used).

If the import rejects `allowed_merge_methods` (older GitHub Enterprise versions), delete that one line and set
*Allow squash merging* only under Settings → General instead.

## 2. Settings → General

- **Pull Requests**: tick *Allow squash merging* and untick *merge commits* and *rebase merging*. Tick
  *Automatically delete head branches*, *Always suggest updating pull request branches* and
  *Allow auto-merge*.
- **Features**: tick *Issues* and *Discussions* (the issue chooser and `SUPPORT.md` link to Discussions). Untick
  *Wikis* and *Projects* unless you use them: the docs live in `docs/`.
- **About** (the gear on the repository home page): description, website `https://commune-mu.vercel.app`, and
  topics. Tick *Releases* and *Packages* off if you do not use them.
- **Social preview**: upload `docs/social-preview.png` (1280 × 640). It is the image shown when the link is shared.

## 3. Settings → Actions → General

- **Workflow permissions**: *Read repository contents and packages permissions*. Each workflow asks for more
  only when it needs it.
- **Fork pull request workflows**: *Require approval for all outside collaborators*. A stranger's pull request
  must not run workflows until you have looked at it.
- **Actions permissions**: *Allow all actions and reusable workflows* is fine for now. To be stricter, allow only
  GitHub-owned and verified creators.

## 4. Settings → Code security

| Setting | Choice |
| --- | --- |
| Private vulnerability reporting | **Enable** (the security policy and issue chooser point to it) |
| Dependency graph | Enable |
| Dependabot alerts | Enable |
| Dependabot security updates | Enable |
| Grouped security updates | Enable |
| Secret scanning | Enable |
| Push protection | **Enable** (blocks a push that contains a key) |
| Code scanning | Leave the *Default setup* **off**. CodeQL already runs from `.github/workflows/security.yml`, and both together conflict |

## 5. Account level (not in the repository)

- Turn on **two-factor authentication** for your GitHub account, and use a passkey or authenticator app rather
  than SMS.
- Settings → SSH and GPG keys: optionally add a signing key and enable *Vigilant mode*, so unsigned commits
  under your name are flagged.
- When you add collaborators, use the lowest role that works (*Triage* or *Write*), not *Admin*.

## 6. Check it worked

1. Try `git push origin main` from a clone: it must be refused.
2. Open a small pull request: the *Merge* button stays disabled until `verify` and `CodeQL static analysis` pass,
   and the only merge option is *Squash and merge*.
3. Settings → Code security shows every item above as *Enabled*.
