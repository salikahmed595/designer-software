import { describe, it, expect } from 'vitest';
import { initialFlow, flowReducer, planStatus, serialize, hydrate, type FlowAction, type FlowState } from './flow';

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
      changes: { add: [], remove: [] }, engine: 'adobe',
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

  it('remembers how long a pasted brief really was when it did not fit, and forgets it once the brief fits', () => {
    const s = run([{ type: 'setPrompt', prompt: 'x'.repeat(4100) }]);
    expect(s.brief.prompt).toHaveLength(2000);
    expect(s.briefOverflow).toBe(4100);
    expect(run([{ type: 'setPrompt', prompt: 'a fox' }], s).briefOverflow).toBeNull();
    expect(initialFlow().briefOverflow).toBeNull();
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
    ]);
    expect(s.brief.changes).toEqual({ add: ['A sixth star', 'x'.repeat(200)], remove: ['The small tagline'] });
    s = run([{ type: 'removeChange', list: 'add', index: 0 }], s);
    expect(s.brief.changes.add).toEqual(['x'.repeat(200)]);
    for (let i = 0; i < 40; i++) s = run([{ type: 'addChange', list: 'remove', text: `item ${i}` }], s);
    expect(s.brief.changes.remove).toHaveLength(30);
    const back = hydrate(JSON.parse(serialize(s)));
    expect(back.brief.changes).toEqual(s.brief.changes);
    expect(run([{ type: 'jobSent' }], s).brief.changes).toEqual({ add: [], remove: [] });
    expect(hydrate({ brief: { changes: { add: [1, 'ok', 'y'.repeat(999)], remove: 'nope' }, sheetOnly: true } }).brief).toEqual({ ...initialFlow().brief, changes: { add: ['ok', 'y'.repeat(200)], remove: [] } }); // an old saved "sheetOnly" is dropped
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

describe('the design plan: made for one brief, out of date when the brief changes', () => {
  const plan = {
    understood: 'A neon wolf logo.', concept: 'Wolf head in a shield.', composition: 'Centred.',
    palette: [{ name: 'Night', hex: '#101020' }, { name: 'Neon', hex: '#00FFCC' }], typography: 'Orbitron.',
    parts: [{ name: 'Shield', app: 'Illustrator' as const, detail: '' }], assets: [], assumptions: [], styleNote: null,
  };
  const filled = (): FlowState => run([
    { type: 'pickTemplate', templateId: 'gaming-logo' },
    { type: 'setArtStyle', artStyleId: 'flat-vector' },
    { type: 'setPrompt', prompt: 'neon wolf' },
  ]);

  it('has no plan until Claude makes one; then it is current', () => {
    expect(planStatus(filled())).toBe('none');
    const s = run([{ type: 'planReady', plan }], filled());
    expect(planStatus(s)).toBe('current');
    expect(s.plan?.plan).toEqual(plan);
  });

  it('designer edits keep the plan current; changing the brief makes it out of date', () => {
    const s = run([{ type: 'planReady', plan }, { type: 'editPlan', plan: { ...plan, concept: 'Wolf head, no shield.' } }], filled());
    expect(planStatus(s)).toBe('current');
    expect(s.plan?.plan.concept).toBe('Wolf head, no shield.');
    for (const change of [
      { type: 'setPrompt', prompt: 'neon fox' },
      { type: 'setArtStyle', artStyleId: 'cartoon' },
      { type: 'setDisplayName', name: 'Fox' },
      { type: 'setRatio', ratio: 'Wide' },
      { type: 'setReference', name: 'a.png', preview: 'data:x' },
    ] as FlowAction[]) expect(planStatus(run([change], s))).toBe('outdated');
  });

  it('the plan is dropped once the job is sent, and never saved on the device', () => {
    const s = run([{ type: 'planReady', plan }], filled());
    expect(run([{ type: 'jobSent' }], s).plan).toBe(null);
    expect(serialize(s)).not.toContain('Wolf head');
  });
});

describe('the drawing apps the designer picks per job', () => {
  const run = (actions: FlowAction[], from: FlowState = initialFlow()) => actions.reduce(flowReducer, from);

  it('starts on Photoshop + Illustrator (Adobe), and switches to PhotoCraft + VectorCraft when picked', () => {
    expect(initialFlow().brief.engine).toBe('adobe');
    expect(run([{ type: 'setEngine', engine: 'craft' }]).brief.engine).toBe('craft');
  });

  it('a plan made for the other apps is out of date', () => {
    const plan = { understood: 'u', concept: 'c', composition: 'x', palette: [], typography: 't', parts: [], assets: [], assumptions: [], styleNote: null };
    const s = run([{ type: 'planReady', plan }]);
    expect(planStatus(run([{ type: 'setEngine', engine: 'craft' }], s))).toBe('outdated');
  });

  it('remembers the choice on this device, and drops anything unknown', () => {
    expect(hydrate(JSON.parse(serialize(run([{ type: 'setEngine', engine: 'craft' }])))).brief.engine).toBe('craft');
    expect(hydrate({ brief: { engine: 'gimp' } }).brief.engine).toBe('adobe');
  });
});
