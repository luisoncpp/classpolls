import { useEffect, useState } from 'preact/hooks';

import { getErrorMessage } from '../common/apiClient';
import { PublicSession, getCountdownMs, getDisplayQuestion, isQuestionExpired, isQuestionOpen } from '../common/session';
import { VoteDispatcher } from './Private/VoteDispatcher';

type GridProps = {
  onVoteError: (message: string | null) => void;
  session: PublicSession;
  voteDispatcher: VoteDispatcher | null;
};

export function Grid({ onVoteError, session, voteDispatcher }: GridProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => startClock(setNow), []);
  const question = getDisplayQuestion(session);
  if (!question && session.status === 'closed') return <p>Session closed.</p>;
  if (!question) return <p>Waiting for the instructor...</p>;

  const countdownMs = getCountdownMs(question, now);
  const displayedVote = voteDispatcher?.getDisplayedVote(question.questionId, question.myVote) ?? question.myVote ?? null;
  const isExpired = session.status === 'closed' || isQuestionExpired(question, now) || question.isActive === false;
  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>{question.text}</h2>
        {countdownMs !== null && !isExpired ? <p style={countdownStyle}>{Math.ceil(countdownMs / 1000)}s</p> : null}
      </div>
      <p style={statusStyle}>{session.status === 'closed' ? 'Session closed' : isExpired ? 'Time is over' : displayedVote === null ? 'Choose one option' : 'Answer registered'}</p>
      <div style={gridStyle}>
        {question.choices.map((choice, index) => renderChoiceButton(question, choice, index, displayedVote, isExpired, onVoteError, voteDispatcher, now))}
      </div>
    </section>
  );
}

function renderChoiceButton(
  activeQuestion: PublicSession['questions'][number],
  choice: string,
  index: number,
  displayedVote: number | null,
  isExpired: boolean,
  onVoteError: (message: string | null) => void,
  voteDispatcher: VoteDispatcher | null,
  now: number
) {
  const isCorrect = activeQuestion.correctChoiceIndex === index && isExpired;
  const isSelected = displayedVote === index;
  const disabled = displayedVote !== null || !isQuestionOpen(activeQuestion, now);
  return (
    <button
      className={disabled ? 'button-soft' : 'button-secondary'}
      disabled={disabled}
      key={`${activeQuestion.questionId}-${index}`}
      onClick={() => void submitVote(activeQuestion.questionId, index, onVoteError, voteDispatcher)}
      style={{
        ...buttonStyle,
        ...(isSelected ? selectedStyle : null),
        ...(isCorrect ? correctStyle : null),
        ...(disabled ? disabledStyle : null)
      }}
    >
      <span>{choice}</span>
    </button>
  );
}

async function submitVote(
  questionId: string,
  choiceIndex: number,
  onVoteError: (message: string | null) => void,
  voteDispatcher: VoteDispatcher | null
) {
  if (!voteDispatcher) return;
  onVoteError(null);
  try {
    await voteDispatcher.submitVote(questionId, choiceIndex);
  } catch (error) {
    onVoteError(getErrorMessage(error));
  }
}

function startClock(setNow: (value: number) => void) {
  const timerId = window.setInterval(() => setNow(Date.now()), 1000);
  return () => window.clearInterval(timerId);
}

const buttonStyle = { background: '#111827', border: '1px solid #334155', borderRadius: '1rem', color: '#f9fafb', minHeight: '88px', padding: '1rem', textAlign: 'left' as const };
const correctStyle = { background: 'rgba(22, 163, 74, 0.22)', border: '1px solid rgba(34, 197, 94, 0.6)' };
const countdownStyle = { color: '#fde68a', margin: 0 };
const disabledStyle = { opacity: 0.82 };
const gridStyle = { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' };
const headerStyle = { alignItems: 'start', display: 'flex', flexWrap: 'wrap' as const, gap: '0.75rem', justifyContent: 'space-between' };
const sectionStyle = { display: 'grid', gap: '0.95rem' };
const selectedStyle = { background: '#1d4ed8' };
const statusStyle = { color: '#cbd5e1', margin: 0 };
const titleStyle = { fontSize: 'clamp(1.3rem, 3vw, 2rem)', margin: 0 };
