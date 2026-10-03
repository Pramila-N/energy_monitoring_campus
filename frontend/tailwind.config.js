/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce6fd',
          200: '#bccffb',
          300: '#8fabf7',
          400: '#5b80f0',
          500: '#365ee8',
          600: '#2546d6',
          700: '#1f38ad',
          800: '#1e3389'
        },
        ok: '#16a34a',
        warn: '#d97706',
        danger: '#dc2626',
        info: '#0ea5e9',
        ai: '#8b5cf6'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -8px rgba(15,23,42,.08)',
        pop: '0 10px 40px -5px rgba(15,23,42,.25)'
      }
    }
  },
  plugins: []
};