# TaskFlow

A real-world full-stack task manager built on the **latest published Next.js
release** (`next@16.2.10`), living alongside — but fully isolated from — the
Next.js monorepo in this repository.

## Stack and features

- **App Router** with nested layout, loading skeletons, error boundary, and a
  custom 404 page.
- **React Server Components** — the dashboard and task detail pages fetch data
  on the server; zero client JS for rendering the lists.
- **Server Actions** (`lib/actions.ts`) — create, toggle, and delete tasks via
  progressive-enhancement `<form>` posts with `useActionState` for pending and
  error UI.
- **REST API Route Handlers** — `GET/POST /api/tasks` and
  `GET/PATCH/DELETE /api/tasks/:id` with input validation and proper status
  codes (400/404/201/204).
- **Proxy (middleware)** — per-request tracing ids and an early oversized-body
  reject.
- **Security headers** — CSP, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, and `Permissions-Policy` via `next.config.ts`.
- **Persistence** — an atomic, write-serialized JSON file store
  (`lib/store.ts`), no native dependencies. Swap for a database by
  reimplementing one module.
- **Validation** — shared server-side validation (`lib/validate.ts`) used by
  both Server Actions and API routes.
- **Responsive UI** with automatic dark mode (`prefers-color-scheme`), no CSS
  framework.

## Run it

```bash
cd taskflow
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

## API examples

```bash
curl localhost:3000/api/tasks
curl -X POST localhost:3000/api/tasks \
  -H 'content-type: application/json' \
  -d '{"title":"Ship it","description":"","priority":"high"}'
curl -X PATCH localhost:3000/api/tasks/<id> \
  -H 'content-type: application/json' -d '{"done":true}'
curl -X DELETE localhost:3000/api/tasks/<id>
```
