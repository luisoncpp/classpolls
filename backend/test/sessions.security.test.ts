import { describe, expect, it, vi } from 'vitest';
import { run } from './helpers';

function oid(hex: string) {
  return { toHexString: () => hex };
}

const db = vi.hoisted(() => ({
  activateQuestion: vi.fn(),
  addCustomQuestion: vi.fn(),
  closeSession: vi.fn(),
  createSession: vi.fn(),
  deactivateQuestion: vi.fn(),
  getPlanById: vi.fn(),
  getSession: vi.fn(),
  getSessionStats: vi.fn(),
  resetClient: vi.fn().mockResolvedValue(undefined),
  registerVote: vi.fn()
}));

vi.mock('../src/db/index', async () => ({
  activateQuestion: db.activateQuestion,
  addCustomQuestion: db.addCustomQuestion,
  closeSession: db.closeSession,
  createSession: db.createSession,
  deactivateQuestion: db.deactivateQuestion,
  getPlanById: db.getPlanById,
  getSession: db.getSession,
  getSessionStats: db.getSessionStats,
  registerVote: db.registerVote,
  resetClient: db.resetClient
}));

describe('session security regressions', () => {
  it('POST /api/sessions rejects plan ids owned by another instructor', async () => {
    vi.mocked(db.getPlanById).mockResolvedValue({
      document: {
        _id: oid('64f000000000000000000010'),
        instructorToken: 'st_other',
        questions: [{ choices: ['A', 'B'], questionId: 'q_1', text: 'Q1' }]
      }
    } as never);

    const response = await run('/api/sessions', {
      body: JSON.stringify({ planId: '64f000000000000000000010' }),
      headers: { Authorization: 'Bearer st_owner', 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' }
    });
    expect(db.createSession).not.toHaveBeenCalled();
  });

  it('POST /api/sessions/:roomCode/vote rejects student ids that are not UUIDs', async () => {
    vi.mocked(db.getSession).mockResolvedValue({
      document: {
        questions: [{ choices: ['A', 'B'], isActive: true, questionId: 'q_1' }],
        roomCode: 'ABCD',
        status: 'active'
      }
    } as never);

    const response = await run('/api/sessions/ABCD/vote', {
      body: JSON.stringify({ choiceIndex: 1, questionId: 'q_1', studentId: '11111111-1111-1111-1111-111111111111.bad' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_VOTE', message: 'Vote payload is invalid' }
    });
    expect(db.registerVote).not.toHaveBeenCalled();
  });

  it('POST /api/sessions/:roomCode/vote rejects choice indexes outside the question range', async () => {
    vi.mocked(db.getSession).mockResolvedValue({
      document: {
        questions: [{ choices: ['A', 'B'], isActive: true, questionId: 'q_1' }],
        roomCode: 'ABCD',
        status: 'active'
      }
    } as never);

    const response = await run('/api/sessions/ABCD/vote', {
      body: JSON.stringify({ choiceIndex: 2, questionId: 'q_1', studentId: '11111111-1111-1111-1111-111111111111' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_VOTE', message: 'Vote payload is invalid' }
    });
    expect(db.registerVote).not.toHaveBeenCalled();
  });
});
