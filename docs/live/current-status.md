# Current Status

## What is Implemented

### Backend (Cloudflare Workers + MongoDB driver)

- **Google OAuth Authentication** (`POST /api/auth/google`):
  - Verifies Google ID tokens with `jose` JWKS.
  - Creates or retrieves instructors in MongoDB.
  - Returns `st_...` tokens generated via `crypto.getRandomValues`.

- **Plan Management** (full CRUD):
  - `GET /api/plans` — list plans filtered by instructor token.
  - `POST /api/plans` — create a plan with a title.
  - `GET /api/plans/:planId` — get a single plan.
  - `DELETE /api/plans/:planId` — delete a plan.
  - `POST /api/plans/:planId/questions` — add a question.
  - `DELETE /api/plans/:planId/questions/:questionId` — remove a question.

- **Session Lifecycle**:
  - `POST /api/sessions` — create a room from a plan (copies questions as inactive).
  - `GET /api/sessions/:roomCode` — public student polling (no auth, strips `instructorToken`/`votes`, injects `myVote`).
  - `GET /api/sessions/:roomCode/stats` — instructor stats (full votes dictionary, requires bearer token).
  - `POST /api/sessions/:roomCode/questions/custom` — inject ad-hoc question; auto-deactivates others if `activate=true`.
  - `POST /api/sessions/:roomCode/questions/:questionId/activate` — activate one question, deactivate all others.
  - `POST /api/sessions/:roomCode/questions/deactivate` — deactivate the active question.
  - `POST /api/sessions/:roomCode/vote` — register a student vote (server-side enforce active question + open session).
  - `POST /api/sessions/:roomCode/close` — close the session.

- **Bug fix applied**: `POST /api/sessions/:roomCode/questions/custom` with `activate=true` now deactivates other active questions first (only one active question at a time).

- **MongoDB integration**:
  - Official `mongodb` driver (no Atlas Data API).
  - Cached `MongoClient` singleton per Worker isolate.
  - Retry/reset logic for connection errors (`withRetry`, `resetClient`).
  - `withDatabase<T>()` helper that auto-closes temp clients when no-cache mode is on.

- **Deployment**:
  - Live at `https://classpolls-backend.luison-cpp.workers.dev`.
  - Secrets: `MONGODB_URI`, `GOOGLE_CLIENT_ID` (both set via `wrangler secret put`).
  - `wrangler.toml` only contains non-sensitive config (`name`, `compatibility_date/flags`, `MONGODB_DATABASE`).

### Config & Security

- `MONGODB_URI` and `GOOGLE_CLIENT_ID` moved out of `wrangler.toml` into `backend/.dev.vars` (git-ignored) and remote secrets.
- Local dev reads `MONGODB_URI` from `.dev.vars` (Wrangler auto-loads it).
- Deploy uses secrets; `wrangler.toml` has no credentials.

### Testing

- 19 unit tests across 3 suites (auth, plans, sessions).
- All tests mock `db/index.ts` for isolation.
- Vitest configured with TypeScript.

## What is NOT Implemented

- **MongoDB indexes**: not created yet. Run manually in Atlas UI or add a migration script.
- **Time-limit enforcement on vote**: server-side `startedAt + timeLimit` check not implemented.
- **`roomCode` collision retry**: `createSession` does not retry on duplicate `roomCode`.
- **Frontend**: nothing built yet (Vite + Preact scaffold only).
- **Architecture docs** for sessions and flows.

## Known Limitations

- **`wrangler dev` latency**: local Miniflare dev with `mongodb` driver is slow (2–6s per request). Use `wrangler dev --remote` or deploy for realistic timings.
- **Deployed latency**: typically ~0.8–1s per request; occasional outliers of ~3–6s due to Atlas M0 free tier.
- **Windows + Miniflare**: the `mongodb` driver has known issues with SRV DNS resolution in Miniflare. Use non-SRV connection strings for local dev on Windows if SRV fails.
- **Max listeners warning**: `node:events` `setMaxListeners(20)` applied in `client.ts` to suppress Mongo driver warnings in dev.
