# Flow: Overlay Projection

## Trigger
Instructor (or anyone) opens `/overlay/:roomCode` in a browser or OBS browser source.

## Entry Point
`overlay/OBSOverlay.tsx` — renders directly from the route param `roomCode`.

## Sequence

1. **Room resolution**
   - Component mounts with `roomCode` from URL path
   - `useEffect` → `startOverlayPolling()` creates a `SessionPollingController` (no `studentId` — overlay is projection-only)
   - Polling starts: `GET /api/sessions/${roomCode}` every 3s

2. **Countdown interpolation**
   - A separate `useEffect` starts a 1s `setInterval` updating `now = Date.now()`
   - Each render calculates `getCountdownMs(question, now)`:
     - `new Date(question.startedAt).getTime() + question.timeLimit * 1000 - now`
    - When no `startedAt`/`timeLimit`, countdown is suppressed
    - Displayed as `Math.ceil(countdownMs / 1000)` seconds

3. **Choice display**
     - Choices rendered as large non-interactive cards in a centered single-column canvas
     - When the timer reaches zero and `correctChoiceIndex` is present, the correct choice card gets a green highlight (`correctChoiceStyle`)
     - No persistent side rail or sidebar layout is used, so narrow OBS scenes keep the prompt centered

4. **State transitions**
    - On `status === "closed"`: polling stops, no error shown (session ended gracefully)
    - On `pollError.status === 404`: polling stops, "Room not found" shown
    - When no active question exists: shows the most recently launched question if one exists; queued questions with no `startedAt` stay hidden and the overlay shows "Waiting for the next question..."
    - When a timed question expires, the overlay schedules an extra immediate poll so the answer reveal is not delayed by the normal 3s interval
    - `inFlight` guard prevents overlapping polls

## Reads
- `GET /api/sessions/:roomCode` (no `studentId` param) — 3s polling

## Writes
None. The overlay is a read-only projection.

## Constraints
- The overlay endpoint strips `votes` and `instructorToken` — aggregate bar counts are **not** available from this route.
- Only per-student `myVote` is injected when a `studentId` is provided (overlay never sends one).
- For aggregate results, the instructor must use the `/stats` endpoint (auth-protected).

## Files to Inspect
- `frontend/src/overlay/OBSOverlay.tsx`
- `frontend/src/common/SessionPollingController.ts`
- `frontend/src/common/session.ts` (`getActiveQuestion`, `getCountdownMs`)
