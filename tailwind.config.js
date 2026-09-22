/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mp: {
          DEFAULT: '#7c3aed',
          light: '#ede9fe',
          dark: '#5b21b6',
        },
        ink: {
          DEFAULT: '#1f2937',
          soft: '#374151',
          muted: '#6b7280',
          faint: '#9ca3af',
        },
        line: '#e5e7eb',
        surface: '#ffffff',
        canvas: '#f9fafb',
        ok: '#10b981',
        warn: '#f59e0b',
        bad: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.06)',
        pop: '0 8px 28px rgba(0,0,0,.14)',
      },
      borderRadius: {
        xl2: '0.875rem',
      },
    },
  },
  plugins: [],
};