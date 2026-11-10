# Backups and restore

Your database holds everything users created. A free MongoDB Atlas cluster (M0) has **no
automatic backups**, so this repository ships its own.

## What you get

- `.github/workflows/backup.yml` makes an **encrypted copy every day** (02:17 UTC) and keeps it
  as a workflow artifact for **30 days**. You can also run it by hand: Actions → Database backup →
  Run workflow.
- It skips the error log and the news cache, which are rebuilt by themselves.
- Until you add the two secrets below it does nothing and shows a notice, never a red failure.

## Turn it on (about 5 minutes)

1. **Atlas → Database Access:** create a user named `backup` with the built-in role **Read any
   database** (or `read` on your database only). It can never change data.
2. Copy that user's connection string and fill it in completely. It must include your database
   name, as in `mongodb+srv://backup:MyPassword123@cluster0.abcde.mongodb.net/commune`.
   - Replace `<password>` with the real password, **without** the `<` `>` brackets.
   - Paste it with no quotes and no spaces before or after.
   - If the password contains special characters, write them encoded: `@` as `%40`, `:` as
     `%3A`, `/` as `%2F`, `#` as `%23`. (Or choose a password with only letters and digits.)
   - Secrets cannot be read back in GitHub, so if you are unsure, save the secret again.
3. Make a long random passphrase, **at least 24 characters**. In PowerShell:
   ```powershell
   -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
   ```
   Keep a copy in your password manager. **Without it a backup cannot be opened.**
4. **GitHub → Settings → Secrets and variables → Actions → New repository secret**, add:
   - `BACKUP_MONGODB_URI`: the connection string from step 2
   - `BACKUP_PASSPHRASE`: the passphrase from step 3
5. **Actions → Database backup → Run workflow.** When it is green, open the run and check that
   the artifact `commune-backup-…` exists.

### Is it safe that the repository is public?

Anyone signed in to GitHub can download the artifacts of a public repository, so the file is
encrypted (AES-256) before it is uploaded and the passphrase is only in GitHub Secrets and your
password manager. With a random 24+ character passphrase it cannot be guessed. If you want even
less exposure, make the repository private, or copy the files to private storage instead.

## Restore

Always restore into a **new, empty database first**, check it, and only then decide what to do
with production. You need Docker and the file from the artifact (download and unzip it).

1. Decrypt (it asks for the passphrase):
   ```powershell
   gpg --output commune.archive --decrypt commune-2026-11-10.archive.gpg
   ```
   Gpg4win provides `gpg` on Windows (`winget install GnuPG.Gpg4win`).
2. Restore into a separate database called `commune_restore`:
   ```powershell
   docker run --rm -v "${PWD}:/backup" mongo:7 mongorestore `
     --uri="mongodb+srv://<admin-user>:<password>@<cluster>/" `
     --archive=/backup/commune.archive --gzip `
     --nsFrom="commune.*" --nsTo="commune_restore.*"
   ```
   Use your real database name instead of `commune` if it differs. This user needs write access.
3. Look at the data in Atlas (collections, document counts, a few recent posts).
4. To bring it back for real, run the same command with `--nsTo="commune.*"` and add
   `--drop` only if you want to replace what is there now.

## Make a backup right now from your computer

```powershell
docker run --rm -v "${PWD}:/backup" mongo:7 mongodump `
  --uri="<your connection string>" --archive=/backup/commune.archive --gzip
```

This file contains user emails and password hashes. Keep it private and never commit it. (The
repository's `.gitignore` should list `*.archive`.)

## Test your backups

A backup you have never restored is a hope, not a backup. Once a quarter, do the **Restore**
steps above into `commune_restore` and confirm the data looks right.

## Beyond this

Atlas paid tiers (M10 and up) include continuous backups with point-in-time restore. If real
users depend on the site, that is worth the upgrade.
