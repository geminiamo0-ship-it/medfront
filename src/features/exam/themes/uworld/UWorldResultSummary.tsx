import { ExamIcon } from '../../shared/ExamIcon';
import type { ExamRunnerController } from '../../core/useExamRunner';
import { formatTime } from './uworldUtils';

export function UWorldResultSummary({ controller: c }: { controller: ExamRunnerController }) {
  if (!c.isRevealed || !c.currentQuestion) return null;
  const q = c.currentQuestion;
  const isCorrect = c.currentReveal?.isCorrect ?? q.userAnswer?.isCorrect;
  const correctId = c.currentReveal?.correctOptionId ??
    c.currentReveal?.explanation.options.find(opt => opt.isCorrect)?.id ??
    q.options.find(opt => opt.isCorrect)?.id ?? null;
  const correctOption = q.options.find(opt => opt.id === correctId);
  const correctPercent = c.currentReveal?.explanation.options.find(opt => opt.id === correctId)?.uworldChosenBy
    ?? correctOption?.uworldChosenBy ?? null;
  return (
    <section className={'uw-result-card' + (isCorrect ? ' is-right' : ' is-wrong')} aria-label="Answer result">
      <div className="uw-result-heading">
        <strong>{c.isOmitted ? 'Omitted' : isCorrect === true ? 'Correct' : isCorrect === false ? 'Incorrect' : 'Reviewed'}</strong>
        <small>Correct answer</small>
        <b>{correctOption?.displayOrder ?? '—'}</b>
      </div>
      <div className="uw-result-stat"><ExamIcon name="tools" size={23} />
        <span><b>{correctPercent == null ? '—' : `${correctPercent}%`}</b><small>Answered Correctly</small></span>
      </div>
      <div className="uw-result-stat"><ExamIcon name="timer" size={23} />
        <span><b>{formatTime(q.userAnswer?.timeSpentSeconds ?? c.questionTimerSeconds)}</b><small>Time Spent</small></span>
      </div>
      <div className="uw-result-stat"><ExamIcon name="mark" size={23} />
        <span><b>{c.isQuestionMarked(q) ? 'Marked' : 'Unmarked'}</b><small>Question status</small></span>
      </div>
    </section>
  );
}
