/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // matcha — màu chủ đạo
        matcha: {
          50: '#f1faf3', 100: '#ddf3e2', 200: '#bde7c8', 300: '#8fd4a4', 400: '#5cba79',
          500: '#16a34a', 600: '#128a3f', 700: '#116d35', 800: '#11572d', 900: '#0f4827', 950: '#062813',
        },
        // caramel / đào — điểm nhấn
        caramel: {
          50: '#fff8ed', 100: '#ffefd4', 200: '#ffdba8', 300: '#ffc071', 400: '#fd9a38',
          500: '#fb7f14', 600: '#ec6409', 700: '#c34a0a', 800: '#9b3a10', 900: '#7d3110',
        },
        peach: { 100: '#ffe8e0', 200: '#ffd1c2', 300: '#ffb59e', 400: '#ff9070', 500: '#ff7a54' },
        cream: { 50: '#fdfcf8', 100: '#faf7ef', 200: '#f4efe1', 300: '#e9e2cf' },
        ink: {
          50: '#f6f7f6', 100: '#e8ebe8', 200: '#d2d8d3', 300: '#aeb8b1', 400: '#7f8d84',
          500: '#5d6b62', 600: '#48544c', 700: '#3a443d', 800: '#232a25', 850: '#1f2521', 900: '#1b211d', 950: '#121714',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', '"Matcha Emoji"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem', '3xl': '1.5rem' },
      boxShadow: {
        soft: '0 1px 2px rgba(27,33,29,.05), 0 4px 14px -6px rgba(27,33,29,.10)',
        lift: '0 10px 30px -12px rgba(17,87,45,.22), 0 2px 8px -4px rgba(27,33,29,.10)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.6)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
        'pop': { '0%': { transform: 'scale(.96)', opacity: .6 }, '100%': { transform: 'scale(1)', opacity: 1 } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(22,163,74,.45)' }, '70%': { boxShadow: '0 0 0 12px rgba(22,163,74,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(22,163,74,0)' } },
        'marching': { to: { strokeDashoffset: '-24' } },
      },
      animation: {
        'fade-up': 'fade-up .28s cubic-bezier(.16,1,.3,1) both',
        pop: 'pop .18s cubic-bezier(.16,1,.3,1) both',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        marching: 'marching 1s linear infinite',
      },
    },
  },
  plugins: [],
}
