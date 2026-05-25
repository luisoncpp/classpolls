# Flow: Instructor Runs a Live Session

## Trigger
Instructor clicks "Open classroom" on a plan from the Dashboard.

## Entry Point
`instructor/Dashboard.tsx` → `openClassroom()` → `POST /api/sessions`

## Sequence

1. **Login** (if not already)
   - `/instructor` → `GoogleAuth.mountButton()` renders GIS button
   - Sign-in → `POST /api/auth/google` → backend verifies JWT → returns `instructorToken`
   - Token stored in `localStorage` (`cp.instructorToken`)

2. **Plan management**
    - `GET /api/plans` → `PlanManager` renders plan list
    - "Create plan" → `POST /api/plans` with `{ title }` → returns `planId`, list refreshes
   - "Edit questions" → `GET /api/plans/:planId` loads the full plan editor
   - Question templates prefill common choice sets (Yes/No, A/B/C/D, Confidence 1-5, Custom)
   - "Add question" → `POST /api/plans/:planId/questions` with `{ text, choices, timeLimit?, correctChoiceIndex? }`
   - "Remove" → `DELETE /api/plans/:planId/questions/:questionId`, detail refreshes
    - "Delete" → `DELETE /api/plans/:planId`, list refreshes

3. **Open classroom**
   - "Open classroom" on a plan → `POST /api/sessions` with `{ planId }` → returns `{ roomCode }`
   - `ClassroomControls` replaces the plan list

4. **Activate a question**
   - Click "Activate" on any question card → `POST /api/sessions/:roomCode/questions/:questionId/activate`
   - Stats polling (`/api/sessions/:roomCode/stats` via `Authorization: Bearer`) updates every 3s (chained `setTimeout`, non-overlapping)

5. **Custom question**
   - Pick a template or write from scratch, including optional `timeLimit` and `correctChoiceIndex`
   - Click "Launch custom question" → `POST /api/sessions/:roomCode/questions/custom` with `{ activate: true, text, choices, timeLimit?, correctChoiceIndex? }`
   - Question appears immediately; stats refresh

6. **Close room**
   - Click "Close room" → `POST /api/sessions/:roomCode/close`
   - Stats polling stops on next update: `status === "closed"`

## Reads
- `GET /api/plans` — list plans
- `GET /api/sessions/:roomCode/stats` — full vote maps + question state (3s poll)

## Writes
- `POST /api/auth/google` — login
- `POST /api/plans` — create plan
- `GET /api/plans/:planId` — load one editable plan
- `POST /api/plans/:planId/questions` — add one reusable question
- `DELETE /api/plans/:planId/questions/:questionId` — remove one reusable question
- `DELETE /api/plans/:planId` — delete plan
- `POST /api/sessions` — create room
- `POST /api/sessions/:roomCode/questions/:questionId/activate`
- `POST /api/sessions/:roomCode/questions/custom`
- `POST /api/sessions/:roomCode/close`

## Side Effects
- Student and overlay views begin seeing question changes within one poll cycle (3s).
- No database rollback on any step — destructive actions (close, activate) are immediate.

## Files to Inspect
- `frontend/src/instructor/Dashboard.tsx`
- `frontend/src/instructor/ClassroomControls.tsx`
- `frontend/src/instructor/Private/PlanManager.tsx`
- `frontend/src/instructor/Private/QuestionEditor.tsx`
- `frontend/src/instructor/Private/questionDraft.ts`
- `frontend/src/instructor/Private/GoogleAuth.ts`
- `backend/src/handlers/sessions.ts`
- `backend/src/handlers/plans.ts`
