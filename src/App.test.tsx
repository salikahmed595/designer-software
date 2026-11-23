import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { CATEGORIES, TEMPLATES } from './state/catalog';
import { hasArt } from './glass/Thumb';
import { ART_STYLES } from './state/production';

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.useRealTimers());

const setup = () => {
  const user = userEvent.setup();
  const view = render(<App />);
  return { user, ...view };
};
const heading = (name: RegExp) => screen.getByRole('heading', { level: 1, name });
const explore = () => screen.getByRole('region', { name: /explore artwork/i });

describe('thumbnails', () => {
  it('every artwork type and every category cover has its own drawn thumbnail', () => {
    for (const t of TEMPLATES) expect(hasArt(t.id), t.id).toBe(true);
    for (const c of CATEGORIES) expect(hasArt(c.coverId), c.coverId).toBe(true);
    for (const s of ART_STYLES) expect(hasArt(`style-${s.id}`), s.id).toBe(true);
  });
});

describe('home', () => {
  it('asks what to create and shows exactly six categories, Animation not selectable', () => {
    setup();
    expect(heading(/what would you like to create/i)).toBeInTheDocument();
    const cards = within(within(explore()).getByRole('list', { name: /artwork categories/i })).getAllByRole('button');
    expect(cards).toHaveLength(6);
    expect(cards.filter((c) => (c as HTMLButtonElement).disabled).map((c) => c.textContent)).toEqual([expect.stringMatching(/animation.*coming later/i)]);
    expect(screen.getByRole('button', { name: /find my artwork/i })).toBeDisabled();
  });

  it('global search understands synonyms and has a helpful empty state', async () => {
    const { user } = setup();
    const box = screen.getByRole('searchbox', { name: /search all artwork/i });
    await user.type(box, 'pfp');
    const results = within(explore()).getByRole('list', { name: /search results/i });
    expect(within(results).getAllByRole('button')[0]).toHaveTextContent(/profile picture/i);
    expect(within(results).getAllByRole('button')[0]).toHaveTextContent(/discord/i);
    await user.clear(box);
    await user.type(box, 'qqqqzz');
    expect(within(explore()).getByText(/couldn't find an exact match/i)).toBeInTheDocument();
  });
});

describe('browse-first journey', () => {
  it('reaches an artwork in two selections, with thumbnails, stepper and back', async () => {
    const { user, container } = setup();
    await user.click(within(explore()).getByRole('button', { name: /streaming/i }));
    expect(heading(/choose your streaming artwork/i)).toBeInTheDocument();
    const list = screen.getByRole('list', { name: /streaming artwork/i });
    expect(within(list).getAllByRole('button')).toHaveLength(8);
    expect(container.querySelectorAll('[data-template] [data-thumb]')).toHaveLength(8);

    await user.click(within(list).getByRole('button', { name: /webcam frame/i }));
    expect(heading(/customize webcam frame/i)).toBeInTheDocument();
    const progress = screen.getByRole('list', { name: /creation progress/i });
    expect(within(progress).getByText('Customize').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/more options/i).closest('details')).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(heading(/choose your streaming artwork/i)).toBeInTheDocument();
  });

  it('creates an honest brief, then saves and resumes it', async () => {
    const { user } = setup();
    await user.click(within(explore()).getByRole('button', { name: /gaming branding/i }));
    await user.click(screen.getByRole('button', { name: /gaming logo/i }));
    await user.click(screen.getByRole('radio', { name: 'Ember' }));
    await user.type(screen.getByLabelText(/brand or gamertag/i), 'NightWolf');
    expect(screen.getByLabelText('Summary')).toHaveTextContent('Gaming Logo · Esports · Ember');

    await user.click(screen.getByRole('button', { name: /create artwork/i }));
    expect(heading(/your artwork brief is ready/i)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/no artwork has been made yet/i);
    expect(screen.getByRole('button', { name: /send to production/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /save to my projects/i }));
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: /my projects/i }));
    expect(heading(/my projects/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue editing/i }));
    expect(heading(/customize gaming logo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/brand or gamertag/i)).toHaveValue('NightWolf');
    expect(screen.getByRole('radio', { name: 'Ember' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('prompt-first journey', () => {
  it('confident idea goes straight to customize, with the guesses visible and editable', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/describe your idea/i), 'Purple Twitch webcam border');
    await user.click(screen.getByRole('button', { name: /find my artwork/i }));
    expect(heading(/customize webcam frame/i)).toBeInTheDocument();
    expect(screen.getByText(/we matched your idea to/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Violet' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/violet was picked from your description/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(heading(/choose your streaming artwork/i)).toBeInTheDocument();
  });

  it('ambiguous idea offers three choices and never auto-picks; Back keeps the idea', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/describe your idea/i), 'Discord dragon art');
    await user.click(screen.getByRole('button', { name: /find my artwork/i }));
    expect(heading(/your idea could become/i)).toBeInTheDocument();
    const list = screen.getByRole('list', { name: /suggested artwork/i });
    expect(within(list).getAllByRole('button')).toHaveLength(3);
    await user.click(within(list).getByRole('button', { name: /server icon/i }));
    expect(heading(/customize server icon/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your idea/i)).toHaveValue('Discord dragon art');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(heading(/your idea could become/i)).toBeInTheDocument();
  });
});

describe('tools (secondary navigation keeps the classic generators)', () => {
  const openImageTool = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /^tools/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Image' }));
  };

  it('lists all seven tools and opens the generator', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /^tools/i }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Image', 'Edit', 'Video', 'Music', 'Voice', 'Sound', 'Graphic']);
    await user.click(screen.getByRole('menuitem', { name: 'Video' }));
    expect(heading(/video generator/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Video' })).toHaveAttribute('aria-selected', 'true');
  });

  it('generate is gated, spends credits and completes a loading session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await openImageTool(user);
    const btn = screen.getByRole('button', { name: /^generate/i });
    expect(btn).toBeDisabled();
    await user.type(screen.getByLabelText(/describe the image/i), 'a lighthouse at dusk');
    await user.click(btn);
    expect(screen.getByText('19 AI credits')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: /generation sessions/i });
    expect(within(list).getAllByRole('listitem')[0]).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(within(list).getAllByRole('listitem')[0]).toHaveAttribute('aria-busy', 'false');
  });

  it('style modal still filters, selects, closes on Escape and returns focus', async () => {
    const { user } = setup();
    await openImageTool(user);
    await user.click(screen.getByRole('button', { name: /visual style: 35mm time capsule/i }));
    const dialog = screen.getByRole('dialog', { name: /apply visual style/i });
    await user.type(within(dialog).getByRole('searchbox'), '8-bit');
    await user.click(within(dialog).getByRole('button', { name: /8-bit nostalgia/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /visual style: 8-bit nostalgia/i })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: /visual style/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('production page (art style + client brief + reference + ratio → agent)', () => {
  const stubBridge = (runner: 'claude' | 'off' = 'claude') => {
    const posted: unknown[] = [];
    const jobs: unknown[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;
      if (url.endsWith('/health')) return json({ online: true, runner, detail: runner === 'claude' ? 'Connected: a Claude Code agent will draw.' : 'Claude Code was not found on this computer.' });
      if (url.endsWith('/jobs') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        posted.push(body);
        jobs.unshift({ id: 'abc123abc123', createdAt: 1, status: 'queued', styleName: 'Cinematic PFP', skill: '2d-pfp', ratio: body.ratio, templateTitle: null, briefExcerpt: body.brief, runner, message: null, hasPreview: false });
        return json({ job: jobs[0] }, 201);
      }
      return json({ jobs });
    });
    vi.stubGlobal('fetch', fetchMock);
    return { posted };
  };
  afterEach(() => vi.unstubAllGlobals());

  const openProduction = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Production' }));
    expect(heading(/send to production/i)).toBeInTheDocument();
  };

  it('shows every art style with a thumbnail, filters them, and names the skill that will run', async () => {
    stubBridge();
    const { user, container } = setup();
    await openProduction(user);
    expect(await screen.findByText(/connected: a claude code agent/i)).toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: 'Art style' });
    expect(within(group).getAllByRole('radio')).toHaveLength(ART_STYLES.length);
    expect(container.querySelectorAll('.style-card [data-thumb]')).toHaveLength(ART_STYLES.length);

    await user.click(screen.getByRole('tab', { name: 'Vector' }));
    expect(within(group).getAllByRole('radio').length).toBeLessThan(ART_STYLES.length);
    await user.click(within(group).getByRole('radio', { name: /flat vector/i }));
    expect(screen.getByText('2dvector-photoshop-illustrator-salik')).toBeInTheDocument();
  });

  it('validates, then sends style + brief + ratio to the bridge and lists the job', async () => {
    const { posted } = stubBridge();
    const { user } = setup();
    await openProduction(user);
    await screen.findByText(/connected/i);

    await user.click(screen.getByRole('button', { name: /send to production/i }));
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(expect.arrayContaining(['Choose an art style.', 'Write the client brief.']));
    expect(posted).toHaveLength(0);

    await user.click(screen.getByRole('radio', { name: /cinematic pfp/i }));
    await user.type(screen.getByLabelText(/client brief/i), 'A wolf gamer with a neon headset');
    await user.click(screen.getByRole('radio', { name: 'Square' }));
    expect(screen.getByLabelText('Job summary')).toHaveTextContent('Cinematic PFP · Square · 2000 × 2000');
    await user.click(screen.getByRole('button', { name: /send to production/i }));

    const job = await within(await screen.findByRole('list', { name: /production jobs/i })).findByRole('listitem');
    expect(job).toHaveTextContent(/cinematic pfp/i);
    expect(job).toHaveTextContent(/waiting/i);
    expect(posted).toEqual([{ styleId: 'pfp-cinematic', ratio: 'Square', brief: 'A wolf gamer with a neon headset', templateId: null, text: '', reference: null }]);
  });

  it('says so plainly when the agent is not available, and when the bridge is offline', async () => {
    stubBridge('off');
    const { user, unmount } = setup();
    await openProduction(user);
    expect(await screen.findByText(/claude code was not found/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot start until the agent is available/i)).toBeInTheDocument();
    unmount();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const second = setup();
    await openProduction(second.user);
    expect(await screen.findByText(/production bridge is offline/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send to production/i })).toBeDisabled();
  });
});
