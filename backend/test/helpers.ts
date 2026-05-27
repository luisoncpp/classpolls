import { afterEach, vi } from 'vitest';

export const env = {
  DB: {} as any,
  FRONTEND_ORIGINS: 'http://localhost:5173,https://classpolls.pages.dev',
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
};

export function resetTime(value = 1_700_000_000_000) {
  vi.spyOn(Date, 'now').mockReturnValue(value);
}

export async function run(path: string, init?: RequestInit, overrides: Partial<typeof env> = {}): Promise<Response> {
  const { default: worker } = await import('../src/index');
  return worker.fetch(new Request(`http://example.com${path}`, init), { ...env, ...overrides });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
