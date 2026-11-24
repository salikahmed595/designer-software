/**
 * Data-driven artwork registry. Categories are for discovery only; the canonical
 * template id is what a production pipeline (Photoshop / Illustrator) would route on.
 * Artwork for streamers and gamers only. The five available categories are 2D still artwork;
 * 3D is listed but not available until a 3D production pipeline is connected.
 */
export type CategoryId = 'streaming' | 'discord' | 'characters' | 'emotes' | 'branding' | 'handmade' | '3d';
export type MadeIn = 'Illustrator' | 'Photoshop' | 'Illustrator + Photoshop';

export interface Category {
  id: CategoryId;
  name: string;
  subtitle: string;
  keywords: string[];
  /** thumbnail drawn on the category card */
  coverId: string;
  colors: [string, string];
  available: boolean;
  unavailableNote?: string;
}

export interface ArtworkTemplate {
  id: string;
  categoryId: CategoryId;
  title: string;
  subtitle: string;
  aliases: string[];
  popular: boolean;
  /** usual production route for this artwork (a studio default, not a guarantee) */
  madeIn: MadeIn;
  /** label of the optional name/text field */
  nameLabel: string;
  promptHint: string;
  /** honest capability note for specialist terms */
  note?: string;
  /** bundle = checklist of deliverables, not a deeper menu */
  bundle?: string[];
}

export const CATEGORIES: Category[] = [
  { id: 'streaming', name: 'Streaming', subtitle: 'Overlays, screens & alerts', keywords: ['twitch', 'kick', 'obs', 'livestream', 'live'], coverId: 'stream-overlay', colors: ['#a67aff', '#5fe3ff'], available: true },
  { id: 'discord', name: 'Discord', subtitle: 'Servers, profiles & community art', keywords: ['server', 'community', 'guild'], coverId: 'server-banner', colors: ['#6f8cff', '#9bdfff'], available: true },
  { id: 'characters', name: 'Characters & VTubers', subtitle: 'Avatars, models & mascots', keywords: ['character', 'oc', 'persona'], coverId: 'gaming-avatar', colors: ['#f08ad6', '#ffc9a8'], available: true },
  { id: 'emotes', name: 'Emotes & Badges', subtitle: 'Reactions, stickers & rewards', keywords: ['chat', 'reaction'], coverId: 'static-emotes', colors: ['#ffa25c', '#ffe07a'], available: true },
  { id: 'branding', name: 'Gaming Branding', subtitle: 'Logos, banners & esports art', keywords: ['brand', 'identity', 'youtube'], coverId: 'gaming-logo', colors: ['#a5ee5a', '#e8ff9a'], available: true },
  { id: 'handmade', name: 'Hand-made', subtitle: 'The client’s own design, redrawn by a person — no AI', keywords: ['handmade', 'hand', 'drawn', 'manual', 'human', 'redraw', 'recreate', 'copy', 'same', 'no', 'ai', 'without'], coverId: 'handmade-emblem', colors: ['#e8c27a', '#7ad0b0'], available: true },
  { id: '3d', name: '3D Artwork', subtitle: 'Models, renders & 3D characters', keywords: [], coverId: '3d-cover', colors: ['#21cae6', '#ab71ff'], available: false, unavailableNote: 'Coming soon — 3D production is not connected yet' },
];

type Extra = Partial<Pick<ArtworkTemplate, 'nameLabel' | 'note' | 'bundle'>>;
type Row = [id: string, title: string, subtitle: string, aliases: string, popular: boolean, madeIn: MadeIn, hint: string, extra?: Extra];

const HANDMADE_NOTE = 'A job sheet for a designer, who redraws the client’s original by hand. No AI draws any part of it.';

const AI: MadeIn = 'Illustrator';
const PS: MadeIn = 'Photoshop';
const BOTH: MadeIn = 'Illustrator + Photoshop';

const rows = (categoryId: CategoryId, list: Row[]): ArtworkTemplate[] =>
  list.map(([id, title, subtitle, aliases, popular, madeIn, promptHint, extra]) => ({
    id, categoryId, title, subtitle, popular, madeIn, promptHint,
    aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
    nameLabel: 'Name or text',
    ...extra,
  }));

export const TEMPLATES: ArtworkTemplate[] = [
  ...rows('streaming', [
    ['stream-overlay', 'Stream Overlay', 'Frames your gameplay and webcam', 'twitch overlay, gameplay overlay, obs overlay, hud', true, BOTH, 'Leave space for gameplay, a webcam box bottom-left and a chat column', { nameLabel: 'Channel name' }],
    ['starting-soon', 'Starting Soon', 'Welcome viewers before you go live', 'intro screen, waiting screen, countdown screen', true, PS, 'A calm scene with big “Starting soon” text', { nameLabel: 'Channel name' }],
    ['webcam-frame', 'Webcam Frame', 'A border for your facecam', 'webcam border, facecam, camera frame, cam overlay', true, AI, 'A rounded frame with a name tag under the camera', { nameLabel: 'Name on the tag' }],
    ['brb-screen', 'BRB Screen', 'For short stream breaks', 'be right back, break screen, pause screen', true, PS, 'A cosy “Be right back” scene'],
    ['stream-alert', 'Stream Alerts', 'Follower, sub and gift pop-ups', 'alert box, follower alert, sub alert, donation alert', false, BOTH, 'A matching set: follower, subscriber, gift', { note: 'Delivered as still alert graphics. Motion is not included.' }],
    ['stream-panels', 'Info Panels', 'About, rules and links panels', 'twitch panels, about panel, profile panels', false, AI, 'Panels for About, Rules, Schedule and Socials'],
    ['offline-screen', 'Offline Screen', 'Shown when you are not live', 'offline banner, ending screen, stream ending', false, PS, 'A night scene with schedule space', { nameLabel: 'Channel name' }],
    ['full-stream-kit', 'Full Stream Kit', 'All the essential stream art', 'stream package, branding kit, stream pack, bundle', false, BOTH, 'One consistent look across every screen', { nameLabel: 'Channel name', bundle: ['Stream overlay', 'Webcam frame', 'Starting soon screen', 'BRB screen', 'Offline screen', 'Alert graphics', 'Info panels'] }],
  ]),
  ...rows('discord', [
    ['server-icon', 'Server Icon', 'A recognizable server avatar', 'guild icon, server logo, server avatar', true, AI, 'Bold and readable at very small sizes', { nameLabel: 'Server name or initials' }],
    ['server-banner', 'Server Banner', 'The header of your community', 'guild banner, header, cover', true, PS, 'A wide scene with the server name', { nameLabel: 'Server name' }],
    ['profile-art', 'Profile Picture', 'A unique personal avatar', 'pfp, avatar, profile art, icon', true, BOTH, 'A head-and-shoulders portrait that reads in a circle'],
    ['welcome-banner', 'Welcome Banner', 'Greets every new member', 'join banner, greeting, welcome image', true, PS, 'Space for a member avatar and a welcome line', { nameLabel: 'Server name' }],
    ['invite-splash', 'Invite Splash', 'Background of your invite page', 'invite background, splash screen', false, PS, 'A full-screen scene behind the invite card'],
    ['role-icons', 'Role Icons', 'Admin, VIP and rank symbols', 'role badge, rank icon, mod icon', false, AI, 'A small matching set: admin, mod, VIP, booster'],
    ['event-poster', 'Event Poster', 'Promote a server event', 'announcement, flyer, game night', false, PS, 'Event title, date and time up front', { nameLabel: 'Event title' }],
    ['bot-avatar', 'Bot Avatar', 'Give your bot a face', 'bot icon, robot avatar', false, AI, 'A friendly robot that matches the server'],
  ]),
  ...rows('characters', [
    ['gaming-avatar', 'Gaming Avatar', 'Your illustrated gamer portrait', 'pfp, profile picture, gamer portrait, headshot', true, BOTH, 'A confident portrait with a headset', { nameLabel: 'Gamertag' }],
    ['mascot', 'Mascot Character', 'A memorable original creature', 'dragon, creature, animal, team mascot, wolf', true, BOTH, 'An expressive creature with a clear silhouette', { nameLabel: 'Mascot name' }],
    ['chibi-character', 'Chibi Character', 'A cute miniature version', 'chibi, cute, sd character', true, PS, 'Big head, small body, simple pose'],
    ['pngtuber', 'PNGTuber Avatar', 'Idle and talking poses', 'reactive, talking avatar, png tuber', true, BOTH, 'Two matching poses: mouth closed and mouth open', { note: 'Delivers still poses (idle and talking). This is not a rigged, moving model.' }],
    ['vtuber-art', 'VTuber Model Art', 'Illustration split into layers', 'live2d, vtuber, rig ready, model art', false, PS, 'Front-facing character, arms slightly away from the body', { note: 'Delivers layered artwork prepared for rigging. A working Live2D rig is not included.' }],
    ['anime-portrait', 'Anime Portrait', 'A stylized character portrait', 'anime, manga, bust', false, PS, 'Soft lighting, expressive eyes'],
    ['expression-sheet', 'Expression Sheet', 'One character, many feelings', 'emotions, faces, expressions', false, PS, 'Six expressions: happy, sad, angry, shocked, love, smug'],
    ['character-sheet', 'Reference Sheet', 'Front, side and back views', 'character sheet, turnaround, model sheet', false, BOTH, 'Three views plus colour swatches'],
  ]),
  ...rows('emotes', [
    ['static-emotes', 'Static Emotes', 'Simple custom chat reactions', 'twitch emote, emote, reaction', true, BOTH, 'Readable at 28 px: thick outline, one clear emotion'],
    ['chibi-emotes', 'Chibi Emotes', 'A cute expression pack', 'cute emote, chibi emote', true, BOTH, 'The same chibi face across every emotion'],
    ['discord-emojis', 'Server Emojis', 'Custom emoji for your server', 'discord emoji, emoji, custom emoji', true, BOTH, 'A small set that matches the server theme'],
    ['sub-badges', 'Subscriber Badges', 'Reward loyal viewers by tier', 'sub badge, loyalty badge, twitch badge', true, AI, 'One shape that levels up over 1, 3, 6, 12 and 24 months'],
    ['sticker-pack', 'Sticker Pack', 'Larger illustrated reactions', 'sticker, discord sticker', false, BOTH, 'White sticker border, big gestures'],
    ['rank-badges', 'Rank Badges', 'Level and tier indicators', 'tier badge, level badge, rank icon', false, AI, 'Bronze, silver and gold versions of one emblem'],
    ['point-icons', 'Channel Point Icons', 'Art for stream rewards', 'reward icon, channel points, coin', false, AI, 'A gem or coin that suits the channel'],
    ['text-emotes', 'Text Emotes', 'GG, HYPE and other word emotes', 'word emote, gg, hype, lol', false, AI, 'Chunky lettering that stays readable when tiny', { nameLabel: 'Words to draw' }],
  ]),
  ...rows('branding', [
    ['gaming-logo', 'Gaming Logo', 'Build a gaming identity', 'logo, emblem, gamer logo', true, AI, 'A bold emblem that works in one colour', { nameLabel: 'Brand or gamertag' }],
    ['esports-logo', 'Esports Logo', 'Team mark with a mascot', 'team logo, esport, clan logo', true, AI, 'An aggressive mascot head inside a shield', { nameLabel: 'Team name' }],
    ['youtube-thumbnail', 'Video Thumbnail', 'Stand out in the feed', 'youtube thumbnail, thumbnail, cover image', true, PS, 'Huge 2–3 word title and one clear subject', { nameLabel: 'Title text' }],
    ['youtube-banner', 'Channel Banner', 'Your channel cover art', 'youtube banner, channel art, header', true, PS, 'Keep the name inside the centre safe area', { nameLabel: 'Channel name' }],
    ['team-banner', 'Team Banner', 'Introduce your roster', 'roster, lineup, squad banner', false, PS, 'Three to five players with name plates', { nameLabel: 'Team name' }],
    ['tournament-poster', 'Tournament Poster', 'Announce a competition', 'tournament, cup, bracket, event flyer', false, PS, 'Trophy, title, date and prize up front', { nameLabel: 'Tournament title' }],
    ['gaming-wallpaper', 'Gaming Wallpaper', 'Custom desktop background', 'wallpaper, desktop, background', false, PS, 'A wide scene with a calm centre for icons'],
    ['merch-art', 'Merch Artwork', 'Graphics for jerseys and tees', 'jersey, t-shirt, apparel, hoodie', false, AI, 'A front print with few colours', { nameLabel: 'Text on the print' }],
  ]),
  // Hand-made: the client wants their existing design recreated with no AI. The app prepares a job sheet; a designer draws it.
  ...rows('handmade', [
    ['handmade-logo', 'Hand-made Logo', 'Same logo, redrawn by hand', 'hand made logo, handmade logo, redraw logo, recreate logo, no ai logo, manual logo', true, AI, 'Anything the client said about the original', { note: HANDMADE_NOTE }],
    ['handmade-emblem', 'Hand-made Emblem', 'Crests, badges and team marks', 'hand made emblem, crest, badge, shield, team mark, no ai emblem', true, BOTH, 'Anything the client said about the original', { note: HANDMADE_NOTE }],
    ['handmade-illustration', 'Hand-made Illustration', 'Same illustration, redrawn by hand', 'hand made illustration, redraw art, recreate artwork, no ai art, human made', false, PS, 'Anything the client said about the original', { note: HANDMADE_NOTE }],
    ['handmade-character', 'Hand-made Character', 'Same character, redrawn by hand', 'hand made character, redraw character, mascot redraw, no ai character', false, PS, 'Anything the client said about the original', { note: HANDMADE_NOTE }],
  ]),
];

/** Hand-made artwork: the client's design, recreated by a person. No AI draws it. */
export const isHandmade = (templateId: string | null | undefined): boolean => getTemplate(templateId)?.categoryId === 'handmade';

export const HOME_POPULAR = ['stream-overlay', 'gaming-logo', 'gaming-avatar', 'static-emotes', 'server-banner', 'webcam-frame', 'sub-badges', 'profile-art'];

const byId = new Map(TEMPLATES.map((t) => [t.id, t]));
const order = new Map(TEMPLATES.map((t, i) => [t.id, i]));

export const getTemplate = (id: string | null | undefined): ArtworkTemplate | undefined => (id ? byId.get(id) : undefined);
export const getCategory = (id: CategoryId): Category => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
export const templatesIn = (categoryId: CategoryId): ArtworkTemplate[] =>
  TEMPLATES.filter((t) => t.categoryId === categoryId).sort((a, b) => Number(b.popular) - Number(a.popular) || order.get(a.id)! - order.get(b.id)!);

/* ---------- search ---------- */

const STOP = new Set(['a', 'an', 'the', 'my', 'me', 'i', 'for', 'with', 'and', 'of', 'in', 'to', 'on', 'be', 'is', 'it', 'make', 'need', 'want', 'something', 'some', 'art', 'artwork', 'design', 'please', 'create', 'new', 'that', 'like']);
/** Synonym expansions: when the pattern appears, these words are searched as well. */
const EXPANSIONS: [RegExp, string][] = [
  [/\bpfp\b/, 'profile picture'],
  [/\bprofile pic\b/, 'profile picture'],
  [/\bbrb\b/, 'be right back'],
  [/\breactive\b/, 'pngtuber'],
  [/\btalk(s|ing)?\b/, 'pngtuber'],
  [/\bface ?cam\b/, 'webcam'],
  [/\bemojis?\b/, 'emote'],
  [/\bstinger\b/, 'stream transition'],
];

const norm = (w: string) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(norm);

function queryTokens(query: string): string[] {
  let q = query.toLowerCase();
  for (const [pattern, extra] of EXPANSIONS) if (pattern.test(q)) q += ` ${extra}`;
  return [...new Set(words(q).filter((w) => w.length >= 2 && !STOP.has(w)))];
}

const INDEX = new Map(
  TEMPLATES.map((t) => {
    const cat = getCategory(t.categoryId);
    return [t.id, { title: words(t.title), alias: words(t.aliases.join(' ')), catName: words(cat.name), other: words(`${t.subtitle} ${cat.keywords.join(' ')}`) }];
  }),
);

const hit = (list: string[], token: string) => list.some((w) => w.startsWith(token));

interface Ranked { template: ArtworkTemplate; score: number; hits: Set<string> }

function rank(query: string, categoryId?: CategoryId): Ranked[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  const out: Ranked[] = [];
  for (const template of TEMPLATES) {
    if (categoryId && template.categoryId !== categoryId) continue;
    const idx = INDEX.get(template.id)!;
    const hits = new Set<string>();
    let score = 0;
    for (const token of tokens) {
      const s = hit(idx.title, token) ? 3 : hit(idx.alias, token) || hit(idx.catName, token) ? 2 : hit(idx.other, token) ? 1 : 0;
      if (s > 0) hits.add(token);
      score += s;
    }
    if (score > 0) out.push({ template, score, hits });
  }
  return out.sort((a, b) => b.score - a.score || Number(b.template.popular) - Number(a.template.popular) || order.get(a.template.id)! - order.get(b.template.id)!);
}

export const MAX_RESULTS = 8;
export function searchTemplates(query: string, categoryId?: CategoryId): ArtworkTemplate[] {
  return rank(query, categoryId).slice(0, MAX_RESULTS).map((r) => r.template);
}

