import { handleGoogleAuth } from './handlers/auth';
import { HttpError, toErrorResponse } from './handlers/_shared';
import { handlePlans } from './handlers/plans';
import { handleSessions } from './handlers/sessions';

export interface Env {
  LOCAL_DEV_NO_CACHE?: string;
  MONGODB_DATABASE: string;
  MONGODB_URI: string;
  GOOGLE_CLIENT_ID: string;
}

function addCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return new Response(res.body, { status: res.status, headers });
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
      if (request.method === "POST" && url.pathname === "/api/auth/google") {
        return addCors(await handleGoogleAuth(request, env));
      }

      const planRes = await handlePlans(request, env);
      if (planRes) return addCors(planRes);

      const sessionRes = await handleSessions(request, env);
      if (sessionRes) return addCors(sessionRes);

      return addCors(toErrorResponse(new HttpError(404, 'NOT_FOUND', 'Not found')));
    } catch (error) {
      return addCors(toErrorResponse(error));
    }
  }
};
