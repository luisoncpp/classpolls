import { useEffect, useRef, useState } from 'preact/hooks';

import { clearInstructorRoomCode, clearInstructorToken, getErrorMessage, getInstructorRoomCode, getInstructorToken, requestJson, setInstructorRoomCode, setInstructorToken } from '../common/apiClient';
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

  useEffect(() => {
    if (token) return;
    mountGoogleButton(authRef, googleButtonRef, setError, setToken);
  }, [token]);

  return (
    <main className="app-shell dashboard-shell" style={layoutStyle}>
      <section className="hero-panel dashboard-hero-layout" style={heroStyle}>
        <div style={heroCopyStyle}>
          <p style={eyebrowStyle}>ClassPolls</p>
          <h1 style={titleStyle}>Instructor Dashboard</h1>
          <p style={subtitleStyle}>Build question plans, run live sessions, and keep the stream overlay readable on-screen.</p>
        </div>
        <div style={heroMetaStyle}>
          {!token ? <div key="signed-out" ref={googleButtonRef} /> : <div key="signed-in" style={signedInGroupStyle}><p className="status-pill" style={signedInStyle}>Signed in and ready.</p><button className="button-ghost" onClick={() => logout(setError, setRoomCode, setToken)} style={logoutButtonStyle} type="button">Log out</button></div>}
          <div style={featureListStyle}>
            <span style={featurePillStyle}>Plans</span>
            <span style={featurePillStyle}>Live control</span>
            <span style={featurePillStyle}>Overlay ready</span>
          </div>
        </div>
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

function logout(
  setError: (value: string | null) => void,
  setRoomCode: (value: string | null) => void,
  setToken: (value: string | null) => void
) {
  clearInstructorToken();
  setError(null);
  setRoomCode(null);
  setToken(null);
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
const featureListStyle = { display: 'flex', flexWrap: 'wrap' as const, gap: '0.55rem', justifyContent: 'flex-end' };
const featurePillStyle = { background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(96, 165, 250, 0.24)', borderRadius: '999px', color: '#cbd5e1', padding: '0.45rem 0.8rem' };
const heroCopyStyle = { display: 'grid', gap: '0.6rem' };
const heroMetaStyle = { alignItems: 'flex-end', display: 'grid', gap: '0.9rem', justifyItems: 'end' as const };
const heroStyle = { display: 'grid', gap: '1rem', padding: '1.7rem' };
const layoutStyle = { color: '#f8fafc' };
const logoutButtonStyle = { padding: '0.7rem 1rem' };
const signedInStyle = { background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(96, 165, 250, 0.32)', color: '#bfdbfe', margin: 0 };
const signedInGroupStyle = { alignItems: 'center', display: 'flex', flexWrap: 'wrap' as const, gap: '0.75rem', justifyContent: 'flex-end' };
const subtitleStyle = { color: '#94a3b8', margin: 0, maxWidth: '52rem' };
const titleStyle = { fontSize: 'clamp(2.2rem, 5vw, 3.6rem)', margin: 0 };
