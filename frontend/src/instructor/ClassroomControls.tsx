import { useEffect, useState } from 'preact/hooks';

import { getErrorMessage, requestJson } from '../common/apiClient';
import { StatsView } from './Private/StatsView';
import { QuestionEditor } from './Private/QuestionEditor';
import { DEFAULT_DRAFT, QuestionDraft, createDraftFromTemplate, parseDraft } from './Private/questionDraft';

type SessionQuestion = {
  choices: string[];
  correctChoiceIndex?: number;
  isActive: boolean;
  questionId: string;
  text: string;
  timeLimit?: number;
  votes?: Record<string, number>;
};

type SessionStats = {
  questions: SessionQuestion[];
  roomCode: string;
  status: 'active' | 'closed';
};

type ClassroomControlsProps = {
  onRoomClosed: () => void;
  roomCode: string;
  token: string;
};

export function ClassroomControls({ onRoomClosed, roomCode, token }: ClassroomControlsProps) {
  const [draft, setDraft] = useState<QuestionDraft>(DEFAULT_DRAFT);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [session, setSession] = useState<SessionStats | null>(null);

  useEffect(() => startStatsPolling(roomCode, token, onRoomClosed, setError, setSession), [onRoomClosed, roomCode, token]);
  const activeQuestion = session?.questions.find((question) => question.isActive) ?? null;
  return (
    <section style={layoutStyle}>
      <header style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Live room</p>
          <h2 style={heroTitleStyle}>{roomCode}</h2>
          <p style={linkStyle}>{window.location.origin}/overlay/{roomCode}</p>
        </div>
        <button disabled={pendingAction === 'close-room'} onClick={() => void closeRoom(roomCode, onRoomClosed, setError, setPendingAction, token)} style={getActionButtonStyle(pendingAction === 'close-room', true)} type="button">{pendingAction === 'close-room' ? 'Closing...' : 'Close room'}</button>
      </header>
      {error ? <p style={errorStyle}>{error}</p> : null}
      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Queue</p>
            <h3 style={sectionTitleStyle}>Questions</h3>
          </div>
          <span style={countBadgeStyle}>{session?.questions.length ?? 0} loaded</span>
        </div>
        <div style={questionGridStyle}>{session?.questions.map((question) => renderQuestionCard(question, pendingAction, roomCode, setError, setPendingAction, setSession, token))}</div>
      </section>
      <section style={twoColumnStyle}>
        <section style={panelStyle}>
          <QuestionEditor
            actionLabel="Launch custom question"
            draft={draft}
            error={editorError}
            onChange={setDraft}
            onSubmit={(event) => void createCustomQuestion(event, draft, roomCode, setDraft, setEditorError, setError, setPendingAction, setSession, token)}
            onTemplateChange={(templateId) => setDraft(createDraftFromTemplate(templateId))}
            pending={pendingAction === 'custom-question'}
            title="Custom question"
          />
        </section>
        <section style={panelStyle}><StatsView question={activeQuestion} /></section>
      </section>
    </section>
  );
}

async function activateQuestion(questionId: string, roomCode: string, setError: (value: string | null) => void, setPendingAction: (value: string | null) => void, setSession: (value: SessionStats | null) => void, token: string) {
  try {
    setPendingAction(`activate-${questionId}`);
    await requestJson(`/api/sessions/${roomCode}/questions/${questionId}/activate`, { method: 'POST', token });
    await loadStats(roomCode, token, setError, setSession, () => true);
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    window.setTimeout(() => setPendingAction(null), 120);
  }
}

async function closeRoom(roomCode: string, onRoomClosed: () => void, setError: (value: string | null) => void, setPendingAction: (value: string | null) => void, token: string) {
  try {
    setPendingAction('close-room');
    await requestJson(`/api/sessions/${roomCode}/close`, { method: 'POST', token });
    setError(null);
    onRoomClosed();
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    setPendingAction(null);
  }
}

async function createCustomQuestion(event: Event, draft: QuestionDraft, roomCode: string, setDraft: (value: QuestionDraft) => void, setEditorError: (value: string | null) => void, setError: (value: string | null) => void, setPendingAction: (value: string | null) => void, setSession: (value: SessionStats | null) => void, token: string) {
  event.preventDefault();
  let releasedPending = false;
  const parsed = parseDraft(draft);
  if ('error' in parsed) return setEditorError(parsed.error);
  try {
    setPendingAction('custom-question');
    await requestJson(`/api/sessions/${roomCode}/questions/custom`, { body: { ...parsed, activate: true }, method: 'POST', token });
    setDraft(DEFAULT_DRAFT);
    setEditorError(null);
    setPendingAction(null);
    releasedPending = true;
    void loadStats(roomCode, token, setError, setSession, () => true);
  } catch (error) {
    setEditorError(getErrorMessage(error));
  } finally {
    if (!releasedPending) window.setTimeout(() => setPendingAction(null), 120);
  }
}

async function loadStats(roomCode: string, token: string, setError: (value: string | null) => void, setSession: (value: SessionStats | null) => void, isMounted: () => boolean): Promise<SessionStats | null> {
  try {
    const nextSession = await requestJson<SessionStats>(`/api/sessions/${roomCode}/stats`, { token });
    if (!isMounted()) return null;
    setSession(nextSession);
    setError(null);
    return nextSession;
  } catch (error) {
    if (!isMounted()) return null;
    setError(getErrorMessage(error));
    return null;
  }
}

function renderQuestionCard(question: SessionQuestion, pendingAction: string | null, roomCode: string, setError: (value: string | null) => void, setPendingAction: (value: string | null) => void, setSession: (value: SessionStats | null) => void, token: string) {
  const isPending = pendingAction === `activate-${question.questionId}`;
  return <article key={question.questionId} style={cardStyle}><div style={cardBodyStyle}><strong>{question.text}</strong><p style={mutedStyle}>{question.choices.join(' / ')}</p><p style={metaStyle}>{toQuestionMeta(question)}</p></div><button disabled={isPending} onClick={() => void activateQuestion(question.questionId, roomCode, setError, setPendingAction, setSession, token)} style={getActionButtonStyle(question.isActive || isPending, false)} type="button">{isPending ? 'Launching...' : question.isActive ? 'Active now' : 'Go live'}</button></article>;
}

function startStatsPolling(roomCode: string, token: string, onRoomClosed: () => void, setError: (value: string | null) => void, setSession: (value: SessionStats | null) => void) {
  let mounted = true;
  let timerId: number | null = null;
  const refresh = async () => {
    const nextSession = await loadStats(roomCode, token, setError, setSession, () => mounted);
    if (!mounted) return;
    if (nextSession?.status === 'closed') return onRoomClosed();
    timerId = window.setTimeout(/*pollStats*/ refresh, /*delayInMs=*/3000);
  };
  void refresh();
  return () => {
    mounted = false;
    if (timerId !== null) window.clearTimeout(timerId);
  };
}

function toQuestionMeta(question: SessionQuestion) {
  const parts = [`${question.choices.length} choices`];
  if (typeof question.timeLimit === 'number') parts.push(`${question.timeLimit}s timer`);
  if (typeof question.correctChoiceIndex === 'number') parts.push('answer ready');
  return parts.join(' • ');
}

function getActionButtonStyle(isPressed: boolean, muted: boolean) {
  if (muted) return isPressed ? pressedGhostButtonStyle : ghostButtonStyle;
  return isPressed ? activeButtonStyle : primaryButtonStyle;
}

const activeButtonStyle = { background: 'rgba(34, 197, 94, 0.18)', border: '1px solid rgba(74, 222, 128, 0.4)', borderRadius: '999px', color: '#dcfce7', padding: '0.8rem 1rem' };
const cardBodyStyle = { display: 'grid', gap: '0.35rem' };
const cardStyle = { alignItems: 'center', background: '#020617', border: '1px solid #1e293b', borderRadius: '1.2rem', display: 'flex', flexWrap: 'wrap' as const, gap: '1rem', justifyContent: 'space-between', padding: '1rem 1.1rem' };
const countBadgeStyle = { background: 'rgba(59, 130, 246, 0.14)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#bfdbfe', padding: '0.5rem 0.9rem' };
const errorStyle = { color: '#fca5a5', margin: 0 };
const eyebrowStyle = { color: '#60a5fa', fontSize: '0.78rem', letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' as const };
const ghostButtonStyle = { background: 'transparent', border: '1px solid #475569', borderRadius: '999px', color: '#e2e8f0', padding: '0.8rem 1rem' };
const heroStyle = { alignItems: 'center', background: 'linear-gradient(160deg, rgba(30, 41, 59, 0.95), rgba(2, 6, 23, 0.96))', border: '1px solid rgba(96, 165, 250, 0.16)', borderRadius: '1.8rem', display: 'flex', flexWrap: 'wrap' as const, gap: '1rem', justifyContent: 'space-between', padding: '1.4rem 1.5rem' };
const heroTitleStyle = { fontSize: '2.4rem', margin: '0.2rem 0 0' };
const layoutStyle = { display: 'grid', gap: '1rem' };
const linkStyle = { color: '#bfdbfe', margin: '0.35rem 0 0' };
const metaStyle = { color: '#cbd5e1', margin: 0 };
const mutedStyle = { color: '#94a3b8', margin: 0 };
const panelHeaderStyle = { alignItems: 'center', display: 'flex', flexWrap: 'wrap' as const, gap: '0.75rem', justifyContent: 'space-between' };
const panelStyle = { background: 'rgba(15, 23, 42, 0.82)', border: '1px solid #1e293b', borderRadius: '1.5rem', display: 'grid', gap: '1rem', padding: '1.3rem' };
const primaryButtonStyle = { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 0, borderRadius: '999px', color: '#eff6ff', padding: '0.8rem 1rem' };
const pressedGhostButtonStyle = { background: 'rgba(59, 130, 246, 0.14)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#dbeafe', padding: '0.8rem 1rem' };
const questionGridStyle = { display: 'grid', gap: '0.8rem' };
const sectionTitleStyle = { margin: '0.15rem 0 0' };
const twoColumnStyle = { display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' };
