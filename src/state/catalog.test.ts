import { describe, it, expect } from 'vitest';
import {
  CATEGORIES, TEMPLATES, HOME_POPULAR, PALETTES, getTemplate, templatesIn, searchTemplates, suggestFromPrompt,
} from './catalog';

describe('artwork catalog', () => {
  it('has exactly six categories; only Animation is unavailable (2D only for now)', () => {
    expect(CATEGORIES.map((c) => c.name)).toEqual([
      'Streaming', 'Discord', 'Characters & VTubers', 'Emotes & Badges', 'Gaming Branding', 'Animation',
    ]);
    expect(CATEGORIES.filter((c) => !c.available).map((c) => c.id)).toEqual(['animation']);
  });

  it('every available category has 8 templates with unique canonical ids and valid data', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CATEGORIES.filter((x) => x.available)) expect(templatesIn(c.id)).toHaveLength(8);
    expect(templatesIn('animation')).toHaveLength(0);
    for (const t of TEMPLATES) {
      expect(t.styles.length).toBeGreaterThanOrEqual(2);
      expect(t.title.length).toBeGreaterThan(2);
      expect(t.subtitle.length).toBeGreaterThan(5);
    }
  });

  it('lists popular templates first inside a category', () => {
    const flags = templatesIn('streaming').map((t) => t.popular);
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    expect(HOME_POPULAR.every((id) => getTemplate(id))).toBe(true);
    expect(PALETTES).toHaveLength(5);
  });
});

describe('search with synonyms', () => {
  it('matches common synonyms', () => {
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

describe('intent suggestions from a prompt', () => {
  it('confident match picks one template and infers the colour', () => {
    const s = suggestFromPrompt('Purple Twitch webcam border');
    expect(s.confident).toBe(true);
    expect(s.templates.map((t) => t.id)).toEqual(['webcam-frame']);
    expect(s.paletteId).toBe('violet');
  });

  it('ambiguous prompt returns up to three choices and never auto-picks', () => {
    const s = suggestFromPrompt('I need something red and black with a dragon for my Discord');
    expect(s.confident).toBe(false);
    expect(s.templates).toHaveLength(3);
    expect(s.templates.map((t) => t.id)).toEqual(expect.arrayContaining(['server-icon', 'server-banner', 'mascot']));
    expect(s.paletteId).toBe('ember');
  });

  it('"make my avatar talk" suggests PNGTuber, with an honest capability note', () => {
    const s = suggestFromPrompt('Make my avatar talk');
    expect(s.templates[0].id).toBe('pngtuber');
    expect(s.templates[0].note).toMatch(/not a rigged/i);
  });

  it('"full stream branding" suggests the bundle with a deliverables checklist', () => {
    const s = suggestFromPrompt('Full stream branding');
    expect(s.templates[0].id).toBe('full-stream-kit');
    expect(s.templates[0].bundle?.length).toBeGreaterThan(3);
  });

  it('vague prompts stay ambiguous; unmatched prompts fall back to popular ideas', () => {
    const vague = suggestFromPrompt('gaming art');
    expect(vague.confident).toBe(false);
    expect(vague.matched).toBe(true);
    const none = suggestFromPrompt('zzzzqq');
    expect(none.matched).toBe(false);
    expect(none.confident).toBe(false);
    expect(none.templates).toHaveLength(3);
  });
});
