import { ComponentChildren, createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';

import { messages } from './Private/messages';

export type Language = keyof typeof messages;

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const STORAGE_KEY = 'cp.language';
const defaultLanguage = 'en';
const defaultValue: I18nValue = { language: defaultLanguage, setLanguage: () => undefined, t: (key, values) => translate(defaultLanguage, key, values) };
const I18nContext = createContext<I18nValue>(defaultValue);

export function I18nProvider(props: { children: ComponentChildren }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  return <I18nContext.Provider value={{ language, setLanguage, t: (key, values) => translate(language, key, values) }}>{props.children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

function getInitialLanguage(): Language {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'es') return stored;
  return window.navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function translate(language: Language, key: string, values?: Record<string, string | number>) {
  const template = getMessage(language, key) ?? getMessage(defaultLanguage, key) ?? key;
  if (!values) return template;
  return Object.entries(values).reduce((result, [name, value]) => result.split(`{${name}}`).join(String(value)), template);
}

function getMessage(language: Language, key: string) {
  let value: unknown = messages[language];
  for (const segment of key.split('.')) {
    if (!value || typeof value !== 'object' || !(segment in value)) return null;
    value = (value as Record<string, unknown>)[segment];
  }
  return typeof value === 'string' ? value : null;
}

export { LanguageSelector } from './LanguageSelector';
