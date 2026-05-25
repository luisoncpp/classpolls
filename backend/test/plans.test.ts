import { describe, expect, it, vi } from 'vitest';
import { run } from './helpers';

function oid(hex: string) {
  return { toHexString: () => hex };
}

const db = vi.hoisted(() => ({
  addQuestionToPlan: vi.fn(),
  createPlan: vi.fn(),
  deletePlan: vi.fn(),
  getPlan: vi.fn(),
  listPlans: vi.fn(),
  removeQuestionFromPlan: vi.fn()
}));

vi.mock('../src/db/index', async () => {
  return {
    addQuestionToPlan: db.addQuestionToPlan,
    createPlan: db.createPlan,
    deletePlan: db.deletePlan,
    getPlan: db.getPlan,
    listPlans: db.listPlans,
    removeQuestionFromPlan: db.removeQuestionFromPlan
  };
});

describe('plans endpoints', () => {
  it('GET /api/plans filters by instructor token and projects metadata only', async () => {
    vi.mocked(db.listPlans).mockResolvedValue({
      documents: [{ _id: oid('64f000000000000000000001'), title: 'Plan A' }]
    } as never);

    const response = await run('/api/plans', {
      headers: { Authorization: 'Bearer st_owner' },
      method: 'GET'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: '64f000000000000000000001', title: 'Plan A' }]);
    expect(db.listPlans).toHaveBeenCalledWith(expect.any(Object), 'st_owner');
  });

  it('POST /api/plans inserts a plan and returns planId', async () => {
    vi.mocked(db.createPlan).mockResolvedValue({ insertedId: oid('64f000000000000000000002') } as never);

    const response = await run('/api/plans', {
      body: JSON.stringify({ title: 'Queues' }),
      headers: { Authorization: 'Bearer st_owner', 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ planId: '64f000000000000000000002' });
    expect(db.createPlan).toHaveBeenCalledWith(expect.any(Object), 'st_owner', 'Queues');
  });

  it('GET /api/plans/:planId rejects cross-tenant access', async () => {
    vi.mocked(db.getPlan).mockResolvedValue({
      document: { _id: oid('64f000000000000000000099'), instructorToken: 'st_other', title: 'Other' }
    } as never);

    const response = await run('/api/plans/64f000000000000000000003', {
      headers: { Authorization: 'Bearer st_owner' },
      method: 'GET'
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' }
    });
  });

  it('DELETE /api/plans/:planId rejects cross-tenant deletion', async () => {
    vi.mocked(db.deletePlan).mockResolvedValue({ deletedCount: 0 } as never);

    const response = await run('/api/plans/64f000000000000000000004', {
      headers: { Authorization: 'Bearer st_owner' },
      method: 'DELETE'
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' }
    });
    expect(db.deletePlan).toHaveBeenCalledWith(expect.any(Object), 'st_owner', '64f000000000000000000004');
  });

  it('POST /api/plans/:planId/questions validates required fields and range checks', async () => {
    const response = await run('/api/plans/64f000000000000000000005/questions', {
      body: JSON.stringify({ choices: ['A', 'B'], correctChoiceIndex: 4 }),
      headers: { Authorization: 'Bearer st_owner', 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_QUESTION', message: 'Question payload is invalid' }
    });
    expect(db.addQuestionToPlan).not.toHaveBeenCalled();
  });

  it('POST /api/plans/:planId/questions persists time limit and correct answer', async () => {
    vi.mocked(db.addQuestionToPlan).mockResolvedValue({ modifiedCount: 1 } as never);

    const response = await run('/api/plans/64f000000000000000000005/questions', {
      body: JSON.stringify({
        choices: ['A', 'B', 'C'],
        correctChoiceIndex: 1,
        text: 'Choose one',
        timeLimit: 45
      }),
      headers: { Authorization: 'Bearer st_owner', 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(201);
    expect(db.addQuestionToPlan).toHaveBeenCalledWith(expect.any(Object), '64f000000000000000000005', {
      instructorToken: 'st_owner',
      question: expect.objectContaining({
        choices: ['A', 'B', 'C'],
        correctChoiceIndex: 1,
        text: 'Choose one',
        timeLimit: 45
      })
    });
  });

  it('POST /api/plans/:planId/questions rejects invalid time limits', async () => {
    const response = await run('/api/plans/64f000000000000000000005/questions', {
      body: JSON.stringify({ choices: ['A', 'B'], text: 'Choose one', timeLimit: -1 }),
      headers: { Authorization: 'Bearer st_owner', 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_QUESTION', message: 'Question payload is invalid' }
    });
  });

  it('DELETE /api/plans/:planId/questions/:questionId pulls the matching question', async () => {
    vi.mocked(db.removeQuestionFromPlan).mockResolvedValue({ modifiedCount: 1 } as never);

    const response = await run('/api/plans/64f000000000000000000006/questions/q_123', {
      headers: { Authorization: 'Bearer st_owner' },
      method: 'DELETE'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(db.removeQuestionFromPlan).toHaveBeenCalledWith(expect.any(Object), '64f000000000000000000006', {
      instructorToken: 'st_owner',
      questionId: 'q_123'
    });
  });
});
