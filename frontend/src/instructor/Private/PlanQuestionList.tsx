import { getErrorMessage, requestJson } from '../../common/apiClient';
import { PlanDetail, PlanQuestion } from './planTypes';

type PlanQuestionListProps = {
  loading?: boolean;
  pendingAction: string | null;
  planId: string;
  questions: PlanQuestion[];
  setError: (value: string | null) => void;
  setPendingAction: (value: string | null) => void;
  setSelectedPlan: (value: PlanDetail | null) => void;
  token: string;
};

export function PlanQuestionList(props: PlanQuestionListProps) {
  if (props.loading) return <p className="loading-indicator" style={loadingStyle}>Loading questions...</p>;
  if (props.questions.length === 0) return <p style={emptyStateStyle}>This plan has no questions yet. Pick a template above to start building the sequence.</p>;
  return <div style={questionListStyle}>{props.questions.map((question) => renderQuestion(question, props.pendingAction, props.planId, props.setError, props.setPendingAction, props.setSelectedPlan, props.token))}</div>;
}

async function loadPlanDetail(
  planId: string,
  token: string,
  setError: (value: string | null) => void,
  setSelectedPlan: (value: PlanDetail | null) => void
) {
  try {
    setSelectedPlan(await requestJson<PlanDetail>(`/api/plans/${planId}`, { token }));
    setError(null);
  } catch (error) {
    setError(getErrorMessage(error));
  }
}

async function removeQuestion(
  planId: string,
  questionId: string,
  setError: (value: string | null) => void,
  setPendingAction: (value: string | null) => void,
  setSelectedPlan: (value: PlanDetail | null) => void,
  token: string
) {
  try {
    setPendingAction(`remove-${questionId}`);
    await requestJson(`/api/plans/${planId}/questions/${questionId}`, { method: 'DELETE', token });
    await loadPlanDetail(planId, token, setError, setSelectedPlan);
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    window.setTimeout(() => setPendingAction(null), 120);
  }
}

function renderMeta(question: PlanQuestion) {
  const parts = [`${question.choices.length} choices`];
  if (typeof question.timeLimit === 'number') parts.push(`${question.timeLimit}s`);
  if (typeof question.correctChoiceIndex === 'number') parts.push('answer marked');
  return parts.join(' • ');
}

function renderQuestion(
  question: PlanQuestion,
  pendingAction: string | null,
  planId: string,
  setError: (value: string | null) => void,
  setPendingAction: (value: string | null) => void,
  setSelectedPlan: (value: PlanDetail | null) => void,
  token: string
) {
  const isPending = pendingAction === `remove-${question.questionId}`;
  return (
    <article className="interactive-card split-card" key={question.questionId} style={questionCardStyle}>
      <div style={questionBodyStyle}>
        <strong>{question.text}</strong>
        <p style={descriptionStyle}>{question.choices.join(' / ')}</p>
        <p style={metaStyle}>{renderMeta(question)}</p>
      </div>
      <button className={isPending ? 'button-soft' : 'button-ghost'} disabled={isPending} onClick={() => void removeQuestion(planId, question.questionId, setError, setPendingAction, setSelectedPlan, token)} style={isPending ? pressedGhostButtonStyle : ghostButtonStyle} type="button">{isPending ? 'Removing...' : 'Remove'}</button>
    </article>
  );
}

const descriptionStyle = { color: '#94a3b8', margin: 0 };
const emptyStateStyle = { color: '#94a3b8', margin: 0 };
const ghostButtonStyle = { background: 'transparent', border: '1px solid #475569', borderRadius: '999px', color: '#e2e8f0', padding: '0.8rem 1rem' };
const loadingStyle = { margin: 0 };
const metaStyle = { color: '#cbd5e1', margin: 0 };
const pressedGhostButtonStyle = { background: 'rgba(59, 130, 246, 0.14)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#dbeafe', padding: '0.8rem 1rem' };
const questionBodyStyle = { display: 'grid', gap: '0.35rem' };
const questionCardStyle = { alignItems: 'start', background: '#020617', border: '1px solid #1e293b', borderRadius: '1.1rem', padding: '1rem 1.1rem' };
const questionListStyle = { display: 'grid', gap: '0.8rem' };
