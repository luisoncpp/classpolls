import { useEffect, useState } from 'preact/hooks';

import { getErrorMessage, requestJson } from '../common/apiClient';
import { StatsView } from './Private/StatsView';

type SessionQuestion = {
  choices: string[];
  correctChoiceIndex?: number;
  isActive: boolean;
  questionId: string;
  text: string;
  votes?: Record<string, number>;
};

type SessionStats = {
  questions: SessionQuestion[];
  roomCode: string;
  status: 'active' | 'closed';
};

type ClassroomControlsProps = {
  roomCode: string;
  token: string;
};

export function ClassroomControls({ roomCode, token }: ClassroomControlsProps) {
  const [session, setSession] = useState<SessionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [customChoices, setCustomChoices] = useState('Option A\nOption B');

  useEffect(() => pollSessionStats(roomCode, token, setError, setSession), [roomCode, token]);
  const activeQuestion = session?.questions.find((question) => question.isActive) ?? null;
  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header style={panelStyle}><h2>Live room {roomCode}</h2><p>{window.location.origin}/overlay/{roomCode}</p></header>
      {error ? <p style={errorStyle}>{error}</p> : null}
      <section style={panelStyle}>
        <h3>Questions</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>{session?.questions.map((question) => renderQuestionCard(question, roomCode, setError, setSession, token))}</div>
      </section>
      <section style={panelStyle}>
        <h3>Custom question</h3>
        <form onSubmit={(event) => void createCustomQuestion(event, customChoices, customQuestion, roomCode, setCustomChoices, setCustomQuestion, setError, setSession, token)}>
          <input onInput={(event) => setCustomQuestion((event.currentTarget as HTMLInputElement).value)} placeholder="Question text" style={inputStyle} value={customQuestion} />
          <textarea onInput={(event) => setCustomChoices((event.currentTarget as HTMLTextAreaElement).value)} rows={4} style={textAreaStyle} value={customChoices} />
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button style={primaryButtonStyle} type="submit">Push custom question</button>
            <button onClick={() => void closeRoom(roomCode, setError, token)} style={secondaryButtonStyle} type="button">Close room</button>
          </div>
        </form>
      </section>
      <section style={panelStyle}><StatsView question={activeQuestion} /></section>
    </section>
  );
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
  customChoices: string,
  customQuestion: string,
  roomCode: string,
  setCustomChoices: (value: string) => void,
  setCustomQuestion: (value: string) => void,
  setError: (value: string | null) => void,
  setSession: (value: SessionStats | null) => void,
  token: string
) {
  event.preventDefault();
  const choices = customChoices.split('\n').map((choice) => choice.trim()).filter(Boolean);
  if (!customQuestion.trim() || choices.length < 2) return setError('Custom questions need text and at least two choices');
  try {
    await requestJson(`/api/sessions/${roomCode}/questions/custom`, { body: { activate: true, choices, text: customQuestion }, method: 'POST', token });
    setCustomQuestion('');
    setCustomChoices('Option A\nOption B');
    await loadStats(roomCode, token, setError, setSession, () => true);
  } catch (error) {
    setError(getErrorMessage(error));
  }
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
      <div>
        <strong>{question.text}</strong>
        <p>{question.choices.join(' / ')}</p>
      </div>
      <button onClick={() => void activateQuestion(question.questionId, roomCode, setError, setSession, token)} style={primaryButtonStyle} type="button">{question.isActive ? 'Active' : 'Activate'}</button>
    </article>
  );
}

const cardStyle = { alignItems: 'center', background: '#0f172a', borderRadius: '1rem', display: 'flex', justifyContent: 'space-between', padding: '1rem' };
const errorStyle = { color: '#fca5a5' };
const inputStyle = { borderRadius: '0.75rem', marginBottom: '0.75rem', padding: '0.85rem 1rem', width: '100%' };
const panelStyle = { background: '#111827', borderRadius: '1.25rem', padding: '1.25rem' };
const primaryButtonStyle = { background: '#2563eb', border: 0, borderRadius: '0.75rem', color: '#fff', padding: '0.75rem 1rem' };
const secondaryButtonStyle = { background: '#1f2937', border: '1px solid #4b5563', borderRadius: '0.75rem', color: '#fff', padding: '0.75rem 1rem' };
const textAreaStyle = { borderRadius: '0.75rem', marginBottom: '0.75rem', minHeight: '120px', padding: '0.85rem 1rem', width: '100%' };
