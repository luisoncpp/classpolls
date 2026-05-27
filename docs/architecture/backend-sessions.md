# Session Lifecycle Architecture

**Location**: `backend/src/handlers/sessions.ts`, `backend/src/db/index.ts`

## Lifecycle States

```
created (active) → question activated (isActive) → question deactivated → ... → closed
```

A `sessions` document always starts with `status: "active"` and ends with `status: "closed"`. Within an active session, individual questions toggle `isActive`.

## Entry Points

| Action | Route | Handler Function |
|--------|-------|------------------|
| Create room | `POST /api/sessions` | `createSession` |
| Public poll | `GET /api/sessions/:roomCode` | `getPublicSession` |
| Instructor stats | `GET /api/sessions/:roomCode/stats` | `getStats` |
| Custom question | `POST /api/sessions/:roomCode/questions/custom` | `addCustomQuestion` |
| Activate question | `POST /api/sessions/:roomCode/questions/:questionId/activate` | `activateQuestion` |
| Deactivate active | `POST /api/sessions/:roomCode/questions/deactivate` | `deactivateQuestion` |
| Submit vote | `POST /api/sessions/:roomCode/vote` | `voteOnQuestion` |
| Close room | `POST /api/sessions/:roomCode/close` | `closeSession` |

## Question Activation

`activateQuestion` uses a single `updateOne` with dual `arrayFilters`:
- `target.questionId` = the question to activate (sets `isActive: true`, sets `startedAt`)
- `others.questionId` ≠ target (sets `isActive: false`)

This guarantees exactly one active question per room atomically.

## Custom Question

`addCustomQuestion` accepts an `activate` boolean. When `true`, it calls `deactivateQuestion` before pushing, then creates the new question with `isActive: true` and a `startedAt` timestamp.

New question ids use `q_${crypto.randomUUID()}` to avoid timestamp collisions and predictable ids.

## Student vs Instructor Projections

**Public** (`GET /api/sessions/:roomCode`):
- Strips `_id`, `instructorToken`, full `votes` dictionary
- Injects `myVote` from `votes[studentId]` when a `studentId` query param is provided
- Removes `correctChoiceIndex` unless the question is still active and its timer has expired
- Normalizes `Date` fields to ISO strings

**Instructor** (`GET /api/sessions/:roomCode/stats`):
- Requires `Authorization: Bearer <token>` matching the session
- Returns full document including complete `votes` maps per question
- Cross-tenant access returns 404

Instructor mutations (`custom`, `activate`, `deactivate`, `close`) also return `404 SESSION_NOT_FOUND` when the bearer token does not match an active room instead of silently reporting success.

## Vote Registration

Before calling `registerVote`, the handler loads the session and rejects the write with `409 VOTE_EXPIRED` when the target question is missing, inactive, or already past `startedAt + timeLimit`.

The handler also validates the vote payload before any write:
- `studentId` must be a lowercase UUIDv4-style string (`8-4-4-4-12` hex segments)
- `choiceIndex` must be an integer within the current question's `choices` range
- `questionId` must be a non-empty string

`registerVote` uses `$set` with `questions.$[q].votes.${studentId}` inside an `arrayFilters` targeting `q.isActive: true && q.questionId: questionId`. Returns `matchedCount` — if zero (question not active or room not in active status), the handler responds with `409 VOTE_EXPIRED`.

## Plan Ownership

`createSession` may copy questions from a saved plan, but only when `plan.instructorToken` matches the bearer token that opened the room. Cross-instructor plan ids are treated as `404 PLAN_NOT_FOUND`.

## Deferred Items

- **`roomCode` collision retry**: The `createSession` function should retry on `E11000` duplicate key errors before falling back to `409 ROOM_CODE_EXHAUSTED`.

## Failure Recovery

- The Worker now resets the cached Mongo client on any uncaught request error before returning the error response.
- Database operations also use a defensive timeout; if an operation stalls, the cached client is reset so later requests do not keep reusing a poisoned connection.
