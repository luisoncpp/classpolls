import { useEffect, useRef, useState } from 'preact/hooks';

import { SessionPollingController } from '../common/SessionPollingController';
import { PublicSession, getActiveQuestion, getCountdownMs, getDisplayQuestion, isPollError, isQuestionExpired } from '../common/session';

type OBSOverlayProps = {
  roomCode: string;
};

export function OBSOverlay({ roomCode }: OBSOverlayProps) {
  const [session, setSession] = useState<PublicSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const controllerRef = useRef<SessionPollingController | null>(null);
  const expiryTimerRef = useRef<number | null>(null);

  useEffect(() => startOverlayPolling(roomCode, controllerRef, expiryTimerRef, setError, setSession), [roomCode]);
  useEffect(() => startClock(setNow), []);

  if (error) return <main style={overlayLayoutStyle}><p>{error}</p></main>;
  if (!session) return <main style={overlayLayoutStyle}><p>Waiting for room data...</p></main>;

  const activeQuestion = getActiveQuestion(session);
  const displayQuestion = getDisplayQuestion(session);
  const countdownMs = displayQuestion ? getCountdownMs(displayQuestion, now) : null;
  const revealCorrectAnswer = displayQuestion
    ? isQuestionExpired(displayQuestion, now) && typeof displayQuestion.correctChoiceIndex === 'number'
    : false;
  return (
    <main style={overlayLayoutStyle}>
      <section style={frameStyle}>
        <header style={headerStyle}>
          <div style={headerRowStyle}>
            <p style={badgeStyle}>Room {session.roomCode}</p>
            {countdownMs !== null && activeQuestion ? <p style={countdownStyle}>{Math.ceil(countdownMs / 1000)}s</p> : null}
          </div>
          <h1 style={questionTitleStyle}>{displayQuestion?.text ?? 'Waiting for the next question...'}</h1>
          <p style={statusStyle}>{revealCorrectAnswer ? 'Answer revealed' : activeQuestion ? 'Voting is live' : 'Waiting for the instructor'}</p>
        </header>
        <section style={choicesStyle}>
        {(displayQuestion?.choices ?? []).map((choice, index) => renderOverlayChoice(choice, revealCorrectAnswer ? displayQuestion?.correctChoiceIndex : undefined, index))}
        </section>
      </section>
    </main>
  );
}

function renderOverlayChoice(choice: string, correctChoiceIndex: number | undefined, index: number) {
  const isCorrect = correctChoiceIndex === index;
  return (
    <div key={`${choice}-${index}`} style={{ ...choiceStyle, ...(isCorrect ? correctChoiceStyle : null) }}>
      <span style={choiceTextStyle}>{choice}</span>
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
  expiryTimerRef: preact.RefObject<number | null>,
  setError: (value: string | null) => void,
  setSession: (value: PublicSession | null) => void
) {
  controllerRef.current?.stopPolling();
  const controller = new SessionPollingController(roomCode, (update) => handleOverlayUpdate(controller, expiryTimerRef, setError, setSession, update));
  controllerRef.current = controller;
  controller.pollNow();
  controller.startPolling();
  return () => stopOverlayPolling(controller, expiryTimerRef);
}

function handleOverlayUpdate(
  controller: SessionPollingController,
  expiryTimerRef: preact.RefObject<number | null>,
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
  scheduleOverlayExpiryPoll(getActiveQuestion(update), controller, expiryTimerRef);
  setSession(update);
  if (update.status === 'closed') controller.stopPolling();
}

function scheduleOverlayExpiryPoll(
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

function stopOverlayPolling(
  controller: SessionPollingController,
  expiryTimerRef: preact.RefObject<number | null>
) {
  controller.stopPolling();
  if (expiryTimerRef.current !== null) window.clearTimeout(expiryTimerRef.current);
  expiryTimerRef.current = null;
}

const badgeStyle = { color: '#93c5fd', letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' as const };
const choicesStyle = { display: 'grid', gap: '0.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', width: 'min(100%, 720px)' };
const choiceStyle = { alignItems: 'center', background: 'rgba(15, 23, 42, 0.68)', border: '1px solid rgba(148, 163, 184, 0.22)', borderRadius: '1.1rem', display: 'grid', padding: '0.8rem 1rem' };
const choiceTextStyle = { fontSize: 'clamp(1rem, 2.1vw, 1.5rem)', lineHeight: 1.15 };
const correctChoiceStyle = { background: 'linear-gradient(135deg, rgba(20, 83, 45, 0.95), rgba(21, 128, 61, 0.72))', border: '1px solid rgba(74, 222, 128, 0.72)', boxShadow: '0 0 0 1px rgba(74, 222, 128, 0.14) inset' };
const countdownStyle = { background: 'rgba(250, 204, 21, 0.12)', border: '1px solid rgba(253, 224, 71, 0.34)', borderRadius: '999px', color: '#fef08a', fontSize: 'clamp(1.1rem, 2vw, 1.6rem)', margin: 0, padding: '0.45rem 0.9rem' };
const frameStyle = { alignItems: 'center', display: 'grid', gap: '1rem', justifyItems: 'center' as const, width: '100%' };
const headerRowStyle = { alignItems: 'center', display: 'flex', flexWrap: 'wrap' as const, gap: '0.9rem', justifyContent: 'space-between', width: '100%' };
const headerStyle = { alignItems: 'center', display: 'grid', gap: '0.45rem', justifyItems: 'center' as const, textAlign: 'center' as const, width: 'min(100%, 720px)' };
const overlayLayoutStyle = { alignItems: 'center', background: 'radial-gradient(circle at 50% 0%, #172554 0%, #020617 62%, #000814 100%)', color: '#f8fafc', display: 'grid', minHeight: '100vh', padding: 'clamp(1.2rem, 3vw, 2.4rem)' };
const questionTitleStyle = { fontSize: 'clamp(1.8rem, 4vw, 3rem)', lineHeight: 1.05, margin: 0, maxWidth: '24ch' };
const statusStyle = { color: '#cbd5e1', fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)', margin: 0 };
