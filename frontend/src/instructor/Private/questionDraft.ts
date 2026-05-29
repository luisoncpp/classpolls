import { Language } from '../../common/i18n';

export type QuestionDraft = {
  choicesText: string;
  correctChoiceIndex: string;
  text: string;
  timeLimit: string;
};

type QuestionDraftErrorKey = 'questionDraft.correctAnswerMismatch' | 'questionDraft.needTextAndChoices' | 'questionDraft.positiveTimeLimit';

type QuestionTemplate = {
  choicesText: string;
  timeLimit: string;
};

type ParsedDraft = {
  choices: string[];
  correctChoiceIndex?: number;
  text: string;
  timeLimit?: number;
};

const TEMPLATE_MAP: Record<string, Record<Language, QuestionTemplate>> = {
  abcd: { en: { choicesText: 'A\nB\nC\nD', timeLimit: '30' }, es: { choicesText: 'A\nB\nC\nD', timeLimit: '30' } },
  confidence: { en: { choicesText: '1\n2\n3\n4\n5', timeLimit: '20' }, es: { choicesText: '1\n2\n3\n4\n5', timeLimit: '20' } },
  custom: { en: { choicesText: 'Option A\nOption B', timeLimit: '30' }, es: { choicesText: 'Opcion A\nOpcion B', timeLimit: '30' } },
  yesno: { en: { choicesText: 'Yes\nNo', timeLimit: '15' }, es: { choicesText: 'Si\nNo', timeLimit: '15' } }
};

export function getDefaultDraft(language: Language) {
  return createDraftFromTemplate('custom', language);
}

export function createDraftFromTemplate(templateId: string, language: Language): QuestionDraft {
  const template = TEMPLATE_MAP[templateId]?.[language] ?? TEMPLATE_MAP.custom[language];
  return {
    choicesText: template.choicesText,
    correctChoiceIndex: '',
    text: '',
    timeLimit: template.timeLimit
  };
}

export function parseDraft(draft: QuestionDraft): ParsedDraft | { error: QuestionDraftErrorKey } {
  const text = draft.text.trim();
  const choices = getDraftChoices(draft);
  if (!text || choices.length < 2) return { error: 'questionDraft.needTextAndChoices' };
  const timeLimit = parseNumber(draft.timeLimit);
  if (timeLimit !== undefined && timeLimit <= 0) {
    return { error: 'questionDraft.positiveTimeLimit' };
  }
  const correctChoiceIndex = parseNumber(draft.correctChoiceIndex);
  if (correctChoiceIndex !== undefined && (correctChoiceIndex < 0 || correctChoiceIndex >= choices.length)) {
    return { error: 'questionDraft.correctAnswerMismatch' };
  }
  return {
    ...(correctChoiceIndex === undefined ? {} : { correctChoiceIndex }),
    ...(timeLimit === undefined ? {} : { timeLimit }),
    choices,
    text
  };
}

export function getDraftChoices(draft: Pick<QuestionDraft, 'choicesText'>): string[] {
  return draft.choicesText.split('\n').map((choice) => choice.trim()).filter(Boolean);
}

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
