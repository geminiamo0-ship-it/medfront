import type { RecommendedTopic, SessionDifficultyGroup, DifficultyKey } from './api';

export const DIFFICULTY_NAMES: Record<DifficultyKey, string> = {
  very_easy: 'Very Easy',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  very_hard: 'Very Hard',
  unclassified: 'Unclassified',
};
export const DIFFICULTY_ORDER: DifficultyKey[] = [
  'very_easy', 'easy', 'medium', 'hard', 'very_hard', 'unclassified',
];

export function formatDuration(value: number): string {
  const seconds = Math.max(0, Math.floor(value));
  if (seconds >= 3600) {
    return Math.floor(seconds / 3600) + 'h ' + String(Math.floor((seconds % 3600) / 60)).padStart(2, '0') + 'm';
  }
  if (seconds >= 60) {
    return Math.floor(seconds / 60) + 'm ' + String(seconds % 60).padStart(2, '0') + 's';
  }
  return seconds + 's';
}

export function SummaryMetrics({ accuracy, correct, total, average, elapsed, answered }: {
  accuracy: string;
  correct: number;
  total: number;
  average: number;
  elapsed: number;
  answered: number;
}) {
  const metrics = [
    { label: 'Accuracy', value: accuracy, id: 'accuracy' },
    { label: 'Correct', value: correct + '/' + total, id: 'correct' },
    { label: 'Avg. / Answered Q', value: answered > 0 ? formatDuration(average) : '—', id: 'average' },
    { label: 'Total Time', value: formatDuration(elapsed), id: 'elapsed' },
  ];
  return (
    <section className="mp-results__metrics" aria-label="Session summary">
      {metrics.map((metric) => (
        <div className="mp-results__metric" key={metric.id}>
          <span className="mp-results__metric-value" data-testid={'results-metric-' + metric.id}>{metric.value}</span>
          <span className="mp-results__metric-label">{metric.label}</span>
        </div>
      ))}
    </section>
  );
}

export function ResultsOverview({ accuracy, correct, incorrect, omitted, total }: {
  accuracy: string;
  correct: number;
  incorrect: number;
  omitted: number;
  total: number;
}) {
  const circumference = Math.PI * 106;
  const safeTotal = Math.max(total, 1);
  const correctLen = circumference * Math.min(correct / safeTotal, 1);
  const wrongLen = circumference * Math.min(incorrect / safeTotal, 1);
  const omittedLen = circumference * Math.min(omitted / safeTotal, 1);
  const labels = [
    { label: 'Correct', count: correct, key: 'correct' },
    { label: 'Incorrect', count: incorrect, key: 'incorrect' },
    { label: 'Omitted', count: omitted, key: 'omitted' },
  ];
  return (
    <section className="mp-results__panel" aria-labelledby="results-score-heading">
      <h2 id="results-score-heading" className="mp-results__panel-title">Your Results</h2>
      <div className="mp-results__overview-content">
        <svg className="mp-results__donut" viewBox="0 0 160 160" role="img"
          aria-label={'Accuracy ' + accuracy + '. ' + correct + ' correct, ' + incorrect + ' incorrect, ' + omitted + ' omitted.'}>
          <circle className="mp-results__donut-track" cx="80" cy="80" r="53" fill="none" strokeWidth="12" />
          <g transform="rotate(-90 80 80)" fill="none" strokeWidth="12">
            <circle className="mp-results__donut-correct" cx="80" cy="80" r="53"
              strokeDasharray={correctLen + ' ' + circumference} />
            <circle className="mp-results__donut-incorrect" cx="80" cy="80" r="53"
              strokeDasharray={wrongLen + ' ' + circumference} strokeDashoffset={-correctLen} />
            <circle className="mp-results__donut-omitted" cx="80" cy="80" r="53"
              strokeDasharray={omittedLen + ' ' + circumference}
              strokeDashoffset={-(correctLen + wrongLen)} />
          </g>
          <text className="mp-results__donut-number" x="80" y="77" textAnchor="middle">{accuracy}</text>
          <text className="mp-results__donut-caption" x="80" y="96" textAnchor="middle">ACCURACY</text>
        </svg>
        <div className="mp-results__legend" aria-label="Answer breakdown">
          {labels.map(({ label, count, key }) => (
            <div className="mp-results__legend-row" key={key}>
              <span className={'mp-results__legend-dot mp-results__legend-dot--' + key} aria-hidden="true" />
              <span>{label}</span>
              <strong className="mp-results__legend-count">{count}</strong>
            </div>
          ))}
          <p className="mp-results__legend-note">Out of {total} questions</p>
        </div>
      </div>
    </section>
  );
}

export function StudyRecommendations({ topics, available, omitted }: {
  topics: RecommendedTopic[];
  available: boolean;
  omitted: number;
}) {
  return (
    <section className="mp-results__panel mp-results__recommendations"
      aria-labelledby="results-topics-heading">
      <h2 id="results-topics-heading" className="mp-results__panel-title">Study Recommendations</h2>
      <p className="mp-results__panel-subtitle">Topics with incorrect answers in this session</p>
      {!available ? (
        <p className="mp-results__message">Topic insights are not available yet.</p>
      ) : topics.length === 0 ? (
        <div className="mp-results__empty-recommendations" data-testid="results-recommendations-empty">
          <span className="mp-results__empty-mark" aria-hidden="true">✓</span>
          <div>
            <p className="mp-results__empty-heading">No incorrect-answer topics</p>
            <p className="mp-results__message">
              {omitted > 0
                ? omitted + ' questions were omitted. There is not enough information to assess those topics.'
                : 'No topics with incorrect answers in this session.'}
            </p>
          </div>
        </div>
      ) : (
        <ol className="mp-results__topic-list">
          {topics.map((topic, index) => (
            <li key={topic.topicId} className="mp-results__topic">
              <div className="mp-results__topic-row">
                <span className="mp-results__topic-name">{index + 1}. {topic.name}</span>
                <span className="mp-results__fraction">{topic.correct}/{topic.total} correct</span>
              </div>
              <div className="mp-results__track" aria-hidden="true">
                <span className="mp-results__track-correct"
                  style={{ width: (topic.total ? 100 * topic.correct / topic.total : 0) + '%' }} />
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mp-results__panel-footnote">Based on this session only, not your overall ability.</p>
    </section>
  );
}

export function DifficultyBreakdown({ tiers, available }: {
  tiers: SessionDifficultyGroup[];
  available: boolean;
}) {
  return (
    <section className="mp-results__panel mp-results__difficulty"
      aria-labelledby="results-difficulty-heading">
      <h2 id="results-difficulty-heading" className="mp-results__panel-title">Performance by Difficulty</h2>
      {!available ? (
        <p className="mp-results__message">Difficulty details are not available yet.</p>
      ) : tiers.length === 0 ? (
        <p className="mp-results__message">No classified questions in this session.</p>
      ) : (
        <div className="mp-results__difficulty-list">
          {tiers.map((tier) => {
            const denominator = Math.max(tier.total, 1);
            return (
              <div className="mp-results__difficulty-row" key={tier.key}>
                <span className="mp-results__difficulty-label">{DIFFICULTY_NAMES[tier.key]}</span>
                <div className="mp-results__track mp-results__difficulty-track" role="img"
                  aria-label={DIFFICULTY_NAMES[tier.key] + ': ' + tier.correct + ' correct, ' + tier.incorrect + ' incorrect, ' + tier.omitted + ' omitted out of ' + tier.total}>
                  <span className="mp-results__track-correct" style={{ width: (tier.correct / denominator * 100) + '%' }} />
                  <span className="mp-results__track-incorrect" style={{ width: (tier.incorrect / denominator * 100) + '%' }} />
                  <span className="mp-results__track-omitted" style={{ width: (tier.omitted / denominator * 100) + '%' }} />
                </div>
                <strong className="mp-results__fraction">{tier.correct}/{tier.total} correct</strong>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
