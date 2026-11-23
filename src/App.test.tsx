import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { CATEGORIES, HOME_POPULAR, TEMPLATES } from './state/catalog';
import { ART_STYLES } from './state/production';
import { hasArt, indexThumbnails } from './glass/Thumb';

type Runner = 'claude' | 'off';

/** Fake production bridge so no test ever starts a real agent. */
function stubBridge(runner: Runner | 'offline' = 'claude') {
  const posted: unknown[] = [];
  const jobs: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (runner === 'offline') throw new Error('offline');
    const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;
    if (url.endsWith('/health')) return json({ online: true, runner, detail: runner === 'claude' ? 'Connected: a Claude Code agent will draw.' : 'Claude Code was not found on this computer.' });
    if (url.endsWith('/jobs') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      posted.push(body);
      jobs.unshift({ id: 'abc123abc123', createdAt: 1, status: 'queued', styleName: 'Cinematic PFP', skill: '2d-pfp', ratio: body.ratio, templateTitle: 'Gaming Avatar', briefExcerpt: body.brief, runner, message: null, hasPreview: false });
      return json({ job: jobs[0] }, 201);
    }
    return json({ jobs });
  }));
  return { posted };
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

const setup = (runner: Runner | 'offline' = 'claude') => {
  const bridge = stubBridge(runner);
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
      '/thumbnails/not-a-real-artwork.webp': '/assets/c.webp',
    });
    expect(photos.get('stream-overlay')).toBe('/assets/a.jpg');
    expect(photos.get('style-manga')).toBe('/assets/b.png');
    expect(photos.has('readme')).toBe(false);
    expect(photos.has('not-a-real-artwork')).toBe(false);
  });
});

describe('only what a designer needs', () => {
  it('the header has two destinations and the old tools are gone', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['New artwork', 'Jobs']);
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
    expect(tabs.map((t) => t.textContent)).toEqual(['Popular', 'Streaming', 'Discord', 'Characters & VTubers', 'Emotes & Badges', 'Gaming Branding', '3D ArtworkComing soon']);
    expect(tabs[6]).toBeDisabled();

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

  it('explains what is missing instead of sending an incomplete job', async () => {
    const { user, posted } = setup();
    await openBrief(user);
    await user.click(screen.getByRole('button', { name: /send to production/i }));
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual(expect.arrayContaining(['Choose an art style.', 'Write the client brief.']));
    expect(posted).toHaveLength(0);
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
    await user.click(screen.getByRole('button', { name: /send to production/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Jobs' })).toBeInTheDocument();
    expect(posted).toEqual([{ styleId: 'pfp-cinematic', ratio: 'Square', brief: 'A wolf gamer with a neon headset', templateId: 'gaming-avatar', text: 'NightWolf', reference: null }]);
    const job = within(screen.getByRole('list', { name: 'Jobs' })).getByRole('listitem');
    expect(job).toHaveTextContent(/gaming avatar/i);
    expect(job).toHaveTextContent(/waiting/i);
    expect(within(screen.getByRole('navigation', { name: 'Primary' })).getByLabelText('1 in progress')).toBeInTheDocument();

    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'New artwork' }));
    expect(screen.queryByText(/unfinished brief/i)).not.toBeInTheDocument();
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
