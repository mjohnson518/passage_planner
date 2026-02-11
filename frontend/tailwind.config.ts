import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './emails/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ['var(--font-heading)', 'Libre Baskerville', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'Source Sans 3', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'Libre Baskerville', 'Georgia', 'serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Maritime Color Palette
        ocean: {
          deep: 'hsl(var(--ocean-deep))',
          mid: 'hsl(var(--ocean-mid))',
          light: 'hsl(var(--ocean-light))',
          50: '#e8f4f8',
          100: '#c5e4ed',
          200: '#9ed3e1',
          300: '#77c1d5',
          400: '#59b3cc',
          500: '#3ba5c3',
          600: '#3596b3',
          700: '#2d839e',
          800: '#26718a',
          900: '#1a5266',
        },
        brass: {
          DEFAULT: 'hsl(var(--brass))',
          dark: 'hsl(var(--brass-dark))',
          50: '#fdf8ed',
          100: '#f9ecd0',
          200: '#f3d9a0',
          300: '#ecc46b',
          400: '#e5ae3d',
          500: '#d49a25',
          600: '#b97b1c',
          700: '#985d1a',
          800: '#7d4a1c',
          900: '#683d1b',
        },
        parchment: 'hsl(var(--parchment))',
        ink: 'hsl(var(--ink))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        'chart-grid': 'hsl(var(--chart-grid))',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'maritime': '0 4px 20px -2px hsl(var(--primary) / 0.15)',
        'maritime-lg': '0 20px 40px -15px hsl(var(--primary) / 0.2)',
        'brass': '0 4px 14px 0 hsl(var(--brass) / 0.35)',
        'card': '0 1px 3px 0 hsl(var(--foreground) / 0.05), 0 1px 2px -1px hsl(var(--foreground) / 0.05)',
        'card-hover': '0 20px 40px -15px hsl(var(--primary) / 0.15), 0 8px 16px -8px hsl(var(--foreground) / 0.1)',
        'inner-light': 'inset 0 1px 0 0 hsl(var(--background) / 0.5)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "compass-needle": {
          "0%, 100%": { transform: "rotate(-5deg)" },
          "50%": { transform: "rotate(5deg)" },
        },
        "wave-shift": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(40px)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--primary) / 0.4)" },
          "50%": { boxShadow: "0 0 20px 10px hsl(var(--primary) / 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.5s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.4s ease-out",
        "slide-in-left": "slide-in-left 0.4s ease-out",
        float: "float 6s ease-in-out infinite",
        "compass-needle": "compass-needle 4s ease-in-out infinite",
        "wave-shift": "wave-shift 3s linear infinite",
        pulse: "pulse 2s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "scale-in": "scale-in 0.2s ease-out",
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'ocean-gradient': 'linear-gradient(135deg, hsl(var(--ocean-deep)) 0%, hsl(var(--primary)) 50%, hsl(var(--ocean-mid)) 100%)',
        'brass-gradient': 'linear-gradient(135deg, hsl(var(--brass)) 0%, hsl(var(--brass-dark)) 100%)',
        'hero-gradient': 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(var(--primary) / 0.08) 0%, transparent 50%)',
        'chart-grid': 'linear-gradient(hsl(var(--chart-grid) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--chart-grid) / 0.5) 1px, transparent 1px)',
      },
      backgroundSize: {
        'chart': '40px 40px',
      },
      typography: {
        DEFAULT: {
          css: {
            fontFamily: 'Source Sans 3, system-ui, sans-serif',
            h1: { fontFamily: 'Libre Baskerville, Georgia, serif' },
            h2: { fontFamily: 'Libre Baskerville, Georgia, serif' },
            h3: { fontFamily: 'Libre Baskerville, Georgia, serif' },
            h4: { fontFamily: 'Libre Baskerville, Georgia, serif' },
          },
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
}

export default config
