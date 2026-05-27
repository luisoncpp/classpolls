import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env, run } from './helpers';

const db = vi.hoisted(() => ({
  getInstructorByGoogleId: vi.fn(),
  resetClient: vi.fn().mockResolvedValue(undefined),
  upsertInstructor: vi.fn()
}));

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
  jwtVerify: vi.fn()
}));

vi.mock('../src/db/index', async () => {
    return {
      getInstructorByGoogleId: db.getInstructorByGoogleId,
      resetClient: db.resetClient,
      upsertInstructor: db.upsertInstructor
    };
  });

beforeEach(() => {
  db.getInstructorByGoogleId.mockReset();
  db.upsertInstructor.mockReset();
  vi.mocked(jose.jwtVerify).mockReset();
});

describe('POST /api/auth/google', () => {
  it('upserts a new instructor and returns a fresh st_ token', async () => {
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload: { email: 'teach@example.com', name: 'Teacher', picture: 'https://example.com/p.png', sub: 'google-1' }
    } as never);
    vi.mocked(db.upsertInstructor).mockResolvedValue({ upsertedCount: 1 } as never);
    vi.mocked(db.getInstructorByGoogleId).mockResolvedValue({ document: null } as never);

    const response = await run('/api/auth/google', {
      body: JSON.stringify({ idToken: 'jwt' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });

    const body = await response.json<{ instructorToken: string }>();
    expect(response.status).toBe(200);
    expect(body.instructorToken).toMatch(/^st_/);
    expect(db.upsertInstructor).toHaveBeenCalledWith(
      expect.objectContaining({ db: env.DB }),
      'google-1',
      expect.objectContaining({ instructorToken: expect.stringMatching(/^st_/) })
    );
  });

  it('returns the stored instructor token on repeat sign-in', async () => {
    vi.mocked(jose.jwtVerify).mockResolvedValue({
      payload: { email: 'teach@example.com', name: 'Teacher', picture: 'https://example.com/p.png', sub: 'google-1' }
    } as never);
    vi.mocked(db.upsertInstructor).mockResolvedValue({ matchedCount: 1 } as never);
    vi.mocked(db.getInstructorByGoogleId).mockResolvedValue({
      document: { instructorToken: 'st_existing' }
    } as never);

    const response = await run('/api/auth/google', {
      body: JSON.stringify({ idToken: 'jwt' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ instructorToken: 'st_existing' });
    expect(db.upsertInstructor).toHaveBeenCalledOnce();
  });

  it('rejects an invalid Google token with 401 and no DB call', async () => {
    vi.mocked(jose.jwtVerify).mockRejectedValue(new Error('bad jwt'));

    const response = await run('/api/auth/google', {
      body: JSON.stringify({ idToken: 'bad' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_GOOGLE_TOKEN', message: 'Google token verification failed' }
    });
    expect(db.upsertInstructor).not.toHaveBeenCalled();
  });
});
