import { useEffect, useRef, useState } from 'preact/hooks';

import { getErrorMessage, getInstructorToken, requestJson, setInstructorToken } from '../common/apiClient';
import { ClassroomControls } from './ClassroomControls';
import { GoogleAuth } from './Private/GoogleAuth';
import { PlanManager } from './Private/PlanManager';

type SessionResponse = {
  roomCode: string;
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export function Dashboard() {
  const [token, setToken] = useState<string | null>(() => getInstructorToken());
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const authRef = useRef<GoogleAuth | null>(null);

  useEffect(() => mountGoogleButton(authRef, googleButtonRef, setError, setToken), []);

  return (
    <main style={layoutStyle}>
      <section style={panelStyle}>
        <h1>Instructor Dashboard</h1>
        {!token ? <div ref={googleButtonRef} /> : <p>Signed in.</p>}
        {error ? <p style={errorStyle}>{error}</p> : null}
      </section>
      {token ? <PlanManager onOpenClassroom={(planId) => void openClassroom(planId, setError, setRoomCode, token)} token={token} /> : null}
      {token && roomCode ? <ClassroomControls roomCode={roomCode} token={token} /> : null}
    </main>
  );
}

function mountGoogleButton(
  authRef: preact.RefObject<GoogleAuth | null>,
  googleButtonRef: preact.RefObject<HTMLDivElement | null>,
  setError: (value: string | null) => void,
  setToken: (value: string | null) => void
) {
  if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return;
  authRef.current ??= new GoogleAuth(GOOGLE_CLIENT_ID, async (jwt) => exchangeGoogleToken(jwt, setError, setToken));
  authRef.current.mountButton(googleButtonRef.current);
}

async function exchangeGoogleToken(
  jwt: string,
  setError: (value: string | null) => void,
  setToken: (value: string | null) => void
) {
  try {
    const response = await requestJson<{ instructorToken: string }>('/api/auth/google', { body: { idToken: jwt }, method: 'POST' });
    setInstructorToken(response.instructorToken);
    setToken(response.instructorToken);
    setError(null);
  } catch (error) {
    setError(getErrorMessage(error));
  }
}

async function openClassroom(
  planId: string,
  setError: (value: string | null) => void,
  setRoomCode: (value: string | null) => void,
  token: string
) {
  try {
    const response = await requestJson<SessionResponse>('/api/sessions', { body: { planId }, method: 'POST', token });
    setRoomCode(response.roomCode);
    setError(null);
  } catch (error) {
    setError(getErrorMessage(error));
  }
}

const errorStyle = { color: '#fca5a5' };
const layoutStyle = { color: '#f9fafb', display: 'grid', gap: '1.5rem', margin: '0 auto', maxWidth: '1100px', padding: '2rem' };
const panelStyle = { background: '#111827', borderRadius: '1.25rem', padding: '1.5rem' };
