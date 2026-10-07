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
          <path d="M12.2 2.2 17 7l-2.4 2.4-1.5-1.5-5.8 5.8 1.6 1.6-2.3 2.3-4.9-4.9L4 10.4 5.6 12l5.8-5.8-1.6-1.6 2.4-2.4Z" />
          <path d="m15.2 7.8 1.7-1.7 4.2 4.2-1.7 1.7-4.2-4.2Z" />
        </svg>
      ))}
    </span>
  );
}
