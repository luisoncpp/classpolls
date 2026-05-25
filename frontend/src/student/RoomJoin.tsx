import { useEffect, useRef, useState } from 'preact/hooks';

import { SessionPollingController } from '../common/SessionPollingController';
import { getStudentId } from '../common/identity';
import { PublicSession, getActiveQuestion, getCountdownMs, isPollError } from '../common/session';
import { Grid } from './Grid';
import { VoteDispatcher } from './Private/VoteDispatcher';

export function RoomJoin() {
  const [draftRoomCode, setDraftRoomCode] = useState('');
  const [joinedRoomCode, setJoinedRoomCode] = useState('');
  const [session, setSession] = useState<PublicSession | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [, setRevision] = useState(0);
  const controllerRef = useRef<SessionPollingController | null>(null);
  const dispatcherRef = useRef<VoteDispatcher | null>(null);
  const expiryTimerRef = useRef<number | null>(null);

  useEffect(() => startRoomPolling(joinedRoomCode, controllerRef, dispatcherRef, expiryTimerRef, setJoinError, setRevision, setSession), [joinedRoomCode]);

  return (
    <main style={layoutStyle}>
      <section style={panelStyle}>
        <h1>ClassPolls</h1>
        <p>Enter a room code to join the live session.</p>
        <form onSubmit={(event) => joinRoom(event, draftRoomCode, setJoinError, setJoinedRoomCode)}>
          <input onInput={(event) => setDraftRoomCode((event.currentTarget as HTMLInputElement).value.toUpperCase())} placeholder="ABCD" style={inputStyle} value={draftRoomCode} />
          <button style={primaryButtonStyle} type="submit">Join room</button>
        </form>
        {joinedRoomCode ? <p>Connected room: <strong>{joinedRoomCode}</strong></p> : null}
        {joinError ? <p style={errorStyle}>{joinError}</p> : null}
      </section>
      <section style={panelStyle}>
        {session ? <Grid onVoteError={setJoinError} session={session} voteDispatcher={dispatcherRef.current} /> : <p>Join a room to start polling.</p>}
      </section>
    </main>
  );
}

function joinRoom(
  event: Event,
  draftRoomCode: string,
  setJoinError: (value: string | null) => void,
  setJoinedRoomCode: (value: string) => void
) {
  event.preventDefault();
  const normalizedRoomCode = draftRoomCode.trim().toUpperCase();
  if (!normalizedRoomCode) return setJoinError('Room code is required');
  setJoinError(null);
  setJoinedRoomCode(normalizedRoomCode);
}

function startRoomPolling(
  joinedRoomCode: string,
  controllerRef: preact.RefObject<SessionPollingController | null>,
  dispatcherRef: preact.RefObject<VoteDispatcher | null>,
  expiryTimerRef: preact.RefObject<number | null>,
  setJoinError: (value: string | null) => void,
  setRevision: (value: number | ((current: number) => number)) => void,
  setSession: (value: PublicSession | null) => void
) {
  stopController(controllerRef, expiryTimerRef);
  dispatcherRef.current = null;
  if (!joinedRoomCode) return;
  const studentId = getStudentId();
  dispatcherRef.current = new VoteDispatcher(joinedRoomCode, studentId, () => setRevision((current) => current + 1));
  const controller = new SessionPollingController(joinedRoomCode, (update) => handleUpdate(controller, dispatcherRef.current, expiryTimerRef, setJoinError, setSession, update), studentId);
  controllerRef.current = controller;
  controller.pollNow();
  controller.startPolling();
  return () => stopController(controllerRef, expiryTimerRef);
}

function handleUpdate(
  controller: SessionPollingController,
  dispatcher: VoteDispatcher | null,
  expiryTimerRef: preact.RefObject<number | null>,
  setJoinError: (value: string | null) => void,
  setSession: (value: PublicSession | null) => void,
  update: PublicSession | { pollError: { status: number } }
) {
  if (isPollError(update)) {
    if (update.pollError.status === 404) setJoinError('Room not found');
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
const inputStyle = { borderRadius: '0.75rem', marginRight: '0.75rem', padding: '0.85rem 1rem', width: '180px' };
const layoutStyle = { color: '#f9fafb', display: 'grid', gap: '1.5rem', margin: '0 auto', maxWidth: '960px', padding: '2rem' };
const panelStyle = { background: '#111827', borderRadius: '1.25rem', padding: '1.5rem' };
const primaryButtonStyle = { background: '#2563eb', border: 0, borderRadius: '0.75rem', color: '#fff', padding: '0.85rem 1rem' };
