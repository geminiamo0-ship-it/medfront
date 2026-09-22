/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Lunar Chalk ───────────────────────────────────────────────
        // Deep cool charcoal canvas, chalk-white ink, moonlight-blue accent.
        canvas: '#0E1116',
        surface: '#161B22',
        surface2: '#1C232D',
        line: '#232A34',
        ink: {
          DEFAULT: '#E6EDF3', // chalk white
          soft: '#C3CDD8',
          muted: '#8B98A5',
          faint: '#5C6773',
        },
        mp: {
          DEFAULT: '#7FB2F0', // moonlight blue
          soft: '#1B2A3D', // tinted surface for chips / active states
          hover: '#9CC6F5',
          strong: '#5E93D6',
        },
        ok: '#4ADE80',
        warn: '#FBBF24',
        bad: '#F87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.4)',
        pop: '0 12px 32px rgba(0,0,0,.55)',
        glow: '0 0 0 1px rgba(127,178,240,.25), 0 8px 30px rgba(127,178,240,.12)',
      },
      borderRadius: {
        xl2: '0.875rem',
      },
    },
  },
  plugins: [],
};