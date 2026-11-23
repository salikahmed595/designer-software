import { describe, it, expect } from 'vitest';
import { STYLES, STYLE_CATEGORIES, filterStyles, getStyle } from './styles';

describe('visual styles catalog', () => {
  it('has unique ids and includes the core presets', () => {
    const ids = STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const name of ['Auto', 'Default 3D', 'Default Icon', 'Default Illustration', 'Default Line Art', 'Default Photography', 'Default Vector', '1980s Comic', '35mm Time Capsule', '8-bit Nostalgia', "90's Studio", 'A24 Cinematic']) {
      expect(STYLES.some((s) => s.name === name)).toBe(true);
    }
  });

  it('exposes the filter tabs in order', () => {
    expect(STYLE_CATEGORIES).toEqual(['All', '3D', 'Icon', 'Illustration', 'Line Art', 'Photography', 'Vector', 'Composition']);
  });

  it('All with empty query returns everything', () => {
    expect(filterStyles(STYLES, '', 'All')).toHaveLength(STYLES.length);
  });

  it('filters by category', () => {
    const r = filterStyles(STYLES, '', 'Line Art');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.categories.includes('Line Art'))).toBe(true);
    expect(r.some((s) => s.name === 'Default Line Art')).toBe(true);
  });

  it('search is case-insensitive, trimmed and combines with category', () => {
    expect(filterStyles(STYLES, '  COMIC ', 'All').map((s) => s.name)).toContain('1980s Comic');
    expect(filterStyles(STYLES, 'comic', 'Photography')).toHaveLength(0);
  });

  it('returns empty for no match', () => {
    expect(filterStyles(STYLES, 'zzzz-no-match', 'All')).toEqual([]);
  });

  it('getStyle falls back to Auto for unknown ids', () => {
    expect(getStyle('nope').id).toBe('auto');
  });
});
