import { useEffect, useRef, useState } from 'preact/hooks';

import { clearInstructorRoomCode, getErrorMessage, getInstructorRoomCode, getInstructorToken, requestJson, setInstructorRoomCode, setInstructorToken } from '../common/apiClient';
import { ClassroomControls } from './ClassroomControls';
import { GoogleAuth } from './Private/GoogleAuth';
import { PlanManager } from './Private/PlanManager';

type SessionResponse = {
  roomCode: string;
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

export function Dashboard() {
  const [token, setToken] = useState<string | null>(() => getInstructorToken());
  const [roomCode, setRoomCode] = useState<string | null>(() => getInstructorRoomCode());
  const [error, setError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const authRef = useRef<GoogleAuth | null>(null);

  useEffect(() => mountGoogleButton(authRef, googleButtonRef, setError, setToken), []);

  return (
    <main style={layoutStyle}>
      <section style={heroStyle}>
        <div style={heroCopyStyle}>
          <p style={eyebrowStyle}>ClassPolls</p>
          <h1 style={titleStyle}>Instructor Dashboard</h1>
          <p style={subtitleStyle}>Build question plans, run live sessions, and keep the stream overlay readable on-screen.</p>
        </div>
        {!token ? <div ref={googleButtonRef} /> : <p style={signedInStyle}>Signed in and ready.</p>}
        {error ? <p style={errorStyle}>{error}</p> : null}
      </section>
      {token && !roomCode ? <PlanManager onOpenClassroom={(planId) => openClassroom(planId, setError, setRoomCode, token)} token={token} /> : null}
      {token && roomCode ? <ClassroomControls onRoomClosed={() => closeRecoveredRoom(setRoomCode)} roomCode={roomCode} token={token} /> : null}
    </main>
  );
}

function closeRecoveredRoom(setRoomCode: (value: string | null) => void) {
  clearInstructorRoomCode();
  setRoomCode(null);
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
    setInstructorRoomCode(response.roomCode);
    setRoomCode(response.roomCode);
    setError(null);
  } catch (error) {
    setError(getErrorMessage(error));
  }
}

const errorStyle = { color: '#fca5a5' };
const eyebrowStyle = { color: '#60a5fa', letterSpacing: '0.14em', margin: 0, textTransform: 'uppercase' as const };
const heroCopyStyle = { display: 'grid', gap: '0.6rem' };
const heroStyle = { background: 'linear-gradient(155deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(96, 165, 250, 0.16)', borderRadius: '2rem', display: 'grid', gap: '1rem', padding: '1.7rem' };
const layoutStyle = { color: '#f8fafc', display: 'grid', gap: '1.5rem', margin: '0 auto', maxWidth: '1180px', padding: '2rem' };
const signedInStyle = { color: '#bfdbfe', margin: 0 };
const subtitleStyle = { color: '#94a3b8', margin: 0, maxWidth: '52rem' };
const titleStyle = { fontSize: 'clamp(2.2rem, 5vw, 3.6rem)', margin: 0 };
