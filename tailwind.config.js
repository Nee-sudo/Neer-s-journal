module.exports = {
  content: [
    "./views/**/*.ejs",
    "./views/**/*.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        journalBg: 'var(--color-bg)',
        journalSurface: 'var(--color-surface)',
        'journalSurface-soft': 'var(--color-surface-soft)',
        journalSurfaceSoft: 'var(--color-surface-soft)',
        journalText: 'var(--color-text)',
        journalMuted: 'var(--color-text-muted)',
        journalAccent: 'var(--color-accent)',
        'journalAccent-hover': 'var(--color-accent-hover)',
        journalAccentHover: 'var(--color-accent-hover)',
        'journalAccent-light': 'var(--color-accent-light)',
        journalAccentLight: 'var(--color-accent-light)',
        journalAccent2: 'var(--color-accent-2)',
        'journalAccent2-hover': 'var(--color-accent-2-hover)',
        journalAccent2Hover: 'var(--color-accent-2-hover)',
        journalBorder: 'var(--color-border)',
      },
      fontFamily: {
        display: ['Merriweather', 'Georgia', 'serif'],
        body: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        reading: ['Lora', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    }
  },
  plugins: [],
}
