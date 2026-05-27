import { Env } from '../index';
import { verifyGoogleToken } from '../auth/google';
import * as db from '../db/index';
import { HttpError, getDbContext, json, parseBody } from './_shared';

function generateInstructorToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `st_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function handleGoogleAuth(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ idToken?: string }>(request);
  if (!body.idToken) {
    throw new HttpError(400, 'MISSING_ID_TOKEN', 'Missing Google ID token');
  }

  let payload: any;
  try {
    payload = await verifyGoogleToken(body.idToken, env.GOOGLE_CLIENT_ID);
  } catch (e) {
    console.error('Google token verification failed:', e instanceof Error ? e.message : String(e));
    throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'Google token verification failed');
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
  return typeof existing.document?.instructorToken === 'string' ? existing.document.instructorToken : newToken;
}
