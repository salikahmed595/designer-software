import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { CATEGORIES, HOME_POPULAR, TEMPLATES } from './state/catalog';
import shipped from '../production/skills.json';
import { ART_STYLES, applySkillChange, normalizeSkillMap, parseSkillFile, type InstalledSkill, type SkillMap } from './state/production';
import { hasArt, indexThumbnails } from './glass/Thumb';
import type { DesignPlan } from './state/plan';

type Runner = 'claude' | 'off';
interface StubOptions { engines?: Record<'adobe' | 'craft', { ok: boolean; detail: string }>; jobs?: unknown[]; installed?: string[]; rejectPost?: string; fileError?: string; rejectHandIn?: string; rejectPlan?: string; plan?: DesignPlan }

const PLAN: DesignPlan = {
  understood: 'A gamer portrait of a wolf wearing a neon headset.',
  concept: 'Confident wolf, cyan rim light.',
  composition: 'Head and shoulders, centred, readable in a circle.',
  palette: [{ name: 'Night', hex: '#101020' }, { name: 'Neon cyan', hex: '#00E5FF' }],
  typography: 'Orbitron for the gamertag.',
  parts: [{ name: 'Background', app: 'Photoshop', detail: 'Dark gradient' }, { name: 'Wolf > Head', app: 'Illustrator', detail: 'Clean shapes' }],
  assets: ['A display font'],
  assumptions: ['No colours were given, so night blue and neon cyan.'],
  styleNote: null,
};

const SHIPPED = normalizeSkillMap(shipped)!;
const ALL_INSTALLED = ['2d-artwork-photoshop-illustrator', '2d-pfp', '2dvector-photoshop-illustrator-salik', 'hand-made', 'vtuber-master'];

/** Fake production bridge so no test ever starts a real agent. Skill changes go through the same rules as the real bridge. */
function stubBridge(runner: Runner | 'offline' = 'claude', opts: StubOptions = {}) {
  const posted: unknown[] = [];
  const skillCalls: { path: string; body: unknown }[] = [];
  const handIns: { url: string; contentType: string | undefined; body: unknown }[] = [];
  const planCalls: Record<string, unknown>[] = [];
  const jobs: unknown[] = [...(opts.jobs ?? [])];
  let map: SkillMap = structuredClone(SHIPPED);
  const installed: InstalledSkill[] = (opts.installed ?? ALL_INSTALLED).map((name) => ({ name, description: `About ${name}` }));
  const state = () => ({ map, installed, fileError: opts.fileError ?? null });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (runner === 'offline') throw new Error('offline');
    const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;
    if (url.endsWith('/health')) return json({ online: true, runner, detail: runner === 'claude' ? 'Connected: a Claude Code agent will draw.' : 'Claude Code was not found on this computer.', ...(opts.engines ? { engines: opts.engines } : {}) });
    if (url.endsWith('/skills')) return json(state());
    if (url.endsWith('/skills/assign') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      skillCalls.push({ path: 'assign', body });
      const r = applySkillChange(map, body, new Set(installed.map((s) => s.name)));
      if (!r.ok) return json({ error: r.error }, 400);
      map = r.map;
      return json(state());
    }
    if (url.endsWith('/skills/add') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      skillCalls.push({ path: 'add', body });
      const parsed = parseSkillFile(body.content);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      if (installed.some((s) => s.name === parsed.name)) return json({ error: `A skill called “${parsed.name}” is already installed.` }, 409);
      installed.push({ name: parsed.name, description: parsed.description });
      if (body.useFor) {
        const r = applySkillChange(map, { ...body.useFor, skill: parsed.name }, new Set(installed.map((s) => s.name)));
        if (r.ok) map = r.map;
      }
      return json({ ...state(), added: parsed.name }, 201);
    }
    const handIn = /\/jobs\/([a-z0-9]+)\/hand-in\/(psd|ai)$/.exec(url);
    if (handIn && init?.method === 'POST') {
      handIns.push({ url, contentType: (init.headers as Record<string, string> | undefined)?.['Content-Type'], body: init.body });
      if (opts.rejectHandIn) return json({ error: opts.rejectHandIn }, 400);
      const job = jobs.find((j) => (j as { id: string }).id === handIn[1]) as { files: string[]; layers: number | null; handedInAt?: number } | undefined;
      if (!job) return json({ error: 'Not found.' }, 404);
      job.files = [...new Set([`artwork.${handIn[2]}`, ...job.files])];
      if (handIn[2] === 'psd') job.layers = 7;
      job.handedInAt = 1_700_000_000_000;
      return json({ job });
    }
    if (url.endsWith('/plan') && init?.method === 'POST') {
      planCalls.push(JSON.parse(String(init.body)));
      if (opts.rejectPlan) return json({ error: opts.rejectPlan }, 502);
      return json({ plan: structuredClone(opts.plan ?? PLAN) });
    }
    if (url.endsWith('/jobs') && init?.method === 'POST') {
      if (opts.rejectPost) return json({ error: opts.rejectPost }, 409);
      const body = JSON.parse(String(init.body));
      posted.push(body);
      jobs.unshift({ id: 'abc123abc123', createdAt: 1, status: 'queued', styleName: 'Cinematic PFP', skills: [{ name: '2d-pfp', role: 'style' }], ratio: body.ratio, templateTitle: 'Gaming Avatar', briefExcerpt: body.brief, runner, message: null, hasPreview: false, files: [], layers: null });
      return json({ job: jobs[0] }, 201);
    }
    return json({ jobs: structuredClone(jobs) }); // a real fetch returns new objects every time
  }));
  return { posted, skillCalls, handIns, planCalls, currentMap: () => map };
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const setup = (runner: Runner | 'offline' = 'claude', opts: StubOptions = {}) => {
  const bridge = stubBridge(runner, opts);
  const user = userEvent.setup();
  const view = render(<App />);
  return { user, ...bridge, ...view };
};
const heading = (name: RegExp) => screen.getByRole('heading', { level: 1, name });
const artwork = () => screen.getByRole('list', { name: 'Artwork' });

describe('thumbnails', () => {
  it('every artwork type, category cover and art style has its own drawn thumbnail', () => {
    for (const t of TEMPLATES) expect(hasArt(t.id), t.id).toBe(true);
    for (const c of CATEGORIES) expect(hasArt(c.coverId), c.coverId).toBe(true);
    for (const s of ART_STYLES) expect(hasArt(`style-${s.id}`), s.id).toBe(true);
  });

  it('a real image in the thumbnails folder replaces the drawn sketch, matched by file name', () => {
    const photos = indexThumbnails({
      '/thumbnails/stream-overlay.jpg': '/assets/a.jpg',
      '/thumbnails/Style-Manga.PNG': '/assets/b.png',
      '/thumbnails/README.md': '/assets/readme',
      '/thumbnails/style-chibi.svg': '/assets/d.svg',
      '/thumbnails/not-a-real-artwork.webp': '/assets/c.webp',
    });
    expect(photos.get('stream-overlay')).toBe('/assets/a.jpg');
    expect(photos.get('style-manga')).toBe('/assets/b.png');
    expect(photos.get('style-chibi')).toBe('/assets/d.svg');
    expect(photos.has('readme')).toBe(false);
    expect(photos.has('not-a-real-artwork')).toBe(false);
  });
});

describe('only what a designer needs', () => {
  it('the header has three destinations and the old tools are gone', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['New artwork', 'Jobs', 'Skills']);
    for (const gone of [/tools/i, /my projects/i, /find my artwork/i, /generate/i, /credits/i]) {
      expect(screen.queryByRole('button', { name: gone })).not.toBeInTheDocument();
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });
});

describe('step 1 — choose the artwork', () => {
  it('opens on popular artwork with thumbnails; categories are one click away; 3D is marked coming soon', async () => {
    const { user, container } = setup();
    expect(heading(/what does the client need/i)).toBeInTheDocument();
    expect(within(artwork()).getAllByRole('button')).toHaveLength(HOME_POPULAR.length);
    expect(container.querySelectorAll('[data-template] [data-thumb]')).toHaveLength(HOME_POPULAR.length);

    const tabs = within(screen.getByRole('tablist', { name: /artwork categories/i })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Popular', 'Streaming', 'Discord', 'Characters & VTubers', 'Emotes & Badges', 'Gaming Branding', 'Hand-made', '3D ArtworkComing soon']);
    expect(tabs[7]).toBeDisabled();

    await user.click(screen.getByRole('tab', { name: 'Emotes & Badges' }));
    expect(within(artwork()).getAllByRole('button')).toHaveLength(8);
    expect(within(artwork()).getByRole('button', { name: /subscriber badges/i })).toBeInTheDocument();
  });

  it('search understands everyday words and recovers from no results', async () => {
    const { user } = setup();
    const box = screen.getByRole('searchbox', { name: /search artwork/i });
    await user.type(box, 'pfp');
    expect(within(screen.getByRole('list', { name: /search results/i })).getAllByRole('button')[0]).toHaveTextContent(/profile picture/i);
    await user.clear(box);
    await user.type(box, 'qqqqzz');
    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show all artwork/i }));
    expect(within(artwork()).getAllByRole('button')).toHaveLength(HOME_POPULAR.length);
  });
});

describe('step 2 — the brief', () => {
  const openBrief = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(artwork()).getByRole('button', { name: /gaming avatar/i }));
    expect(heading(/brief for gaming avatar/i)).toBeInTheDocument();
  };

  it('one click from the first screen; shows every art style with a thumbnail and a live checklist', async () => {
    const { user, container } = setup();
    await openBrief(user);
    expect(within(screen.getByRole('list', { name: 'Progress' })).getByText('Brief').closest('li')).toHaveAttribute('aria-current', 'step');
    const styles = within(screen.getByRole('radiogroup', { name: 'Art style' })).getAllByRole('radio');
    expect(styles).toHaveLength(ART_STYLES.length);
    expect(container.querySelectorAll('.style-card [data-thumb]')).toHaveLength(ART_STYLES.length);

    const checklist = screen.getByRole('list', { name: 'Checklist' });
    expect(checklist).toHaveTextContent(/art style\s*not chosen yet/i);
    await user.click(screen.getByRole('radio', { name: /cinematic pfp/i }));
    expect(checklist).toHaveTextContent(/art style\s*cinematic pfp/i);
    expect(screen.getByText('2d-pfp')).toBeInTheDocument();
  });

  it('shows which dedicated skills will draw it, and promises editable layered files', async () => {
    const { user } = setup();
    await openBrief(user);
    const drawnWith = () => screen.getByRole('list', { name: 'Drawn with' });
    expect(within(drawnWith()).getByText('2d-pfp')).toBeInTheDocument();
    expect(drawnWith()).toHaveTextContent(/artwork/i);

    await user.click(screen.getByRole('radio', { name: /vector artwork/i }));
    expect(within(drawnWith()).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringMatching(/art style.*2dvector-photoshop-illustrator-salik/i),
      expect.stringMatching(/artwork.*2d-pfp/i),
    ]);
    expect(screen.getByText(/every part on its own named layer/i)).toBeInTheDocument();
  });

  it('says when a style has no dedicated skill yet and the general one is used', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Streaming' }));
    await user.click(within(artwork()).getByRole('button', { name: /stream overlay/i }));
    await user.click(screen.getByRole('radio', { name: /^manga/i }));
    expect(screen.getByRole('list', { name: 'Drawn with' })).toHaveTextContent(/general.*2d-artwork-photoshop-illustrator/i);
  });

  it('shows the bridge’s reason when a skill is missing, and keeps the brief', async () => {
    const { user } = setup('claude', { rejectPost: 'The skill “anime-art” is not installed on this computer, so this can’t be drawn yet.' });
    await openBrief(user);
    await user.click(screen.getByRole('radio', { name: /cinematic pfp/i }));
    await user.type(screen.getByLabelText(/paste the client’s brief/i), 'A wolf gamer');
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    await user.click(await screen.findByRole('button', { name: /approve plan and draw/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/“anime-art” is not installed/);
    expect(heading(/brief for gaming avatar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/paste the client’s brief/i)).toHaveValue('A wolf gamer');
  });

  it('explains what is missing instead of planning or sending an incomplete job', async () => {
    const { user, posted, planCalls } = setup();
    await openBrief(user);
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(expect.arrayContaining(['Choose an art style.', 'Write the client brief.']));
    expect(posted).toHaveLength(0);
    expect(planCalls).toHaveLength(0);
  });

  it('changing the artwork keeps what was already filled in', async () => {
    const { user } = setup();
    await openBrief(user);
    await user.click(screen.getByRole('radio', { name: /chibi/i }));
    await user.type(screen.getByLabelText(/paste the client’s brief/i), 'A wolf gamer');
    await user.click(screen.getByRole('button', { name: /change artwork/i }));
    expect(screen.getByText(/unfinished brief for/i)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Characters & VTubers' }));
    await user.click(within(artwork()).getByRole('button', { name: /mascot character/i }));
    expect(heading(/brief for mascot character/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/paste the client’s brief/i)).toHaveValue('A wolf gamer');
    expect(screen.getByRole('radio', { name: /chibi/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('sends artwork + style + brief + size, then shows the job and clears the brief for the next client', async () => {
    const { user, posted } = setup();
    await openBrief(user);
    await user.click(screen.getByRole('radio', { name: /cinematic pfp/i }));
    await user.type(screen.getByLabelText(/paste the client’s brief/i), 'A wolf gamer with a neon headset');
    await user.type(screen.getByLabelText(/gamertag/i), 'NightWolf');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Size' })).getByRole('radio', { name: 'Square' }));
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    await user.click(await screen.findByRole('button', { name: /approve plan and draw/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Jobs' })).toBeInTheDocument();
    expect(posted).toEqual([{ styleId: 'pfp-cinematic', ratio: 'Square', brief: 'A wolf gamer with a neon headset', templateId: 'gaming-avatar', text: 'NightWolf', reference: null, engine: 'adobe', plan: PLAN }]);
    const job = within(screen.getByRole('list', { name: 'Jobs' })).getByRole('listitem');
    expect(job).toHaveTextContent(/gaming avatar/i);
    expect(job).toHaveTextContent(/waiting/i);
    expect(within(screen.getByRole('navigation', { name: 'Primary' })).getByLabelText('1 in progress')).toBeInTheDocument();

    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'New artwork' }));
    expect(screen.queryByText(/unfinished brief/i)).not.toBeInTheDocument();
  });
});

describe('step 3 — Claude plans the design, the designer approves it', () => {
  const fillBrief = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(artwork()).getByRole('button', { name: /gaming avatar/i }));
    await user.click(screen.getByRole('radio', { name: /cinematic pfp/i }));
    await user.type(screen.getByLabelText(/paste the client’s brief/i), 'A wolf gamer with a neon headset');
  };
  const planPanel = () => screen.getByRole('region', { name: /claude’s design plan/i });

  it('Claude reads the brief first and shows what it understood; nothing is drawn yet', async () => {
    const { user, planCalls, posted } = setup();
    await fillBrief(user);
    expect(screen.queryByRole('button', { name: /approve plan and draw/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    expect(await screen.findByLabelText(/what the client wants/i)).toHaveValue(PLAN.understood);
    expect(planCalls).toEqual([{ styleId: 'pfp-cinematic', ratio: 'Auto', brief: 'A wolf gamer with a neon headset', templateId: 'gaming-avatar', text: '', reference: null, engine: 'adobe' }]);
    expect(posted).toHaveLength(0);
    expect(within(planPanel()).getByLabelText(/^concept/i)).toHaveValue(PLAN.concept);
    expect(within(planPanel()).getByDisplayValue('#00E5FF')).toBeInTheDocument();
    expect(within(planPanel()).getByDisplayValue('Wolf > Head')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Checklist' })).toHaveTextContent(/design plan\s*ready to approve/i);
  });

  it('the designer edits the plan, and the edited plan is what gets drawn', async () => {
    const { user, posted } = setup();
    await fillBrief(user);
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    const concept = await screen.findByLabelText(/^concept/i);
    await user.clear(concept);
    await user.type(concept, 'Wolf with a gold headset');
    await user.click(screen.getByRole('button', { name: /approve plan and draw/i }));
    await screen.findByRole('heading', { level: 1, name: 'Jobs' });
    expect((posted[0] as { plan: DesignPlan }).plan.concept).toBe('Wolf with a gold headset');
  });

  it('redo with a note sends the note and the current plan for Claude to revise', async () => {
    const { user, planCalls } = setup('claude', { plan: { ...PLAN, styleNote: 'Cartoon would suit a younger audience.' } });
    await fillBrief(user);
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    expect(await screen.findByText(/cartoon would suit a younger audience/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/what should claude change/i), 'Make it warmer');
    await user.click(screen.getByRole('button', { name: /redo the plan/i }));
    await vi.waitFor(() => expect(planCalls).toHaveLength(2));
    expect(planCalls[1]).toMatchObject({ note: 'Make it warmer', previous: { concept: PLAN.concept } });
  });

  it('changing the brief makes the plan out of date, so it is planned again before drawing', async () => {
    const { user, posted } = setup();
    await fillBrief(user);
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    await screen.findByLabelText(/what the client wants/i);
    await user.type(screen.getByLabelText(/paste the client’s brief/i), ' and a scar');
    expect(screen.getByText(/you changed the brief after this plan/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve plan and draw/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    await user.click(await screen.findByRole('button', { name: /approve plan and draw/i }));
    await screen.findByRole('heading', { level: 1, name: 'Jobs' });
    expect(posted).toHaveLength(1);
  });

  it('says why planning failed and keeps the brief', async () => {
    const { user, posted } = setup('claude', { rejectPlan: 'Claude’s reply was not a plan. Try again.' });
    await fillBrief(user);
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not a plan\. try again/i);
    expect(screen.getByLabelText(/paste the client’s brief/i)).toHaveValue('A wolf gamer with a neon headset');
    expect(posted).toHaveLength(0);
  });

  it('will not draw an edited plan that lost its parts', async () => {
    const { user, posted } = setup('claude', { plan: { ...PLAN, parts: [PLAN.parts[0]] } });
    await fillBrief(user);
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    await user.clear(await screen.findByDisplayValue('Background'));
    await user.click(screen.getByRole('button', { name: /approve plan and draw/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/must list the parts to draw/i);
    expect(posted).toHaveLength(0);
  });
});

describe('the designer picks the drawing apps per job', () => {
  const fillBrief = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(artwork()).getByRole('button', { name: /gaming avatar/i }));
    await user.click(screen.getByRole('radio', { name: /cinematic pfp/i }));
    await user.type(screen.getByLabelText(/paste the client’s brief/i), 'A wolf gamer with a neon headset');
  };
  const drawWith = () => screen.getByRole('radiogroup', { name: /draw with/i });
  const BOTH = { adobe: { ok: true, detail: 'Connected: Photoshop 2023, Illustrator 2022.' }, craft: { ok: true, detail: 'Connected: PhotoCraft 0.23.1, VectorCraft 0.24.1 (headless).' } };

  it('offers Adobe and PhotoCraft + VectorCraft, starts on Adobe, and shows the choice in the checklist', async () => {
    const { user } = setup('claude', { engines: BOTH });
    await fillBrief(user);
    expect(within(drawWith()).getByRole('radio', { name: /photoshop \+ illustrator/i })).toHaveAttribute('aria-checked', 'true');
    expect(within(drawWith()).getByRole('radio', { name: /photocraft \+ vectorcraft/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('list', { name: 'Checklist' })).toHaveTextContent(/drawing apps\s*photoshop \+ illustrator/i);
  });

  it('plans and draws in PhotoCraft + VectorCraft when the designer picks them', async () => {
    const { user, planCalls, posted } = setup('claude', { engines: BOTH });
    await fillBrief(user);
    await user.click(within(drawWith()).getByRole('radio', { name: /photocraft \+ vectorcraft/i }));
    expect(screen.getByRole('list', { name: 'Checklist' })).toHaveTextContent(/drawing apps\s*photocraft \+ vectorcraft/i);
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    await user.click(await screen.findByRole('button', { name: /approve plan and draw/i }));
    await screen.findByRole('heading', { level: 1, name: 'Jobs' });
    expect(planCalls[0]).toMatchObject({ engine: 'craft' });
    expect(posted[0]).toMatchObject({ engine: 'craft' });
  });

  it('the plan names each part’s app as PhotoCraft or VectorCraft for a Craft job (the plan keeps its roles)', async () => {
    const { user, posted } = setup('claude', { engines: BOTH });
    await fillBrief(user);
    await user.click(within(drawWith()).getByRole('radio', { name: /photocraft \+ vectorcraft/i }));
    await user.click(screen.getByRole('button', { name: /plan with claude/i }));
    const head = await screen.findByDisplayValue('Wolf > Head');
    const row = head.closest('li') as HTMLElement;
    expect(within(row).getByRole('combobox')).toHaveDisplayValue('VectorCraft');
    await user.click(screen.getByRole('button', { name: /approve plan and draw/i }));
    await screen.findByRole('heading', { level: 1, name: 'Jobs' });
    expect((posted[0] as { plan: DesignPlan }).plan.parts.map((x) => x.app)).toEqual(['Photoshop', 'Illustrator']);
  });

  it('says why apps that are not connected can’t be picked, and switches to the pair that is', async () => {
    const { user } = setup('claude', { engines: { adobe: { ok: false, detail: 'Photoshop 2023 is not installed.' }, craft: BOTH.craft } });
    await fillBrief(user);
    const adobe = within(drawWith()).getByRole('radio', { name: /photoshop \+ illustrator/i });
    expect(adobe).toBeDisabled();
    expect(drawWith()).toHaveTextContent(/photoshop 2023 is not installed/i);
    expect(within(drawWith()).getByRole('radio', { name: /photocraft \+ vectorcraft/i })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('honest about production', () => {
  it('says plainly when the agent is missing', async () => {
    const { user } = setup('off');
    await user.click(within(artwork()).getByRole('button', { name: /gaming avatar/i }));
    expect(await screen.findByText(/claude code was not found/i)).toBeInTheDocument();
    expect(screen.getByText(/can’t start until the agent is available/i)).toBeInTheDocument();
  });

  it('blocks sending and explains when production is offline', async () => {
    const { user } = setup('offline');
    await user.click(within(artwork()).getByRole('button', { name: /gaming avatar/i }));
    expect(await screen.findByText(/production is offline\. start the studio app/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send to production/i })).toBeDisabled();
  });

  it('the Jobs screen has a friendly empty state', async () => {
    const { user } = setup();
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Jobs' }));
    expect(heading(/^jobs$/i)).toBeInTheDocument();
    expect(screen.getByText(/no jobs yet/i)).toBeInTheDocument();
  });
});

const openJobs = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Jobs' }));
  expect(heading(/^jobs$/i)).toBeInTheDocument();
};

describe('finished artwork can be edited by the designer', () => {
  const done = {
    id: 'aaaaaaaaaaaa', createdAt: 2, status: 'done', styleName: 'Vector Artwork', ratio: 'Square', templateTitle: 'VTuber Model Art', briefExcerpt: 'Fox girl',
    runner: 'claude', message: 'Made it.', hasPreview: true, files: ['artwork.psd', 'artwork.ai'], layers: 42,
    skills: [{ name: '2dvector-photoshop-illustrator-salik', role: 'style' }, { name: 'vtuber-master', role: 'artwork' }],
  };

  it('offers the layered PSD and AI as downloads, with the layer count and the skills used', async () => {
    const { user } = setup('claude', { jobs: [done] });
    await openJobs(user);
    const job = within(await screen.findByRole('list', { name: 'Jobs' })).getByRole('listitem');
    expect(within(job).getByRole('link', { name: /download layered psd/i })).toHaveAttribute('href', '/api/production/jobs/aaaaaaaaaaaa/files/artwork.psd');
    expect(within(job).getByRole('link', { name: /download illustrator file/i })).toHaveAttribute('href', '/api/production/jobs/aaaaaaaaaaaa/files/artwork.ai');
    expect(job).toHaveTextContent('42 layers');
    expect(job).toHaveTextContent(/2dvector-photoshop-illustrator-salik.*vtuber-master/);
  });

  it('still shows jobs saved before per-job skills existed', async () => {
    const old = { ...done, id: 'bbbbbbbbbbbb', skills: undefined, files: undefined, layers: undefined, skill: '2d-pfp' };
    const { user } = setup('claude', { jobs: [old] });
    await openJobs(user);
    const job = within(await screen.findByRole('list', { name: 'Jobs' })).getByRole('listitem');
    expect(job).toHaveTextContent('2d-pfp');
    expect(within(job).queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
  });
});

describe('Hand-made: the client’s own design, drawn by a designer from a job sheet', () => {
  const PNG_FILE = () => new File([new Uint8Array([137, 80, 78, 71])], 'machine-corps.png', { type: 'image/png' });
  const openHandmade = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('tab', { name: 'Hand-made' }));
    expect(within(artwork()).getAllByRole('button')).toHaveLength(4);
    await user.click(within(artwork()).getByRole('button', { name: /hand-made emblem/i }));
    expect(heading(/brief for hand-made emblem/i)).toBeInTheDocument();
  };

  it('asks for the original instead of an art style, and says a designer draws it from a job sheet — no agent, no AI, no choice to turn on', async () => {
    const { user, posted } = setup();
    await openHandmade(user);
    expect(screen.queryByRole('radiogroup', { name: 'Art style' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Size' })).not.toBeInTheDocument();
    expect(screen.getByText(/a designer draws it by hand/i, { selector: 'p.stage-sub' })).toHaveTextContent(/no ai/i);
    expect(screen.queryByText(/redrawn in photoshop and illustrator/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Drawn with' })).getByText('hand-made')).toBeInTheDocument();
    expect(screen.getByText(/by a designer, from a job sheet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /send to production/i }));
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toContain('Add the client’s original design — the image to redraw.');
    expect(posted).toHaveLength(0);
  });

  it('the designer adds and removes changes, then sends the original for a job sheet', async () => {
    const { user, posted } = setup();
    await openHandmade(user);
    expect(screen.getByText(/none — an exact copy/i)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Something to add' }), 'A sixth star{Enter}');
    await user.type(screen.getByRole('textbox', { name: 'Something to add' }), 'Gold outline');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByRole('textbox', { name: 'Something to take out' }), 'The tagline');
    await user.click(screen.getByRole('button', { name: 'Take out' }));
    expect(within(screen.getByRole('list', { name: 'Add to the design' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('A sixth star'), expect.stringContaining('Gold outline')]);
    await user.click(screen.getByRole('button', { name: 'Delete “Gold outline”' }));
    expect(within(screen.getByRole('list', { name: 'Add to the design' })).getAllByRole('listitem')).toHaveLength(1);

    await user.upload(screen.getByLabelText('Upload reference image'), PNG_FILE());
    expect(await screen.findAllByText('machine-corps.png')).toHaveLength(2); // the upload box and the checklist
    await user.click(screen.getByRole('button', { name: /send to production/i }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Jobs' })).toBeInTheDocument();
    expect(posted).toEqual([{
      templateId: 'handmade-emblem', brief: '',
      changes: { add: ['A sixth star'], remove: ['The tagline'] },
      reference: { dataUrl: expect.stringMatching(/^data:image\/png;base64,/), role: 'Original to redraw' },
    }]);
  });

  it('an older finished redraw still offers its layered files and says how it was made', async () => {
    const drawn = {
      id: 'eeeeeeeeeeee', createdAt: 5, status: 'done', styleName: 'Matches the original', ratio: 'Auto', templateTitle: 'Hand-made Emblem', briefExcerpt: 'Exact copy of the client’s original',
      runner: 'claude', message: 'Redrawn.', hasPreview: true, files: ['artwork.psd', 'artwork.ai'], layers: 18,
      skills: [{ name: SHIPPED.defaultSkill, role: 'general' }], handmade: 'draw',
    };
    const { user } = setup('claude', { jobs: [drawn] });
    await openJobs(user);
    const job = within(await screen.findByRole('list', { name: 'Jobs' })).getByRole('listitem');
    expect(within(job).getByRole('link', { name: /download layered psd/i })).toHaveTextContent('18 layers');
    expect(within(job).getByRole('link', { name: /download illustrator file/i })).toBeInTheDocument();
    expect(job).toHaveTextContent(/redrawn in photoshop\/illustrator with manual tools \(no ai image generation\)/i);
    expect(within(job).getByLabelText('Replace layered PSD')).toBeInTheDocument();
  });

  it('a finished “job sheet only” job offers its job sheet, not artwork', async () => {
    const sheetJob = {
      id: 'cccccccccccc', createdAt: 3, status: 'done', styleName: 'Matches the original', ratio: 'Auto', templateTitle: 'Hand-made Emblem', briefExcerpt: 'Exact copy of the client’s original',
      runner: 'claude', message: 'Job sheet ready. A designer draws this by hand — no AI was used for this job.', hasPreview: false, files: ['handmade-job-sheet.md'], layers: null,
      skills: [{ name: 'hand-made', role: 'artwork' }], handmade: 'strict',
    };
    const { user } = setup('claude', { jobs: [sheetJob] });
    await openJobs(user);
    const job = within(await screen.findByRole('list', { name: 'Jobs' })).getByRole('listitem');
    expect(within(job).getByRole('link', { name: /download job sheet/i })).toHaveAttribute('href', '/api/production/jobs/cccccccccccc/files/handmade-job-sheet.md');
    expect(within(job).queryByRole('link', { name: /psd/i })).not.toBeInTheDocument();
    expect(job).toHaveTextContent(/hand-made/i);
  });

  describe('handing in the finished, hand-drawn artwork', () => {
    const sheetOnly = () => ({
      id: 'dddddddddddd', createdAt: 4, status: 'done', styleName: 'Matches the original', ratio: 'Auto', templateTitle: 'Hand-made Logo', briefExcerpt: 'Exact copy of the client’s original',
      runner: 'claude', message: 'Job sheet ready.', hasPreview: false, files: ['handmade-job-sheet.md'], layers: null, skills: [{ name: 'hand-made', role: 'artwork' }], handmade: 'strict',
    });
    const openJob = async (user: ReturnType<typeof userEvent.setup>) => {
      await openJobs(user);
      return within(await screen.findByRole('list', { name: 'Jobs' })).getByRole('listitem');
    };

    it('uploads the layered PSD as the file itself, then offers it for download with its layer count', async () => {
      const { user, handIns } = setup('claude', { jobs: [sheetOnly()] });
      const job = await openJob(user);
      expect(within(job).getByText(/hand in the finished artwork/i)).toBeInTheDocument();
      const psd = new File([new Uint8Array([0x38, 0x42, 0x50, 0x53])], 'logo-final.psd', { type: '' });
      await user.upload(within(job).getByLabelText('Upload layered PSD'), psd);
      expect(await within(job).findByRole('link', { name: /download layered psd/i })).toHaveAttribute('href', '/api/production/jobs/dddddddddddd/files/artwork.psd');
      expect(job).toHaveTextContent('7 layers');
      expect(handIns).toEqual([{ url: '/api/production/jobs/dddddddddddd/hand-in/psd', contentType: 'application/octet-stream', body: psd }]);
      expect(within(job).getByText(/handed in/i)).toBeInTheDocument();
      expect(within(job).getByLabelText('Replace layered PSD')).toBeInTheDocument();
      expect(within(job).getByLabelText('Upload Illustrator file')).toBeInTheDocument();
    });

    it('says what is wrong with a wrong file before uploading anything', async () => {
      const { user, handIns } = setup('claude', { jobs: [sheetOnly()] });
      const job = await openJob(user);
      fireEvent.change(within(job).getByLabelText('Upload Illustrator file'), { target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] } });
      expect(await within(job).findByRole('alert')).toHaveTextContent('Choose an Illustrator file (.ai).');
      expect(handIns).toHaveLength(0);
    });

    it('shows the server’s reason when it refuses the file', async () => {
      const { user } = setup('claude', { jobs: [sheetOnly()], rejectHandIn: 'This PSD has only one layer — it was flattened.' });
      const job = await openJob(user);
      await user.upload(within(job).getByLabelText('Upload layered PSD'), new File(['8BPS'], 'flat.psd'));
      expect(await within(job).findByRole('alert')).toHaveTextContent(/flattened/);
      expect(within(job).queryByRole('link', { name: /download layered psd/i })).not.toBeInTheDocument();
    });

    it('is offered only on hand-made jobs', async () => {
      const agentJob = { ...sheetOnly(), handmade: undefined, files: ['artwork.psd'], layers: 9, templateTitle: 'Gaming Avatar' };
      const { user } = setup('claude', { jobs: [agentJob] });
      const job = await openJob(user);
      expect(within(job).queryByText(/hand in the finished artwork/i)).not.toBeInTheDocument();
      expect(within(job).queryByLabelText(/upload/i)).not.toBeInTheDocument();
    });
  });

  it('the Skills screen has no drawing skill for hand-made types, because no agent draws them', async () => {
    const { user } = setup();
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Skills' }));
    await screen.findByRole('table', { name: 'Artwork types' });
    expect(screen.getByRole('combobox', { name: 'Skill for Gaming Avatar' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /skill for hand-made/i })).not.toBeInTheDocument();
  });
});

describe('the Skills section (designers manage skills here)', () => {
  const openSkills = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Skills' }));
    expect(heading(/^skills$/i)).toBeInTheDocument();
    await screen.findByRole('table', { name: 'Art styles' });
  };
  const styleRow = (name: RegExp) => within(screen.getByRole('table', { name: 'Art styles' })).getByRole('row', { name });
  const MANGA_SKILL = '---\nname: manga-effects\ndescription: Black-and-white manga inks with screentone.\n---\n\n# Manga\n';

  it('is one click from the header, and lists every style and every artwork type an agent draws, with a skill picker', async () => {
    const { user } = setup();
    await openSkills(user);
    expect(within(screen.getByRole('table', { name: 'Art styles' })).getAllByRole('row')).toHaveLength(ART_STYLES.length + 1);
    expect(within(screen.getByRole('table', { name: 'Artwork types' })).getAllByRole('row')).toHaveLength(TEMPLATES.filter((t) => !t.id.startsWith('handmade-')).length + 1);
    expect(screen.getByRole('combobox', { name: 'Skill for Cinematic PFP' })).toHaveValue('2d-pfp');
    expect(screen.getByRole('combobox', { name: 'Skill for Manga' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Skill for VTuber Model Art' })).toHaveValue('vtuber-master');
    const options = within(screen.getByRole('combobox', { name: 'Skill for Manga' })).getAllByRole('option').map((o) => o.textContent);
    expect(options[0]).toMatch(/default skill.*2d-artwork-photoshop-illustrator/i);
    expect(options).toEqual(expect.arrayContaining(['2d-pfp', 'vtuber-master']));
  });

  it('shows and changes the default skill', async () => {
    const { user, skillCalls, currentMap } = setup();
    await openSkills(user);
    const pick = screen.getByRole('combobox', { name: 'Default skill' });
    expect(pick).toHaveValue('2d-artwork-photoshop-illustrator');
    await user.selectOptions(pick, '2d-pfp');
    expect(skillCalls).toEqual([{ path: 'assign', body: { kind: 'default', skill: '2d-pfp' } }]);
    expect(await screen.findByText(/default skill is now 2d-pfp/i)).toBeInTheDocument();
    expect(currentMap().defaultSkill).toBe('2d-pfp');
    expect(within(screen.getByRole('combobox', { name: 'Skill for Manga' })).getAllByRole('option')[0]).toHaveTextContent(/default skill.*2d-pfp/i);
  });

  it('gives a style its own skill with one pick, and sets it back to the default', async () => {
    const { user, skillCalls } = setup();
    await openSkills(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Skill for Manga' }), 'vtuber-master');
    expect(await screen.findByText(/manga now uses vtuber-master/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Skill for Cinematic PFP' }), '');
    expect(await screen.findByText(/cinematic pfp now uses the default skill/i)).toBeInTheDocument();
    expect(skillCalls.map((c) => c.body)).toEqual([
      { kind: 'style', id: 'manga', skill: 'vtuber-master' },
      { kind: 'style', id: 'pfp-cinematic', skill: null },
    ]);
  });

  it('the brief uses the new choice straight away', async () => {
    const { user } = setup();
    await openSkills(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Skill for Manga' }), 'vtuber-master');
    await screen.findByText(/manga now uses vtuber-master/i);
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'New artwork' }));
    await user.click(screen.getByRole('tab', { name: 'Streaming' }));
    await user.click(within(artwork()).getByRole('button', { name: /stream overlay/i }));
    await user.click(screen.getByRole('radio', { name: /^manga/i }));
    expect(screen.getByRole('list', { name: 'Drawn with' })).toHaveTextContent(/art style\s*vtuber-master/i);
  });

  it('finds a style or artwork by name', async () => {
    const { user } = setup();
    await openSkills(user);
    await user.type(screen.getByRole('searchbox', { name: /find a style or artwork/i }), 'manga');
    expect(within(screen.getByRole('table', { name: 'Art styles' })).getAllByRole('row')).toHaveLength(2);
    expect(screen.queryByRole('table', { name: 'Artwork types' })).not.toBeInTheDocument();
    expect(screen.getByText(/no artwork types match/i)).toBeInTheDocument();
  });

  it('adds a designer’s own skill from a SKILL.md file and uses it for a style right away', async () => {
    const { user, skillCalls, currentMap } = setup();
    await openSkills(user);
    const add = screen.getByRole('region', { name: 'Add a skill' });
    expect(within(add).getByRole('button', { name: /add skill/i })).toBeDisabled();
    await user.upload(within(add).getByLabelText(/skill\.md file/i), new File([MANGA_SKILL], 'SKILL.md', { type: 'text/markdown' }));
    expect(await within(add).findByText(/ready to add/i)).toHaveTextContent(/manga-effects/);
    // the file's text also fills the paste box, so look for the description in the preview line
    expect(within(add).getByText(/black-and-white manga inks/i, { selector: 'p' })).toBeInTheDocument();
    expect(within(add).getByLabelText(/or paste/i)).toHaveValue(MANGA_SKILL);
    await user.selectOptions(within(add).getByRole('combobox', { name: /use it for/i }), 'style:manga');
    await user.click(within(add).getByRole('button', { name: /add skill/i }));

    expect(await screen.findByText(/added “manga-effects”/i)).toBeInTheDocument();
    expect(skillCalls).toEqual([{ path: 'add', body: { content: MANGA_SKILL, useFor: { kind: 'style', id: 'manga' } } }]);
    expect(currentMap().styles.manga).toBe('manga-effects');
    expect(screen.getByRole('combobox', { name: 'Skill for Manga' })).toHaveValue('manga-effects');
    expect(within(screen.getByRole('combobox', { name: 'Skill for Chibi / Super Deformed' })).getByRole('option', { name: 'manga-effects' })).toBeInTheDocument();
    expect(within(add).getByLabelText(/or paste/i)).toHaveValue('');
  });

  it('adds a pasted skill, and explains what is wrong with a bad one', async () => {
    const { user } = setup();
    await openSkills(user);
    const add = screen.getByRole('region', { name: 'Add a skill' });
    const box = within(add).getByLabelText(/or paste/i);
    await user.click(box);
    await user.paste('# just some notes');
    expect(within(add).getByRole('alert')).toHaveTextContent(/starts with/i);
    expect(within(add).getByRole('button', { name: /add skill/i })).toBeDisabled();

    await user.clear(box);
    await user.click(box);
    await user.paste(MANGA_SKILL);
    await user.click(within(add).getByRole('button', { name: /add skill/i }));
    expect(await screen.findByText(/added “manga-effects”/i)).toBeInTheDocument();
  });

  it('refuses to add a skill whose name is already installed, and says why', async () => {
    const { user } = setup();
    await openSkills(user);
    const add = screen.getByRole('region', { name: 'Add a skill' });
    await user.click(within(add).getByLabelText(/or paste/i));
    await user.paste(MANGA_SKILL.replace('manga-effects', '2d-pfp'));
    await user.click(within(add).getByRole('button', { name: /add skill/i }));
    expect(await within(add).findByRole('alert')).toHaveTextContent(/already installed/i);
  });

  it('warns about a skill that is not installed on this computer, without hiding the choice', async () => {
    const { user } = setup('claude', { installed: ['2d-artwork-photoshop-illustrator', 'vtuber-master', '2dvector-photoshop-illustrator-salik', 'hand-made'] });
    await openSkills(user);
    expect(screen.getByText(/1 skill is not installed on this computer: 2d-pfp/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Skill for Cinematic PFP' })).toHaveValue('2d-pfp');
    expect(within(styleRow(/cinematic pfp/i)).getByText(/not installed/i)).toBeInTheDocument();
  });

  it('says plainly when the skills file had to be reset', async () => {
    const { user } = setup('claude', { fileError: 'skills.json could not be read, so the built-in defaults are used.' });
    await openSkills(user);
    expect(screen.getByText(/could not be read/i)).toBeInTheDocument();
  });
});
