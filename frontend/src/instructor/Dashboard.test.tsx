import { fireEvent, render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider, LanguageSelector } from '../common/i18n';
import { Dashboard } from './Dashboard';

const authState = { roomCode: null as string | null, token: null as string | null };
const { requestJsonMock, clearInstructorTokenMock, mountButtonMock } = vi.hoisted(() => ({
  clearInstructorTokenMock: vi.fn(() => {
    authState.roomCode = null;
    authState.token = null;
  }),
  mountButtonMock: vi.fn(),
  requestJsonMock: vi.fn()
}));

vi.mock('../common/apiClient', () => ({
  clearInstructorRoomCode: vi.fn(() => {
    authState.roomCode = null;
  }),
  clearInstructorToken: clearInstructorTokenMock,
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Request failed',
  getInstructorRoomCode: vi.fn(() => authState.roomCode),
  getInstructorToken: vi.fn(() => authState.token),
  requestJson: requestJsonMock,
  setInstructorRoomCode: vi.fn((roomCode: string) => {
    authState.roomCode = roomCode;
  }),
  setInstructorToken: vi.fn((token: string) => {
    authState.token = token;
  })
}));

vi.mock('./Private/GoogleAuth', () => ({
  GoogleAuth: class {
    constructor(_clientId: string, private onCredential: (jwt: string) => void) {}

    mountButton(element: HTMLElement) {
      mountButtonMock();
      element.replaceChildren();
      const button = document.createElement('button');
      button.textContent = 'Login with Google';
      button.type = 'button';
      button.onclick = () => this.onCredential('jwt-token');
      element.append(button);
    }
  }
}));

vi.mock('./Private/PlanManager', () => ({
  PlanManager: () => <div>Plan manager</div>
}));

vi.mock('./ClassroomControls', () => ({
  ClassroomControls: () => <div>Live classroom</div>
}));

describe('Dashboard', () => {
  afterEach(() => {
    authState.roomCode = null;
    authState.token = null;
    clearInstructorTokenMock.mockReset();
    mountButtonMock.mockReset();
    requestJsonMock.mockReset();
    vi.unstubAllEnvs();
  });

  it('swaps the Google button correctly on login and logout', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
    requestJsonMock.mockResolvedValue({ instructorToken: 'st_token' });

    render(<Dashboard />);

    const loginButton = await screen.findByRole('button', { name: 'Login with Google' });
    expect(mountButtonMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(loginButton);
      await Promise.resolve();
    });

    expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login with Google' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
      await Promise.resolve();
    });

    expect(await screen.findByRole('button', { name: 'Login with Google' })).toBeInTheDocument();
    expect(clearInstructorTokenMock).toHaveBeenCalledTimes(1);
    expect(mountButtonMock).toHaveBeenCalledTimes(2);
  });

  it('switches dashboard copy to spanish and persists it', async () => {
    render(<I18nProvider><LanguageSelector /><Dashboard /></I18nProvider>);

    expect(screen.getByText('Instructor Dashboard')).toBeInTheDocument();

    await act(async () => {
      fireEvent.input(screen.getByRole('combobox'), { currentTarget: { value: 'es' }, target: { value: 'es' } });
      await Promise.resolve();
    });

    expect(screen.getByText('Panel del instructor')).toBeInTheDocument();
    expect(window.localStorage.getItem('cp.language')).toBe('es');
  });
});
