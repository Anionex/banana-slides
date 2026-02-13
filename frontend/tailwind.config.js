/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 品牌色 - 使用 CSS 变量
        'banana': {
          DEFAULT: 'var(--banana-yellow)',
          light: 'var(--banana-yellow-light)',
          dark: 'var(--banana-yellow-dark)',
          pale: 'var(--banana-yellow-pale)',
          // 保留静态色用于渐变等特殊场景
          50: '#FFF9E6',
          100: '#FFE44D',
          200: '#FFD93D',
          300: '#FFD21F',
          400: '#FFCA00',
          500: '#FFD700',
          600: '#FFC700',
        },
        // 背景色 - 语义化 token
        'background': {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          elevated: 'var(--bg-elevated)',
          hover: 'var(--bg-hover)',
        },
        // 文字色 - 语义化 token
        'foreground': {
          DEFAULT: 'var(--text-primary)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        // 边框色 - 语义化 token
        'border': {
          DEFAULT: 'var(--border-primary)',
          primary: 'var(--border-primary)',
          secondary: 'var(--border-secondary)',
          hover: 'var(--border-hover)',
        },
        // 功能色
        'success': 'var(--success)',
        'warning': 'var(--warning)',
        'error': 'var(--error)',
        'info': 'var(--info)',
      },
      borderRadius: {
        'card': '12px',
        'panel': '16px',
      },
      boxShadow: {
        'yellow': '0 4px 12px rgba(255, 215, 0, 0.3)',
        'sm': '0 1px 2px rgba(0,0,0,0.05)',
        'md': '0 4px 6px rgba(0,0,0,0.07)',
        'lg': '0 10px 15px rgba(0,0,0,0.1)',
        'xl': '0 20px 25px rgba(0,0,0,0.15)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        '3xl': '0 35px 60px -12px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'gradient': 'gradient 3s ease infinite',
        'gradient-x': 'gradient-x 2s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'float-delayed': 'float 7s ease-in-out infinite 1s',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'fade-in': 'fadeIn 1s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 0%' },
          '50%': { backgroundPosition: '100% 0%' },
        },
      },
    },
  },
  plugins: [],
}
