import { handleGoogleAuth } from './handlers/auth';
import { resetClient, getInstructorByGoogleId } from './db';
import { HttpError, getDbContext, json, toErrorResponse } from './handlers/_shared';
import { handlePlans } from './handlers/plans';
import { handleSessions } from './handlers/sessions';

export interface Env {
  DB?: D1Database;
  GOOGLE_CLIENT_ID: string;
}

function addCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
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
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    }

  try {
      if (request.method === "GET" && url.pathname === "/api/ping") {
        return addCors(await handlePing(url, env));
      }

      if (request.method === "POST" && url.pathname === "/api/auth/google") {
        return addCors(await handleGoogleAuth(request, env));
      }

      const planRes = await handlePlans(request, env);
      if (planRes) return addCors(planRes);

      const sessionRes = await handleSessions(request, env);
      if (sessionRes) return addCors(sessionRes);

      return addCors(toErrorResponse(new HttpError(404, 'NOT_FOUND', 'Not found')));
    } catch (error) {
      console.error('Worker error:', error instanceof Error ? error.message : String(error));
      await resetClient().catch(() => {});
      return addCors(toErrorResponse(error));
    }
  }
};
