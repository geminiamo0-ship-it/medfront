import { useState } from 'react';
import { ExamIcon } from '../../shared/ExamIcon';

interface AmbossCalculatorProps {
  open: boolean;
  onClose: () => void;
}

type Operator = '+' | '−' | '×' | '÷';

function applyOperator(left: number, right: number, operator: Operator | null) {
  if (!operator) return right;
  if (operator === '+') return left + right;
  if (operator === '−') return left - right;
  if (operator === '×') return left * right;
  if (right === 0) return Number.NaN;
  return left / right;
}

function formatValue(value: number) {
  if (!Number.isFinite(value)) return 'Error';
  return Number(value.toPrecision(12)).toString();
}

export function AmbossCalculator({ open, onClose }: AmbossCalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [replaceDisplay, setReplaceDisplay] = useState(false);

  if (!open) return null;

  function inputDigit(value: string) {
    if (display === 'Error' || replaceDisplay) {
      setDisplay(value === '.' ? '0.' : value);
      setReplaceDisplay(false);
      return;
    }
    if (value === '.' && display.includes('.')) return;
    if (display === '0' && value !== '.') setDisplay(value);
    else if (display.length < 16) setDisplay((current) => current + value);
  }

  function chooseOperator(next: Operator) {
    const current = Number(display);
    if (!Number.isFinite(current)) return;
    if (stored !== null && operator && !replaceDisplay) {
      const result = applyOperator(stored, current, operator);
      setStored(result);
      setDisplay(formatValue(result));
    } else {
      setStored(current);
    }
    setOperator(next);
    setReplaceDisplay(true);
  }

  function equals() {
    if (stored === null || !operator) return;
    const result = applyOperator(stored, Number(display), operator);
    setDisplay(formatValue(result));
    setStored(null);
    setOperator(null);
    setReplaceDisplay(true);
  }

  function clear() {
    setDisplay('0');
    setStored(null);
    setOperator(null);
    setReplaceDisplay(false);
  }

  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];

  return (
    <section className="amboss-calculator" aria-label="Calculator">
      <header>
        <strong>Calculator</strong>
        <button type="button" onClick={onClose} aria-label="Close calculator">
          <ExamIcon name="close" size={18} />
        </button>
      </header>
      <div className="amboss-calculator-display" aria-live="polite">
        {display}
      </div>
      <div className="amboss-calculator-grid">
        <button type="button" className="is-wide" onClick={clear}>AC</button>
        <button
          type="button"
          className="is-wide"
          onClick={() => setDisplay((value) => (value.length > 1 ? value.slice(0, -1) : '0'))}
        >
          ⌫
        </button>
        {keys.map((key) => (
          <button
            type="button"
            key={key}
            className={['÷', '×', '−', '+'].includes(key) ? 'is-operator' : key === '=' ? 'is-equals' : ''}
            onClick={() => {
              if (key === '=') equals();
              else if (['÷', '×', '−', '+'].includes(key)) chooseOperator(key as Operator);
              else inputDigit(key);
            }}
          >
            {key}
          </button>
        ))}
      </div>
    </section>
  );
}
