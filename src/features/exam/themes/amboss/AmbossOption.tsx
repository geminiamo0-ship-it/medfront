import type { KeyboardEvent, MouseEvent } from 'react';
import type { ExamOption } from '../../types';
import { SafeHtml } from '../../shared/SafeHtml';

export interface AmbossResolvedOption extends ExamOption {
  isCorrect?: boolean;
  explanationHtml?: string | null;
  uworldChosenBy?: number | null;
}

interface AmbossOptionProps {
  option: AmbossResolvedOption;
  selected: boolean;
  revealed: boolean;
  showExplanation: boolean;
  onSelect: () => void;
}

export function AmbossOption({
  option,
  selected,
  revealed,
  showExplanation,
  onSelect,
}: AmbossOptionProps) {
  const correct = revealed && option.isCorrect === true;
  const incorrectSelected = revealed && selected && option.isCorrect === false;
  const classes = [
    'amboss-option',
    selected ? 'is-selected' : '',
    correct ? 'is-correct' : '',
    incorrectSelected ? 'is-incorrect' : '',
    revealed ? 'is-revealed' : '',
  ].filter(Boolean).join(' ');

  function selectFromMouse(event: MouseEvent<HTMLDivElement>) {
    if (revealed) return;
    const target = event.target as HTMLElement;
    if (target.closest('a')) return;
    onSelect();
  }

  function selectFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (revealed || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onSelect();
  }

  return (
    <div
      className={classes}
      role="radio"
      aria-checked={selected}
      aria-disabled={revealed}
      tabIndex={revealed ? -1 : 0}
      onClick={selectFromMouse}
      onKeyDown={selectFromKeyboard}
    >
      <span className="amboss-option-letter">{option.displayOrder}</span>
      <span className="amboss-option-main">
        <SafeHtml html={option.textHtml} className="amboss-option-text" />
        {showExplanation ? (
          <SafeHtml html={option.explanationHtml} className="amboss-option-explanation" />
        ) : null}
      </span>
      <span className="amboss-option-stat">
        {revealed && option.uworldChosenBy != null ? `${option.uworldChosenBy}%` : ''}
        {correct ? ' ✓' : incorrectSelected ? ' ×' : ''}
      </span>
    </div>
  );
}
