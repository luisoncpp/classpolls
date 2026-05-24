# ClassPolls Detailed Implementation & Testing Plan

Technical blueprint for the remaining features. Aligned with `docs/GUIDELINES.md` (≤3 params, ≤30-line functions, ≤200-line files, deep modules) and `docs/WORKFLOW.md` (TDD-first, then architecture docs).

> **On verification.** Unit tests with mocked `db/index.ts` and mocked `fetch` only prove the code is internally consistent — they cannot catch real mismatches between our payload shapes and what MongoDB, Google, or a real browser actually expect. Each phase below ends with a **🔎 Verify** block listing concrete things to observe in the real world before moving on. Stop the phase if a check fails.

> **Before writing any code, read these spec sections — they are the source of truth and the plan does not repeat them:**
> - [`backend-design.md`](../specs/backend-design.md) §1.1 (routing with `URLPattern`), §2 (CORS, error envelope, timestamps, identifiers, `roomCode` collisions, auth extraction), §4.1 (driver connection layer), §4.3 (test injection pattern), §5.4 (public-session response schema with `myVote`).
> - [`frontend-design.md`](../specs/frontend-design.md) §2.3 (Google Identity Services in Preact), §2.4 (polling stop conditions), §4 (target directory tree).

## ✅ Phase 1: Authentication & Environment Preparation (Completed)
### Manual Configuration
1. **Google Cloud Project Setup**:
   - Google Cloud Console → APIs & Services → Credentials.
   - Configure OAuth Consent Screen (add `localhost` and deployment domains).
   - Create OAuth 2.0 Client ID for Web Application.
   - Insert Client ID into `backend/.dev.vars` (`GOOGLE_CLIENT_ID`) and set as remote secret.
   - **Note**: Do NOT put secrets in `wrangler.toml`. Use `.dev.vars` for local dev + `wrangler secret put` for deploy.
2. **MongoDB Setup**:
   - Create a MongoDB Atlas cluster.
   - Create a database user and allow network access for Worker egress (`0.0.0.0/0`).
   - Store the full connection string with `wrangler secret put MONGODB_URI` and in `backend/.dev.vars`.

### TypeScript Tooling Fix
- **File**: `backend/package.json`
- **Action**: Already patched — `"typecheck": "tsc --noEmit"`.

### 🔎 Verify (Phase 1)
- `npm run typecheck` in `backend/` exits 0.
- `wrangler dev` boots without errors (reads secrets from `.dev.vars`).
- `npx wrangler deploy` succeeds; worker runs at `https://classpolls-backend.luison-cpp.workers.dev`.
- `POST /api/auth/google` with a real Google JWT returns `200` with `instructorToken`.

---

## ✅ Phase 2: Backend Testing Infrastructure & TDD (Completed)
### 2.1 Tooling Installation
- **Libraries**: `vitest`, `@cloudflare/vitest-pool-workers`
- **Config**: `backend/vitest.config.ts` configured for the `cloudflare` environment (simulated Edge/V8 isolate).

### 2.2 Auth Test Suite (`backend/test/auth.test.ts`)
1. **`POST /api/auth/google` (new instructor)**: Mock `jose.jwtVerify` and mock `db/index.ts`. Assert `upsertInstructor` is called for `googleId`, and the response returns a freshly generated `st_...` token.
2. **`POST /api/auth/google` (existing instructor)**: Same mocks, but the upsert hits an existing record. Assert the stored `instructorToken` is returned unchanged.
3. **`POST /api/auth/google` (invalid token)**: Mock `jose.jwtVerify` to throw. Assert 401 and no DB call.

### 2.3 Plan Management Test Suite (`backend/test/plans.test.ts`)
1. **`GET /api/plans`**: Asserts `find` filters by `instructorToken` from `Authorization: Bearer` header and projects metadata only.
2. **`POST /api/plans`**: Asserts `insertOne` and that the response returns the new `planId`.
3. **`GET /api/plans/:planId`**: Asserts `findOne` with the right filter and that cross-tenant access (different `instructorToken`) returns 404.
4. **`DELETE /api/plans/:planId`**: Asserts `deleteOne` and cross-tenant rejection.
5. **`POST /api/plans/:planId/questions`**: Asserts `updateOne` with `$push`, validating that `text` + `choices` are required and `correctChoiceIndex` (if present) is within range.
6. **`DELETE /api/plans/:planId/questions/:questionId`**: Asserts `updateOne` with `$pull` matching `questionId`.

### 2.4 Session Test Suite (`backend/test/sessions.test.ts`)
1. **`POST /api/sessions`**: Mock `db/index.ts`. Assert `createSession` is called and a 4-character uppercase alphanumeric `roomCode` is returned. When `planId` is supplied, assert questions are copied with `isActive: false` and `votes: {}`.
2. **`GET /api/sessions/:roomCode` (student polling)**: Mock `db/index.ts` to return a complete session. Assert the returned payload **does not** contain `instructorToken` or the full `votes` dictionary, but does inject the specific `studentId`'s vote (if any) for the active question.
3. **`GET /api/sessions/:roomCode` (overlay, no studentId)**: Assert no per-student vote field is injected; `instructorToken` and `votes` still stripped.
4. **`GET /api/sessions/:roomCode/stats` (instructor)**: Assert full `votes` dictionaries are returned only when a valid `Bearer <instructorToken>` matches the session.
5. **`POST /api/sessions/:roomCode/questions/custom`**: Assert the payload constructs a question with an ID (`q_...`), pushes it via `$push`, and (when requested) toggles `isActive: true` on the new question.
6. **`POST /api/sessions/:roomCode/questions/:questionId/activate`**: Assert `updateOne` flips only the target question's `isActive` to `true`, sets `startedAt`, and forces all others to `isActive: false`.
7. **`POST /api/sessions/:roomCode/questions/deactivate`**: Assert `updateOne` flips the currently-active question to `isActive: false` without touching others.
8. **`POST /api/sessions/:roomCode/vote` (happy path)**: Assert `updateOne` with `$set` on `votes.<studentId>` after verifying `status == "active"`, question `isActive == true`, and **server-side** that `Date.now() < startedAt + timeLimit*1000`.
9. **`POST /api/sessions/:roomCode/vote` (expired)**: With `startedAt + timeLimit` in the past, assert 409/4xx and no DB write — expiry is enforced on the server, not the client.
10. **`POST /api/sessions/:roomCode/close`**: Assert `updateOne` sets `status = "closed"`.

### 🔎 Verify (Phase 2)
- `npm run test` runs all three suites and they all **fail** for the right reason ("function not implemented" / 404), not for setup errors.
- No test in any suite passes accidentally — a green suite at this point means a mock is too lenient.

---

## ✅ Phase 3: Backend Implementation (Completed)
### 3.1 Auth Module (`backend/src/auth/google.ts` + `backend/src/handlers/auth.ts`)
Already described in `docs/architecture/backend-auth.md`. Drive implementation via the Phase 2.2 tests. Token generator (`st_...`) lives next to the handler; high-entropy via `crypto.getRandomValues`.

#### 🔎 Verify (3.1) — real Google + real MongoDB
Mocks cannot catch a JWKS misconfig or an upsert filter mistake. Do this once before continuing:
1. `wrangler dev` the backend.
2. From a scratch HTML page or browser console with Google Identity Services loaded, sign in and capture the `credential` JWT.
3. `curl -X POST http://localhost:8787/api/auth/google -d '{"idToken":"<jwt>"}'` → expect `200` with `{ instructorToken: "st_..." }`.
4. Repeat with the same Google account → expect the **same** token returned (upsert path).
5. MongoDB Atlas UI → `instructors` collection → confirm exactly **one** document for that `googleId`.
6. Send a garbage JWT → expect `401` and no DB write.

Stop if: step 3 500s (likely JWKS/`jose` config), step 4 returns a different token (upsert filter wrong), or step 5 shows duplicate rows.

### 3.2 DB Deep Module Extension (`backend/src/db/index.ts`)
Target public surface defined in [`backend-design.md`](../specs/backend-design.md) §4.4. Plan-side functions already exist; this phase adds the session-side functions and replaces `createInstructor` with an upsert variant.

Two non-obvious bits to follow from the spec:
- **`activateQuestion`** — must use the single-`updateOne` + dual-`arrayFilters` pattern in §4.2. Two round trips is a bug.
- **`createSession`** — must implement the collision-retry loop from §2.5 (create the unique index in Atlas manually before running).

#### 🔎 Verify (3.2) — document shapes match MongoDB
Implement the **plans** functions first and hand-drive them via `curl` before touching sessions. This isolates Mongo document-shape bugs from session-lifecycle bugs.
1. With the `instructorToken` from 3.1, `curl POST /api/plans` with `{title:"smoke"}` → expect `200` + `planId`.
2. `curl POST /api/plans/:planId/questions` with a real payload → expect `200`.
3. MongoDB Atlas UI → `plans` collection → confirm the document matches `backend-design.md` §3.1 **exactly** (field names, types, no stray nulls, `questionId` is `q_...`).
4. `curl DELETE /api/plans/:planId/questions/:questionId` → confirm the array shrinks.
5. `curl DELETE /api/plans/:planId` → confirm document is gone.

Stop if: any field name in MongoDB drifts from the spec, or `$push`/`$pull` silently no-ops (filter mismatch).

### 3.3 Handlers (`backend/src/handlers/`)
- `auth.ts`, `plans.ts`, `sessions.ts`.
- Routing: dispatch by path prefix from `src/index.ts`.
- Extract `instructorToken` via `Bearer` header for protected endpoints; reject missing/invalid tokens at the handler boundary before any DB call.
- Server-side time-limit enforcement on `/vote` lives here (or in `registerVote`) — never trust the client.
- Strict ≤30 lines per function. Use return-early.

### 🔎 Verify (3.3) — full session lifecycle via HTTP
Drive a complete instructor → student → close flow with `curl` (or a small shell script) against `wrangler dev`. No browser yet.
1. `POST /api/sessions` with `{planId}` (from 3.2) → capture `roomCode`. MongoDB: confirm `sessions` doc has the plan's questions copied with `isActive:false`, `votes:{}`.
2. `GET /api/sessions/:roomCode?studentId=test-1` (no auth) → confirm response **lacks** `instructorToken` and the full `votes` dict.
3. `POST /api/sessions/:roomCode/questions/:questionId/activate` → re-fetch step 2 → confirm `isActive:true` and `startedAt` set.
4. `POST /api/sessions/:roomCode/vote` with `{questionId, choiceIndex:1, studentId:"test-1"}` → `200`. Re-fetch step 2 → response shows **this** student's choice, no one else's.
5. Wait past `timeLimit`, vote with a fresh `studentId` → expect rejection (server-side expiry).
6. `POST /api/sessions/:roomCode/questions/custom` → confirm the question appears; auto-activate path works if requested.
7. `POST /api/sessions/:roomCode/questions/deactivate` → confirm `isActive:false`.
8. `GET /api/sessions/:roomCode/stats` with `Bearer <instructorToken>` → full `votes` dictionaries returned.
9. Same call with a **different** instructor's token → `403`/`404` (cross-tenant isolation).
10. `POST /api/sessions/:roomCode/close` → `status:"closed"`.

Stop if: any student-facing response leaks `instructorToken`/`votes`, expired votes are accepted, or cross-tenant stats leak.

### Notes on Phase 3 completion

- **All handlers implemented** and tested (19 unit tests).
- **Deployed** at `https://classpolls-backend.luison-cpp.workers.dev`.
- **Bug fix**: `custom questions` with `activate=true` now deactivates the other active question first.
- **Config change**: secrets moved from `wrangler.toml` to `.dev.vars` + remote secrets.
- **Deferred from original plan**:
  - `roomCode` collision retry not yet implemented.
  - Server-side time-limit enforcement on vote not yet implemented.
  - MongoDB indexes not created (need manual setup or migration script).
- **Known issue**: `wrangler dev` (local Miniflare) with the MongoDB driver is slow (2–6s). Use `--remote` or deploy for realistic latencies.

---

## Phase 4: Frontend Testing Infrastructure & TDD
### 4.1 Tooling Installation
- **Libraries**: `vitest`, `jsdom`, `@testing-library/preact`, `@testing-library/jest-dom`
- **Config**: `frontend/vitest.config.ts` with alias resolution and DOM simulation.

### 4.2 Identity Module Tests (`frontend/src/common/identity.test.ts`)
1. **First call**: Asserts a UUIDv4 is generated and persisted to `localStorage`.
2. **Subsequent calls**: Asserts the persisted value is reused (idempotent).

### 4.3 Polling Controller Tests (`frontend/src/common/SessionPollingController.test.ts`)
Signature per `docs/specs/frontend-design.md`: `new SessionPollingController(roomCode, onUpdate, studentId?)`.
1. **Initialization**: Asserts properties stored correctly; no timer scheduled yet.
2. **Polling lifecycle**: `startPolling` calls `setInterval`; calling `startPolling` again is a no-op. `stopPolling` clears the timer; calling `stopPolling` twice is a no-op.
3. **Fetch logic (student)**: Mock global `fetch`. Advance Vitest fake timers by 3000ms. Assert `fetch` hit `/api/sessions/ABCD?studentId=...` and `onUpdate` ran with the parsed JSON.
4. **Fetch logic (overlay)**: Construct without `studentId`. Assert URL has no query string.

### 🔎 Verify (Phase 4)
- `npm run test` in `frontend/` runs and the new suites fail with implementation-missing errors, not config errors (jsdom up, alias resolution working).

---

## Phase 5: Frontend Component Architecture
### 5.1 Deep Modules & State Classes
- **`frontend/src/common/identity.ts`** — generates/persists `studentId` (UUIDv4 + `localStorage`).
- **`frontend/src/common/SessionPollingController.ts`** — class from Phase 4.3.
- **`frontend/src/student/`** — deep module with `index.ts` exposing `<RoomJoin />` and `<Grid />`; internals (vote dispatcher, button-lock state) are private.
- **`frontend/src/instructor/`** — deep module with `index.ts` exposing `<Dashboard />` and `<ClassroomControls />`; plan-manager internals are private.
- **`frontend/src/overlay/`** — deep module with `index.ts` exposing `<OBSOverlay />`.

### 5.2 Views
- **`instructor/Dashboard.tsx`**: Google Identity Services button → `POST /api/auth/google` → store `instructorToken` in `localStorage`. Lists plans from `GET /api/plans`. Routes to `ClassroomControls.tsx`.
- **`student/RoomJoin.tsx` & `Grid.tsx`**: Anonymous. Read active question choices from polling state; `POST /vote` on click; lock buttons optimistically and confirm against server-returned vote field.
- **`overlay/OBSOverlay.tsx`**: No inputs. Interpolates countdown `startedAt + timeLimit - Date.now()`. When `isActive` flips to `false` and `correctChoiceIndex` is set, highlights the correct bar.

### 🔎 Verify (5.2) — incremental per view
Don't wait until all three views exist. Verify each as it lands:

**After `Dashboard.tsx`**:
- Sign in with Google in the real browser → `localStorage` shows an `instructorToken`. Reload → still signed in.
- Plan list loads from the live backend; create a plan → it appears without a page refresh.

**After `ClassroomControls.tsx`**:
- Start a session → `roomCode` is displayed. MongoDB shows the new `sessions` doc.
- Activate a question → the dashboard reflects the active state.

**After `student/`**:
- In a second incognito window, enter the `roomCode`. The active question appears within ~3s of activation.
- Vote → buttons lock immediately. Wait one poll cycle → still locked (server-confirmed, not just optimistic).
- Reload the page → the lock persists (identity survived via `localStorage`).

**After `overlay/OBSOverlay.tsx`**:
- Open `/overlay/:roomCode` in a third window. Confirm **no input controls** are visible.
- Countdown ticks down smoothly (not in 3s jumps — that would mean it's not interpolating locally).
- Instructor deactivates the question → overlay highlights the correct choice within one poll cycle.

**Full three-window walkthrough (final gate before Phase 6)**:
- Push a "Custom Question" from the instructor → appears on student + overlay within one poll cycle.
- Close the session from the instructor → student + overlay both reflect closed state cleanly with no console errors.

Stop if: any view shows stale data after a state change, the overlay reveals interactive controls, the countdown jumps in 3s steps, or the student and overlay desync from each other.

---

## Phase 6: Architecture Documentation (Mandatory per WORKFLOW.md)
After implementation lands and tests pass:

1. **Update existing docs**:
   - `docs/architecture/backend-db.md` — extend with the new public DB surface from Phase 3.2.
   - `docs/architecture/backend-auth.md` — confirm token-issuance flow matches reality; add the `st_...` entropy source.
   - `docs/specs/backend-design.md` & `docs/specs/frontend-design.md` — sync any signature changes (e.g., atomic-payload objects).

2. **Add new architecture docs**:
   - `docs/architecture/backend-sessions.md` — session lifecycle (create → activate/deactivate questions → close), vote-expiry enforcement, student-vs-instructor projections.
   - `docs/architecture/frontend-polling.md` — `SessionPollingController` contract, identity bootstrap, optimistic vote locking.

3. **Add flows** (`docs/flows/`):
   - `instructor-runs-session.md` — login → pick plan → open room → activate question → close.
   - `student-votes.md` — join code → poll → vote → see lock.
   - `overlay-projection.md` — overlay URL → countdown → reveal correct answer.

4. **Lessons learned** (`docs/lessons-learned/`): capture any non-obvious gotchas discovered during implementation (e.g., Mongo driver behavior in Workers, `jose` JWKS caching, Preact + Vite test config).

### 🔎 Verify (Phase 6) — pre-deploy
- `npm run typecheck` (both packages) — clean.
- `npm run test` (both packages) — green.
- Re-run the full three-window walkthrough from Phase 5 once more, this time against the **deployed preview**, not just `localhost`. Real CORS, real domain on Google OAuth, real MongoDB latency.
