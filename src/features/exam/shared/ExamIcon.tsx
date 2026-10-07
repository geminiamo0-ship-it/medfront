import type { SVGProps } from 'react';

export type ExamIconName =
  | 'menu'
  | 'mark'
  | 'lab-values'
  | 'notes'
  | 'flashcards'
  | 'highlight'
  | 'ai-tutor'
  | 'close'
  | 'previous'
  | 'next'
  | 'timer';

interface ExamIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: ExamIconName;
  size?: number;
}

function IconPaths({ name }: { name: ExamIconName }) {
  switch (name) {
    case 'menu':
      return <path d="M4 6.5h16M4 12h16M4 17.5h16" />;
    case 'mark':
      return (
        <>
          <path d="M6 21V4.5c3-2 6 2 9 0 1.2-.8 2.2-.9 3-.6v10.2c-.8-.3-1.8-.2-3 .6-3 2-6-2-9 0" />
          <path d="M6 4.5v10.2" />
        </>
      );
    case 'lab-values':
      return (
        <>
          <path d="M9 3h6M10 3v5.5l-4.5 8A3 3 0 0 0 8.1 21h7.8a3 3 0 0 0 2.6-4.5l-4.5-8V3" />
          <path d="M8 15h8" />
          <path d="M10 12h4" />
        </>
      );
    case 'notes':
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 3v3h6V3M8 10h8M8 14h8M8 18h5" />
        </>
      );
    case 'flashcards':
      return (
        <>
          <rect x="5" y="5" width="13" height="15" rx="2" transform="rotate(-6 5 5)" />
          <rect x="7" y="3" width="13" height="15" rx="2" transform="rotate(4 7 3)" />
          <path d="M10 9h7M10 13h5" />
        </>
      );
    case 'highlight':
      return (
        <>
          <path d="m6 15 7-7 4 4-7 7H6v-4Z" />
          <path d="m14 7 2-2 4 4-2 2" />
          <path d="M5 21h14" />
        </>
      );
    case 'ai-tutor':
      return (
        <>
          <path d="M12 3a7 7 0 1 0 7 7c0-1.2-.3-2.4-.8-3.4" />
          <path d="M15 3h6v6" />
          <path d="M21 3l-5 5" />
          <path d="M8.5 13.5c1.1 1 2.2 1.5 3.5 1.5s2.4-.5 3.5-1.5" />
          <path d="M9 9h.01M15 9h.01" />
        </>
      );
    case 'close':
      return <path d="m6 6 12 12M18 6 6 18" />;
    case 'previous':
      return (
        <>
          <path d="m15.5 5-7 7 7 7" />
          <path d="M9 12h9" />
        </>
      );
    case 'next':
      return (
        <>
          <path d="m8.5 5 7 7-7 7" />
          <path d="M15 12H6" />
        </>
      );
    case 'timer':
      return (
        <>
          <circle cx="12" cy="13" r="8" />
          <path d="M9 2h6M12 5v8l4 2" />
        </>
      );
  }
}

export function ExamIcon({ name, size = 16, ...props }: ExamIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <IconPaths name={name} />
    </svg>
  );
}
