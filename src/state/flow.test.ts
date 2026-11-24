import { describe, it, expect } from 'vitest';
import { initialFlow, flowReducer, serialize, hydrate, type FlowAction, type FlowState } from './flow';

const run = (actions: FlowAction[], from: FlowState = initialFlow()) => actions.reduce(flowReducer, from);

describe('three-step flow: choose artwork → brief → jobs', () => {
  it('starts on the artwork screen with an empty brief', () => {
    const s = initialFlow();
    expect(s.page).toBe('home');
    expect(s.brief).toMatchObject({ templateId: null, artStyleId: null, prompt: '', ratio: 'Auto' });
  });

  it('picking an artwork opens the brief; unknown artwork does nothing', () => {
    expect(run([{ type: 'pickTemplate', templateId: 'webcam-frame' }])).toMatchObject({ page: 'brief', brief: { templateId: 'webcam-frame' } });
    expect(run([{ type: 'pickTemplate', templateId: 'nope' }]).page).toBe('home');
  });

  it('going back and changing the artwork keeps everything already filled in', () => {
    const s = run([
      { type: 'pickTemplate', templateId: 'gaming-logo' },
      { type: 'setArtStyle', artStyleId: 'flat-vector' },
      { type: 'setPrompt', prompt: 'neon wolf' },
      { type: 'setDisplayName', name: 'NightWolf' },
      { type: 'setReference', name: 'wolf.png', preview: 'data:x' },
      { type: 'setReferenceRole', role: 'Style reference' },
      { type: 'setRatio', ratio: 'Square' },
      { type: 'back' },
      { type: 'pickTemplate', templateId: 'esports-logo' },
    ]);
    expect(s.page).toBe('brief');
    expect(s.brief).toEqual({
      templateId: 'esports-logo', artStyleId: 'flat-vector', prompt: 'neon wolf', displayName: 'NightWolf', referenceName: 'wolf.png', referenceRole: 'Style reference', ratio: 'Square',
      changes: { add: [], remove: [] }, sheetOnly: false,
    });
    expect(s.referencePreview).toBe('data:x');
  });

  it('a new reference resets its role; removing it clears both', () => {
    let s = run([{ type: 'setReference', name: 'a.png', preview: 'data:a' }, { type: 'setReferenceRole', role: 'Edit this image' }, { type: 'setReference', name: 'b.png', preview: 'data:b' }]);
    expect(s.brief.referenceRole).toBeNull();
    s = run([{ type: 'clearReference' }], s);
    expect(s.brief.referenceName).toBeNull();
    expect(s.referencePreview).toBeNull();
  });

  it('limits text lengths', () => {
    const s = run([{ type: 'setPrompt', prompt: 'x'.repeat(5000) }, { type: 'setDisplayName', name: 'y'.repeat(500) }]);
    expect(s.brief.prompt).toHaveLength(2000);
    expect(s.brief.displayName).toHaveLength(60);
  });

  it('after a job is sent: go to Jobs with a fresh brief for the next client', () => {
    const s = run([
      { type: 'pickTemplate', templateId: 'mascot' },
      { type: 'setArtStyle', artStyleId: 'chibi' },
      { type: 'setPrompt', prompt: 'fox' },
      { type: 'setReference', name: 'a.png', preview: 'data:a' },
      { type: 'showErrors' },
      { type: 'jobSent' },
    ]);
    expect(s.page).toBe('jobs');
    expect(s.brief).toEqual(initialFlow().brief);
    expect(s.referencePreview).toBeNull();
    expect(s.showErrors).toBe(false);
    expect(run([{ type: 'back' }], s).page).toBe('home');
  });

  it('hand-made: the designer lists what to add or remove compared with the original', () => {
    let s = run([
      { type: 'pickTemplate', templateId: 'handmade-logo' },
      { type: 'addChange', list: 'add', text: '  A sixth star  ' },
      { type: 'addChange', list: 'add', text: '   ' },
      { type: 'addChange', list: 'remove', text: 'The small tagline' },
      { type: 'addChange', list: 'add', text: 'x'.repeat(500) },
      { type: 'setSheetOnly', on: true },
    ]);
    expect(s.brief.changes).toEqual({ add: ['A sixth star', 'x'.repeat(200)], remove: ['The small tagline'] });
    expect(s.brief.sheetOnly).toBe(true);
    s = run([{ type: 'removeChange', list: 'add', index: 0 }], s);
    expect(s.brief.changes.add).toEqual(['x'.repeat(200)]);
    for (let i = 0; i < 40; i++) s = run([{ type: 'addChange', list: 'remove', text: `item ${i}` }], s);
    expect(s.brief.changes.remove).toHaveLength(30);
    const back = hydrate(JSON.parse(serialize(s)));
    expect(back.brief.changes).toEqual(s.brief.changes);
    expect(back.brief.sheetOnly).toBe(true);
    expect(run([{ type: 'jobSent' }], s).brief.changes).toEqual({ add: [], remove: [] });
    expect(hydrate({ brief: { changes: { add: [1, 'ok', 'y'.repeat(999)], remove: 'nope' }, sheetOnly: 'yes', aiSheet: true } }).brief).toMatchObject({ changes: { add: ['ok', 'y'.repeat(200)], remove: [] }, sheetOnly: false });
  });

  it('header navigation works from anywhere', () => {
    const s = run([{ type: 'pickTemplate', templateId: 'mascot' }, { type: 'openJobs' }]);
    expect(s.page).toBe('jobs');
    expect(s.brief.templateId).toBe('mascot');
    expect(run([{ type: 'goHome' }], s).page).toBe('home');
  });
});

describe('saved on this device', () => {
  it('round-trips the brief without the uploaded reference, and always reopens on the first screen', () => {
    const s = run([
      { type: 'pickTemplate', templateId: 'mascot' },
      { type: 'setArtStyle', artStyleId: 'chibi' },
      { type: 'setPrompt', prompt: 'fox' },
      { type: 'setReference', name: 'a.png', preview: 'data:a' },
    ]);
    const back = hydrate(JSON.parse(serialize(s)));
    expect(back.page).toBe('home');
    expect(back.brief).toMatchObject({ templateId: 'mascot', artStyleId: 'chibi', prompt: 'fox', referenceName: null, referenceRole: null });
  });

  it('ignores damaged or hostile stored data', () => {
    expect(hydrate(null).brief).toEqual(initialFlow().brief);
    const bad = hydrate({ brief: { templateId: 'nope', artStyleId: '../../x', ratio: '9:99', prompt: 42, displayName: 'z'.repeat(999) } });
    expect(bad.brief).toMatchObject({ templateId: null, artStyleId: null, ratio: 'Auto', prompt: '' });
    expect(bad.brief.displayName).toHaveLength(60);
  });
});
