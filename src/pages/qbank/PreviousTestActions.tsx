import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PreviousTestSummaryItem } from '@/api/tests';

type ActionIcon = 'results' | 'review' | 'resume' | 'continue' | 'more' | 'copy' | 'repeat' | 'delete' | 'history';

/** Icons are local vector paths; no extra icon dependency, theme colors stay semantic. */
function Icon({ name }: { name: ActionIcon }) {
  const paths: Record<ActionIcon, string> = {
    results: 'M3 3v18h18 M7 17v-5 M12 17V7 M17 17v-8',
    review: 'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14',
    resume: 'M3 12a9 9 0 1 0 3-6M3 4v5h5M10 8l5 4-5 4V8Z',
    continue: 'm9 6 9 6-9 6V6Z',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    copy: 'M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3M9 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
    repeat: 'M20 7h-9a7 7 0 0 0-7 7m0-4v4h4M4 17h9a7 7 0 0 0 7-7m0 4v-4h-4',
    delete: 'M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6',
    history: 'M3 12a9 9 0 1 0 3-6M3 4v5h5m4-2v5l4 2',
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d={paths[name]} />
    </svg>
  );
}

interface Props {
  test: PreviousTestSummaryItem;
  copiedId: number | null;
  onCopy: (testId: number) => void;
  onRepeat: (testId: number) => void;
  onDelete: (testId: number) => void;
  repeatingId: number | null;
  deletingId: number | null;
  menuAbove?: boolean;
}

export default function PreviousTestActions({
  test, copiedId, onCopy, onRepeat, onDelete, repeatingId, deletingId, menuAbove = false,
}: Props) {
  const [isOpen, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<'repeat' | 'delete' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const busy = repeatingId !== null || deletingId !== null;
  const complete = test.status === 'completed';
  const repeatable = test.totalQuestions <= 50 && (test.type === 'tutor' || test.type === 'timed');
  const primaryHref = '/test/' + test.id;
  const primaryLink = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-surface2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link';
  const menuItem = 'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-surface2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-link';

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setConfirmation(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setConfirmation(null);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const close = () => {
    setOpen(false);
    setConfirmation(null);
  };

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-1" aria-label={'Actions for ' + test.title}>
      {complete ? (
        <>
          <Link to={primaryHref + '/results'} className={primaryLink}
            title="Results" aria-label={'Results for test ' + test.id}><Icon name="results" /></Link>
          <Link to={primaryHref} className={primaryLink}
            title="Review this attempt" aria-label={'Review attempt for test ' + test.id}><Icon name="review" /></Link>
        </>
      ) : (
        <Link to={primaryHref} className={primaryLink}
          title={test.status === 'suspended' ? 'Resume test' : 'Continue test'}
          aria-label={(test.status === 'suspended' ? 'Resume' : 'Continue') + ' test ' + test.id}>
          <Icon name={test.status === 'suspended' ? 'resume' : 'continue'} />
        </Link>
      )}
      <button type="button" ref={triggerRef} aria-label={'More actions for test ' + test.id}
        title="More actions" aria-haspopup="true" aria-expanded={isOpen}
        className={primaryLink} onClick={() => { setOpen(v => !v); setConfirmation(null); }}>
        <Icon name="more" />
      </button>
      {isOpen && (
        <div role="group" aria-label={'More actions for test ' + test.id}
          className={`absolute right-0 z-30 w-[min(17rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-1.5 shadow-pop ${menuAbove ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          {complete && (
            <>
              <Link className={menuItem} to={'/test/' + test.originalReviewId} onClick={close}>
                <Icon name="history" /> Review Original Test
              </Link>
              {test.latestRepeatReviewId != null && (
                <Link className={menuItem} to={'/test/' + test.latestRepeatReviewId} onClick={close}>
                  <Icon name="review" /> Review Latest Repeat
                </Link>
              )}
            </>
          )}
          {repeatable && (
            confirmation === 'repeat' ? (
              <div className="space-y-2 rounded-lg bg-surface2 p-2 text-xs">
                <p>Start a new test with the same questions?</p>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} className="min-h-11 flex-1 rounded-lg border border-line bg-surface px-2 font-semibold text-ink"
                    onClick={() => onRepeat(test.id)}>{repeatingId === test.id ? 'Creating…' : 'Confirm Repeat'}</button>
                  <button type="button" disabled={busy} className="min-h-11 rounded-lg border border-line px-2" onClick={() => setConfirmation(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" disabled={busy} className={menuItem} onClick={() => setConfirmation('repeat')}>
                <Icon name="repeat" /> Repeat Test
              </button>
            )
          )}
          <button type="button" className={menuItem} onClick={() => { onCopy(test.id); close(); }}>
            <Icon name="copy" /> {copiedId === test.id ? 'ID Copied' : 'Copy Test ID'}
          </button>
          <div className="my-1 border-t border-line" />
          {confirmation === 'delete' ? (
            <div className="space-y-2 rounded-lg bg-bad/5 p-2 text-xs">
              <p className="font-medium text-bad">Delete only this test and its answers? Other attempts remain.</p>
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="min-h-11 flex-1 rounded-lg border border-bad/40 px-2 font-semibold text-bad"
                  onClick={() => onDelete(test.id)}>{deletingId === test.id ? 'Deleting…' : 'Confirm Delete'}</button>
                <button type="button" disabled={busy} className="min-h-11 rounded-lg border border-line px-2" onClick={() => setConfirmation(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={busy} className={menuItem + ' text-bad'} onClick={() => setConfirmation('delete')}>
              <Icon name="delete" /> Delete Test
            </button>
          )}
        </div>
      )}
    </div>
  );
}
