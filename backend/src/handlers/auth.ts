import { Env } from '../index';
import { verifyGoogleToken } from '../auth/google';
import * as db from '../db/index';
import { HttpError, getDbContext, json, parseBody } from './_shared';

async function fallbackInstructorToken(googleId: string): Promise<string> {
  const bytes = new TextEncoder().encode(googleId);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `st_${hex.slice(0, 32)}`;
}

function generateInstructorToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `st_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function hasMongoConfig(env: Env): boolean {
  return Boolean(env.MONGODB_URI);
}

export async function handleGoogleAuth(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ idToken?: string }>(request);
  if (!body.idToken) {
    throw new HttpError(400, 'MISSING_ID_TOKEN', 'Missing Google ID token');
  }

  let payload: any;
  try {
    payload = await verifyGoogleToken(body.idToken, env.GOOGLE_CLIENT_ID);
  } catch {
    throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'Google token verification failed');
  }

  if (!hasMongoConfig(env)) {
    return json({ instructorToken: await fallbackInstructorToken(payload.sub) });
  }

  return json({ instructorToken: await upsertInstructor(getDbContext(env), payload) });
}

async function upsertInstructor(ctx: db.DbContext, payload: any): Promise<string> {
  const newToken = generateInstructorToken();
  await db.upsertInstructor(ctx, payload.sub, {
    email: payload.email,
    instructorToken: newToken,
    name: payload.name,
    picture: payload.picture
  });
  const existing = await db.getInstructorByGoogleId(ctx, payload.sub);
  return existing.document?.instructorToken ?? newToken;
}
