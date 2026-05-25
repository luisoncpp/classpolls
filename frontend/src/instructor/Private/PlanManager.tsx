import { useEffect, useState } from 'preact/hooks';

import { getErrorMessage, requestJson } from '../../common/apiClient';
import { PlanQuestionList } from './PlanQuestionList';
import { QuestionEditor } from './QuestionEditor';
import { DEFAULT_DRAFT, QuestionDraft, createDraftFromTemplate, parseDraft } from './questionDraft';
import { Plan, PlanDetail } from './planTypes';
type PlanManagerProps = { onOpenClassroom: (planId: string) => void; token: string };

export function PlanManager({ onOpenClassroom, token }: PlanManagerProps) {
  const [draft, setDraft] = useState<QuestionDraft>(DEFAULT_DRAFT);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
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
      <form onSubmit={(event) => void createPlan(event, title, token, setError, setPlans, setTitle)} style={createFormStyle}>
        <input onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)} placeholder="New plan title" style={inputStyle} value={title} />
        <button style={primaryButtonStyle} type="submit">Create plan</button>
      </form>
      {error ? <p style={errorStyle}>{error}</p> : null}
      <div style={listStyle}>{plans.map((plan) => renderPlanCard(plan, expandedPlanId, onOpenClassroom, setError, setExpandedPlanId, setPlans, token))}</div>
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
            onSubmit={(event) => void addQuestion(event, draft, expandedPlanId, setDraft, setEditorError, setError, setSelectedPlan, token)}
            onTemplateChange={(templateId) => setDraft(createDraftFromTemplate(templateId))}
            title="Question templates"
          />
          <PlanQuestionList planId={expandedPlanId} questions={selectedPlan.questions ?? []} setError={setError} setSelectedPlan={setSelectedPlan} token={token} />
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
  setSelectedPlan: (value: PlanDetail | null) => void,
  token: string
) {
  event.preventDefault();
  const parsed = parseDraft(draft);
  if ('error' in parsed) return setEditorError(parsed.error);
  try {
    await requestJson(`/api/plans/${planId}/questions`, { body: parsed, method: 'POST', token });
    setDraft(DEFAULT_DRAFT);
    setEditorError(null);
    setError(null);
    await loadPlanDetail(planId, token, setError, setSelectedPlan);
  } catch (error) {
    setEditorError(getErrorMessage(error));
  }
}

async function createPlan(
  event: Event,
  title: string,
  token: string,
  setError: (value: string | null) => void,
  setPlans: (value: Plan[]) => void,
  setTitle: (value: string) => void
) {
  event.preventDefault();
  if (!title.trim()) return setError('Plan title is required');
  setError(null);
  await requestJson('/api/plans', { body: { title }, method: 'POST', token });
  setTitle('');
  await loadPlans(token, setError, setPlans);
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
  onOpenClassroom: (planId: string) => void,
  setError: (value: string | null) => void,
  setExpandedPlanId: (value: string | null) => void,
  setPlans: (value: Plan[]) => void,
  token: string
) {
  const isExpanded = expandedPlanId === plan.id;
  return (
    <article key={plan.id} style={planCardStyle}>
      <div>
        <strong style={planTitleStyle}>{plan.title}</strong>
        <p style={descriptionStyle}>Create reusable prompts, then launch this plan into a live room.</p>
      </div>
      <div style={actionsStyle}>
        <button onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)} style={secondaryButtonStyle} type="button">{isExpanded ? 'Hide editor' : 'Edit questions'}</button>
        <button onClick={() => onOpenClassroom(plan.id)} style={primaryButtonStyle} type="button">Open classroom</button>
        <button onClick={() => void deletePlan(plan.id, token, setError, setPlans)} style={ghostButtonStyle} type="button">Delete</button>
      </div>
    </article>
  );
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
const primaryButtonStyle = { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 0, borderRadius: '999px', color: '#eff6ff', padding: '0.8rem 1rem' };
const sectionHeaderStyle = { alignItems: 'end', display: 'flex', flexWrap: 'wrap' as const, gap: '1rem', justifyContent: 'space-between' };
const sectionStyle = { display: 'grid', gap: '1rem' };
const secondaryButtonStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: '999px', color: '#e2e8f0', padding: '0.8rem 1rem' };
const titleStyle = { margin: 0 };
