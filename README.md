# Commune

An open source community platform (profiles, posts, comments, likes, follows) built on the MERN stack with TypeScript.

## Stack

| Layer   | Tech                                                     |
| ------- | -------------------------------------------------------- |
| Web     | React 18, Vite, TypeScript, React Router, TanStack Query |
| API     | Node 20, Express, TypeScript, Mongoose, Zod, JWT         |
| Shared  | Zod schemas + inferred types used by both web and API    |
| Tooling | npm workspaces, Prettier, Vitest, Docker, GitHub CI      |

## Structure

```
commune/
├── apps/
│   ├── web/            React frontend
│   └── api/            Express + MongoDB backend
├── packages/
│   └── shared/         Shared validation schemas and types
├── docs/               Architecture and API notes
├── .github/workflows/  CI
├── docker-compose.yml  MongoDB + API
└── .env.example
```

## Getting started

```bash
cp .env.example .env
docker compose up -d mongo      # or point MONGODB_URI at your own MongoDB
npm install
npm run dev                     # API on :4000, web on :5173
```

## Deploying

A free production setup (Vercel + Render + MongoDB Atlas + Cloudinary) is described step by step in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Becoming an admin

Admins review reported posts at `/admin`. There is no signup rule or API for this, so nobody can
claim the role by registering first. Register your account in the app, then run:

```bash
npm run make-admin -w @commune/api -- you@example.com
```

Log out and back in, and an **Admin** link appears in the header.

## Scripts

- `npm run dev` runs API and web together
- `npm run typecheck` type-checks every workspace
- `npm test` runs API tests
- `npm run build` builds shared, API and web

## Roadmap

- [x] Auth (register, login, refresh, logout)
- [x] Posts, comments, likes
- [x] Follows and a "Following" feed
- [x] User profiles with editable bios
- [x] Notifications (likes, comments, new followers) with unread badge
- [x] Image uploads (post images and profile photos)
- [ ] Real-time notifications (WebSockets / SSE instead of polling)
- [x] Moderation tools (reports, admin queue, post removal, account suspension)
- [x] Email verification and password reset (Resend)
- [x] Paid posts (pay to unlock, Lemon Squeezy checkout, creator earnings ledger)
- [x] Sign in with Google; public Explore page with optional AdSense ads
- [x] Communities (create, join, post inside them; owners can remove posts)
- [x] Commune Plus subscription (insights, lower fees, longer posts, badge)

## License

MIT

# Commune

> An open source community platform built with the MERN stack and TypeScript.

Commune is a production-minded, full-stack reference project: secure authentication,
posts, comments and likes, a shared validation layer, Docker support and CI, all in a
clean monorepo that's easy to read, run and extend.

## Features

- Secure auth with short-lived JWT access tokens and rotating httpOnly refresh cookies
- Posts, comments and likes with cursor-based pagination
- Shared Zod schemas used by both frontend and backend
- Helmet, rate limiting, input validation and centralized error handling
- Docker Compose for MongoDB and the API, plus a GitHub Actions workflow

## Contributing

Contributions of all sizes are welcome. Look for issues labeled `good first issue`,
read [CONTRIBUTING.md](CONTRIBUTING.md), and open a pull request.
