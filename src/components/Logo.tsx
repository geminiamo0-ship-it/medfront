export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mp-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF4500" />
          <stop offset="100%" stopColor="#D93A00" />
        </linearGradient>
      </defs>
      <path
        d="M2 12h3l2.5-6 4 12 3-9 2.5 6h3"
        stroke="url(#mp-logo-gradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"
        stroke="url(#mp-logo-gradient)"
        strokeWidth="2"
        strokeOpacity="0.5"
      />
    </svg>
  );
}