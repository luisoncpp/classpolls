import { render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClassroomControls } from './ClassroomControls';

const { requestJsonMock } = vi.hoisted(() => ({ requestJsonMock: vi.fn() }));

vi.mock('../common/apiClient', () => ({
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Request failed',
  requestJson: requestJsonMock
}));

describe('ClassroomControls', () => {
  afterEach(() => {
    requestJsonMock.mockReset();
    vi.useRealTimers();
  });

  it('keeps queue cards visible while polling refreshes session stats', async () => {
    vi.useFakeTimers();
    const session = { questions: [{ choices: ['Yes', 'No'], isActive: true, questionId: 'q1', text: 'First question', votes: {} }], roomCode: 'ROOM', status: 'active' as const };

    requestJsonMock.mockResolvedValueOnce(session);
    requestJsonMock.mockResolvedValue(session);

    const view = render(<ClassroomControls onRoomClosed={vi.fn()} roomCode="ROOM" token="token" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getAllByText('First question').length).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(screen.getAllByText('First question').length).toBeGreaterThan(0);
    expect(screen.getByText('1 loaded')).toBeInTheDocument();

    view.unmount();
  });

  it('keeps the queue badge text stable while a refresh is in flight', async () => {
    vi.useFakeTimers();
    const session = { questions: [{ choices: ['Yes', 'No'], isActive: true, questionId: 'q1', text: 'First question', votes: {} }], roomCode: 'ROOM', status: 'active' as const };
    let resolveRefresh: ((value: typeof session) => void) | null = null;

    requestJsonMock.mockResolvedValueOnce(session);
    requestJsonMock.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const view = render(<ClassroomControls onRoomClosed={vi.fn()} roomCode="ROOM" token="token" />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(screen.getByText('1 loaded')).toBeInTheDocument();
    expect(screen.queryByText(/refreshing/i)).not.toBeInTheDocument();

    await act(async () => {
      resolveRefresh?.(session);
      await Promise.resolve();
    });

    view.unmount();
  });
});
