# Backend Technical Specification (Cloudflare Workers + D1)

## 1. Architectural Overview
The backend is a stateless REST API deployed on Cloudflare Workers. It performs request validation, auth, and session business rules while talking directly to a Cloudflare D1 database through the Worker `DB` binding.

For authentication, the backend validates Google ID Tokens (JWTs) using Google's public JWKS.

### 1.1 Routing
Dispatch from `src/index.ts` uses the runtime-native `URLPattern` API (no router dependency). Each handler module exports matcher logic returning `Response | null`; `index.ts` tries handlers in order and falls through to a 404. Path parameters (`:roomCode`, `:planId`, `:questionId`) come from `URLPattern.exec(url).pathname.groups`.

### 1.2 Directory Layout
```text
backend/src/
├── index.ts              # URLPattern dispatch + CORS wrapper + error envelope
├── auth/
│   └── google.ts         # jose-based ID token verification
├── handlers/
│   ├── _shared.ts        # error helpers, auth extraction, normalization
│   ├── auth.ts           # POST /api/auth/google
│   ├── plans.ts          # /api/plans/*
│   └── sessions.ts       # /api/sessions/*
└── db/
    ├── index.ts          # Public interface — all DB functions live here
    └── Private/
        ├── client.ts     # D1 binding context — never imported outside db/
        └── documents.ts  # Row -> document mapping helpers
```

---

## 2. Cross-Cutting Conventions

### 2.1 CORS
- Responses echo `Access-Control-Allow-Origin` only when the request `Origin` is present in the `FRONTEND_ORIGINS` allowlist.
- `OPTIONS` preflight returns `Allow-Methods: GET, POST, DELETE, OPTIONS` and `Allow-Headers: Content-Type, Authorization`.
- CORS responses include `Vary: Origin`.
- The CORS wrapper lives in `src/index.ts` and is applied to every non-OPTIONS response, including errors.

### 2.2 Error Envelope
Every non-2xx response uses exactly:

```json
{ "error": { "code": "VOTE_EXPIRED", "message": "Voting window closed" } }
```

- `code` is stable `UPPER_SNAKE_CASE`.
- `message` is human-readable.
- Status codes: `400`, `401`, `403`, `404`, `409`, `500`.

### 2.3 Timestamps on the Wire
The DB layer maps D1 timestamp strings back into `Date` objects before returning documents to handlers. Handlers normalize them to plain ISO strings before responding.

### 2.4 Identifier Formats
- `instructorToken`: `st_` + 32 hex chars from `crypto.getRandomValues(new Uint8Array(16))`
- `studentId`: client-generated UUIDv4
- `questionId`: `q_${crypto.randomUUID()}`
- `roomCode`: see §2.5

### 2.5 `roomCode` Generation & Collisions
4-character uppercase alphanumeric excluding ambiguous chars (`0/O`, `1/I/L`).

- `sessions.roomCode` must stay unique in D1.
- `createSession` should retry a few times on duplicate-key errors.
- Exhaustion returns `409 ROOM_CODE_EXHAUSTED`.

### 2.6 Auth Extraction
Protected endpoints read `Authorization: Bearer <instructorToken>`. `requireToken(req)` throws `401 MISSING_TOKEN` if absent.

---

## 3. Data Model

### 3.1 Tables

**`instructors`**
```json
{
  "googleId": "10984392483...",
  "email": "prof.smith@university.edu",
  "name": "Prof. Smith",
  "picture": "https://lh3.googleusercontent.com/a/...",
  "instructorToken": "st_5a2f8c9b3e10...",
  "createdAt": "Date"
}
```

**`plans`**
```json
{
  "_id": "uuid",
  "instructorToken": "st_5a2f8c9b3e10...",
  "title": "Data Structures 101",
  "questions": [
    {
      "questionId": "q_1716490800",
      "text": "What is the time complexity of a binary search tree lookup in the worst case?",
      "choices": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      "timeLimit": 60,
      "correctChoiceIndex": 1
    }
  ]
}
```

**`sessions`**
```json
{
  "_id": "uuid",
  "roomCode": "NXKB",
  "instructorToken": "st_5a2f8c9b3e10...",
  "planId": "64f...",
  "status": "active",
  "createdAt": "Date",
  "questions": [
    {
      "questionId": "q_1716490800",
      "text": "...",
      "choices": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      "timeLimit": 60,
      "correctChoiceIndex": 1,
      "isActive": true,
      "startedAt": "Date",
      "votes": {
        "student_5f8a9": 2,
        "student_1b2c3": 1
      }
    }
  ]
}
```

---

## 4. Deep Module: Database Client Interface

### 4.1 Private Connection Layer
`backend/src/db/Private/client.ts` owns the D1 context type.

- The backend passes a `DbContext` containing the `DB` binding.
- Route handlers never import the private client directly.
- `backend/src/db/Private/documents.ts` converts rows and JSON columns into handler-facing documents.

### 4.2 Public DB Surface
Public functions in `backend/src/db/index.ts` wrap domain operations and hide driver details:

```ts
getInstructorByGoogleId(ctx, googleId)
upsertInstructor(ctx, googleId, profile)

listPlans(ctx, token)
createPlan(ctx, token, title)
getPlan(ctx, token, planId)
getPlanById(ctx, planId)
deletePlan(ctx, token, planId)
addQuestionToPlan(ctx, planId, payload)
removeQuestionFromPlan(ctx, planId, payload)

createSession(ctx, token, payload)
getSession(ctx, roomCode)
getSessionStats(ctx, token, roomCode)
addCustomQuestion(ctx, roomCode, payload)
activateQuestion(ctx, roomCode, payload)
deactivateQuestion(ctx, roomCode, instructorToken)
registerVote(ctx, roomCode, vote)
closeSession(ctx, roomCode, instructorToken)
```

### 4.3 Test Injection Pattern
Tests mock the public `db/index.ts` boundary with `vi.mock('../src/db/index')` and assert handler behavior against that public contract. They do not assert driver internals or socket behavior.

### 4.4 Concurrency Rule
`activateQuestion`, `deactivateQuestion`, `registerVote`, and question-list rewrites use optimistic `version` checks in D1. Future changes must preserve that guard to avoid lost updates.

---

## 5. REST API Endpoint Catalog

### 5.1 Authentication Domain

#### `POST /api/auth/google`
- Verifies Google ID token.
- Upserts the instructor by `googleId`.
- Returns `{ instructorToken }`.
- Requires the D1 binding; otherwise returns `500 DB_NOT_CONFIGURED`.

### 5.2 Plan Management Domain

#### `GET /api/plans`
- Lists plans for the instructor.
- Returns projected metadata only.

#### `POST /api/plans`
- Creates a plan.
- Returns `{ planId }`.

#### `GET /api/plans/:planId`
- Returns one instructor-owned plan.

#### `DELETE /api/plans/:planId`
- Deletes one instructor-owned plan.

#### `POST /api/plans/:planId/questions`
- Adds a question with validation.

#### `DELETE /api/plans/:planId/questions/:questionId`
- Removes one question from the plan.

### 5.3 Session Management Domain

#### `POST /api/sessions`
- Creates a live room.
- Optionally copies plan questions with `isActive: false` and `votes: {}`.

#### `POST /api/sessions/:roomCode/questions/custom`
- Pushes a custom live-room question.
- Returns `404 SESSION_NOT_FOUND` when the bearer token does not own an active room.

#### `POST /api/sessions/:roomCode/questions/:questionId/activate`
- Activates one question and deactivates others.
- Returns `404 SESSION_NOT_FOUND` when no active instructor-owned room matches.

#### `POST /api/sessions/:roomCode/questions/deactivate`
- Deactivates the currently active question.
- Returns `404 SESSION_NOT_FOUND` when no active instructor-owned room matches.

#### `GET /api/sessions/:roomCode/stats`
- Returns full instructor-facing stats including vote maps.

#### `POST /api/sessions/:roomCode/close`
- Sets `status = "closed"`.
- Returns `404 SESSION_NOT_FOUND` when no active instructor-owned room matches.

### 5.4 Student Domain

#### `GET /api/sessions/:roomCode`
- Public polling endpoint.
- Strips `instructorToken` and full `votes`.
- Injects `myVote` when `studentId` is provided.

Authoritative response shape:

```json
{
  "roomCode": "NXKB",
  "status": "active",
  "createdAt": "2026-05-23T19:00:00.000Z",
  "questions": [
    {
      "questionId": "q_1716490800",
      "text": "What is the time complexity of a binary search tree lookup in the worst case?",
      "choices": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      "timeLimit": 60,
      "correctChoiceIndex": 1,
      "isActive": true,
      "startedAt": "2026-05-23T19:15:00.000Z",
      "myVote": 2
    }
  ]
}
```

#### `POST /api/sessions/:roomCode/vote`
- Writes a student vote for the active question.
- Rejects expired/inactive/closed states with `409`.
