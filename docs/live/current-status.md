# Current Status

## What is Implemented

### Backend (Cloudflare Workers + D1)

- **Google OAuth Authentication** (`POST /api/auth/google`):
  - Verifies Google ID tokens with `jose` JWKS.
  - Creates or retrieves instructors in D1.
  - Returns `st_...` tokens generated via `crypto.getRandomValues`.

- **Plan Management** (full CRUD):
  - `GET /api/plans`
  - `POST /api/plans`
  - `GET /api/plans/:planId`
  - `DELETE /api/plans/:planId`
  - `POST /api/plans/:planId/questions`
  - `DELETE /api/plans/:planId/questions/:questionId`

- **Session Lifecycle**:
  - `POST /api/sessions`
  - `GET /api/sessions/:roomCode`
  - `GET /api/sessions/:roomCode/stats`
  - `POST /api/sessions/:roomCode/questions/custom`
  - `POST /api/sessions/:roomCode/questions/:questionId/activate`
  - `POST /api/sessions/:roomCode/questions/deactivate`
  - `POST /api/sessions/:roomCode/vote`
  - `POST /api/sessions/:roomCode/close`

- **D1 integration**:
  - Worker `DB` binding is the only required database input.
  - SQL schema lives in `backend/migrations/0001_init.sql`.
  - Plans and sessions store question arrays as JSON text columns.
  - Session and plan rewrites use optimistic `version` checks.

- **Deployment**:
  - Live at `https://classpolls-backend.luison-cpp.workers.dev`.
  - Secret: `GOOGLE_CLIENT_ID`.
  - `wrangler.toml` contains the `DB` binding metadata.

### Testing

- Unit tests mock `db/index.ts` for handler isolation.
- Vitest configured with TypeScript.

### Frontend

- Instructor dashboard, live classroom controls, OBS overlay, and student vote flow remain implemented.

## What is NOT Implemented

- **`roomCode` collision retry**: `createSession` does not retry on duplicate `roomCode` yet.
- **Mongo -> D1 data migration script**: schema exists, but old Atlas data is not automatically imported.

## Known Limitations

- Plan/session question arrays are rewritten as JSON blobs, so concurrency safety depends on the `version` guard in `src/db/index.ts`.
- `wrangler.toml` still needs a real D1 `database_id` before deploy.
