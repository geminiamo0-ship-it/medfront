import { useState } from 'react';
export function UWorldCalculator() {
  const [display, setDisplay] = useState('0');
  const [memo, setMemo] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [resetOnNext, setResetOnNext] = useState(false);
  function press(key: string) {
    if (key === 'C') { setDisplay('0'); setMemo(null); setOp(null); return; }
    if (key === '=') {
      if (memo == null || !op) return;
      const a = memo, b = Number(display);
      const n = op === '+' ? a+b : op === '−' ? a-b : op === '×' ? a*b : b === 0 ? NaN : a/b;
      setDisplay(Number.isFinite(n) ? String(Number(n.toPrecision(12))) : 'Error');
      setMemo(null); setOp(null); setResetOnNext(true); return;
    }
    if (['+','−','×','÷'].includes(key)) {
      setMemo(Number(display)); setOp(key); setResetOnNext(true); return;
    }
    if (key === '.' && !resetOnNext && display.includes('.')) return;
    if (display.length >= 16 && !resetOnNext) return;
    setDisplay(resetOnNext ? (key === '.' ? '0.' : key) : display === '0' && key !== '.' ? key : display + key);
    setResetOnNext(false);
  }
  return <div className="uw-calculator">
    <output aria-label="Calculator display">{display}</output>
    <div className="uw-calculator-grid">
      {['7','8','9','÷','4','5','6','×','1','2','3','−','C','0','.','+','='].map(k => (
        <button type="button" key={k} onClick={() => press(k)}>{k}</button>
      ))}
    </div>
  </div>;
}
