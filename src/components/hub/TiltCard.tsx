import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface TiltCardProps {
  to: string;
  children: ReactNode;
  /** Accent color as an "r,g,b" string for the cursor glow. */
  glowRgb?: string;
  className?: string;
}

/**
 * A card that tilts toward the cursor and carries a soft radial glow that
 * follows the pointer. Pure transform + state — no external deps.
 */
export function TiltCard({ to, children, glowRgb = '255,69,0', className = '' }: TiltCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [transform, setTransform] = useState(
    'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)',
  );
  const [glow, setGlow] = useState({ x: 50, y: 50, opacity: 0 });

  function handleMove(e: MouseEvent<HTMLAnchorElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - py) * 8;
    const rotateY = (px - 0.5) * 10;
    setTransform(
      `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(
        2,
      )}deg) translateY(-6px) scale(1.015)`,
    );
    setGlow({ x: px * 100, y: py * 100, opacity: 1 });
  }

  function handleLeave() {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)');
    setGlow((g) => ({ ...g, opacity: 0 }));
  }

  return (
    <Link
      ref={ref}
      to={to}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ transform, transition: 'transform .28s cubic-bezier(.2,.7,.2,1)' }}
      className={`group relative block overflow-hidden rounded-2xl border border-line bg-surface p-8 shadow-card transition-shadow duration-300 hover:shadow-pop ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: glow.opacity,
          background: `radial-gradient(420px circle at ${glow.x}% ${glow.y}%, rgba(${glowRgb},0.14), transparent 60%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </Link>
  );
}