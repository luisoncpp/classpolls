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
- A random UUID (`studentId`) is generated and stored in `localStorage`.
- Appended to polling requests and vote submissions.
- The UI disables selection keys based on server-confirmed voting.
- To prevent clock drift issues, the client interpolates the `timeLimit` countdown locally using the `startedAt` backend timestamp.

---

## 3. UI Component View Breakdown

### 3.1 Instructor Dashboard
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
