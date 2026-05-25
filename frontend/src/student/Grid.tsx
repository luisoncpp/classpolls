import { useEffect, useState } from 'preact/hooks';

import { getErrorMessage } from '../common/apiClient';
import { PublicSession, getActiveQuestion, getCountdownMs, isQuestionExpired, isQuestionOpen } from '../common/session';
import { VoteDispatcher } from './Private/VoteDispatcher';

type GridProps = {
  onVoteError: (message: string | null) => void;
  session: PublicSession;
  voteDispatcher: VoteDispatcher | null;
};

export function Grid({ onVoteError, session, voteDispatcher }: GridProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => startClock(setNow), []);
  const activeQuestion = getActiveQuestion(session);
  if (session.status === 'closed') return <p>Session closed.</p>;
  if (!activeQuestion) return <p>Waiting for the instructor...</p>;

  const countdownMs = getCountdownMs(activeQuestion, now);
  const displayedVote = voteDispatcher?.getDisplayedVote(activeQuestion.questionId, activeQuestion.myVote) ?? activeQuestion.myVote ?? null;
  const isExpired = isQuestionExpired(activeQuestion, now);
  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>{activeQuestion.text}</h2>
        {countdownMs !== null ? <p style={countdownStyle}>{Math.ceil(countdownMs / 1000)}s</p> : null}
      </div>
      <p style={statusStyle}>{isExpired ? 'Time is over' : displayedVote === null ? 'Choose one option' : 'Vote registered'}</p>
      <div style={gridStyle}>
        {activeQuestion.choices.map((choice, index) => renderChoiceButton(activeQuestion, choice, index, displayedVote, isExpired, onVoteError, voteDispatcher, now))}
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
const gridStyle = { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' };
const headerStyle = { alignItems: 'center', display: 'flex', gap: '1rem', justifyContent: 'space-between' };
const sectionStyle = { display: 'grid', gap: '0.8rem' };
const selectedStyle = { background: '#1d4ed8' };
const statusStyle = { color: '#cbd5e1', margin: 0 };
const titleStyle = { margin: 0 };
