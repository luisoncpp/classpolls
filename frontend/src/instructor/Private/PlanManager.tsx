import { useEffect, useState } from 'preact/hooks';

import { getErrorMessage, requestJson } from '../../common/apiClient';
import { useI18n } from '../../common/i18n';
import { PlanQuestionList } from './PlanQuestionList';
import { QuestionEditor } from './QuestionEditor';
import { QuestionDraft, createDraftFromTemplate, getDefaultDraft, parseDraft } from './questionDraft';
import { Plan, PlanDetail } from './planTypes';

type PlanManagerProps = {
  onOpenClassroom: (planId: string) => Promise<void>;
  token: string;
};

export function PlanManager({ onOpenClassroom, token }: PlanManagerProps) {
  const { language, t } = useI18n();
  const [draft, setDraft] = useState<QuestionDraft>(() => getDefaultDraft(language));
  const [editorError, setEditorError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [isLoadingPlanDetail, setIsLoadingPlanDetail] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanDetail | null>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    void loadPlans(token, setError, setIsLoadingPlans, setPlans);
  }, [token]);

  useEffect(() => {
    if (!expandedPlanId) return setSelectedPlan(null);
    void loadPlanDetail(expandedPlanId, token, setError, setIsLoadingPlanDetail, setSelectedPlan);
  }, [expandedPlanId, token]);

  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={sectionHeadingStyle}>
          <p style={eyebrowStyle}>{t('plans.instructorWorkspace')}</p>
          <h2 style={titleStyle}>{t('plans.plans')}</h2>
          <p style={descriptionStyle}>{t('plans.description')}</p>
        </div>
        <span className="status-pill" style={countBadgeStyle}>{t('plans.planCount', { count: plans.length })}</span>
      </div>
      <form className="responsive-form" onSubmit={(event) => void createPlan(event, title, token, setError, setPendingAction, setPlans, setTitle, t('plans.planTitleRequired'))} style={createFormStyle}>
        <input onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)} placeholder={t('plans.newPlanTitle')} style={inputStyle} value={title} />
        <button className={pendingAction === 'create-plan' ? 'button-soft' : 'button-primary'} disabled={pendingAction === 'create-plan'} style={pendingAction === 'create-plan' ? pressedPrimaryButtonStyle : primaryButtonStyle} type="submit">{pendingAction === 'create-plan' ? t('plans.creatingPlan') : t('plans.createPlan')}</button>
      </form>
      {error ? <p style={errorStyle}>{error}</p> : null}
      {isLoadingPlans ? <p className="loading-indicator" style={loadingStyle}>{t('plans.loadingPlans')}</p> : null}
      {!isLoadingPlans && plans.length > 0 ? <div style={listStyle}>{plans.map((plan) => renderPlanCard(plan, expandedPlanId, onOpenClassroom, pendingAction, setError, setExpandedPlanId, setPendingAction, setPlans, token, t))}</div> : null}
      {!isLoadingPlans && plans.length === 0 ? <p style={emptyStateStyle}>{t('plans.noPlans')}</p> : null}
      {expandedPlanId ? (
        <section className="surface-panel" style={editorPanelStyle}>
          <header style={editorHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>{t('plans.editingPlan')}</p>
              <h3 style={titleStyle}>{selectedPlan?.title ?? t('plans.loadingPlanEditor')}</h3>
            </div>
            <span className="status-pill" style={countBadgeStyle}>{t('plans.planQuestionsCount', { count: selectedPlan?.questions?.length ?? 0 })}</span>
          </header>
          {isLoadingPlanDetail ? <p className="loading-indicator" style={loadingStyle}>{t('plans.loadingPlanEditor')}</p> : null}
          <QuestionEditor
            actionLabel={t('plans.addQuestion')}
            disabled={isLoadingPlanDetail}
            draft={draft}
            error={editorError}
            onChange={setDraft}
            onSubmit={(event) => void addQuestion(event, draft, expandedPlanId, language, setDraft, setEditorError, setError, setPendingAction, setSelectedPlan, token, t)}
            onTemplateChange={(templateId) => setDraft(createDraftFromTemplate(templateId, language))}
            pending={isLoadingPlanDetail || pendingAction === 'add-question'}
            title={t('plans.questionTemplates')}
          />
          <PlanQuestionList loading={isLoadingPlanDetail} pendingAction={pendingAction} planId={expandedPlanId} questions={selectedPlan?.questions ?? []} setError={setError} setPendingAction={setPendingAction} setSelectedPlan={setSelectedPlan} token={token} />
        </section>
      ) : null}
    </section>
  );
}

async function addQuestion(
  event: Event,
  draft: QuestionDraft,
  planId: string,
  language: 'en' | 'es',
  setDraft: (value: QuestionDraft) => void,
  setEditorError: (value: string | null) => void,
  setError: (value: string | null) => void,
  setPendingAction: (value: string | null) => void,
  setSelectedPlan: (value: PlanDetail | null) => void,
  token: string,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  event.preventDefault();
  const parsed = parseDraft(draft);
  if ('error' in parsed) return setEditorError(t(parsed.error));
  try {
    setPendingAction('add-question');
    await requestJson(`/api/plans/${planId}/questions`, { body: parsed, method: 'POST', token });
    setDraft(getDefaultDraft(language));
    setEditorError(null);
    setError(null);
    await loadPlanDetail(planId, token, setError, () => undefined, setSelectedPlan);
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
  setTitle: (value: string) => void,
  titleRequiredMessage: string
) {
  event.preventDefault();
  if (!title.trim()) return setError(titleRequiredMessage);
  try {
    setPendingAction('create-plan');
    setError(null);
    await requestJson('/api/plans', { body: { title }, method: 'POST', token });
    setTitle('');
    await loadPlans(token, setError, () => undefined, setPlans);
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    window.setTimeout(() => setPendingAction(null), 120);
  }
}

async function deletePlan(planId: string, token: string, setError: (value: string | null) => void, setPlans: (value: Plan[]) => void) {
  try {
    await requestJson(`/api/plans/${planId}`, { method: 'DELETE', token });
    await loadPlans(token, setError, () => undefined, setPlans);
  } catch (error) {
    setError(getErrorMessage(error));
  }
}

async function loadPlanDetail(
  planId: string,
  token: string,
  setError: (value: string | null) => void,
  setIsLoadingPlanDetail: (value: boolean) => void,
  setSelectedPlan: (value: PlanDetail | null) => void
) {
  try {
    setIsLoadingPlanDetail(true);
    setSelectedPlan(await requestJson<PlanDetail>(`/api/plans/${planId}`, { token }));
    setError(null);
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    setIsLoadingPlanDetail(false);
  }
}

async function loadPlans(token: string, setError: (value: string | null) => void, setIsLoadingPlans: (value: boolean) => void, setPlans: (value: Plan[]) => void) {
  try {
    setIsLoadingPlans(true);
    setPlans(await requestJson<Plan[]>('/api/plans', { token }));
    setError(null);
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    setIsLoadingPlans(false);
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
  token: string,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  const isExpanded = expandedPlanId === plan.id;
  const isOpening = pendingAction === `open-${plan.id}`;
  const isDeleting = pendingAction === `delete-${plan.id}`;
  return (
    <article className="interactive-card split-card" key={plan.id} style={planCardStyle}>
      <div>
        <strong style={planTitleStyle}>{plan.title}</strong>
        <p style={descriptionStyle}>{t('plans.planDescription')}</p>
      </div>
      <div className="action-row compact-actions" style={actionsStyle}>
        <button className="button-secondary" onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)} style={secondaryButtonStyle} type="button">{isExpanded ? t('plans.hideEditor') : t('plans.editQuestions')}</button>
        <button className={isOpening ? 'button-soft' : 'button-primary'} disabled={isOpening} onClick={() => void openPlan(plan.id, onOpenClassroom, setPendingAction)} style={isOpening ? pressedPrimaryButtonStyle : primaryButtonStyle} type="button">{isOpening ? t('plans.openingClassroom') : t('plans.openClassroom')}</button>
        <button className={isDeleting ? 'button-soft' : 'button-ghost'} disabled={isDeleting} onClick={() => void removePlan(plan.id, token, setError, setPendingAction, setPlans)} style={isDeleting ? pressedGhostButtonStyle : ghostButtonStyle} type="button">{isDeleting ? t('plans.deleting') : t('plans.delete')}</button>
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

const actionsStyle = { gap: '0.75rem', justifyContent: 'flex-end' };
const countBadgeStyle = { background: 'rgba(59, 130, 246, 0.14)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#bfdbfe', padding: '0.5rem 0.9rem' };
const createFormStyle = { gap: '0.75rem' };
const descriptionStyle = { color: '#94a3b8', margin: 0 };
const editorHeaderStyle = { alignItems: 'center', display: 'flex', flexWrap: 'wrap' as const, gap: '0.75rem', justifyContent: 'space-between' };
const editorPanelStyle = { display: 'grid', gap: '1.25rem', padding: '1.3rem' };
const errorStyle = { color: '#fca5a5', margin: 0 };
const eyebrowStyle = { color: '#60a5fa', fontSize: '0.78rem', letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' as const };
const ghostButtonStyle = { background: 'transparent', border: '1px solid #475569', borderRadius: '999px', color: '#e2e8f0', padding: '0.8rem 1rem' };
const inputStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: '999px', color: '#e2e8f0', padding: '0.9rem 1rem', width: '100%' };
const listStyle = { display: 'grid', gap: '0.9rem' };
const loadingStyle = { margin: 0 };
const emptyStateStyle = { color: '#94a3b8', margin: 0 };
const planCardStyle = { alignItems: 'start', background: 'rgba(15, 23, 42, 0.86)', border: '1px solid #1e293b', borderRadius: '1.4rem', padding: '1.15rem 1.25rem' };
const planTitleStyle = { fontSize: '1.05rem' };
const pressedGhostButtonStyle = { background: 'rgba(59, 130, 246, 0.14)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#dbeafe', padding: '0.8rem 1rem' };
const pressedPrimaryButtonStyle = { background: 'rgba(59, 130, 246, 0.36)', border: '1px solid rgba(96, 165, 250, 0.4)', borderRadius: '999px', color: '#eff6ff', padding: '0.8rem 1rem' };
const primaryButtonStyle = { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 0, borderRadius: '999px', color: '#eff6ff', padding: '0.8rem 1rem' };
const sectionHeadingStyle = { display: 'grid', gap: '0.25rem' };
const sectionHeaderStyle = { alignItems: 'center', display: 'flex', flexWrap: 'wrap' as const, gap: '0.75rem', justifyContent: 'space-between' };
const sectionStyle = { display: 'grid', gap: '1rem' };
const secondaryButtonStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: '999px', color: '#e2e8f0', padding: '0.8rem 1rem' };
const titleStyle = { margin: 0 };
