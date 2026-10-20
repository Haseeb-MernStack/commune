# Architecture

## Overview

Commune is an npm-workspaces monorepo with three packages:

- `packages/shared`: Zod schemas and DTO types. Both apps import from here so request
  validation and response shapes never drift apart.
- `apps/api`: Express + Mongoose REST API.
- `apps/web`: React + Vite single-page app.

## Auth flow

1. `POST /api/auth/register` or `/login` returns `{ user, accessToken }` and sets an
   httpOnly `commune_rt` cookie scoped to `/api/auth`.
2. The web app keeps the access token in memory only and sends it as a Bearer token.
3. On a 401 the client calls `POST /api/auth/refresh`. The refresh token is rotated on
   every use: the old one is deleted and a new one issued.
4. Refresh tokens are random strings; only their SHA-256 hash is stored in MongoDB, with a
   TTL index that removes expired records automatically.

## API

| Method | Path                      | Auth | Description               |
| ------ | ------------------------- | ---- | ------------------------- |
| GET    | /api/health               | no   | Liveness check            |
| POST   | /api/auth/register        | no   | Create account            |
| POST   | /api/auth/login           | no   | Log in                    |
| POST   | /api/auth/refresh         | cookie | Rotate session          |
| POST   | /api/auth/logout          | cookie | End session             |
| POST   | /api/uploads              | yes  | Upload one image (multipart field `file`) |
| GET    | /uploads/:file            | no   | Serve an uploaded image   |
| GET    | /api/users/me             | yes  | Current user              |
| PATCH  | /api/users/me             | yes  | Update own bio            |
| GET    | /api/users/:username      | yes  | Profile with follow counts |
| GET    | /api/users/:username/posts | yes | A user's posts (paginated) |
| POST   | /api/users/:username/follow | yes | Toggle follow            |
| GET    | /api/notifications        | yes  | Latest 30 notifications   |
| GET    | /api/notifications/unread-count | yes | Unread badge count   |
| POST   | /api/notifications/read   | yes  | Mark all as read          |
| GET    | /api/posts?cursor&limit   | yes  | Cursor-paginated feed     |
| POST   | /api/posts                | yes  | Create post               |
| GET    | /api/posts/:id            | yes  | Single post               |
| DELETE | /api/posts/:id            | yes  | Delete own post           |
| POST   | /api/posts/:id/like       | yes  | Toggle like               |
| GET    | /api/posts/:id/comments   | yes  | List comments             |
| POST   | /api/posts/:id/comments   | yes  | Add comment               |

## Data model

- **User**: username (case-insensitive unique), email (unique), passwordHash, bio
- **Post**: author, content, likeCount, commentCount
- **Comment**: post, author, content
- **Like**: post, user (unique pair)
- **RefreshToken**: user, tokenHash, expiresAt (TTL)
- **Follow**: follower, following (unique pair). Follower counts are computed with
  `countDocuments`, so they can never drift out of sync.
- **Notification**: user (recipient), actor, type (`like` | `comment` | `follow`), post, read.
  Likes and follows are upserted so like/unlike toggling does not spam the recipient.

## Feeds

`GET /api/posts?feed=all|following`. The following feed returns posts from people you follow
plus your own, using the same cursor pagination as the main feed.

## Notifications

The web app polls `/api/notifications/unread-count` every 30 seconds for the header badge.
Opening the notifications page marks everything as read. Replacing polling with SSE or
WebSockets is on the roadmap.

## Deployment notes

- Set `NODE_ENV=production` so the refresh cookie is `Secure`.
- Serve web and API under the same site (or configure `CLIENT_ORIGIN`) so cookies work.
- Run behind a reverse proxy; `trust proxy` is set to 1 for correct rate-limit IPs.

## Image uploads

`POST /api/uploads` accepts one multipart `file` (max 5 MB) and returns `{ "url": "/uploads/<id>.<ext>" }`.
The client then sends that URL as `imageUrl` when creating a post, or as `avatarUrl` when updating
the profile.

Safety measures:

- Auth and the upload rate limit (30 per 15 minutes) run before the file is parsed.
- The file type is detected from its leading bytes (PNG, JPEG, GIF, WebP). The filename and the
  `Content-Type` header are never trusted. SVG and HTML are rejected.
- Files are stored under a random 128-bit name, never the client's filename, so there is no path
  traversal and names cannot be guessed.
- `imageUrl` / `avatarUrl` are validated against the exact `/uploads/<32 hex>.<ext>` shape, so
  posts cannot point at external URLs.
- Files are served with `X-Content-Type-Options: nosniff` and long-lived cache headers.
- Deleting a post, or replacing a profile photo, removes the file from disk, but only when no other
  post or profile still references it.

Known limitation: a file that is uploaded but never attached (for example the user picks a photo and
then abandons the composer) stays on disk. A scheduled cleanup of unreferenced files older than a
day is a good future addition.

### Storage

Files are stored on local disk in `UPLOAD_DIR` (a Docker volume in `docker-compose.yml`). All disk
access lives in `apps/api/src/services/uploadService.ts`. To use S3 or Cloudinary, replace
`saveImage` and `deleteUploadIfUnused` there and return the new URL. On a multi-server deployment you
must do this, because local disk is not shared between servers.
