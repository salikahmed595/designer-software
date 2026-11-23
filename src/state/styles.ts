export const STYLE_CATEGORIES = ['All', '3D', 'Icon', 'Illustration', 'Line Art', 'Photography', 'Vector', 'Composition'] as const;
export type StyleCategory = (typeof STYLE_CATEGORIES)[number];

/** Glyph drawn on top of the card gradient (pure CSS/SVG placeholder art, no photos). */
export type StyleGlyph =
  | 'none' | 'cube' | 'check' | 'pen' | 'squiggle' | 'camera' | 'vector' | 'comic' | 'lamp' | 'pixel'
  | 'figure' | 'film' | 'city' | 'prism' | 'cloud' | 'sun' | 'flower' | 'temple' | 'blueprint'
  | 'people' | 'village' | 'bear' | 'brush' | 'ghost' | 'mountain' | 'neon' | 'leaf' | 'star' | 'grid' | 'drop';

export interface VisualStyle {
  id: string;
  name: string;
  categories: Exclude<StyleCategory, 'All'>[];
  /** CSS background for the card */
  gradient: string;
  glyph: StyleGlyph;
  /** true when card art is light, so the glyph is drawn dark */
  light?: boolean;
}

const g = (a: string, b: string, c?: string, angle = 135) =>
  `linear-gradient(${angle}deg, ${a}, ${b}${c ? `, ${c}` : ''})`;

export const STYLES: VisualStyle[] = [
  { id: 'auto', name: 'Auto', categories: [], gradient: 'linear-gradient(160deg,#1f1f1f,#141414)', glyph: 'none' },
  { id: 'default-3d', name: 'Default 3D', categories: ['3D'], gradient: g('#ff5f6d', '#c2185b', '#2a2a2a', 160), glyph: 'cube' },
  { id: 'default-icon', name: 'Default Icon', categories: ['Icon'], gradient: g('#7b2ff7', '#c471f5', '#f15bb5'), glyph: 'check' },
  { id: 'default-illustration', name: 'Default Illustration', categories: ['Illustration'], gradient: g('#1fb6c9', '#0f6f8a', '#2d1b4e', 160), glyph: 'pen' },
  { id: 'default-line-art', name: 'Default Line Art', categories: ['Line Art'], gradient: g('#ff3d5a', '#b3123c', '#3a1020', 160), glyph: 'squiggle' },
  { id: 'default-photography', name: 'Default Photography', categories: ['Photography'], gradient: g('#ffb000', '#6d3cff', '#1d4bff', 200), glyph: 'camera' },
  { id: 'default-vector', name: 'Default Vector', categories: ['Vector'], gradient: g('#c6f432', '#3f8f2a', '#103d1a', 160), glyph: 'vector' },
  { id: '1980s-comic', name: '1980s Comic', categories: ['Illustration', 'Composition'], gradient: g('#f4e3c1', '#e86a33', '#2b6cb0'), glyph: 'comic', light: true },
  { id: '35mm-time-capsule', name: '35mm Time Capsule', categories: ['Photography'], gradient: g('#3b3524', '#1c1a14', '#0b0b0b', 180), glyph: 'lamp' },
  { id: '8-bit-nostalgia', name: '8-bit Nostalgia', categories: ['Illustration', 'Icon'], gradient: g('#0c1a12', '#14351f', '#06140b', 180), glyph: 'pixel' },
  { id: '90s-studio', name: "90's Studio", categories: ['Photography'], gradient: g('#f2785c', '#e0563f', '#c8402f', 180), glyph: 'figure' },
  { id: 'a24-cinematic', name: 'A24 Cinematic', categories: ['Photography', 'Composition'], gradient: g('#2b2b2b', '#4a4a48', '#171717', 160), glyph: 'film' },
  { id: 'adult-colouring-book', name: 'Adult Colouring Book', categories: ['Line Art'], gradient: g('#ffffff', '#f2f2f2', '#e6e6e6', 180), glyph: 'city', light: true },
  { id: 'analog-diffraction', name: 'Analog Diffraction', categories: ['Photography'], gradient: g('#0a0a0a', '#2a2140', '#0a0a0a', 160), glyph: 'prism' },
  { id: 'app-icon', name: 'App Icon', categories: ['Icon', '3D'], gradient: g('#c7d3df', '#9fb1c3', '#7f93a8', 180), glyph: 'cloud', light: true },
  { id: 'artist-illustration', name: 'Artist Illustration', categories: ['Illustration'], gradient: g('#ffe9b8', '#7ccbd6', '#ff9f43', 160), glyph: 'sun', light: true },
  { id: 'bw-raw', name: 'B&W Raw', categories: ['Photography'], gradient: g('#e8e8e8', '#9a9a9a', '#1a1a1a', 160), glyph: 'flower', light: true },
  { id: 'bathed-in-drama', name: 'Bathed in Drama', categories: ['Composition', 'Illustration'], gradient: g('#f6e7da', '#d13b1e', '#2a0b05', 180), glyph: 'temple', light: true },
  { id: 'blueprint', name: 'Blueprint', categories: ['Line Art', 'Composition'], gradient: g('#123a7a', '#0d2b5c', '#081a3a', 180), glyph: 'blueprint' },
  { id: 'corporate-flat', name: 'Corporate Flat', categories: ['Vector', 'Illustration'], gradient: g('#1e7d4f', '#f4b400', '#e85d75'), glyph: 'people' },
  { id: 'riviera-watercolour', name: 'Riviera Watercolour', categories: ['Illustration'], gradient: g('#bfe3f2', '#f4d6a6', '#8fbf7a', 180), glyph: 'village', light: true },
  { id: 'cosy-3d-toy', name: 'Cosy 3D Toy', categories: ['3D'], gradient: g('#9ed7ff', '#ffd59e', '#ff9e6b', 180), glyph: 'bear', light: true },
  { id: 'pop-gesture', name: 'Pop Gesture', categories: ['Vector', 'Illustration'], gradient: g('#ff4fa3', '#29b6f6', '#ffd23f'), glyph: 'brush' },
  { id: 'clay-character', name: 'Clay Character', categories: ['3D'], gradient: g('#111111', '#1b1b1b', '#111111', 180), glyph: 'ghost' },
  { id: 'low-poly-peaks', name: 'Low Poly Peaks', categories: ['3D', 'Vector'], gradient: g('#2c5364', '#203a43', '#0f2027', 180), glyph: 'mountain' },
  { id: 'neon-noir', name: 'Neon Noir', categories: ['Photography', 'Composition'], gradient: g('#0f0c29', '#302b63', '#ff2e97', 160), glyph: 'neon' },
  { id: 'botanical-ink', name: 'Botanical Ink', categories: ['Line Art', 'Illustration'], gradient: g('#f5f0e1', '#d9cfb4', '#a89f80', 180), glyph: 'leaf', light: true },
  { id: 'sticker-badge', name: 'Sticker Badge', categories: ['Icon', 'Vector'], gradient: g('#ffcc00', '#ff6a00', '#d7263d'), glyph: 'star' },
  { id: 'swiss-grid', name: 'Swiss Grid', categories: ['Composition', 'Vector'], gradient: g('#f2f2f2', '#e63946', '#1d3557', 145), glyph: 'grid', light: true },
  { id: 'liquid-chrome', name: 'Liquid Chrome', categories: ['3D'], gradient: g('#d7d7d7', '#7a7a7a', '#2b2b2b', 160), glyph: 'drop', light: true },
];

const byId = new Map(STYLES.map((s) => [s.id, s]));

export function getStyle(id: string): VisualStyle {
  return byId.get(id) ?? (byId.get('auto') as VisualStyle);
}

export function isStyleId(id: string): boolean {
  return byId.has(id);
}

export function filterStyles(styles: readonly VisualStyle[], query: string, category: StyleCategory): VisualStyle[] {
  const q = query.trim().toLowerCase();
  return styles.filter(
    (s) =>
      (category === 'All' || s.categories.includes(category)) &&
      (q === '' || s.name.toLowerCase().includes(q) || s.categories.some((c) => c.toLowerCase().includes(q))),
  );
}
