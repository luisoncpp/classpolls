type StatsQuestion = {
  choices: string[];
  correctChoiceIndex?: number;
  isActive: boolean;
  text: string;
  votes?: Record<string, number>;
};

type StatsViewProps = {
  question: StatsQuestion | null;
};

export function StatsView({ question }: StatsViewProps) {
  if (!question) return <p>Activate a question to view stats.</p>;
  const counts = question.choices.map((_, index) => countVotes(question.votes, index));
  const totalVotes = counts.reduce((sum, count) => sum + count, 0);
  return (
    <section style={{ display: 'grid', gap: '0.75rem' }}>
      <h3>{question.text}</h3>
      {question.choices.map((choice, index) => renderBar(choice, counts[index] ?? 0, index, question.correctChoiceIndex, totalVotes))}
    </section>
  );
}

function countVotes(votes: Record<string, number> | undefined, choiceIndex: number): number {
  return Object.values(votes ?? {}).filter((value) => value === choiceIndex).length;
}

function renderBar(
  choice: string,
  count: number,
  index: number,
  correctChoiceIndex: number | undefined,
  totalVotes: number
) {
  const percent = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
  const isCorrect = correctChoiceIndex === index;
  return (
    <div key={`${choice}-${index}`} style={{ display: 'grid', gap: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{choice}</span><span>{count} votes</span></div>
      <div style={{ background: '#1f2937', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ background: isCorrect ? '#16a34a' : '#2563eb', color: '#fff', minHeight: '18px', paddingLeft: '0.5rem', width: `${percent}%` }}>{percent}%</div>
      </div>
    </div>
  );
}
