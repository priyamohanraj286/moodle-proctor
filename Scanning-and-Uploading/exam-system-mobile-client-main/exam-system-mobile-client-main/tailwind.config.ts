import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#070a14',
        surface: '#0f1520',
        border: '#1a2235',
        accent: '#00e5c8',
        'accent-dim': '#00b8a3',
        danger: '#ff4757',
        success: '#00d084',
        'text-primary': '#e8edf5',
        'text-secondary': '#64748b',
        'text-muted': '#384456',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        display: ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
