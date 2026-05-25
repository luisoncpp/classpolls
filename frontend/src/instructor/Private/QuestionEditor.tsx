import { QUESTION_TEMPLATES } from './questionTemplates';
import { QuestionDraft } from './questionDraft';

type QuestionEditorProps = {
  actionLabel: string;
  draft: QuestionDraft;
  error: string | null;
  onChange: (draft: QuestionDraft) => void;
  onSubmit: (event: Event) => void;
  onTemplateChange: (templateId: string) => void;
  title: string;
};

export function QuestionEditor(props: QuestionEditorProps) {
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
          Correct choice index
          <input
            inputMode="numeric"
            onInput={(event) => props.onChange({ ...props.draft, correctChoiceIndex: (event.currentTarget as HTMLInputElement).value })}
            placeholder="0"
            style={inputStyle}
            value={props.draft.correctChoiceIndex}
          />
        </label>
      </div>
      <p style={hintStyle}>Choice index starts at 0. Example: `0` marks the first choice as correct.</p>
      {props.error ? <p style={errorStyle}>{props.error}</p> : null}
      <button style={primaryButtonStyle} type="submit">{props.actionLabel}</button>
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
const primaryButtonStyle = { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 0, borderRadius: '999px', color: '#eff6ff', padding: '0.85rem 1.2rem', width: 'fit-content' };
const templateButtonStyle = { alignItems: 'flex-start', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '1rem', color: '#e2e8f0', display: 'grid', gap: '0.25rem', padding: '0.95rem', textAlign: 'left' as const };
const templateGridStyle = { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' };
const textAreaStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: '0.9rem', color: '#e2e8f0', minHeight: '132px', padding: '0.85rem 1rem', width: '100%' };
const titleStyle = { fontSize: '1.05rem', margin: 0 };
