/**
 * The MedPark logo beating like a heart, with an ECG trace sweeping around it.
 * Used as the app-wide section loader: pages render immediately and the beat
 * pulses over whichever section is still loading.
 */
export function PulseLoader({
  size = 64,
  label,
}: {
  size?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <div className="mp-heartbeat relative" style={{ width: size, height: size }}>
        {/* breathing halo behind the logo */}
        <svg viewBox="0 0 24 24" fill="none" className="mp-ring-breathe absolute inset-0 h-full w-full">
          <circle cx="12" cy="12" r="9" stroke="#FF4500" strokeWidth="1" opacity="0.5" />
        </svg>
        <svg viewBox="0 0 24 24" fill="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="mp-pulse-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF4500" />
              <stop offset="100%" stopColor="#D93A00" />
            </linearGradient>
          </defs>
          {/* ECG mark draws itself, like a monitor sweep */}
          <path
            className="mp-ecg-flow"
            d="M2 12h3l2.5-6 4 12 3-9 2.5 6h3"
            stroke="url(#mp-pulse-gradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"
            stroke="url(#mp-pulse-gradient)"
            strokeWidth="2"
            strokeOpacity="0.5"
          />
        </svg>
      </div>
      {label && <span className="text-xs font-semibold text-ink-muted">{label}</span>}
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * Placeholder shown IN PLACE of a section while its data loads in the
 * background — the page around it renders immediately.
 */
export function SectionLoader({
  minHeight = 180,
  label,
}: {
  minHeight?: number;
  label?: string;
}) {
  return (
    <div
      className="relative flex w-full items-center justify-center rounded-2xl border border-line bg-surface/60"
      style={{ minHeight }}
    >
      <PulseLoader label={label} />
    </div>
  );
}

/**
 * Sits ON TOP of a section that keeps its space in the layout while
 * refreshing — the old/previous content stays visible underneath.
 */
export function OverlayLoader({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-surface/70 backdrop-blur-[2px]">
      <PulseLoader label={label} />
    </div>
  );
}