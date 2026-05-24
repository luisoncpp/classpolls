import { afterEach, vi } from 'vitest';

export const env = {
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  MONGODB_DATABASE: 'classpolls',
  MONGODB_URI: 'mongodb://mongo.test/classpolls'
};

export function resetTime(value = 1_700_000_000_000) {
  vi.spyOn(Date, 'now').mockReturnValue(value);
}

export async function run(path: string, init?: RequestInit): Promise<Response> {
  const { default: worker } = await import('../src/index');
  return worker.fetch(new Request(`http://example.com${path}`, init), env);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
