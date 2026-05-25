type StatsQuestion = {
  choices: string[];
  correctChoiceIndex?: number;
  isActive: boolean;
  text: string;
  votes?: Record<string, number>;
};

type StatsViewProps = { question: StatsQuestion | null };

const SLICE_COLORS = ['#60a5fa', '#f59e0b', '#f472b6', '#34d399', '#a78bfa', '#fb7185'];

export function StatsView({ question }: StatsViewProps) {
  if (!question) return <p>Activate a question to view stats.</p>;
  const counts = question.choices.map((_, index) => countVotes(question.votes, index));
  const totalVotes = counts.reduce((sum, count) => sum + count, 0);
  return (
    <section style={layoutStyle}>
      <div>
        <p style={eyebrowStyle}>Live results</p>
        <h3 style={titleStyle}>{question.text}</h3>
        <p style={metaStyle}>{totalVotes} total votes</p>
      </div>
      <div style={chartLayoutStyle}>
        <div style={pieWrapStyle}>
          <div style={pieStyle(counts, totalVotes)} />
          <div style={pieCenterStyle}>
            <strong>{totalVotes}</strong>
            <span>votes</span>
          </div>
        </div>
        <div style={legendStyle}>{question.choices.map((choice, index) => renderLegendItem(choice, counts[index] ?? 0, index, question.correctChoiceIndex, totalVotes))}</div>
      </div>
    </section>
  );
}

function countVotes(votes: Record<string, number> | undefined, choiceIndex: number): number {
  return Object.values(votes ?? {}).filter((value) => value === choiceIndex).length;
}

function pieStyle(counts: number[], totalVotes: number) {
  if (!totalVotes) {
    return { ...pieBaseStyle, background: 'conic-gradient(#1e293b 0deg 360deg)' };
  }
  let currentAngle = 0;
  const slices = counts.map((count, index) => {
    const angle = (count / totalVotes) * 360;
    const start = currentAngle;
    currentAngle += angle;
    return `${SLICE_COLORS[index % SLICE_COLORS.length]} ${start}deg ${currentAngle}deg`;
  });
  return { ...pieBaseStyle, background: `conic-gradient(${slices.join(', ')})` };
}

function renderLegendItem(
  choice: string,
  count: number,
  index: number,
  correctChoiceIndex: number | undefined,
  totalVotes: number
) {
  const percent = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
  const isCorrect = correctChoiceIndex === index;
  return (
    <div key={`${choice}-${index}`} style={legendItemStyle}>
      <div style={legendLabelStyle}>
        <span style={{ ...swatchStyle, background: SLICE_COLORS[index % SLICE_COLORS.length] }} />
        <span>{choice}</span>
        {isCorrect ? <span style={correctBadgeStyle}>Correct</span> : null}
      </div>
      <strong>{count}</strong>
      <span style={metaStyle}>{percent}%</span>
    </div>
  );
}

const chartLayoutStyle = { alignItems: 'center', display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' };
const correctBadgeStyle = { background: 'rgba(22, 163, 74, 0.18)', border: '1px solid rgba(34, 197, 94, 0.45)', borderRadius: '999px', color: '#dcfce7', fontSize: '0.72rem', padding: '0.2rem 0.45rem' };
const eyebrowStyle = { color: '#60a5fa', fontSize: '0.78rem', letterSpacing: '0.12em', margin: 0, textTransform: 'uppercase' as const };
const layoutStyle = { display: 'grid', gap: '1rem' };
const legendItemStyle = { alignItems: 'center', background: '#020617', border: '1px solid #1e293b', borderRadius: '1rem', display: 'grid', gap: '0.35rem', gridTemplateColumns: '1fr auto auto', padding: '0.8rem 0.9rem' };
const legendLabelStyle = { alignItems: 'center', display: 'flex', flexWrap: 'wrap' as const, gap: '0.55rem' };
const legendStyle = { display: 'grid', gap: '0.75rem' };
const metaStyle = { color: '#94a3b8', margin: 0 };
const pieBaseStyle = { aspectRatio: '1 / 1', background: '#1e293b', borderRadius: '999px', height: '220px', width: '220px' };
const pieCenterStyle = { alignItems: 'center', background: '#0f172a', borderRadius: '999px', display: 'grid', height: '92px', justifyItems: 'center' as const, left: '50%', position: 'absolute' as const, top: '50%', transform: 'translate(-50%, -50%)', width: '92px' };
const pieWrapStyle = { display: 'grid', placeItems: 'center' as const, position: 'relative' as const };
const swatchStyle = { borderRadius: '999px', display: 'inline-block', height: '0.8rem', width: '0.8rem' };
const titleStyle = { margin: '0.15rem 0 0' };
