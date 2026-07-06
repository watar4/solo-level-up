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
          // "Arise" purple — the second brand hue for shadows / rare drops
          arise: '#a855f7',
          arisedim: '#6d28d9',
        },
        // Rank identity colors (E→SS). Used for badges, gate headers, accents.
        rank: {
          e: '#8a9bb5',
          d: '#2ed573',
          c: '#00d4ff',
          b: '#3b82f6',
          a: '#a855f7',
          s: '#ffd700',
          ss: '#ff4757',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
        display: ['Orbitron', '"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 12px rgba(95, 201, 255, 0.55), 0 0 24px rgba(0, 212, 255, 0.25)',
        'glow-lg': '0 0 18px rgba(95, 201, 255, 0.7), 0 0 48px rgba(0, 212, 255, 0.35)',
        'glow-purple': '0 0 12px rgba(168, 85, 247, 0.55), 0 0 24px rgba(109, 40, 217, 0.3)',
        'glow-gold': '0 0 12px rgba(255, 215, 0, 0.5), 0 0 24px rgba(255, 180, 0, 0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 4s linear infinite',
        'flash': 'flash 0.6s ease-out',
        'shimmer': 'shimmer 2.2s linear infinite',
        'float-slow': 'float 14s ease-in-out infinite',
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
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-16px)' },
        },
      },
    },
  },
  plugins: [],
};
