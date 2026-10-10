import { SafeHtml } from '../../shared/SafeHtml';
import type { ExamOption } from '../../types';
interface Props {
  options: ExamOption[];
  selectedId: number | null;
  revealed: boolean;
  locked: boolean;
  correctId: number | null;
  onChoose: (id: number) => void;
}
export function UWorldOptions({ options, selectedId, revealed, locked, correctId, onChoose }: Props) {
  return (
    <fieldset className="uw-options" disabled={locked}>
      <legend className="uw-sr-only">Answer choices</legend>
      {options.map((option, index) => {
        const selected = option.id === selectedId;
        const correct = revealed && correctId === option.id;
        const incorrect = revealed && selected && correctId !== null && !correct;
        return (
          <label key={option.id} className={'uw-option' + (selected ? ' is-chosen' : '')}>
            <span className="uw-option-result" aria-label={correct ? 'Correct answer' : incorrect ? 'Incorrect selection' : undefined}>
              {correct ? '✓' : incorrect ? '×' : ''}
            </span>
            <input type="radio" name="uworld-answer" checked={selected}
              onChange={() => onChoose(option.id)} disabled={locked} />
            <span className="uw-option-copy">
              <span className="uw-choice-letter">{String(option.displayOrder || String.fromCharCode(65 + index)).replace(/\.?$/, '')}.</span>
              <SafeHtml html={option.textHtml} className="uw-option-html" />
              {revealed && option.uworldChosenBy !== null && option.uworldChosenBy !== undefined ? (
                <span className="uw-option-percent">({option.uworldChosenBy}%)</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
