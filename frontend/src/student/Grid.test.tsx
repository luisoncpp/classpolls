import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';

import { Grid } from './Grid';

describe('Grid', () => {
  it('hides queued questions before the first launch', () => {
    render(
      <Grid
        onVoteError={() => undefined}
        session={{
          createdAt: '2026-05-23T19:00:00.000Z',
          questions: [{ choices: ['A', 'B'], isActive: false, questionId: 'q_1', text: 'Queued first question' }],
          roomCode: 'ROOM',
          status: 'active'
        }}
        voteDispatcher={null}
      />
    );

    expect(screen.getByText('Waiting for the instructor...')).toBeInTheDocument();
    expect(screen.queryByText('Queued first question')).not.toBeInTheDocument();
  });
});
