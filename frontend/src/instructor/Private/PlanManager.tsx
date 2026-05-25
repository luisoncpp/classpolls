import { useEffect, useState } from 'preact/hooks';

import { getErrorMessage, requestJson } from '../../common/apiClient';

type Plan = {
  id: string;
  title: string;
};

type PlanManagerProps = {
  onOpenClassroom: (planId: string) => void;
  token: string;
};

export function PlanManager({ onOpenClassroom, token }: PlanManagerProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadPlans(token, setError, setPlans);
  }, [token]);

  return (
    <section style={sectionStyle}>
      <h2>Plans</h2>
      <form onSubmit={(event) => void createPlan(event, title, token, setError, setPlans, setTitle)}>
        <input onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)} placeholder="New plan title" style={inputStyle} value={title} />
        <button style={primaryButtonStyle} type="submit">Create plan</button>
      </form>
      {error ? <p style={errorStyle}>{error}</p> : null}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {plans.map((plan) => (
          <article key={plan.id} style={cardStyle}>
            <strong>{plan.title}</strong>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => onOpenClassroom(plan.id)} style={primaryButtonStyle} type="button">Open classroom</button>
              <button onClick={() => void deletePlan(plan.id, token, setError, setPlans)} style={secondaryButtonStyle} type="button">Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
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

async function deletePlan(
  planId: string,
  token: string,
  setError: (value: string | null) => void,
  setPlans: (value: Plan[]) => void
) {
  try {
    await requestJson(`/api/plans/${planId}`, { method: 'DELETE', token });
    await loadPlans(token, setError, setPlans);
  } catch (error) {
    setError(getErrorMessage(error));
  }
}

async function loadPlans(
  token: string,
  setError: (value: string | null) => void,
  setPlans: (value: Plan[]) => void
) {
  try {
    setPlans(await requestJson<Plan[]>('/api/plans', { token }));
    setError(null);
  } catch (error) {
    setError(getErrorMessage(error));
  }
}

const cardStyle = { alignItems: 'center', background: '#111827', borderRadius: '1rem', display: 'flex', justifyContent: 'space-between', padding: '1rem' };
const errorStyle = { color: '#fca5a5' };
const inputStyle = { borderRadius: '0.75rem', marginRight: '0.75rem', padding: '0.85rem 1rem', width: '260px' };
const primaryButtonStyle = { background: '#2563eb', border: 0, borderRadius: '0.75rem', color: '#fff', padding: '0.75rem 1rem' };
const secondaryButtonStyle = { background: '#1f2937', border: '1px solid #4b5563', borderRadius: '0.75rem', color: '#fff', padding: '0.75rem 1rem' };
const sectionStyle = { display: 'grid', gap: '1rem' };
