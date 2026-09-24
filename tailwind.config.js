/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        sunken: "var(--sunken)",
        surface: "var(--surface-1)",
        surface2: "var(--surface-2)",
        raised: "var(--raised)",
        line: "var(--line)",
        text: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        pos: "var(--pos)",
        neg: "var(--neg)",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans Variable", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Plus Jakarta Sans Variable", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
