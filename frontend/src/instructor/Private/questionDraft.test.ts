import { describe, expect, it } from 'vitest';

import { createDraftFromTemplate, parseDraft } from './questionDraft';

describe('question draft helpers', () => {
  it('loads preset choices from a template', () => {
    const draft = createDraftFromTemplate('abcd', 'en');

    expect(draft.choicesText).toBe('A\nB\nC\nD');
    expect(draft.correctChoiceIndex).toBe('');
    expect(draft.timeLimit).toBe('30');
  });

  it('localizes template defaults for spanish', () => {
    const draft = createDraftFromTemplate('yesno', 'es');

    expect(draft.choicesText).toBe('Si\nNo');
  });

  it('parses time limit and correct answer into a payload', () => {
    const payload = parseDraft({
      choicesText: 'Red\nBlue\nGreen',
      correctChoiceIndex: '1',
      text: 'Pick a color',
      timeLimit: '15'
    });

    expect('error' in payload).toBe(false);
    if ('error' in payload) return;
    expect(payload).toEqual({
      choices: ['Red', 'Blue', 'Green'],
      correctChoiceIndex: 1,
      text: 'Pick a color',
      timeLimit: 15
    });
  });

  it('rejects invalid time limits', () => {
    const payload = parseDraft({
      choicesText: 'Red\nBlue',
      correctChoiceIndex: '',
      text: 'Pick a color',
      timeLimit: '0'
    });

    expect(payload).toEqual({ error: 'questionDraft.positiveTimeLimit' });
  });
});
