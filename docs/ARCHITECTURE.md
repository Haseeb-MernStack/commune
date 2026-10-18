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
| GET    | /api/users/me             | yes  | Current user              |
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

## Deployment notes

- Set `NODE_ENV=production` so the refresh cookie is `Secure`.
- Serve web and API under the same site (or configure `CLIENT_ORIGIN`) so cookies work.
- Run behind a reverse proxy; `trust proxy` is set to 1 for correct rate-limit IPs.
