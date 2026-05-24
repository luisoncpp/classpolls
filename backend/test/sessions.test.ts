import { describe, expect, it, vi } from 'vitest';
import { resetTime, run } from './helpers';

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
  registerVote: vi.fn()
}));

vi.mock('../src/db/index', async () => {
  return {
    activateQuestion: db.activateQuestion,
    addCustomQuestion: db.addCustomQuestion,
    closeSession: db.closeSession,
    createSession: db.createSession,
    deactivateQuestion: db.deactivateQuestion,
    getPlanById: db.getPlanById,
    getSession: db.getSession,
    getSessionStats: db.getSessionStats,
    registerVote: db.registerVote
  };
});

describe('sessions endpoints', () => {
  it('POST /api/sessions creates a room code and copies plan questions inactive', async () => {
    resetTime();
    vi.mocked(db.getPlanById).mockResolvedValue({
      document: {
        _id: oid('64f000000000000000000010'),
        questions: [{ choices: ['A', 'B'], questionId: 'q_1', text: 'Q1', timeLimit: 30 }]
      }
    } as never);
    vi.mocked(db.createSession).mockResolvedValue({ insertedId: oid('64f000000000000000000011') } as never);

    const response = await run('/api/sessions', {
      body: JSON.stringify({ planId: '64f000000000000000000010' }),
      headers: { Authorization: 'Bearer st_owner', 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ roomCode: expect.stringMatching(/^[A-Z2-9]{4}$/) });
    expect(db.createSession).toHaveBeenCalledWith(expect.any(Object), 'st_owner', {
      planId: '64f000000000000000000010',
      questions: [
        {
          choices: ['A', 'B'],
          isActive: false,
          questionId: 'q_1',
          text: 'Q1',
          timeLimit: 30,
          votes: {}
        }
      ],
      roomCode: expect.stringMatching(/^[A-Z2-9]{4}$/)
    });
  });

  it('GET /api/sessions/:roomCode strips instructorToken and votes but injects myVote', async () => {
    vi.mocked(db.getSession).mockResolvedValue({
      document: {
        createdAt: new Date('2026-05-23T19:00:00.000Z'),
        instructorToken: 'st_owner',
        questions: [
          {
            choices: ['A', 'B'],
            isActive: true,
            questionId: 'q_1',
            startedAt: new Date('2026-05-23T19:15:00.000Z'),
            text: 'Q1',
            timeLimit: 30,
            votes: { 'student-1': 1 }
          }
        ],
        roomCode: 'ABCD',
        status: 'active'
      }
    } as never);

    const response = await run('/api/sessions/ABCD?studentId=student-1', { method: 'GET' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      createdAt: '2026-05-23T19:00:00.000Z',
      questions: [
        {
          choices: ['A', 'B'],
          isActive: true,
          myVote: 1,
          questionId: 'q_1',
          startedAt: '2026-05-23T19:15:00.000Z',
          text: 'Q1',
          timeLimit: 30
        }
      ],
      roomCode: 'ABCD',
      status: 'active'
    });
  });

  it('GET /api/sessions/:roomCode for overlay omits myVote when studentId is absent', async () => {
    vi.mocked(db.getSession).mockResolvedValue({
      document: {
        createdAt: new Date('2026-05-23T19:00:00.000Z'),
        instructorToken: 'st_owner',
        questions: [{ choices: ['A', 'B'], isActive: false, questionId: 'q_1', text: 'Q1', votes: {} }],
        roomCode: 'ABCD',
        status: 'active'
      }
    } as never);

    const response = await run('/api/sessions/ABCD', { method: 'GET' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      createdAt: '2026-05-23T19:00:00.000Z',
      questions: [{ choices: ['A', 'B'], isActive: false, questionId: 'q_1', text: 'Q1' }],
      roomCode: 'ABCD',
      status: 'active'
    });
  });

  it('GET /api/sessions/:roomCode/stats returns full votes only to the owner token', async () => {
    vi.mocked(db.getSessionStats).mockResolvedValue({
      document: {
        instructorToken: 'st_owner',
        questions: [{ questionId: 'q_1', votes: { 'student-1': 1 } }],
        roomCode: 'ABCD',
        status: 'active'
      }
    } as never);

    const response = await run('/api/sessions/ABCD/stats', {
      headers: { Authorization: 'Bearer st_owner' },
      method: 'GET'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      instructorToken: 'st_owner',
      questions: [{ questionId: 'q_1', votes: { 'student-1': 1 } }],
      roomCode: 'ABCD',
      status: 'active'
    });
  });

  it('POST /api/sessions/:roomCode/questions/custom pushes a q_ question and can auto-activate', async () => {
    resetTime();
    vi.mocked(db.addCustomQuestion).mockResolvedValue({ modifiedCount: 1 } as never);

    const response = await run('/api/sessions/ABCD/questions/custom', {
      body: JSON.stringify({ activate: true, choices: ['A', 'B'], text: 'Live?' }),
      headers: { Authorization: 'Bearer st_owner', 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ questionId: expect.stringMatching(/^q_/) });
    expect(db.addCustomQuestion).toHaveBeenCalledWith(expect.any(Object), 'ABCD', {
      instructorToken: 'st_owner',
      question: expect.objectContaining({ isActive: true, questionId: expect.stringMatching(/^q_/) })
    });
  });

  it('POST /api/sessions/:roomCode/questions/:questionId/activate flips only one question active', async () => {
    vi.mocked(db.activateQuestion).mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as never);

    const response = await run('/api/sessions/ABCD/questions/q_1/activate', {
      headers: { Authorization: 'Bearer st_owner' },
      method: 'POST'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(db.activateQuestion).toHaveBeenCalledWith(expect.any(Object), 'ABCD', {
      instructorToken: 'st_owner',
      questionId: 'q_1'
    });
  });

  it('POST /api/sessions/:roomCode/questions/deactivate only deactivates the active question', async () => {
    vi.mocked(db.deactivateQuestion).mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as never);

    const response = await run('/api/sessions/ABCD/questions/deactivate', {
      headers: { Authorization: 'Bearer st_owner' },
      method: 'POST'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(db.deactivateQuestion).toHaveBeenCalledWith(expect.any(Object), 'ABCD', 'st_owner');
  });

  it('POST /api/sessions/:roomCode/vote writes a vote only for an active, unexpired question', async () => {
    vi.mocked(db.registerVote).mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as never);

    const response = await run('/api/sessions/ABCD/vote', {
      body: JSON.stringify({ choiceIndex: 1, questionId: 'q_1', studentId: 'student-1' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(db.registerVote).toHaveBeenCalledWith(expect.any(Object), 'ABCD', {
      choiceIndex: 1,
      questionId: 'q_1',
      studentId: 'student-1'
    });
  });

  it('POST /api/sessions/:roomCode/vote rejects expired questions without writing', async () => {
    vi.mocked(db.registerVote).mockResolvedValue({ matchedCount: 0, modifiedCount: 0 } as never);

    const response = await run('/api/sessions/ABCD/vote', {
      body: JSON.stringify({ choiceIndex: 1, questionId: 'q_1', studentId: 'student-2' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: 'VOTE_EXPIRED', message: 'Voting window closed' }
    });
  });

  it('POST /api/sessions/:roomCode/close marks the session closed', async () => {
    vi.mocked(db.closeSession).mockResolvedValue({ matchedCount: 1, modifiedCount: 1 } as never);

    const response = await run('/api/sessions/ABCD/close', {
      headers: { Authorization: 'Bearer st_owner' },
      method: 'POST'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(db.closeSession).toHaveBeenCalledWith(expect.any(Object), 'ABCD', 'st_owner');
  });
});
