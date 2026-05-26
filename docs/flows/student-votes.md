# Flow: Student Votes

## Trigger
Student enters a room code on the home page and clicks "Join room".

## Entry Point
`student/RoomJoin.tsx` → `joinRoom()` → `SessionPollingController.startPolling()`

## Sequence

1. **Identity bootstrap**
   - `getStudentId()` either reads `cp.studentId` from `localStorage` or generates a new UUIDv4.
   - No server registration — the id is sent with every request.

2. **Join room**
   - Student types room code → clicks "Join room"
   - `joinedRoomCode` state updates → `useEffect` triggers `startRoomPolling()`
   - `SessionPollingController` created with `roomCode`, `onUpdate` callback, and `studentId`
   - `pollNow()` fires immediately, then `startPolling()` begins 3s interval

3. **Polling loop**
    - Every 3s: `GET /api/sessions/:roomCode?studentId=...`
    - Response parsed as `PublicSession` → `setSession()` updates state
    - `handleUpdate` also calls `VoteDispatcher.sync()` if a pending vote exists
    - When an active timed question is close to expiring, the client schedules an extra immediate poll right after the countdown crosses zero so the revealed answer arrives without waiting for the next 3s interval
    - On `status === "closed"`: polling stops, UI shows "Session closed"
   - On `pollError.status === 404`: polling stops, UI shows "Room not found"
   - `inFlight` guard prevents overlapping requests

4. **Vote**
     - When a question is `isActive: true`, `Grid` renders enabled choice buttons
     - A local 1s clock interpolates the countdown from `startedAt + timeLimit`
     - Student clicks a choice → `VoteDispatcher.submitVote(questionId, choiceIndex)`
     - Optimistic: `pendingVote` set immediately, component re-renders via `onChange`
     - Button locks: `displayedVote !== null` disables all buttons
     - `POST /api/sessions/:roomCode/vote` with `{ choiceIndex, questionId, studentId }`
     - Backend rejects malformed vote payloads with `400 INVALID_VOTE` before touching Mongo
     - When the countdown reaches `0`, voting buttons disable immediately on the client
     - When the timer is over and `correctChoiceIndex` is present, the correct choice is highlighted
     - On API error: error message displayed, vote remains locked or reverts on next sync

5. **Vote confirmation**
   - Next poll cycles bring back `myVote` from the server
   - `VoteDispatcher.sync()` compares `serverVote` against `pendingVote`
   - On match: pending vote cleared, UI stays locked (confirmed)
   - On mismatch after 2 missed polls: pending vote cleared, UI shows the server's value
   - If server returned a different vote: pending cleared immediately, UI reflects server truth

## Reads
- `GET /api/sessions/:roomCode?studentId=...` — 3s polling

## Writes
- `POST /api/sessions/:roomCode/vote` — on choice click

## Side Effects
- `localStorage` accumulates a `cp.studentId` entry (persists across sessions).
- No server-side state change for identity — the student is anonymous.

## Common Failure Modes
- **Room not found (404)**: Polling stops automatically, user can re-enter a different code.
- **Invalid vote payload (400)**: Student identity or choice index is malformed; frontend should keep using the stored UUID and current choices.
- **Vote rejected (409)**: The question may have expired or the room was closed.
- **Network error**: Polling retries on the next interval (3s later). Vote submission shows an error.

## Files to Inspect
- `frontend/src/student/RoomJoin.tsx`
- `frontend/src/student/Grid.tsx`
- `frontend/src/student/Private/VoteDispatcher.ts`
- `frontend/src/common/SessionPollingController.ts`
- `frontend/src/common/identity.ts`
