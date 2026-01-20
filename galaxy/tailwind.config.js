/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-vendasta-500',
    'bg-vendasta-400',
    'bg-vendasta-500/20',
    'text-vendasta-400',
    'text-vendasta-500',
    'hover:bg-vendasta-400',
    'hover:bg-vendasta-500',
    'border-vendasta-500',
    'border-vendasta-500/50',
    'border-vendasta-900/50',
    'ring-vendasta-500',
    'focus:ring-vendasta-500',
    'shadow-vendasta-500/25',
    'shadow-vendasta-500/40',
    'hover:text-vendasta-400',
    'hover:border-vendasta-500/50',
    'bg-accent-500',
    'bg-accent-500/20',
    'text-accent-400',
    'bg-amber-500/20',
    'text-amber-400',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Vendasta Green color palette
        vendasta: {
          50: '#e8f5e9',
          100: '#c8e6c9',
          200: '#a5d6a7',
          300: '#81c784',
          400: '#66bb6a',
          500: '#4caf50',  // Primary Vendasta green
          600: '#43a047',
          700: '#388e3c',
          800: '#2e7d32',
          900: '#1b5e20',
          950: '#0d3d12',
        },
        // Accent colors that complement the green
        accent: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
      },
    },
  },
  plugins: [],
}
