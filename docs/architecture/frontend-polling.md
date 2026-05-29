# Frontend Polling & Identity Architecture

**Location**: `frontend/src/common/`

## Identity Bootstrap

### Student (Anonymous)
- `identity.ts` exports `getStudentId()`.
- First call generates a UUIDv4 via `crypto.randomUUID()` and persists it to `localStorage` under `cp.studentId`.
- Subsequent calls return the cached value.
- No server-side registration required — the id is sent with every poll and vote request.

### Instructor
- `apiClient.ts` manages `cp.instructorToken` in `localStorage`.
- `getInstructorToken()` / `setInstructorToken()` / `clearInstructorToken()` are the accessors.
- `clearInstructorToken()` is called automatically on any `401` response from protected endpoints.
- The Google Identity Services flow is handled by `GoogleAuth` (class in `instructor/Private/GoogleAuth.ts`).

## Frontend Language Selection

- `common/i18n/index.ts` exposes the `I18nProvider` and `useI18n()` hook for all Preact views.
- Supported UI languages are English (`en`) and Spanish (`es`).
- The initial language comes from `cp.language` in `localStorage`; if absent, the provider falls back to browser detection (`navigator.language`) and then English.
- Non-overlay routes render a shared language selector from `main.tsx`.
- The overlay route does not render the selector, but it still uses the persisted or auto-detected language.
- Instructor-side draft templates also localize their default choice text (`Yes/No`, `Option A/B`) through `questionDraft.ts`.

## SessionPollingController

A class-based polling loop used by student and overlay views. Located in `common/SessionPollingController.ts`.

### Contract
```
constructor(roomCode: string, onUpdate: (data) => void, studentId?: string)
```

### Methods
- `startPolling()` — begins a 3s `setInterval` loop. No-op if already polling.
- `stopPolling()` — clears the interval. Idempotent.
- `pollNow()` — triggers a single immediate fetch without waiting for the next interval tick.

### Fetch Behavior
- Constructs URL: `/api/sessions/${roomCode}` or `/api/sessions/${roomCode}?studentId=${studentId}`.
- On `!response.ok`, calls `onUpdate({ pollError: { status } })`.
- On network error, calls `onUpdate({ pollError: { status: 0 } })`.
- On success, calls `onUpdate(parsedJson)`.

### Non-Overlap Guard
An `inFlight` flag prevents concurrent fetch calls. If `fetchState` is already running when the interval fires, the second call is dropped.

### Stop Conditions (responsibility of the view layer)
1. Component unmount — `useEffect` cleanup calls `stopPolling()`.
2. `status === "closed"` — the view calls `controller.stopPolling()` inside the update handler.
3. HTTP 404 — the view calls `controller.stopPolling()` and surfaces "room not found".
4. Navigation away — handled implicitly by (1).

## VoteDispatcher

Located in `student/Private/VoteDispatcher.ts`. Manages optimistic vote locking with server confirmation.

### Contract
```
constructor(roomCode: string, studentId: string, onChange: () => void)
```

### Methods
- `submitVote(questionId, choiceIndex)` — POSTs to `/api/sessions/${roomCode}/vote`. Sets a pending vote immediately and calls `onChange()` so the UI shows the optimistic state.
- `sync(questionId, serverVote)` — called on each poll cycle. Compares the pending vote against the server-returned `myVote`.
- `getDisplayedVote(questionId, serverVote)` — returns the pending vote if active, otherwise the server vote.
- `isSubmitting(questionId)` — whether a pending vote exists for this question.

### Optimistic Lock & Revert
- On `submitVote`, the pending vote is stored with `missedPolls: 0`.
- Each `sync` call increments `missedPolls`. If `missedPolls >= 2` without the server echoing the vote, the pending vote is cleared (optimistic lock reverted).
- If the server-returned vote matches the pending choice (or differs), the pending state is cleared immediately on the next sync.

## API Client

`common/apiClient.ts` provides a thin `fetch` wrapper.

### Functions
- `requestJson<T>(path, { body?, method?, token? })` — sets `Content-Type: application/json`, adds `Authorization: Bearer` when a token is provided, parses the response as JSON. Throws `ApiError` on non-2xx.
- `ApiError` — custom error with `code`, `message`, `status` properties.
- `getErrorMessage(error)` — safely extracts a string from any error type.
- `getInstructorToken()` / `setInstructorToken()` / `clearInstructorToken()` — `localStorage` accessors for the instructor JWT.
