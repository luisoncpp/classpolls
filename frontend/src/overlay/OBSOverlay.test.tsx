import { render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../common/i18n';
import { OBSOverlay } from './OBSOverlay';

const { pollNowMock, startPollingMock, stopPollingMock } = vi.hoisted(() => ({
  pollNowMock: vi.fn(),
  startPollingMock: vi.fn(),
  stopPollingMock: vi.fn()
}));

vi.mock('../common/SessionPollingController', () => ({
  SessionPollingController: class {
    constructor(_roomCode: string, onUpdate: (value: unknown) => void) {
      queueMicrotask(() => {
        onUpdate({
          createdAt: '2026-05-23T19:00:00.000Z',
          questions: [{ choices: ['A', 'B'], isActive: false, questionId: 'q_1', text: 'Queued first question' }],
          roomCode: 'ROOM',
          status: 'active'
        });
      });
    }

    pollNow() {
      pollNowMock();
    }

    startPolling() {
      startPollingMock();
    }

    stopPolling() {
      stopPollingMock();
    }
  }
}));

describe('OBSOverlay', () => {
  it('does not show queued questions before activation', async () => {
    render(<I18nProvider><OBSOverlay roomCode="ROOM" /></I18nProvider>);

    expect(await screen.findByText('Waiting for the next question...')).toBeInTheDocument();
    expect(screen.queryByText('Queued first question')).not.toBeInTheDocument();
  });
});
