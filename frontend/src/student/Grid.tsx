import { PublicSession, getActiveQuestion } from '../common/session';
import { getErrorMessage } from '../common/apiClient';
import { VoteDispatcher } from './Private/VoteDispatcher';

type GridProps = {
  onVoteError: (message: string | null) => void;
  session: PublicSession;
  voteDispatcher: VoteDispatcher | null;
};

export function Grid({ onVoteError, session, voteDispatcher }: GridProps) {
  const activeQuestion = getActiveQuestion(session);
  if (session.status === 'closed') return <p>Session closed.</p>;
  if (!activeQuestion) return <p>Waiting for the instructor...</p>;

  const displayedVote = voteDispatcher?.getDisplayedVote(activeQuestion.questionId, activeQuestion.myVote) ?? activeQuestion.myVote ?? null;
  return (
    <section>
      <h2>{activeQuestion.text}</h2>
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {activeQuestion.choices.map((choice, index) => renderChoiceButton(activeQuestion.questionId, choice, index, displayedVote, onVoteError, voteDispatcher))}
      </div>
    </section>
  );
}

function renderChoiceButton(
  questionId: string,
  choice: string,
  index: number,
  displayedVote: number | null,
  onVoteError: (message: string | null) => void,
  voteDispatcher: VoteDispatcher | null
) {
  const isSelected = displayedVote === index;
  return (
    <button
      disabled={displayedVote !== null}
      key={`${questionId}-${index}`}
      onClick={() => void submitVote(questionId, index, onVoteError, voteDispatcher)}
      style={{
        background: isSelected ? '#1d4ed8' : '#111827',
        border: '1px solid #374151',
        borderRadius: '1rem',
        color: '#f9fafb',
        minHeight: '96px',
        padding: '1rem',
        textAlign: 'left'
      }}
    >
      <strong>{String.fromCharCode(65 + index)}.</strong> {choice}
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
