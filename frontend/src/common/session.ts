export type SessionQuestion = {
  choices: string[];
  correctChoiceIndex?: number;
  isActive: boolean;
  myVote?: number | null;
  questionId: string;
  startedAt?: string;
  text: string;
  timeLimit?: number;
};

export type PublicSession = {
  createdAt: string;
  questions: SessionQuestion[];
  roomCode: string;
  sessionId?: string;
  status: 'active' | 'closed';
};

export type PollError = {
  pollError: {
    status: number;
  };
};

export function getActiveQuestion(session: PublicSession): SessionQuestion | null {
  return session.questions.find((question) => question.isActive) ?? null;
}

export function getCountdownMs(question: SessionQuestion, now: number): number | null {
  if (!question.startedAt || typeof question.timeLimit !== 'number') return null;
  return Math.max(0, new Date(question.startedAt).getTime() + question.timeLimit * 1000 - now);
}

export function isPollError(update: PollError | PublicSession): update is PollError {
  return 'pollError' in update;
}
