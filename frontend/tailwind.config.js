/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          red: '#FA2D48',
          DEFAULT: 'var(--accent-color, #FA2D48)',
        },
        surface: {
          dark: '#0D0D0F',
          variantDark: '#1C1C1E',
          outlineDark: '#2C2C2E',
          light: '#F7F7F9',
          variantLight: '#F2F2F7',
          outlineLight: '#E5E5EA',
        },
      },
      fontFamily: {
        sf: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
        acrylic: '24px',
      },
      keyframes: {
        mesh: {
          '0%, 100%': { transform: 'scale(1) translate(0px, 0px)' },
          '50%': { transform: 'scale(1.15) translate(20px, -20px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      animation: {
        'mesh-glow': 'mesh 15s ease-in-out infinite',
        marquee: 'marquee 12s linear infinite',
      },
    },
  },
  plugins: [],
}

