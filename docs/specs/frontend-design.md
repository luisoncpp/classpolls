# Frontend Technical Specification (Preact + TypeScript)

## 1. Core Principles
- **Framework:** Preact + TypeScript for rapid rendering, minimal footprint, and 100% free hosting deployment on Cloudflare Pages.
- **State Management:** Avoids cascading hook networks. Workflows are governed by standard TypeScript classes equipped with lightweight event mechanisms.
- **Component Limits:** Adheres to maximum 200 lines per file, maximum 30 lines per function, and strict parameter caps.

---

## 2. Architecture & State Handlers

### 2.1 The Polling Controller Class
Student and instructor modules rely on clean state controller entities.

```ts
export class SessionPollingController {
  private timerId: number | null = null;
  private currentRoomCode: string;
  private studentId?: string;
  private onUpdateCallback: (data: any) => void;

  constructor(roomCode: string, onUpdate: (data: any) => void, studentId?: string) {
    this.currentRoomCode = roomCode;
    this.studentId = studentId;
    this.onUpdateCallback = onUpdate;
  }

  public startPolling(): void {
    if (this.timerId) return;
    this.timerId = window.setInterval(
      /*handler=*/ () => this.fetchState(),
      /*delayInMs=*/ 3000
    );
  }

  public stopPolling(): void {
    if (!this.timerId) return;
    window.clearInterval(this.timerId);
    this.timerId = null;
  }

  private async fetchState(): Promise<void> {
    const query = this.studentId ? `?studentId=${this.studentId}` : '';
    const response = await fetch(`/api/sessions/${this.currentRoomCode}${query}`);
    const data = await response.json();
    this.onUpdateCallback(data);
  }
}
```

### 2.2 Client-Side Identity & Voting
- **Instructor Authentication:** Instructors authenticate via the Google Identity Services popup/redirect. The client receives a Google JWT (`credential`) and sends it to `POST /api/auth/google`. The backend responds with a custom `instructorToken` saved in `localStorage`.
- **Student Identity (Anonymous):** A random UUID (`studentId`) is generated via `crypto.randomUUID()` and stored in `localStorage` under key `cp.studentId`. Appended to polling requests and vote submissions.
- **`instructorToken` storage:** `localStorage` under key `cp.instructorToken`. Cleared on 401 from any protected endpoint (token rotated server-side).
- The UI disables selection buttons based on the **server-confirmed** `myVote` field returned by the next poll cycle — optimistic locks are reverted if the server doesn't echo the vote within 2 polls.
- To prevent clock drift issues, the client interpolates the `timeLimit` countdown locally using the `startedAt` backend timestamp (ISO-8601 string — `new Date(startedAt).getTime()`).

### 2.3 Google Identity Services Integration (Preact)
The GIS library is loaded once globally via a `<script>` tag in `index.html`:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```
Wiring lives in a class, not a hook, to honor `GUIDELINES.md` §"Hooks vs Classes" and to dodge Preact StrictMode double-init:

```ts
// frontend/src/instructor/Private/GoogleAuth.ts
declare const google: any;

export class GoogleAuth {
  private initialized = false;
  constructor(private clientId: string, private onCredential: (jwt: string) => void) {}

  public mountButton(el: HTMLElement): void {
    if (!this.initialized) {
      google.accounts.id.initialize({
        client_id: this.clientId,
        callback: /*onCredentialResponse=*/ (resp: { credential: string }) => this.onCredential(resp.credential),
      });
      this.initialized = true;
    }
    google.accounts.id.renderButton(el, { theme: "outline", size: "large" });
  }
}
```
The `<Dashboard />` component creates one `GoogleAuth` instance in a `useRef` (or class-property if the component is itself a class) and calls `mountButton` from a `useEffect` keyed on a `div` ref. On `onCredential`, POST to `/api/auth/google`, store the returned `instructorToken`.

### 2.4 Polling Controller Stop Conditions
`stopPolling()` must be called explicitly when:
1. **Component unmount** — `useEffect` cleanup, or class `componentWillUnmount`.
2. **`status === "closed"`** in the polled response — the room is over; further polls are wasted.
3. **HTTP 404** on a poll — room was deleted or `roomCode` was invalid; show a "room not found" state.
4. **Navigation away** from the route — handled implicitly by (1) if the controller is owned by the view component.

A polling controller that survives a `status === "closed"` response is a bug. The view layer is responsible for surfacing the closure to the user; the controller is responsible for not wasting requests.

### 2.5 Response Shapes (Authoritative)
The frontend consumes the response schemas defined in [`backend-design.md`](../specs/backend-design.md) §5. The two most load-bearing:
- **`GET /api/sessions/:roomCode`** → `backend-design.md` §5.4. Note: `myVote` is **absent** when no `studentId` is sent (overlay case), `null` when sent but no vote yet, and `number` after voting.
- **Errors** → `{error: {code, message}}` per `backend-design.md` §2.2. Branch on `code`, display `message`.
- Persistence is backend-internal. The frontend must not assume Atlas/Data API-specific behavior; it only depends on the HTTP contract above.

---

## 3. UI Component View Breakdown

### 3.1 Instructor Dashboard
- **Login View:** Contains the "Sign in with Google" button.
- **Plan Manager:** List plans, visualize details, add/remove questions with `timeLimit` and `correctChoiceIndex`, and delete plans.
- **Classroom Controls:** View for launching an ephemeral session from a plan. Can activate questions or launch a "Custom Question".
- **Statistics Graph View:** Renders real-time response bars.
- **Export Control:** Parses final vote dictionaries into a CSV string.

### 3.2 Student Remote Interface
- **Room Join View:** Simple input box for the `roomCode`.
- **Staging Idle View:** "Waiting for the instructor..." placeholder.
- **Interactive Option Grid:** Rendered dynamically generating buttons mapped to `choices`.

### 3.3 OBS / Projection Overlay View
- **Route:** `/overlay/:roomCode`
- **Data Display:** Shows the current question text and real-time choice bars.
- **Countdown Display:** If `timeLimit` is set and the question is `isActive`, renders a countdown timer calculating `startedAt + timeLimit - currentTime`.
- **Answer Reveal:** Once `isActive` becomes `false` (voting closed), if `correctChoiceIndex` is set, the overlay highlights the correct choice bar (e.g., turning it green) to provide immediate resolution to the class. Excludes all interactive inputs.

---

## 4. Directory Layout (post-Phase-5)
```
frontend/src/
├── main.tsx              # Preact entry; wires router → instructor / student / overlay
├── common/
│   ├── identity.ts       # cp.studentId bootstrap (crypto.randomUUID + localStorage)
│   ├── SessionPollingController.ts
│   └── apiClient.ts      # fetch wrapper: applies Bearer header, parses {error:{code,message}}
├── instructor/
│   ├── index.ts          # exports <Dashboard />, <ClassroomControls />
│   ├── Dashboard.tsx
│   ├── ClassroomControls.tsx
│   └── Private/
│       ├── GoogleAuth.ts        # GIS class, see §2.3
│       ├── PlanManager.tsx
│       └── StatsView.tsx
├── student/
│   ├── index.ts          # exports <RoomJoin />, <Grid />
│   ├── RoomJoin.tsx
│   ├── Grid.tsx
│   └── Private/
│       └── VoteDispatcher.ts    # POST /vote + optimistic lock + 2-poll revert
└── overlay/
    ├── index.ts          # exports <OBSOverlay />
    └── OBSOverlay.tsx
```
Files inside `Private/` may only be imported by siblings within the same deep module — enforced by code review per `GUIDELINES.md` §"Deep Modules".
