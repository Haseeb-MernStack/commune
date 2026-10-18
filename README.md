# Commune

An open source community platform (profiles, posts, comments, likes, follows) built on the MERN stack with TypeScript.

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Web      | React 18, Vite, TypeScript, React Router, TanStack Query    |
| API      | Node 20, Express, TypeScript, Mongoose, Zod, JWT            |
| Shared   | Zod schemas + inferred types used by both web and API       |
| Tooling  | npm workspaces, Prettier, Vitest, Docker, GitHub CI |

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

## Scripts

- `npm run dev` runs API and web together
- `npm run typecheck` type-checks every workspace
- `npm test` runs API tests
- `npm run build` builds shared, API and web

## Roadmap

- [x] Auth (register, login, refresh, logout)
- [x] Posts, comments, likes
- [ ] Follows and personalized feed
- [ ] Image uploads
- [ ] Real-time notifications
- [ ] Moderation tools

## License

MIT
