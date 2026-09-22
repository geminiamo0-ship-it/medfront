/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Reddit (light) ────────────────────────────────────────────
        // Light-gray page, white cards, orangered accent, blue links.
        canvas: '#F6F7F8', // page background
        surface: '#FFFFFF', // cards
        surface2: '#F0F2F5', // hover / subtle fills
        line: '#E5EBEE', // borders
        ink: {
          DEFAULT: '#1A1A1B', // primary text
          soft: '#3D3D3E',
          muted: '#576F76', // secondary text
          faint: '#878A8C',
        },
        mp: {
          DEFAULT: '#FF4500', // orangered
          soft: '#FFF0EB', // tinted surface for chips / active states
          hover: '#E03D00',
          strong: '#D93A00',
        },
        link: '#0079D3', // reddit link blue
        ok: '#46D160',
        warn: '#FFB000',
        bad: '#FF585B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.06)',
        pop: '0 8px 28px rgba(0,0,0,.14)',
        glow: '0 0 0 1px rgba(255,69,0,.18), 0 8px 24px rgba(255,69,0,.08)',
      },
      borderRadius: {
        xl2: '0.875rem',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        floaty: 'floaty 7s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};