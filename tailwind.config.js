/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sys: {
          bg: '#050810',
          panel: '#0a1322',
          border: '#5fc9ff',
          accent: '#00d4ff',
          gold: '#ffd700',
          hp: '#ff4757',
          mp: '#3742fa',
          text: '#e6f0ff',
          muted: '#7a8aa5',
          danger: '#ff6b81',
          ok: '#2ed573',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 12px rgba(95, 201, 255, 0.55), 0 0 24px rgba(0, 212, 255, 0.25)',
        'glow-lg': '0 0 18px rgba(95, 201, 255, 0.7), 0 0 48px rgba(0, 212, 255, 0.35)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 4s linear infinite',
        'flash': 'flash 0.6s ease-out',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        flash: {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '60%': { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
