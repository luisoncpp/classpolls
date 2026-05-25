export type QuestionDraft = {
  choicesText: string;
  correctChoiceIndex: string;
  text: string;
  timeLimit: string;
};

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

const TEMPLATE_MAP: Record<string, QuestionTemplate> = {
  abcd: { choicesText: 'A\nB\nC\nD', timeLimit: '30' },
  confidence: { choicesText: '1\n2\n3\n4\n5', timeLimit: '20' },
  yesno: { choicesText: 'Yes\nNo', timeLimit: '15' }
};

export const DEFAULT_DRAFT = createDraftFromTemplate('custom');

export function createDraftFromTemplate(templateId: string): QuestionDraft {
  const template = TEMPLATE_MAP[templateId] ?? { choicesText: 'Option A\nOption B', timeLimit: '30' };
  return {
    choicesText: template.choicesText,
    correctChoiceIndex: '',
    text: '',
    timeLimit: template.timeLimit
  };
}

export function parseDraft(draft: QuestionDraft): ParsedDraft | { error: string } {
  const text = draft.text.trim();
  const choices = getDraftChoices(draft);
  if (!text || choices.length < 2) return { error: 'Questions need text and at least two choices' };
  const timeLimit = parseNumber(draft.timeLimit);
  if (timeLimit !== undefined && timeLimit <= 0) {
    return { error: 'Use a time limit greater than 0 seconds' };
  }
  const correctChoiceIndex = parseNumber(draft.correctChoiceIndex);
  if (correctChoiceIndex !== undefined && (correctChoiceIndex < 0 || correctChoiceIndex >= choices.length)) {
    return { error: 'Correct answer must match one of the listed choices' };
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
