import { describe, it, expect } from 'vitest';
import {
  initialFlow, flowReducer, stepOf, briefIssues, summarize, toJobBrief, serialize, hydrate, MAX_PROJECTS,
  type FlowAction, type FlowState,
} from './flow';

const run = (actions: FlowAction[], from: FlowState = initialFlow()) => actions.reduce(flowReducer, from);

describe('guided flow navigation', () => {
  it('starts on home at step 1', () => {
    const s = initialFlow();
    expect(s.page).toBe('home');
    expect(stepOf(s.page)).toBe(1);
  });

  it('category → template → customize is two selections; unavailable categories do nothing', () => {
    let s = run([{ type: 'openCategory', categoryId: 'streaming' }]);
    expect(s.page).toBe('category');
    s = run([{ type: 'pickTemplate', templateId: 'webcam-frame' }], s);
    expect(s.page).toBe('customize');
    expect(stepOf(s.page)).toBe(2);
    expect(run([{ type: 'openCategory', categoryId: 'animation' }]).page).toBe('home');
  });

  it('Back returns to where the user came from and keeps prompt and reference', () => {
    let s = run([
      { type: 'setPrompt', prompt: 'neon wolf' },
      { type: 'setReference', name: 'wolf.png', preview: 'data:x' },
      { type: 'openCategory', categoryId: 'discord' },
      { type: 'pickTemplate', templateId: 'server-icon' },
      { type: 'back' },
    ]);
    expect(s.page).toBe('category');
    expect(s.categoryId).toBe('discord');
    s = run([{ type: 'openCategory', categoryId: 'branding' }], run([{ type: 'goHome' }], s));
    expect(s.brief.prompt).toBe('neon wolf');
    expect(s.brief.referenceName).toBe('wolf.png');
  });

  it('prompt-first: empty does nothing, confident goes to customize with visible inferred fields', () => {
    expect(run([{ type: 'submitPrompt' }]).page).toBe('home');
    const s = run([{ type: 'setPrompt', prompt: 'Purple Twitch webcam border' }, { type: 'submitPrompt' }]);
    expect(s.page).toBe('customize');
    expect(s.brief.templateId).toBe('webcam-frame');
    expect(s.brief.paletteId).toBe('violet');
    expect(s.inferred).toEqual({ template: true, palette: true });
    expect(run([{ type: 'setPalette', paletteId: 'lime' }], s).inferred.palette).toBe(false);
  });

  it('prompt-first: ambiguous shows suggestions and Back from customize returns to them', () => {
    let s = run([{ type: 'setPrompt', prompt: 'Discord dragon art' }, { type: 'submitPrompt' }]);
    expect(s.page).toBe('suggestions');
    expect(s.suggestionIds).toHaveLength(3);
    expect(s.brief.templateId).toBeNull();
    s = run([{ type: 'pickTemplate', templateId: s.suggestionIds[0] }, { type: 'back' }], s);
    expect(s.page).toBe('suggestions');
    expect(s.brief.prompt).toBe('Discord dragon art');
  });

  it('stepper can jump back to completed steps only', () => {
    const custom = run([{ type: 'openCategory', categoryId: 'streaming' }, { type: 'pickTemplate', templateId: 'brb-screen' }]);
    expect(run([{ type: 'goToStep', step: 3 }], custom).page).toBe('customize');
    const result = run([{ type: 'createBrief' }], custom);
    expect(result.page).toBe('result');
    expect(run([{ type: 'goToStep', step: 2 }], result).page).toBe('customize');
    expect(run([{ type: 'goToStep', step: 1 }], result).page).toBe('category');
  });
});

describe('brief rules', () => {
  it('changing artwork keeps a compatible style and explains when it must reset', () => {
    let s = run([
      { type: 'pickTemplate', templateId: 'stream-overlay' },
      { type: 'setStyle', style: 'anime' },
      { type: 'pickTemplate', templateId: 'static-emotes' },
    ]);
    expect(s.brief.style).toBe('anime');
    expect(s.notice).toBeNull();
    s = run([{ type: 'setStyle', style: 'minimal' }, { type: 'pickTemplate', templateId: 'gaming-avatar' }], s);
    expect(s.brief.style).not.toBe('minimal');
    expect(s.notice).toMatch(/minimal/i);
  });

  it('a reference image needs an explicit role before the brief can be created', () => {
    let s = run([{ type: 'pickTemplate', templateId: 'gaming-logo' }, { type: 'setReference', name: 'ref.png', preview: 'data:x' }]);
    expect(briefIssues(s.brief)).toHaveLength(1);
    s = run([{ type: 'createBrief' }], s);
    expect(s.page).toBe('customize');
    expect(s.showErrors).toBe(true);
    s = run([{ type: 'setReferenceRole', role: 'Style reference' }, { type: 'createBrief' }], s);
    expect(s.page).toBe('result');
  });

  it('summarises and exports a production brief', () => {
    const s = run([
      { type: 'pickTemplate', templateId: 'stream-overlay' },
      { type: 'setStyle', style: 'cyberpunk' },
      { type: 'setPalette', paletteId: 'violet' },
      { type: 'setDisplayName', name: 'NightWolf' },
    ]);
    expect(summarize(s.brief)).toBe('Stream Overlay · Cyberpunk · Violet');
    expect(toJobBrief(s.brief)).toMatchObject({ template: 'stream-overlay', style: 'cyberpunk', text: 'NightWolf', variations: 1 });
    expect(run([{ type: 'setVariations', count: 9 }], s).brief.variations).toBe(4);
  });
});

describe('projects and persistence', () => {
  it('saves, caps, resumes and removes projects', () => {
    let s = run([{ type: 'pickTemplate', templateId: 'mascot' }, { type: 'setDisplayName', name: 'Blaze' }]);
    for (let i = 0; i < MAX_PROJECTS + 3; i++) s = flowReducer(s, { type: 'saveProject', id: `p${i}`, now: i });
    expect(s.projects).toHaveLength(MAX_PROJECTS);
    const resumed = run([{ type: 'goHome' }, { type: 'setDisplayName', name: '' }, { type: 'resumeProject', id: s.projects[0].id }], s);
    expect(resumed.page).toBe('customize');
    expect(resumed.brief.displayName).toBe('Blaze');
    expect(run([{ type: 'removeProject', id: s.projects[0].id }], s).projects).toHaveLength(MAX_PROJECTS - 1);
  });

  it('round-trips through storage without the uploaded reference and ignores bad data', () => {
    const s = run([
      { type: 'pickTemplate', templateId: 'mascot' },
      { type: 'setReference', name: 'a.png', preview: 'data:x' },
      { type: 'saveProject', id: 'p1', now: 1 },
    ]);
    const back = hydrate(JSON.parse(serialize(s)));
    expect(back.brief.templateId).toBe('mascot');
    expect(back.brief.referenceName).toBeNull();
    expect(back.projects).toHaveLength(1);
    expect(back.page).toBe('home');
    expect(hydrate({ brief: { templateId: 'nope', style: 'x' }, projects: 'bad' }).brief.templateId).toBeNull();
    expect(hydrate(null).page).toBe('home');
  });
});
