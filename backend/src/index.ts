import { handleGoogleAuth } from './handlers/auth';
import { resetClient, getInstructorByGoogleId } from './db';
import { HttpError, getDbContext, json, toErrorResponse } from './handlers/_shared';
import { handlePlans } from './handlers/plans';
import { handleSessions } from './handlers/sessions';

export interface Env {
  DB?: D1Database;
  FRONTEND_ORIGINS?: string;
  GOOGLE_CLIENT_ID: string;
}

function getAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowedOrigins = (env.FRONTEND_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return allowedOrigins.includes(origin) ? origin : null;
}

function addCors(request: Request, env: Env, res: Response): Response {
  const headers = new Headers(res.headers);
  const origin = getAllowedOrigin(request, env);
  headers.append('Vary', 'Origin');
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Response(res.body, { status: res.status, headers });
}

async function handlePing(url: URL, env: Env): Promise<Response> {
  const withDb = url.searchParams.get('db') === 'true';
  const start = Date.now();

  if (withDb) {
    const ctx = getDbContext(env);
    const result = await getInstructorByGoogleId(ctx, 'ping-test');
    return json({ ok: true, db: true, documentFound: result.document !== null, ms: Date.now() - start });
  }

  return json({ ok: true, db: false, ms: Date.now() - start });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const headers = new Headers({
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        Vary: 'Origin'
      });
      const origin = getAllowedOrigin(request, env);
      if (origin) headers.set('Access-Control-Allow-Origin', origin);
      return new Response(null, {
        headers
      });
    }

  try {
      if (request.method === "GET" && url.pathname === "/api/ping") {
        return addCors(request, env, await handlePing(url, env));
      }

      if (request.method === "POST" && url.pathname === "/api/auth/google") {
        return addCors(request, env, await handleGoogleAuth(request, env));
      }

      const planRes = await handlePlans(request, env);
      if (planRes) return addCors(request, env, planRes);

      const sessionRes = await handleSessions(request, env);
      if (sessionRes) return addCors(request, env, sessionRes);

      return addCors(request, env, toErrorResponse(new HttpError(404, 'NOT_FOUND', 'Not found')));
    } catch (error) {
      console.error('Worker error:', error instanceof Error ? error.message : String(error));
      await resetClient().catch(() => {});
      return addCors(request, env, toErrorResponse(error));
    }
  }
};
