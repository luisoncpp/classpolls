import { DbContext } from '../db';
import { Env } from '../index';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function badRequest(code: string, message: string): never {
  throw new HttpError(400, code, message);
}

export function conflict(code: string, message: string): never {
  throw new HttpError(409, code, message);
}

export function getDbContext(env: Env): DbContext {
  if (!env.DB) throw new HttpError(500, 'DB_NOT_CONFIGURED', 'Database not configured');
  return {
    db: env.DB
  };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status
  });
}

export function normalizeDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if ('$date' in value) return (value as { $date: string }).$date;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, normalizeDates(entry)])
  );
}

export function parseBody<T>(request: Request): Promise<T> {
  return request.json().then((body) => body as T).catch(() => ({} as T));
}

export function readId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toHexString' in value) {
    return (value as { toHexString(): string }).toHexString();
  }
  if (value && typeof value === 'object' && '$oid' in value) {
    return String((value as { $oid: string }).$oid);
  }
  return '';
}

export function requireToken(request: Request): string {
  const auth = request.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    throw new HttpError(401, 'MISSING_TOKEN', 'Missing bearer token');
  }
  return auth.slice(7);
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: { code: error.code, message: error.message } }, error.status);
  }
  return json(
    { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } },
    500
  );
}
