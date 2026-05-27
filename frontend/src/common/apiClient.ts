const INSTRUCTOR_TOKEN_KEY = 'cp.instructorToken';
const INSTRUCTOR_ROOM_CODE_KEY = 'cp.instructorRoomCode';

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

type RequestOptions = {
  body?: unknown;
  method?: string;
  token?: string;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export function clearInstructorToken(): void {
  window.localStorage.removeItem(INSTRUCTOR_TOKEN_KEY);
  clearInstructorRoomCode();
}

export function clearInstructorRoomCode(): void {
  window.localStorage.removeItem(INSTRUCTOR_ROOM_CODE_KEY);
}

export function getInstructorToken(): string | null {
  return window.localStorage.getItem(INSTRUCTOR_TOKEN_KEY);
}

export function getInstructorRoomCode(): string | null {
  return window.localStorage.getItem(INSTRUCTOR_ROOM_CODE_KEY);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected request error';
}

function apiUrl(path: string): string {
  if (import.meta.env.VITE_API_ORIGIN && path.startsWith('/api/')) {
    return `${import.meta.env.VITE_API_ORIGIN}${path}`;
  }
  return path;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(apiUrl(path), createRequestInit(options));
  const body = await readResponseBody(response);
  if (response.ok) return body as T;
  if (response.status === 401 && options.token) clearInstructorToken();
  throw toApiError(body, response.status);
}

export function setInstructorToken(token: string): void {
  window.localStorage.setItem(INSTRUCTOR_TOKEN_KEY, token);
}

export function setInstructorRoomCode(roomCode: string): void {
  window.localStorage.setItem(INSTRUCTOR_ROOM_CODE_KEY, roomCode);
}

function createRequestInit(options: RequestOptions): RequestInit {
  const headers = new Headers();
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  return {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? 'GET'
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toApiError(body: unknown, status: number): ApiError {
  if (typeof body === 'string') {
    return new ApiError('REQUEST_FAILED', body, status);
  }
  const payload = body as ApiErrorPayload | null;
  const code = payload?.error?.code ?? 'REQUEST_FAILED';
  const message = payload?.error?.message ?? 'Request failed';
  return new ApiError(code, message, status);
}
