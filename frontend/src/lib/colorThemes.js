/**
 * Maps color_theme values from the AI response to CSS custom properties.
 * getTheme() always returns a valid theme — falls back to 'purple' for unknowns.
 */
export const COLOR_THEMES = {
  purple: { bg: 'var(--color-primary-light)', accent: 'var(--color-primary)' },
  coral:  { bg: 'var(--color-coral-light)',   accent: 'var(--color-coral)' },
  green:  { bg: 'var(--color-accent-light)',  accent: 'var(--color-accent)' },
  amber:  { bg: 'var(--color-warm-light)',    accent: 'var(--color-warm)' },
  blue:   { bg: 'var(--color-blue-light)',    accent: 'var(--color-blue)' },
  pink:   { bg: '#FCF0F5',                    accent: 'var(--color-pink)' },
};

export function getTheme(colorTheme) {
  return COLOR_THEMES[colorTheme] ?? COLOR_THEMES['purple'];
}
