import { useEffect, useState } from 'preact/hooks';

import { getErrorMessage, requestJson } from '../common/apiClient';
import { QuestionEditor } from './Private/QuestionEditor';
import { DEFAULT_DRAFT, QuestionDraft, createDraftFromTemplate, parseDraft } from './Private/questionDraft';
import { StatsView } from './Private/StatsView';

type SessionQuestion = {
  choices: string[];
  correctChoiceIndex?: number;
  isActive: boolean;
  questionId: string;
  text: string;
  timeLimit?: number;
  votes?: Record<string, number>;
};

type SessionStats = { questions: SessionQuestion[]; roomCode: string; status: 'active' | 'closed' };
type ClassroomControlsProps = { roomCode: string; token: string };

export function ClassroomControls({ roomCode, token }: ClassroomControlsProps) {
  const [draft, setDraft] = useState<QuestionDraft>(DEFAULT_DRAFT);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionStats | null>(null);

  useEffect(() => pollSessionStats(roomCode, token, setError, setSession), [roomCode, token]);
  const activeQuestion = session?.questions.find((question) => question.isActive) ?? null;
  return (
    <section style={layoutStyle}>
      <header style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Live room</p>
          <h2 style={heroTitleStyle}>{roomCode}</h2>
          <p style={linkStyle}>{window.location.origin}/overlay/{roomCode}</p>
        </div>
        <button onClick={() => void closeRoom(roomCode, setError, token)} style={ghostButtonStyle} type="button">Close room</button>
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
        <div style={questionGridStyle}>{session?.questions.map((question) => renderQuestionCard(question, roomCode, setError, setSession, token))}</div>
      </section>
      <section style={twoColumnStyle}>
        <section style={panelStyle}>
          <QuestionEditor
            actionLabel="Launch custom question"
            draft={draft}
            error={editorError}
            onChange={setDraft}
            onSubmit={(event) => void createCustomQuestion(event, draft, roomCode, setDraft, setEditorError, setError, setSession, token)}
            onTemplateChange={(templateId) => setDraft(createDraftFromTemplate(templateId))}
            title="Custom question"
          />
        </section>
        <section style={panelStyle}><StatsView question={activeQuestion} /></section>
      </section>
    </section>
  );
}

async function activateQuestion(
  questionId: string,
  roomCode: string,
  setError: (value: string | null) => void,
  setSession: (value: SessionStats | null) => void,
  token: string
) {
  try {
    await requestJson(`/api/sessions/${roomCode}/questions/${questionId}/activate`, { method: 'POST', token });
    await loadStats(roomCode, token, setError, setSession, () => true);
  } catch (error) {
    setError(getErrorMessage(error));
  }
}

async function closeRoom(roomCode: string, setError: (value: string | null) => void, token: string) {
  try {
    await requestJson(`/api/sessions/${roomCode}/close`, { method: 'POST', token });
    setError(null);
  } catch (error) {
    setError(getErrorMessage(error));
  }
}

async function createCustomQuestion(
  event: Event,
  draft: QuestionDraft,
  roomCode: string,
  setDraft: (value: QuestionDraft) => void,
  setEditorError: (value: string | null) => void,
  setError: (value: string | null) => void,
  setSession: (value: SessionStats | null) => void,
  token: string
) {
  event.preventDefault();
  const parsed = parseDraft(draft);
  if ('error' in parsed) return setEditorError(parsed.error);
  try {
    await requestJson(`/api/sessions/${roomCode}/questions/custom`, { body: { ...parsed, activate: true }, method: 'POST', token });
    setDraft(DEFAULT_DRAFT);
    setEditorError(null);
    await loadStats(roomCode, token, setError, setSession, () => true);
  } catch (error) {
    setEditorError(getErrorMessage(error));
  }
}

async function loadStats(
  roomCode: string,
  token: string,
  setError: (value: string | null) => void,
  setSession: (value: SessionStats | null) => void,
  isMounted: () => boolean
) {
  try {
    const nextSession = await requestJson<SessionStats>(`/api/sessions/${roomCode}/stats`, { token });
    if (!isMounted()) return;
    setSession(nextSession);
    setError(null);
  } catch (error) {
    if (!isMounted()) return;
    setError(getErrorMessage(error));
  }
}

function pollSessionStats(
  roomCode: string,
  token: string,
  setError: (value: string | null) => void,
  setSession: (value: SessionStats | null) => void
) {
  let mounted = true;
  let timerId: number | null = null;
  const refresh = async () => {
    await loadStats(roomCode, token, setError, setSession, () => mounted);
    if (mounted) timerId = window.setTimeout(/*pollStats*/ refresh, /*delayInMs=*/3000);
  };
  void refresh();
  return () => {
    mounted = false;
    if (timerId !== null) window.clearTimeout(timerId);
  };
}

function renderQuestionCard(
  question: SessionQuestion,
  roomCode: string,
  setError: (value: string | null) => void,
  setSession: (value: SessionStats | null) => void,
  token: string
) {
  return (
    <article key={question.questionId} style={cardStyle}>
      <div style={cardBodyStyle}>
        <strong>{question.text}</strong>
        <p style={mutedStyle}>{question.choices.join(' / ')}</p>
        <p style={metaStyle}>{toQuestionMeta(question)}</p>
      </div>
      <button onClick={() => void activateQuestion(question.questionId, roomCode, setError, setSession, token)} style={question.isActive ? activeButtonStyle : primaryButtonStyle} type="button">{question.isActive ? 'Active now' : 'Go live'}</button>
    </article>
  );
}

function toQuestionMeta(question: SessionQuestion) {
  const parts = [`${question.choices.length} choices`];
  if (typeof question.timeLimit === 'number') parts.push(`${question.timeLimit}s timer`);
  if (typeof question.correctChoiceIndex === 'number') parts.push(`answer ${question.correctChoiceIndex}`);
  return parts.join(' • ');
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
const questionGridStyle = { display: 'grid', gap: '0.8rem' };
const sectionTitleStyle = { margin: '0.15rem 0 0' };
const twoColumnStyle = { display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' };
