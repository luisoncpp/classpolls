import { getErrorMessage, requestJson } from '../../common/apiClient';
import { PlanDetail, PlanQuestion } from './planTypes';

type PlanQuestionListProps = {
  pendingAction: string | null;
  planId: string;
  questions: PlanQuestion[];
  setError: (value: string | null) => void;
  setPendingAction: (value: string | null) => void;
  setSelectedPlan: (value: PlanDetail | null) => void;
  token: string;
};

export function PlanQuestionList(props: PlanQuestionListProps) {
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
    <article key={question.questionId} style={questionCardStyle}>
      <div style={questionBodyStyle}>
        <strong>{question.text}</strong>
        <p style={descriptionStyle}>{question.choices.join(' / ')}</p>
        <p style={metaStyle}>{renderMeta(question)}</p>
      </div>
      <button disabled={isPending} onClick={() => void removeQuestion(planId, question.questionId, setError, setPendingAction, setSelectedPlan, token)} style={isPending ? pressedGhostButtonStyle : ghostButtonStyle} type="button">{isPending ? 'Removing...' : 'Remove'}</button>
    </article>
  );
}

const descriptionStyle = { color: '#94a3b8', margin: 0 };
const ghostButtonStyle = { background: 'transparent', border: '1px solid #475569', borderRadius: '999px', color: '#e2e8f0', padding: '0.8rem 1rem' };
const metaStyle = { color: '#cbd5e1', margin: 0 };
const pressedGhostButtonStyle = { background: 'rgba(59, 130, 246, 0.14)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#dbeafe', padding: '0.8rem 1rem' };
const questionBodyStyle = { display: 'grid', gap: '0.35rem' };
const questionCardStyle = { alignItems: 'center', background: '#020617', border: '1px solid #1e293b', borderRadius: '1.1rem', display: 'flex', flexWrap: 'wrap' as const, gap: '1rem', justifyContent: 'space-between', padding: '1rem 1.1rem' };
const questionListStyle = { display: 'grid', gap: '0.8rem' };
