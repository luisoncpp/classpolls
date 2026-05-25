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

## Student vs Instructor Projections

**Public** (`GET /api/sessions/:roomCode`):
- Strips `_id`, `instructorToken`, full `votes` dictionary
- Injects `myVote` from `votes[studentId]` when a `studentId` query param is provided
- Removes `correctChoiceIndex` from active questions (don't reveal answer during voting)
- Normalizes `Date` fields to ISO strings

**Instructor** (`GET /api/sessions/:roomCode/stats`):
- Requires `Authorization: Bearer <token>` matching the session
- Returns full document including complete `votes` maps per question
- Cross-tenant access returns 404

## Vote Registration

`registerVote` uses `$set` with `questions.$[q].votes.${studentId}` inside an `arrayFilters` targeting `q.isActive: true && q.questionId: questionId`. Returns `matchedCount` — if zero (question not active or room not in active status), the handler responds with `409 VOTE_EXPIRED`.

## Deferred Items

- **`roomCode` collision retry**: The `createSession` function should retry on `E11000` duplicate key errors before falling back to `409 ROOM_CODE_EXHAUSTED`.
- **Server-side time-limit enforcement**: `registerVote` should check `Date.now() < startedAt + timeLimit` before writing the vote.
