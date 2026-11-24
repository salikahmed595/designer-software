/**
 * The art styles on the Brief screen. Which skill draws each one is NOT here: that is chosen on the
 * Skills screen and saved in production/skills.json. A new style also needs a thumbnail named
 * style-<id> in thumbnails/ (a test fails if it is missing).
 */
export interface ArtStyle {
  id: string;
  name: string;
  category: string;
  colors: [string, string];
  description: string;
}

export const ART_STYLES: ArtStyle[] = [
  { id: 'anime-cel', name: 'Anime', category: 'Character', colors: ['#f08ad6', '#ffc9a8'], description: 'Clean lines with flat cel shading' },
  { id: 'manga', name: 'Manga', category: 'Illustration', colors: ['#f2f2f2', '#9aa0a6'], description: 'Black-and-white inks with screentone' },
  { id: 'pastel-anime', name: 'Semi-Realistic Pastel Anime', category: 'Character', colors: ['#b9a7f5', '#ffdfe8'], description: 'Soft pastel colours, gentle realistic shading' },
  { id: 'semi-real', name: 'Semi-Realistic', category: 'Illustration', colors: ['#c98a6a', '#ffd9b8'], description: 'Realistic light and form, stylized features' },
  { id: 'chibi', name: 'Chibi / Super Deformed', category: 'Character', colors: ['#ff9ec4', '#ffe0c2'], description: 'Big head, small body, cute and simple' },
  { id: 'cartoon', name: 'Cartoon', category: 'Vector', colors: ['#ffb23e', '#ffe28a'], description: 'Bold outlines and playful shapes' },
  { id: 'flat-vector', name: 'Vector Artwork', category: 'Vector', colors: ['#9cfb59', '#4fd0ff'], description: 'Clean flat shapes, few colours' },
  { id: 'pixel-art', name: 'Pixel Art', category: 'Illustration', colors: ['#5ad1a0', '#ffd9a8'], description: 'Retro game sprites on a pixel grid' },
  { id: 'digital-painting', name: 'Digital Painting / Concept Art', category: 'Illustration', colors: ['#5b8def', '#ffb37a'], description: 'Painterly scenes with mood and depth' },
  { id: 'viking', name: 'Medieval Viking Art', category: 'Illustration', colors: ['#c9a24b', '#8c2f2f'], description: 'Norse shields, knotwork and runes' },
  { id: 'vtuber-model', name: 'VTuber Model', category: 'Character', colors: ['#c58aff', '#ffd0e4'], description: 'Front-facing character split into layers' },
  { id: 'pfp-cinematic', name: 'Cinematic PFP', category: 'Character', colors: ['#7c8cff', '#ffd9b8'], description: 'Hero portrait with rim light and glow' },
  { id: 'esports-mascot', name: 'Esports Mascot', category: 'Vector', colors: ['#ff6a4d', '#ffd45a'], description: 'Aggressive mascot with thick outlines' },
  { id: 'sticker', name: 'Sticker', category: 'Vector', colors: ['#ffa25c', '#ffe07a'], description: 'White border, big expression' },
  { id: 'comic-ink', name: 'Comic Ink', category: 'Illustration', colors: ['#ffcf40', '#ff5a5a'], description: 'Heavy inks and halftone dots' },
  { id: 'line-art', name: 'Clean Line Art', category: 'Line Art', colors: ['#e8eef0', '#9fb4c0'], description: 'Outlines only, ready to colour' },
];
