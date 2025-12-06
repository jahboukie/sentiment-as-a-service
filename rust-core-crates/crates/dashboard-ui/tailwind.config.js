/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary - "Trust Blue" (enterprise credibility)
        primary: {
          50: '#E6F0FF',
          100: '#CCE0FF',
          200: '#99C2FF',
          300: '#66A3FF',
          400: '#3385FF',
          500: '#0052CC',
          600: '#0047B3',
          700: '#003D99',
          800: '#003380',
          900: '#002966',
        },
        // Success - "Compliance Green"
        success: {
          50: '#E6F7ED',
          100: '#C2EBD4',
          200: '#8DD9AD',
          300: '#57C785',
          400: '#2BB563',
          500: '#0A9D57',
          600: '#088A4B',
          700: '#06773F',
          800: '#046433',
          900: '#035127',
        },
        // Warning - "Attention Amber"
        warning: {
          50: '#FFF8E6',
          100: '#FFEDCC',
          200: '#FFDB99',
          300: '#FFC966',
          400: '#FFB733',
          500: '#FFA500',
          600: '#E69500',
          700: '#CC8400',
          800: '#B37300',
          900: '#996300',
        },
        // Danger - "Threat Red"
        danger: {
          50: '#FDEEEE',
          100: '#FBDDDD',
          200: '#F7BBBB',
          300: '#F39999',
          400: '#EF7777',
          500: '#E53935',
          600: '#D32F2F',
          700: '#C62828',
          800: '#B71C1C',
          900: '#A31515',
        },
        // Accent - "Sovereign Purple" (for demo banner, special highlights)
        accent: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#7C3AED',
          600: '#6D28D9',
          700: '#5B21B6',
          800: '#4C1D95',
          900: '#3B0764',
        },
        // Background colors - GRC Light Theme (Vanta/Drata style)
        bg: {
          primary: '#F4F6F8',      // Light Slate Gray (main background)
          secondary: '#FFFFFF',     // Pure White (cards)
          tertiary: '#E2E8F0',      // Cool Gray (borders/dividers)
        },
        // Text colors for light theme
        text: {
          primary: '#1E293B',       // Dark slate for headings
          secondary: '#475569',     // Medium gray for body text
          tertiary: '#64748B',      // Light gray for labels
          muted: '#94A3B8',         // Muted gray for metadata
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
