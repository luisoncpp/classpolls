import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionPollingController } from './SessionPollingController';

describe('SessionPollingController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores constructor state without scheduling polling', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const onUpdate = vi.fn();
    const controller = new SessionPollingController('ABCD', onUpdate, 'student-1');
    const privateState = controller as unknown as {
      currentRoomCode: string;
      onUpdateCallback: typeof onUpdate;
      studentId?: string;
      timerId: number | null;
    };

    expect(privateState.currentRoomCode).toBe('ABCD');
    expect(privateState.onUpdateCallback).toBe(onUpdate);
    expect(privateState.studentId).toBe('student-1');
    expect(privateState.timerId).toBeNull();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('starts and stops polling only once', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const controller = new SessionPollingController('ABCD', vi.fn(), 'student-1');

    controller.startPolling();
    controller.startPolling();
    controller.stopPolling();
    controller.stopPolling();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('polls the student session endpoint and publishes the response', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ status: 'active' })
    });
    vi.stubGlobal('fetch', fetchSpy);
    const onUpdate = vi.fn();
    const controller = new SessionPollingController('ABCD', onUpdate, 'student-1');

    controller.startPolling();
    await vi.advanceTimersByTimeAsync(3000);
    controller.stopPolling();

    expect(fetchSpy).toHaveBeenCalledWith('/api/sessions/ABCD?studentId=student-1');
    expect(onUpdate).toHaveBeenCalledWith({ status: 'active' });
  });

  it('polls the overlay session endpoint without a student id', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ status: 'closed' })
    });
    vi.stubGlobal('fetch', fetchSpy);
    const controller = new SessionPollingController('WXYZ', vi.fn());

    controller.startPolling();
    await vi.advanceTimersByTimeAsync(3000);
    controller.stopPolling();

    expect(fetchSpy).toHaveBeenCalledWith('/api/sessions/WXYZ');
  });

  it('does not overlap polling requests while one is still running', async () => {
    vi.useFakeTimers();
    type PendingResponse = { json: () => Promise<{ status: string }> };
    const deferred = { resolve: null as ((value: PendingResponse) => void) | null };
    const fetchSpy = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          deferred.resolve = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchSpy);
    const controller = new SessionPollingController('ABCD', vi.fn(), 'student-1');

    controller.startPolling();
    await vi.advanceTimersByTimeAsync(9000);

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    if (deferred.resolve) deferred.resolve({ json: () => Promise.resolve({ status: 'active' }) });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(3000);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    controller.stopPolling();
  });
});
