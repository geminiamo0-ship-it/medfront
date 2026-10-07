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
  | 'timer'
  | 'settings'
  | 'tools'
  | 'marker'
  | 'pencil'
  | 'laser'
  | 'calculator'
  | 'suspend'
  | 'resume'
  | 'end-block'
  | 'ai-summary';

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
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.5 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.5-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.5-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.7a7 7 0 0 0 2-1.2l2.5 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
        </>
      );
    case 'tools':
      return <path d="m4 20 6.5-6.5M14 4l6 6M13 5l6 6M8 4l12 12-4 4L4 8l4-4Z" />;
    case 'marker':
      return (
        <>
          <path d="m5 16 9-9 4 4-9 9H5v-4Z" />
          <path d="m15 6 2-2 4 4-2 2M4 21h16" />
        </>
      );
    case 'pencil':
      return (
        <>
          <path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" />
          <path d="m13.5 7 3.5 3.5" />
        </>
      );
    case 'laser':
      return (
        <>
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" />
        </>
      );
    case 'calculator':
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 7h8M8 11h1M12 11h1M16 11h1M8 15h1M12 15h1M16 15h1M8 18h5" />
        </>
      );
    case 'suspend':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 8v8M14.5 8v8" />
        </>
      );
    case 'resume':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m10 8 6 4-6 4V8Z" />
        </>
      );
    case 'end-block':
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="m8 12 2.5 2.5L16 9" />
        </>
      );
    case 'ai-summary':
      return (
        <>
          <path d="M12 3 13.5 7.5 18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
          <path d="M18.5 14.5 19 17l2.5.5L19 18l-.5 2.5L18 18l-2.5-.5L18 17l.5-2.5Z" />
          <path d="M4 17h8M4 20h6" />
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
