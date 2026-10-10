import { ExamIcon, type ExamIconName } from '../../shared/ExamIcon';

type TopIconName = 'previous' | 'next' | 'mark' | 'lab-values' | ExamIconName;

/** Screenshot-faithful solid exam chrome glyphs; AMBOSS SVGs stay untouched. */
export function UWorldTopbarIcon({ name, size = 22 }: { name: TopIconName; size?: number }) {
  if (name === 'previous' || name === 'next') {
    return <svg aria-hidden="true" focusable="false" width={size} height={size}
      viewBox="0 0 24 24" fill="currentColor">
      <path d={name === 'previous' ? 'M16.5 3.5a1.5 1.5 0 0 0-2.3-1.25L4 10.65a1.75 1.75 0 0 0 0 2.7l10.2 8.4a1.5 1.5 0 0 0 2.3-1.25V3.5Z'
        : 'M7.5 3.5a1.5 1.5 0 0 1 2.3-1.25L20 10.65a1.75 1.75 0 0 1 0 2.7L9.8 21.75a1.5 1.5 0 0 1-2.3-1.25V3.5Z'}/>
    </svg>;
  }
  if (name === 'mark') {
    return <svg aria-hidden="true" focusable="false" width={size} height={size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v19"/>
      <path d="M6 4c3-2 5 1 8 0 2-.7 3-.9 5 0v11c-2-1-3-.7-5 0-3 1-5-2-8 0Z" fill="currentColor"/>
    </svg>;
  }
  if (name === 'lab-values') {
    return <svg aria-hidden="true" focusable="false" width={size} height={size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h7M5 3v6L2.7 18a2 2 0 0 0 1.9 2.5h5.8a2 2 0 0 0 1.9-2.5L10 9V3M4 15h7"/>
      <path d="M14 3h7M16 3v6l-2.5 9a2 2 0 0 0 1.9 2.5h5a2 2 0 0 0 1.9-2.5L20 9V3M15 15h6"/>
    </svg>;
  }
  return <ExamIcon name={name} size={size}/>;
}
