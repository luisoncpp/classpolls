import { useEffect, useRef, useState } from 'preact/hooks';

import { SessionPollingController } from '../common/SessionPollingController';
import { PublicSession, getActiveQuestion, getCountdownMs, isPollError } from '../common/session';

type OBSOverlayProps = {
  roomCode: string;
};

export function OBSOverlay({ roomCode }: OBSOverlayProps) {
  const [session, setSession] = useState<PublicSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const controllerRef = useRef<SessionPollingController | null>(null);

  useEffect(() => startOverlayPolling(roomCode, controllerRef, setError, setSession), [roomCode]);
  useEffect(() => startClock(setNow), []);

  if (error) return <main style={overlayLayoutStyle}><p>{error}</p></main>;
  if (!session) return <main style={overlayLayoutStyle}><p>Waiting for room data...</p></main>;

  const activeQuestion = getActiveQuestion(session);
  const displayQuestion = activeQuestion ?? session.questions[session.questions.length - 1] ?? null;
  const countdownMs = displayQuestion ? getCountdownMs(displayQuestion, now) : null;
  return (
    <main style={overlayLayoutStyle}>
      <header>
        <p style={badgeStyle}>Room {session.roomCode}</p>
        <h1 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>{displayQuestion?.text ?? 'Waiting for the next question...'}</h1>
        {countdownMs !== null && activeQuestion ? <p style={countdownStyle}>{Math.ceil(countdownMs / 1000)}s</p> : null}
      </header>
      <section style={{ display: 'grid', gap: '1rem' }}>
        {(displayQuestion?.choices ?? []).map((choice, index) => renderOverlayChoice(choice, displayQuestion?.correctChoiceIndex, index))}
      </section>
    </main>
  );
}

function renderOverlayChoice(choice: string, correctChoiceIndex: number | undefined, index: number) {
  const isCorrect = correctChoiceIndex === index;
  return (
    <div key={`${choice}-${index}`} style={{ ...choiceStyle, ...(isCorrect ? correctChoiceStyle : null) }}>
      <strong>{String.fromCharCode(65 + index)}</strong>
      <span>{choice}</span>
    </div>
  );
}

function startClock(setNow: (value: number) => void) {
  const timerId = window.setInterval(() => setNow(Date.now()), 1000);
  return () => window.clearInterval(timerId);
}

function startOverlayPolling(
  roomCode: string,
  controllerRef: preact.RefObject<SessionPollingController | null>,
  setError: (value: string | null) => void,
  setSession: (value: PublicSession | null) => void
) {
  controllerRef.current?.stopPolling();
  const controller = new SessionPollingController(roomCode, (update) => handleOverlayUpdate(controller, setError, setSession, update));
  controllerRef.current = controller;
  controller.pollNow();
  controller.startPolling();
  return () => controller.stopPolling();
}

function handleOverlayUpdate(
  controller: SessionPollingController,
  setError: (value: string | null) => void,
  setSession: (value: PublicSession | null) => void,
  update: PublicSession | { pollError: { status: number } }
) {
  if (isPollError(update)) {
    if (update.pollError.status === 404) setError('Room not found');
    if (update.pollError.status === 404) controller.stopPolling();
    return;
  }
  setError(null);
  setSession(update);
  if (update.status === 'closed') controller.stopPolling();
}

const badgeStyle = { color: '#93c5fd', letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' as const };
const choiceStyle = { alignItems: 'center', background: 'rgba(15, 23, 42, 0.72)', border: '1px solid rgba(148, 163, 184, 0.35)', borderRadius: '1rem', display: 'grid', gap: '1rem', gridTemplateColumns: '48px 1fr', padding: '1rem 1.25rem' };
const correctChoiceStyle = { background: 'rgba(22, 163, 74, 0.24)', border: '1px solid rgba(34, 197, 94, 0.7)' };
const countdownStyle = { color: '#fde68a', fontSize: '2rem', margin: 0 };
const overlayLayoutStyle = { color: '#f8fafc', display: 'grid', gap: '1.5rem', margin: '0 auto', maxWidth: '1100px', minHeight: '100vh', padding: '2rem', background: 'radial-gradient(circle at top, #1e3a8a 0%, #020617 65%)' };
