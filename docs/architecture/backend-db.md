# Database Deep Module Architecture

**Location**: `backend/src/db/`

## Philosophy
The backend connects to MongoDB Atlas using the official `mongodb` driver directly from Cloudflare Workers. The Worker runtime enables `nodejs_compat`, and the private DB layer owns the connection lifecycle so route handlers stay free of driver details.

## The Deep Module Rule

1. **Private Layer (`src/db/Private/client.ts`)**
   - Creates and caches the `MongoClient` in module scope.
   - Returns a `Db` instance from the configured `MONGODB_URI` and database name.
   - Is never imported by handlers.
   - When `LOCAL_DEV_NO_CACHE=1` is set, creates a fresh client per call and closes it in the `finally` block.

2. **Public Layer (`src/db/index.ts`)**
   - Exposes domain operations — plans, sessions, instructors.
   - Keeps the public API small and business-focused.
   - Hides `ObjectId`, collection names, and Mongo update syntax from handlers.

## Connection Lifecycle

- `MongoClient` is created once and cached in module-level `state`.
- `connectTimeoutMS`, `serverSelectionTimeoutMS`, and `socketTimeoutMS` are all set to 5000ms.
- A `maxIdleTimeMS` of 30000ms allows idle connections to be reclaimed.
- `resetClient()` clears the cache and closes the previous client — called by `withRetry` on transient errors.

## Retry on Transient Errors

`withRetry` wraps every DB operation. On failure it checks `shouldRetry`: if the error message matches a known transient pattern (`connection`, `socket`, `server selection`, `topology`, `closed`, `timed out`), it calls `resetClient()` and retries once. Non-transient errors (e.g. `MongoServerError` for duplicate keys) are not retried.

## Public Surface

### Instructors
- `getInstructorByGoogleId(ctx, googleId)` → `{ document }`
- `upsertInstructor(ctx, googleId, profile)` — `$set` mutable fields, `$setOnInsert` for `googleId`, `createdAt`, `instructorToken`

### Plans
- `listPlans(ctx, token)` — projection: `{ title: 1 }`
- `createPlan(ctx, token, title)` — creates `{ instructorToken, questions: [], title }`
- `getPlan(ctx, token, planId)` — filtered by `instructorToken`
- `getPlanById(ctx, planId)` — unfiltered (used internally by session creation)
- `deletePlan(ctx, token, planId)`
- `addQuestionToPlan(ctx, planId, { instructorToken, question })` — `$push`
- `removeQuestionFromPlan(ctx, planId, { instructorToken, questionId })` — `$pull`

### Sessions
- `createSession(ctx, token, { planId?, questions, roomCode })` — inserts with `status: "active"`
- `getSession(ctx, roomCode)` — no auth filter (public endpoint)
- `getSessionStats(ctx, token, roomCode)` — filtered by `instructorToken`
- `addCustomQuestion(ctx, roomCode, { instructorToken, question })` — `$push`
- `activateQuestion(ctx, roomCode, { instructorToken, questionId })` — single `updateOne` with `arrayFilters`
- `deactivateQuestion(ctx, roomCode, instructorToken)`
- `registerVote(ctx, roomCode, { choiceIndex, questionId, studentId })` — single `updateOne` with `arrayFilters`
- `closeSession(ctx, roomCode, instructorToken)`

## Atomicity Rule
`activateQuestion` and `registerVote` use single `updateOne` + `arrayFilters` to avoid race conditions. Two round-trips is a bug.

## Testing
Unit tests mock `backend/src/db/index` with `vi.mock`. They validate handler behavior against the public DB contract rather than asserting driver calls.
