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
  inspected: boolean;
  showExplanation: boolean;
  showCorrectAnswer?: boolean;
  onActivate: () => void;
  mainArticleHref?: string;
}

export function AmbossOption({
  option,
  selected,
  revealed,
  inspected,
  showExplanation,
  showCorrectAnswer = false,
  onActivate,
  mainArticleHref,
}: AmbossOptionProps) {
  const correct =
    revealed &&
    option.isCorrect === true &&
    (inspected || showCorrectAnswer);
  const incorrect = revealed && inspected && option.isCorrect === false;
  const classes = [
    'amboss-option',
    selected ? 'is-selected' : '',
    inspected ? 'is-inspected' : '',
    correct ? 'is-correct' : '',
    incorrect ? 'is-incorrect' : '',
    revealed ? 'is-revealed' : '',
  ].filter(Boolean).join(' ');

  function activateFromMouse(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('a, img, button')) return;
    onActivate();
  }

  function activateFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate();
  }

  return (
    <div
      className={classes}
      role={revealed ? 'button' : 'radio'}
      aria-checked={revealed ? undefined : selected}
      aria-expanded={revealed ? showExplanation : undefined}
      tabIndex={0}
      onClick={activateFromMouse}
      onKeyDown={activateFromKeyboard}
    >
      <span className="amboss-option-letter">{option.displayOrder}</span>
      <div className="amboss-option-main">
        <SafeHtml html={option.textHtml} className="amboss-option-text" />
        {showExplanation ? (
          <>
            <SafeHtml html={option.explanationHtml} className="amboss-option-explanation" />
            {option.isCorrect === true && mainArticleHref ? (
              <div className="amboss-main-article">
                <a
                  href={mainArticleHref}
                  data-medpark-library-link="1"
                  className="amboss-main-article-link"
                  title="Open the linked main article in MedPark Library"
                >
                  <span aria-hidden="true">▤</span>
                  <span>Main article</span>
                </a>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <span className="amboss-option-stat">
        {revealed && option.uworldChosenBy != null ? `${option.uworldChosenBy}%` : ''}
        {correct ? ' ✓' : incorrect ? ' ×' : ''}
      </span>
    </div>
  );
}
