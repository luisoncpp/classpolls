import { useEffect, useRef, useState } from 'preact/hooks';

import { useI18n } from '../common/i18n';
import { SessionPollingController } from '../common/SessionPollingController';
import { getStudentId } from '../common/identity';
import { PublicSession, getActiveQuestion, getCountdownMs, isPollError } from '../common/session';
import { Grid } from './Grid';
import { VoteDispatcher } from './Private/VoteDispatcher';

export function RoomJoin() {
  const { t } = useI18n();
  const [draftRoomCode, setDraftRoomCode] = useState('');
  const [joinedRoomCode, setJoinedRoomCode] = useState('');
  const [session, setSession] = useState<PublicSession | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [, setRevision] = useState(0);
  const controllerRef = useRef<SessionPollingController | null>(null);
  const dispatcherRef = useRef<VoteDispatcher | null>(null);
  const expiryTimerRef = useRef<number | null>(null);

  useEffect(() => startRoomPolling(joinedRoomCode, controllerRef, dispatcherRef, expiryTimerRef, t('student.roomNotFound'), setJoinError, setRevision, setSession), [joinedRoomCode, t]);

  const handleSubmit = (event: Event) => {
    event.preventDefault();
    const normalizedRoomCode = draftRoomCode.trim().toUpperCase();
    if (!normalizedRoomCode) return setJoinError(t('student.roomCodeRequired'));
    setJoinError(null);
    setJoinedRoomCode(normalizedRoomCode);
  };

  return (
    <main className="app-shell join-shell" style={layoutStyle}>
      <section className="hero-panel" style={heroPanelStyle}>
        <p style={eyebrowStyle}>{t('student.liveClassroomPolling')}</p>
        <h1 style={titleStyle}>{t('student.title')}</h1>
        <p style={subtitleStyle}>{t('student.subtitle')}</p>
        <form className="responsive-form" onSubmit={handleSubmit}>
          <input onInput={(event) => setDraftRoomCode((event.currentTarget as HTMLInputElement).value.toUpperCase())} placeholder="ABCD" style={inputStyle} value={draftRoomCode} />
          <button className="button-primary" style={primaryButtonStyle} type="submit">{t('student.joinRoom')}</button>
        </form>
        {joinedRoomCode ? <p style={connectedStyle}>{t('student.connectedRoom')} <strong className="mono-text">{joinedRoomCode}</strong></p> : null}
        {joinError ? <p style={errorStyle}>{joinError}</p> : null}
      </section>
      <section className="surface-panel" style={panelStyle}>
        {session ? <Grid onVoteError={setJoinError} session={session} voteDispatcher={dispatcherRef.current} /> : <p>{t('student.joinToStart')}</p>}
      </section>
    </main>
  );
}

function startRoomPolling(
  joinedRoomCode: string,
  controllerRef: preact.RefObject<SessionPollingController | null>,
  dispatcherRef: preact.RefObject<VoteDispatcher | null>,
  expiryTimerRef: preact.RefObject<number | null>,
  roomNotFoundMessage: string,
  setJoinError: (value: string | null) => void,
  setRevision: (value: number | ((current: number) => number)) => void,
  setSession: (value: PublicSession | null) => void
) {
  stopController(controllerRef, expiryTimerRef);
  dispatcherRef.current = null;
  if (!joinedRoomCode) return;
  const studentId = getStudentId();
  dispatcherRef.current = new VoteDispatcher(joinedRoomCode, studentId, () => setRevision((current) => current + 1));
  const controller = new SessionPollingController(joinedRoomCode, (update) => handleUpdate(controller, dispatcherRef.current, expiryTimerRef, roomNotFoundMessage, setJoinError, setSession, update), studentId);
  controllerRef.current = controller;
  controller.pollNow();
  controller.startPolling();
  return () => stopController(controllerRef, expiryTimerRef);
}

function handleUpdate(
  controller: SessionPollingController,
  dispatcher: VoteDispatcher | null,
  expiryTimerRef: preact.RefObject<number | null>,
  roomNotFoundMessage: string,
  setJoinError: (value: string | null) => void,
  setSession: (value: PublicSession | null) => void,
  update: PublicSession | { pollError: { status: number } }
) {
  if (isPollError(update)) {
    if (update.pollError.status === 404) setJoinError(roomNotFoundMessage);
    if (update.pollError.status === 404) setSession(null);
    if (update.pollError.status === 404) controller.stopPolling();
    return;
  }
  const activeQuestion = getActiveQuestion(update);
  dispatcher?.sync(activeQuestion?.questionId ?? null, activeQuestion?.myVote ?? null);
  scheduleExpiryPoll(activeQuestion, controller, expiryTimerRef);
  setJoinError(null);
  setSession(update);
  if (update.status === 'closed') controller.stopPolling();
}

function scheduleExpiryPoll(
  question: PublicSession['questions'][number] | null,
  controller: SessionPollingController,
  expiryTimerRef: preact.RefObject<number | null>
) {
  if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current);
  expiryTimerRef.current = null;
  if (!question) return;
  const countdownMs = getCountdownMs(question, Date.now());
  if (countdownMs === null || countdownMs === 0) return;
  expiryTimerRef.current = window.setTimeout(() => controller.pollNow(), countdownMs + 50);
}

function stopController(
  controllerRef: preact.RefObject<SessionPollingController | null>,
  expiryTimerRef: preact.RefObject<number | null>
) {
  controllerRef.current?.stopPolling();
  controllerRef.current = null;
  if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current);
  expiryTimerRef.current = null;
}

const errorStyle = { color: '#fca5a5' };
const connectedStyle = { color: '#cbd5e1', margin: 0 };
const eyebrowStyle = { color: '#93c5fd', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' as const };
const heroPanelStyle = { display: 'grid', gap: '1rem', padding: '1.5rem' };
const inputStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: '0.95rem', color: '#f8fafc', padding: '0.9rem 1rem', width: '100%' };
const layoutStyle = { color: '#f9fafb' };
const panelStyle = { display: 'grid', gap: '1rem', padding: '1.5rem' };
const primaryButtonStyle = { borderRadius: '0.95rem' };
const subtitleStyle = { color: '#94a3b8', lineHeight: 1.6, margin: 0 };
const titleStyle = { fontSize: 'clamp(2rem, 5vw, 3.3rem)', lineHeight: 1.02, margin: 0 };
