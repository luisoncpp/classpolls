import { badRequest } from './_shared';

type QuestionPayload = {
  choices: string[];
  correctChoiceIndex?: number;
  text: string;
  timeLimit?: number;
};

export function parseQuestionPayload(body: Record<string, unknown>): QuestionPayload {
  const choices = Array.isArray(body.choices) ? body.choices.filter(isString) : [];
  const correctChoiceIndex = readInteger(body.correctChoiceIndex);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const timeLimit = readInteger(body.timeLimit);
  if (!text || choices.length < 2 || isInvalidCorrectChoice(correctChoiceIndex, choices.length)) {
    badRequest('INVALID_QUESTION', 'Question payload is invalid');
  }
  if (timeLimit !== undefined && timeLimit <= 0) badRequest('INVALID_QUESTION', 'Question payload is invalid');
  return {
    ...(correctChoiceIndex === undefined ? {} : { correctChoiceIndex }),
    ...(timeLimit === undefined ? {} : { timeLimit }),
    choices,
    text
  };
}

function isInvalidCorrectChoice(correctChoiceIndex: number | undefined, choiceCount: number) {
  return correctChoiceIndex !== undefined && (correctChoiceIndex < 0 || correctChoiceIndex >= choiceCount);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function readInteger(value: unknown): number | undefined {
  return Number.isInteger(value) ? (value as number) : undefined;
}
