import { QUESTION_TEMPLATES } from './questionTemplates';
import { QuestionDraft, getDraftChoices } from './questionDraft';

type QuestionEditorProps = {
  actionLabel: string;
  draft: QuestionDraft;
  error: string | null;
  onChange: (draft: QuestionDraft) => void;
  onSubmit: (event: Event) => void;
  onTemplateChange: (templateId: string) => void;
  pending?: boolean;
  title: string;
};

export function QuestionEditor(props: QuestionEditorProps) {
  const choices = getDraftChoices(props.draft);
  return (
    <form onSubmit={props.onSubmit} style={formStyle}>
      <div style={templateGridStyle}>
        {QUESTION_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => props.onTemplateChange(template.id)}
            style={templateButtonStyle}
            type="button"
          >
            <strong>{template.label}</strong>
            <span style={mutedStyle}>{template.description}</span>
          </button>
        ))}
      </div>
      <h3 style={titleStyle}>{props.title}</h3>
      <input
        onInput={(event) => props.onChange({ ...props.draft, text: (event.currentTarget as HTMLInputElement).value })}
        placeholder="Question text"
        style={inputStyle}
        value={props.draft.text}
      />
      <textarea
        onInput={(event) => props.onChange({ ...props.draft, choicesText: (event.currentTarget as HTMLTextAreaElement).value })}
        placeholder="One choice per line"
        rows={5}
        style={textAreaStyle}
        value={props.draft.choicesText}
      />
      <div style={metaGridStyle}>
        <label style={labelStyle}>
          Time limit (seconds)
          <input
            inputMode="numeric"
            onInput={(event) => props.onChange({ ...props.draft, timeLimit: (event.currentTarget as HTMLInputElement).value })}
            placeholder="30"
            style={inputStyle}
            value={props.draft.timeLimit}
          />
        </label>
        <label style={labelStyle}>
          Correct answer
          <select
            onInput={(event) => props.onChange({ ...props.draft, correctChoiceIndex: (event.currentTarget as HTMLSelectElement).value })}
            style={inputStyle}
            value={props.draft.correctChoiceIndex}
          >
            <option value="">No marked answer</option>
            {choices.map((choice, index) => <option key={`${choice}-${index}`} value={String(index)}>{choice}</option>)}
          </select>
        </label>
      </div>
      <p style={hintStyle}>The correct answer selector updates automatically from the listed choices.</p>
      {props.error ? <p style={errorStyle}>{props.error}</p> : null}
      <button disabled={props.pending} style={props.pending ? pendingButtonStyle : primaryButtonStyle} type="submit">{props.pending ? 'Working...' : props.actionLabel}</button>
    </form>
  );
}

const errorStyle = { color: '#fca5a5', margin: 0 };
const formStyle = { display: 'grid', gap: '0.9rem' };
const hintStyle = { color: '#94a3b8', fontSize: '0.92rem', margin: 0 };
const inputStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: '0.9rem', color: '#e2e8f0', padding: '0.85rem 1rem', width: '100%' };
const labelStyle = { color: '#cbd5e1', display: 'grid', fontSize: '0.92rem', gap: '0.45rem' };
const metaGridStyle = { display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' };
const mutedStyle = { color: '#94a3b8', fontSize: '0.85rem' };
const pendingButtonStyle = { background: 'rgba(59, 130, 246, 0.3)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#eff6ff', padding: '0.85rem 1.2rem', width: 'fit-content' };
const primaryButtonStyle = { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 0, borderRadius: '999px', color: '#eff6ff', padding: '0.85rem 1.2rem', width: 'fit-content' };
const templateButtonStyle = { alignItems: 'flex-start', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '1rem', color: '#e2e8f0', display: 'grid', gap: '0.25rem', padding: '0.95rem', textAlign: 'left' as const };
const templateGridStyle = { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' };
const textAreaStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: '0.9rem', color: '#e2e8f0', minHeight: '132px', padding: '0.85rem 1rem', width: '100%' };
const titleStyle = { fontSize: '1.05rem', margin: 0 };
