import { useEffect, useState } from 'preact/hooks';

import { getErrorMessage, requestJson } from '../../common/apiClient';
import { PlanQuestionList } from './PlanQuestionList';
import { QuestionEditor } from './QuestionEditor';
import { DEFAULT_DRAFT, QuestionDraft, createDraftFromTemplate, parseDraft } from './questionDraft';
import { Plan, PlanDetail } from './planTypes';

type PlanManagerProps = {
  onOpenClassroom: (planId: string) => Promise<void>;
  token: string;
};

export function PlanManager({ onOpenClassroom, token }: PlanManagerProps) {
  const [draft, setDraft] = useState<QuestionDraft>(DEFAULT_DRAFT);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanDetail | null>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    void loadPlans(token, setError, setPlans);
  }, [token]);

  useEffect(() => {
    if (!expandedPlanId) return setSelectedPlan(null);
    void loadPlanDetail(expandedPlanId, token, setError, setSelectedPlan);
  }, [expandedPlanId, token]);

  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <p style={eyebrowStyle}>Instructor workspace</p>
          <h2 style={titleStyle}>Plans</h2>
        </div>
        <p style={descriptionStyle}>Build reusable question sets, then open a room when you are ready.</p>
      </div>
      <form onSubmit={(event) => void createPlan(event, title, token, setError, setPendingAction, setPlans, setTitle)} style={createFormStyle}>
        <input onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)} placeholder="New plan title" style={inputStyle} value={title} />
        <button disabled={pendingAction === 'create-plan'} style={pendingAction === 'create-plan' ? pressedPrimaryButtonStyle : primaryButtonStyle} type="submit">{pendingAction === 'create-plan' ? 'Creating...' : 'Create plan'}</button>
      </form>
      {error ? <p style={errorStyle}>{error}</p> : null}
      <div style={listStyle}>{plans.map((plan) => renderPlanCard(plan, expandedPlanId, onOpenClassroom, pendingAction, setError, setExpandedPlanId, setPendingAction, setPlans, token))}</div>
      {selectedPlan && expandedPlanId ? (
        <section style={editorPanelStyle}>
          <header style={editorHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>Editing plan</p>
              <h3 style={titleStyle}>{selectedPlan.title}</h3>
            </div>
            <span style={countBadgeStyle}>{selectedPlan.questions?.length ?? 0} questions</span>
          </header>
          <QuestionEditor
            actionLabel="Add question"
            draft={draft}
            error={editorError}
            onChange={setDraft}
            onSubmit={(event) => void addQuestion(event, draft, expandedPlanId, setDraft, setEditorError, setError, setPendingAction, setSelectedPlan, token)}
            onTemplateChange={(templateId) => setDraft(createDraftFromTemplate(templateId))}
            pending={pendingAction === 'add-question'}
            title="Question templates"
          />
          <PlanQuestionList pendingAction={pendingAction} planId={expandedPlanId} questions={selectedPlan.questions ?? []} setError={setError} setPendingAction={setPendingAction} setSelectedPlan={setSelectedPlan} token={token} />
        </section>
      ) : null}
    </section>
  );
}

async function addQuestion(
  event: Event,
  draft: QuestionDraft,
  planId: string,
  setDraft: (value: QuestionDraft) => void,
  setEditorError: (value: string | null) => void,
  setError: (value: string | null) => void,
  setPendingAction: (value: string | null) => void,
  setSelectedPlan: (value: PlanDetail | null) => void,
  token: string
) {
  event.preventDefault();
  const parsed = parseDraft(draft);
  if ('error' in parsed) return setEditorError(parsed.error);
  try {
    setPendingAction('add-question');
    await requestJson(`/api/plans/${planId}/questions`, { body: parsed, method: 'POST', token });
    setDraft(DEFAULT_DRAFT);
    setEditorError(null);
    setError(null);
    await loadPlanDetail(planId, token, setError, setSelectedPlan);
  } catch (error) {
    setEditorError(getErrorMessage(error));
  } finally {
    window.setTimeout(() => setPendingAction(null), 120);
  }
}

async function createPlan(
  event: Event,
  title: string,
  token: string,
  setError: (value: string | null) => void,
  setPendingAction: (value: string | null) => void,
  setPlans: (value: Plan[]) => void,
  setTitle: (value: string) => void
) {
  event.preventDefault();
  if (!title.trim()) return setError('Plan title is required');
  try {
    setPendingAction('create-plan');
    setError(null);
    await requestJson('/api/plans', { body: { title }, method: 'POST', token });
    setTitle('');
    await loadPlans(token, setError, setPlans);
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    window.setTimeout(() => setPendingAction(null), 120);
  }
}

async function deletePlan(planId: string, token: string, setError: (value: string | null) => void, setPlans: (value: Plan[]) => void) {
  try {
    await requestJson(`/api/plans/${planId}`, { method: 'DELETE', token });
    await loadPlans(token, setError, setPlans);
  } catch (error) {
    setError(getErrorMessage(error));
  }
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

async function loadPlans(token: string, setError: (value: string | null) => void, setPlans: (value: Plan[]) => void) {
  try {
    setPlans(await requestJson<Plan[]>('/api/plans', { token }));
    setError(null);
  } catch (error) {
    setError(getErrorMessage(error));
  }
}

function renderPlanCard(
  plan: Plan,
  expandedPlanId: string | null,
  onOpenClassroom: (planId: string) => Promise<void>,
  pendingAction: string | null,
  setError: (value: string | null) => void,
  setExpandedPlanId: (value: string | null) => void,
  setPendingAction: (value: string | null) => void,
  setPlans: (value: Plan[]) => void,
  token: string
) {
  const isExpanded = expandedPlanId === plan.id;
  const isOpening = pendingAction === `open-${plan.id}`;
  const isDeleting = pendingAction === `delete-${plan.id}`;
  return (
    <article key={plan.id} style={planCardStyle}>
      <div>
        <strong style={planTitleStyle}>{plan.title}</strong>
        <p style={descriptionStyle}>Create reusable prompts, then launch this plan into a live room.</p>
      </div>
      <div style={actionsStyle}>
        <button onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)} style={secondaryButtonStyle} type="button">{isExpanded ? 'Hide editor' : 'Edit questions'}</button>
        <button disabled={isOpening} onClick={() => void openPlan(plan.id, onOpenClassroom, setPendingAction)} style={isOpening ? pressedPrimaryButtonStyle : primaryButtonStyle} type="button">{isOpening ? 'Opening...' : 'Open classroom'}</button>
        <button disabled={isDeleting} onClick={() => void removePlan(plan.id, token, setError, setPendingAction, setPlans)} style={isDeleting ? pressedGhostButtonStyle : ghostButtonStyle} type="button">{isDeleting ? 'Deleting...' : 'Delete'}</button>
      </div>
    </article>
  );
}

async function openPlan(
  planId: string,
  onOpenClassroom: (planId: string) => Promise<void>,
  setPendingAction: (value: string | null) => void
) {
  try {
    setPendingAction(`open-${planId}`);
    await onOpenClassroom(planId);
  } finally {
    window.setTimeout(() => setPendingAction(null), 120);
  }
}

async function removePlan(
  planId: string,
  token: string,
  setError: (value: string | null) => void,
  setPendingAction: (value: string | null) => void,
  setPlans: (value: Plan[]) => void
) {
  try {
    setPendingAction(`delete-${planId}`);
    await deletePlan(planId, token, setError, setPlans);
  } finally {
    window.setTimeout(() => setPendingAction(null), 120);
  }
}

const actionsStyle = { display: 'flex', flexWrap: 'wrap' as const, gap: '0.75rem' };
const countBadgeStyle = { background: 'rgba(59, 130, 246, 0.14)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#bfdbfe', padding: '0.5rem 0.9rem' };
const createFormStyle = { alignItems: 'center', display: 'flex', flexWrap: 'wrap' as const, gap: '0.75rem' };
const descriptionStyle = { color: '#94a3b8', margin: 0 };
const editorHeaderStyle = { alignItems: 'center', display: 'flex', flexWrap: 'wrap' as const, gap: '0.75rem', justifyContent: 'space-between' };
const editorPanelStyle = { background: 'rgba(15, 23, 42, 0.82)', border: '1px solid #1e293b', borderRadius: '1.5rem', display: 'grid', gap: '1.25rem', padding: '1.3rem' };
const errorStyle = { color: '#fca5a5', margin: 0 };
const eyebrowStyle = { color: '#60a5fa', fontSize: '0.78rem', letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' as const };
const ghostButtonStyle = { background: 'transparent', border: '1px solid #475569', borderRadius: '999px', color: '#e2e8f0', padding: '0.8rem 1rem' };
const inputStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: '999px', color: '#e2e8f0', padding: '0.9rem 1rem', width: '280px' };
const listStyle = { display: 'grid', gap: '0.9rem' };
const planCardStyle = { alignItems: 'center', background: 'rgba(15, 23, 42, 0.86)', border: '1px solid #1e293b', borderRadius: '1.4rem', display: 'flex', flexWrap: 'wrap' as const, gap: '1rem', justifyContent: 'space-between', padding: '1.15rem 1.25rem' };
const planTitleStyle = { fontSize: '1.05rem' };
const pressedGhostButtonStyle = { background: 'rgba(59, 130, 246, 0.14)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#dbeafe', padding: '0.8rem 1rem' };
const pressedPrimaryButtonStyle = { background: 'rgba(59, 130, 246, 0.36)', border: '1px solid rgba(96, 165, 250, 0.4)', borderRadius: '999px', color: '#eff6ff', padding: '0.8rem 1rem' };
const primaryButtonStyle = { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 0, borderRadius: '999px', color: '#eff6ff', padding: '0.8rem 1rem' };
const sectionHeaderStyle = { alignItems: 'end', display: 'flex', flexWrap: 'wrap' as const, gap: '1rem', justifyContent: 'space-between' };
const sectionStyle = { display: 'grid', gap: '1rem' };
const secondaryButtonStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: '999px', color: '#e2e8f0', padding: '0.8rem 1rem' };
const titleStyle = { margin: 0 };
