import { useI18n } from './index';

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();
  return (
    <label style={labelStyle}>
      <span style={textStyle}>{t('app.language')}</span>
      <select onInput={(event) => setLanguage((event.currentTarget as HTMLSelectElement).value as 'en' | 'es')} style={selectStyle} value={language}>
        <option value="en">{t('app.english')}</option>
        <option value="es">{t('app.spanish')}</option>
      </select>
    </label>
  );
}

const labelStyle = { alignItems: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' };
const selectStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: '999px', color: '#e2e8f0', padding: '0.45rem 0.8rem' };
const textStyle = { color: '#cbd5e1', fontSize: '0.9rem' };
