# Database Deep Module Architecture

**Location**: `backend/src/db/`

## Philosophy
The backend now stores instructors, plans, and sessions in Cloudflare D1 through a small DB deep module. Handlers still talk only in domain operations; SQL, JSON persistence, row mapping, and optimistic concurrency stay inside `src/db`.

## The Deep Module Rule

1. **Private Layer**
   - `src/db/Private/client.ts` defines `DbContext` as the Worker `D1Database` binding.
   - `src/db/Private/documents.ts` maps D1 rows into handler-facing documents.
   - Handlers never import these files directly.

2. **Public Layer (`src/db/index.ts`)**
   - Exposes domain operations only.
   - Preserves the old handler contract: `{ document }`, `{ documents }`, `insertedId`, `matchedCount`, `modifiedCount`, `deletedCount`.
   - Hides table names, JSON columns, and optimistic-write details from handlers.

## Storage Model

- `instructors`
  - One row per Google account.
  - `google_id` is the primary key.
  - `instructor_token` stays stable after first insert.

- `plans`
  - `questions` are stored in `questions_json` as a JSON array.
  - `version` increments on every question-list rewrite.

- `sessions`
  - `room_code` is unique.
  - `questions` are stored in `questions_json` as a JSON array.
  - `version` increments on every question or vote rewrite.

## Concurrency Rule

Question activation, deactivation, custom-question insertion, vote registration, and plan question edits are implemented as:

1. read row
2. compute next JSON document in memory
3. `UPDATE ... WHERE version = ?`

If the row changed in between, the update returns `0` changes and the DB layer retries once with fresh state. Future changes must preserve this optimistic concurrency guard; plain read-then-write with no version check is a bug.

## Public Surface

### Instructors
- `getInstructorByGoogleId(ctx, googleId)`
- `upsertInstructor(ctx, googleId, profile)`

### Plans
- `listPlans(ctx, token)`
- `createPlan(ctx, token, title)`
- `getPlan(ctx, token, planId)`
- `getPlanById(ctx, planId)`
- `deletePlan(ctx, token, planId)`
- `addQuestionToPlan(ctx, planId, payload)`
- `removeQuestionFromPlan(ctx, planId, payload)`

### Sessions
- `createSession(ctx, token, payload)`
- `getSession(ctx, roomCode)`
- `getSessionStats(ctx, token, roomCode)`
- `addCustomQuestion(ctx, roomCode, payload)`
- `activateQuestion(ctx, roomCode, payload)`
- `deactivateQuestion(ctx, roomCode, instructorToken)`
- `registerVote(ctx, roomCode, vote)`
- `closeSession(ctx, roomCode, instructorToken)`

## Testing
Unit tests still mock `backend/src/db/index.ts`. They validate handler behavior against the DB contract instead of asserting SQL text or D1 APIs.
