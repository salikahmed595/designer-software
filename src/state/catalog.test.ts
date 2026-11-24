import { describe, it, expect } from 'vitest';
import { CATEGORIES, TEMPLATES, HOME_POPULAR, getTemplate, isHandmade, templatesIn, searchTemplates } from './catalog';

describe('artwork catalog (streamer and gamer artwork only)', () => {
  it('has five 2D categories, Hand-made, plus 3D, which is not available yet', () => {
    expect(CATEGORIES.map((c) => c.name)).toEqual([
      'Streaming', 'Discord', 'Characters & VTubers', 'Emotes & Badges', 'Gaming Branding', 'Hand-made', '3D Artwork',
    ]);
    expect(CATEGORIES.filter((c) => !c.available).map((c) => c.id)).toEqual(['3d']);
    expect(CATEGORIES.find((c) => c.id === '3d')?.unavailableNote).toMatch(/coming soon/i);
  });

  it('Hand-made has redraw types for clients who want the same design made without AI', () => {
    expect(templatesIn('handmade').map((t) => t.id)).toEqual(['handmade-logo', 'handmade-emblem', 'handmade-illustration', 'handmade-character']);
    expect(isHandmade('handmade-logo')).toBe(true);
    expect(isHandmade('gaming-logo')).toBe(false);
    expect(isHandmade(null)).toBe(false);
    expect(searchTemplates('hand made')[0].categoryId).toBe('handmade');
    expect(searchTemplates('no ai redraw')[0].categoryId).toBe('handmade');
  });

  it('every 2D category has 8 artwork types with unique ids', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CATEGORIES.filter((x) => x.available && x.id !== 'handmade')) expect(templatesIn(c.id)).toHaveLength(8);
    expect(templatesIn('3d')).toHaveLength(0);
    for (const t of TEMPLATES) {
      expect(t.title.length).toBeGreaterThan(2);
      expect(t.subtitle.length).toBeGreaterThan(5);
    }
  });

  it('lists popular types first and has a popular shortlist for the first screen', () => {
    const flags = templatesIn('streaming').map((t) => t.popular);
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    expect(HOME_POPULAR.length).toBeGreaterThanOrEqual(8);
    expect(HOME_POPULAR.every((id) => getTemplate(id))).toBe(true);
  });
});

describe('search with synonyms', () => {
  it('matches the words designers and clients actually use', () => {
    expect(searchTemplates('pfp')[0].id).toBe('profile-art');
    expect(searchTemplates('BRB')[0].id).toBe('brb-screen');
    expect(searchTemplates('reactive avatar')[0].id).toBe('pngtuber');
    expect(searchTemplates('facecam')[0].id).toBe('webcam-frame');
  });

  it('returns at most 8 results and can be scoped to a category', () => {
    expect(searchTemplates('banner').length).toBeLessThanOrEqual(8);
    const scoped = searchTemplates('badge', 'emotes');
    expect(scoped.map((t) => t.id)).toEqual(expect.arrayContaining(['sub-badges', 'rank-badges']));
    expect(scoped.every((t) => t.categoryId === 'emotes')).toBe(true);
  });

  it('returns nothing for gibberish and for an empty query', () => {
    expect(searchTemplates('zzzzqq')).toEqual([]);
    expect(searchTemplates('   ')).toEqual([]);
  });
});
