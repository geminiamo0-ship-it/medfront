import type { QuestionDifficultyTier } from '../../types';

const HAMMER_COUNT: Record<QuestionDifficultyTier, number> = {
  very_easy: 1,
  easy: 2,
  medium: 3,
  hard: 4,
  very_hard: 5,
};

interface DifficultyHammersProps {
  tier?: QuestionDifficultyTier | null;
}

export function DifficultyHammers({ tier }: DifficultyHammersProps) {
  const count = tier ? HAMMER_COUNT[tier] : 0;
  const label = tier ? `${tier.replace('_', ' ')} difficulty` : 'Difficulty unavailable';

  return (
    <span className="amboss-hammers" aria-label={label} title={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          viewBox="0 0 18 18"
          className={index < count ? 'amboss-hammer is-active' : 'amboss-hammer'}
          aria-hidden="true"
        >
          <path d="M2.7 3.2h6.1l2.6 2.6-2.2 2.2-1.5-1.5-4.9 4.9-2-2 4.9-4.9-1.4-1.3H2.7Z" />
          <path d="m10.5 7.2 4.8 4.8-2.2 2.2-4.8-4.8Z" />
        </svg>
      ))}
    </span>
  );
}
