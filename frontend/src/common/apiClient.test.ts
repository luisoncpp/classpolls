import { describe, expect, it, vi } from 'vitest';

import { ApiError, requestJson } from './apiClient';

describe('apiClient', () => {
  it('turns non-json error bodies into ApiError messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Error: The Worker hung', { status: 500 })));

    await expect(requestJson('/api/test')).rejects.toEqual(new ApiError('REQUEST_FAILED', 'Error: The Worker hung', 500));
  });
});
