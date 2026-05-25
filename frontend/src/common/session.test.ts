import { describe, expect, it } from 'vitest';

import { getCountdownMs, isQuestionExpired, isQuestionOpen } from './session';

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
});
