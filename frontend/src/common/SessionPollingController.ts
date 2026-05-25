import { PollError, PublicSession } from './session';

const POLL_INTERVAL_IN_MS = 3000;

type SessionUpdate = PollError | PublicSession;
type OnUpdate = (data: SessionUpdate) => void;

export class SessionPollingController {
  private inFlight = false;
  private timerId: number | null = null;

  constructor(
    private currentRoomCode: string,
    private onUpdateCallback: OnUpdate,
    private studentId?: string
  ) {}

  public pollNow(): void {
    void this.fetchState();
  }

  public startPolling(): void {
    if (this.timerId !== null) return;

    this.timerId = window.setInterval(
      /*pollSession=*/ () => void this.fetchState(),
      /*delayInMs=*/ POLL_INTERVAL_IN_MS
    );
  }

  public stopPolling(): void {
    if (this.timerId === null) return;

    window.clearInterval(this.timerId);
    this.timerId = null;
  }

  private async fetchState(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const response = await fetch(this.getPollingUrl());
      if ('ok' in response && !response.ok) return this.onUpdateCallback({ pollError: { status: response.status } });
      const data = (await response.json()) as PublicSession;
      this.onUpdateCallback(data);
    } catch {
      this.onUpdateCallback({ pollError: { status: 0 } });
    } finally {
      this.inFlight = false;
    }
  }

  private getPollingUrl(): string {
    if (!this.studentId) return `/api/sessions/${this.currentRoomCode}`;
    return `/api/sessions/${this.currentRoomCode}?studentId=${this.studentId}`;
  }
}
