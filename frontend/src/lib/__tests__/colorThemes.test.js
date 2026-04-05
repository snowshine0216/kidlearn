import { describe, it, expect } from 'vitest';
import { COLOR_THEMES, getTheme } from '../colorThemes';

describe('COLOR_THEMES', () => {
  it('has all 6 themes', () => {
    const keys = Object.keys(COLOR_THEMES);
    expect(keys).toContain('purple');
    expect(keys).toContain('coral');
    expect(keys).toContain('green');
    expect(keys).toContain('amber');
    expect(keys).toContain('blue');
    expect(keys).toContain('pink');
  });

  it('each theme has bg and accent', () => {
    Object.values(COLOR_THEMES).forEach((theme) => {
      expect(theme).toHaveProperty('bg');
      expect(theme).toHaveProperty('accent');
    });
  });
});

describe('getTheme', () => {
  it('returns the correct theme for known values', () => {
    expect(getTheme('purple')).toEqual(COLOR_THEMES.purple);
    expect(getTheme('coral')).toEqual(COLOR_THEMES.coral);
  });

  it('falls back to purple for unknown values', () => {
    expect(getTheme('unknown')).toEqual(COLOR_THEMES.purple);
    expect(getTheme(undefined)).toEqual(COLOR_THEMES.purple);
    expect(getTheme('')).toEqual(COLOR_THEMES.purple);
  });
});
