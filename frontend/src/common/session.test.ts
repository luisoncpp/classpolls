import { describe, expect, it } from 'vitest';

import { getCountdownMs, getDisplayQuestion, isQuestionExpired, isQuestionOpen } from './session';

describe('session helpers', () => {
  const question = {
    choices: ['A', 'B'],
    isActive: true,
    questionId: 'q_1',
    startedAt: '2026-05-23T19:15:00.000Z',
    text: 'Q1',
    timeLimit: 30
  };

  it('detects when a question is still open', () => {
    const now = new Date('2026-05-23T19:15:10.000Z').getTime();

    expect(getCountdownMs(question, now)).toBe(20000);
    expect(isQuestionExpired(question, now)).toBe(false);
    expect(isQuestionOpen(question, now)).toBe(true);
  });

  it('detects when a question is expired', () => {
    const now = new Date('2026-05-23T19:15:31.000Z').getTime();

    expect(getCountdownMs(question, now)).toBe(0);
    expect(isQuestionExpired(question, now)).toBe(true);
    expect(isQuestionOpen(question, now)).toBe(false);
  });

  it('does not expose queued questions before any launch', () => {
    const session = {
      createdAt: '2026-05-23T19:00:00.000Z',
      questions: [{ choices: ['A', 'B'], isActive: false, questionId: 'q_1', text: 'Queued first question' }],
      roomCode: 'ABCD',
      status: 'active' as const
    };

    expect(getDisplayQuestion(session)).toBeNull();
  });

  it('keeps showing the most recent launched question when nothing is active', () => {
    const session = {
      createdAt: '2026-05-23T19:00:00.000Z',
      questions: [
        { choices: ['A', 'B'], isActive: false, questionId: 'q_1', startedAt: '2026-05-23T19:15:00.000Z', text: 'Launched question' },
        { choices: ['C', 'D'], isActive: false, questionId: 'q_2', text: 'Queued next question' }
      ],
      roomCode: 'ABCD',
      status: 'active' as const
    };

    expect(getDisplayQuestion(session)?.questionId).toBe('q_1');
  });
});
