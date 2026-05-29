import { useI18n } from '../../common/i18n';
import { QUESTION_TEMPLATES } from './questionTemplates';
import { QuestionDraft, getDraftChoices } from './questionDraft';

type QuestionEditorProps = {
  actionLabel: string;
  disabled?: boolean;
  draft: QuestionDraft;
  error: string | null;
  onChange: (draft: QuestionDraft) => void;
  onSubmit: (event: Event) => void;
  onTemplateChange: (templateId: string) => void;
  pending?: boolean;
  title: string;
};

export function QuestionEditor(props: QuestionEditorProps) {
  const { t } = useI18n();
  const choices = getDraftChoices(props.draft);
  return (
    <form onSubmit={props.onSubmit} style={{ ...formStyle, ...(props.disabled ? disabledFormStyle : null) }}>
      <header style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>{t('editor.questionBuilder')}</p>
          <h3 style={titleStyle}>{props.title}</h3>
        </div>
        <span style={countBadgeStyle}>{t('editor.choiceCount', { count: choices.length })}</span>
      </header>
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <strong>{t('editor.pickStartingPoint')}</strong>
          <span style={mutedStyle}>{t('editor.templateHelp')}</span>
        </div>
        <div style={templateGridStyle}>
          {QUESTION_TEMPLATES.map((template) => (
            <button
              className="button-secondary"
              disabled={props.disabled}
              key={template.id}
              onClick={() => props.onTemplateChange(template.id)}
              style={templateButtonStyle}
              type="button"
            >
              <strong>{t(`templates.${template.id}Label`)}</strong>
              <span style={mutedStyle}>{t(`templates.${template.id}Description`)}</span>
            </button>
          ))}
        </div>
      </section>
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <strong>{t('editor.writePrompt')}</strong>
          <span style={mutedStyle}>{t('editor.promptHelp')}</span>
        </div>
        <input
          disabled={props.disabled}
          onInput={(event) => props.onChange({ ...props.draft, text: (event.currentTarget as HTMLInputElement).value })}
          placeholder={t('editor.questionText')}
          style={inputStyle}
          value={props.draft.text}
        />
        <textarea
          disabled={props.disabled}
          onInput={(event) => props.onChange({ ...props.draft, choicesText: (event.currentTarget as HTMLTextAreaElement).value })}
          placeholder={t('editor.oneChoicePerLine')}
          rows={5}
          style={textAreaStyle}
          value={props.draft.choicesText}
        />
      </section>
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <strong>{t('editor.configureAnswer')}</strong>
          <span style={mutedStyle}>{t('editor.setTimingHelp')}</span>
        </div>
        <div style={metaGridStyle}>
          <label style={labelStyle}>
            {t('editor.timeLimitSeconds')}
            <input
              disabled={props.disabled}
              inputMode="numeric"
              onInput={(event) => props.onChange({ ...props.draft, timeLimit: (event.currentTarget as HTMLInputElement).value })}
              placeholder="30"
              style={inputStyle}
              value={props.draft.timeLimit}
            />
          </label>
          <label style={labelStyle}>
            {t('editor.correctAnswer')}
            <select
              disabled={props.disabled}
              onInput={(event) => props.onChange({ ...props.draft, correctChoiceIndex: (event.currentTarget as HTMLSelectElement).value })}
              style={inputStyle}
              value={props.draft.correctChoiceIndex}
            >
              <option value="">{t('editor.noMarkedAnswer')}</option>
              {choices.map((choice, index) => <option key={`${choice}-${index}`} value={String(index)}>{choice}</option>)}
            </select>
          </label>
        </div>
        <p style={hintStyle}>{t('editor.hint')}</p>
      </section>
      {props.error ? <p style={errorStyle}>{props.error}</p> : null}
      <button className={props.pending ? 'button-soft' : 'button-primary'} disabled={props.pending} style={props.pending ? pendingButtonStyle : primaryButtonStyle} type="submit">{props.pending ? t('editor.working') : props.actionLabel}</button>
    </form>
  );
}

const countBadgeStyle = { background: 'rgba(59, 130, 246, 0.14)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#bfdbfe', padding: '0.45rem 0.8rem' };
const errorStyle = { color: '#fca5a5', margin: 0 };
const disabledFormStyle = { opacity: 0.72 };
const eyebrowStyle = { color: '#60a5fa', fontSize: '0.78rem', letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' as const };
const formStyle = { display: 'grid', gap: '0.9rem' };
const headerStyle = { alignItems: 'center', display: 'flex', flexWrap: 'wrap' as const, gap: '0.75rem', justifyContent: 'space-between' };
const hintStyle = { color: '#94a3b8', fontSize: '0.92rem', margin: 0 };
const inputStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: '0.9rem', color: '#e2e8f0', padding: '0.85rem 1rem', width: '100%' };
const labelStyle = { color: '#cbd5e1', display: 'grid', fontSize: '0.92rem', gap: '0.45rem' };
const metaGridStyle = { display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' };
const mutedStyle = { color: '#94a3b8', fontSize: '0.85rem' };
const pendingButtonStyle = { background: 'rgba(59, 130, 246, 0.3)', border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '999px', color: '#eff6ff', padding: '0.85rem 1.2rem', width: 'fit-content' };
const primaryButtonStyle = { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 0, borderRadius: '999px', color: '#eff6ff', padding: '0.85rem 1.2rem', width: 'fit-content' };
const sectionHeaderStyle = { display: 'grid', gap: '0.2rem' };
const sectionStyle = { background: 'rgba(2, 6, 23, 0.5)', border: '1px solid #1e293b', borderRadius: '1rem', display: 'grid', gap: '0.85rem', padding: '1rem' };
const templateButtonStyle = { alignItems: 'flex-start', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '1rem', color: '#e2e8f0', display: 'grid', gap: '0.25rem', padding: '0.95rem', textAlign: 'left' as const };
const templateGridStyle = { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' };
const textAreaStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: '0.9rem', color: '#e2e8f0', minHeight: '132px', padding: '0.85rem 1rem', width: '100%' };
const titleStyle = { fontSize: '1.05rem', margin: 0 };
