import { requestJson } from '../../common/apiClient';

type PendingVote = {
  choiceIndex: number;
  missedPolls: number;
  questionId: string;
};

export class VoteDispatcher {
  private pendingVote: PendingVote | null = null;

  constructor(
    private roomCode: string,
    private studentId: string,
    private onChange: () => void
  ) {}

  public getDisplayedVote(questionId: string, serverVote: number | null | undefined): number | null {
    if (!this.pendingVote || this.pendingVote.questionId !== questionId) return serverVote ?? null;
    return serverVote ?? this.pendingVote.choiceIndex;
  }

  public isSubmitting(questionId: string): boolean {
    return this.pendingVote?.questionId === questionId;
  }

  public async submitVote(questionId: string, choiceIndex: number): Promise<void> {
    this.pendingVote = { choiceIndex, missedPolls: 0, questionId };
    this.onChange();
    await requestJson(`/api/sessions/${this.roomCode}/vote`, {
      body: { choiceIndex, questionId, studentId: this.studentId },
      method: 'POST'
    });
  }

  public sync(questionId: string | null, serverVote: number | null | undefined): void {
    if (!this.pendingVote) return;
    if (!questionId || questionId !== this.pendingVote.questionId) return this.clearPendingVote();
    if (serverVote === this.pendingVote.choiceIndex) return this.clearPendingVote();
    if (serverVote !== null && serverVote !== undefined) return this.clearPendingVote();
    this.pendingVote.missedPolls += 1;
    if (this.pendingVote.missedPolls >= 2) this.clearPendingVote();
  }

  private clearPendingVote(): void {
    this.pendingVote = null;
    this.onChange();
  }
}
