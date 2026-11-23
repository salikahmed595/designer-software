// Art-style thumbnails. Most show the same character so the styles can be compared side by side.
import { character, chibi, emote, fullBg, g, lg, rg, rr, shield, sparkle, stars, t, wolf, wrap } from './lib.mjs';

const speedLines = (cx, cy, n, r1, r2, stroke, w = 3) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + (i % 2) * 0.05;
    d += `M${(cx + r1 * Math.cos(a)).toFixed(0)} ${(cy + r1 * Math.sin(a)).toFixed(0)}L${(cx + r2 * Math.cos(a)).toFixed(0)} ${(cy + r2 * Math.sin(a)).toFixed(0)}`;
  }
  return `<path d="${d}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
};

const pixelSprite = () => {
  const rows = [
    '....hhhhhhhh....', '...hhhhhhhhhh...', '..hhHHhhhhHHhh..', '.khhhhhhhhhhhhk.', '.khhsssssssshhk.', 'kkhsssssssssshkk',
    'kahsweesseewshak', 'kahsweesseewshak', '.khsssssssssshk.', '.khspssssssspsk.', '..hsssmmmmsssh..', '..h.ssssssss.h..',
    '....ttssssstt...', '...tttttttttttt.', '..ttttTttttTtttt', '..tttttttttttttt',
  ];
  const pal = { h: '#ff7ac4', H: '#ffc2e6', k: '#1a1c30', a: '#5ff0ff', s: '#ffd9c2', w: '#ffffff', e: '#3b1a78', p: '#ff8fa8', m: '#b8324f', t: '#3a4090', T: '#eef0ff' };
  let out = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (pal[ch]) out += `<rect x="${208 + x * 24}" y="${96 + y * 24}" width="24.500" height="24.500" fill="${pal[ch]}"/>`;
  }));
  return out;
};

export const STYLES = {
  'style-manga': wrap(
    `${fullBg('#f4f4f4')}<rect width="800" height="550" fill="url(#dots)" opacity=".16"/>
${speedLines(400, 250, 46, 250, 620, '#111', 4)}
<rect x="14" y="14" width="772" height="522" fill="none" stroke="#111" stroke-width="10"/>
${character({ id: 'm', hair: '#1a1a1a', hairD: '#000', hairL: '#444', skin: '#ffffff', skinS: '#cfcfcf', neckS: '#bdbdbd', top: '#2b2b2b', topD: '#000', topL: '#5a5a5a', ol: '#000', ow: 6, iris: ['#000', '#555', '#cfcfcf'], accent: '#fff', hs: '#111', hsL: '#777', lip: '#333', blush: false, mouth: 'smile' })}
<g fill="#000" opacity=".5"><rect x="300" y="296" width="60" height="26" fill="url(#dots)"/><rect x="440" y="296" width="60" height="26" fill="url(#dots)"/></g>
<path d="M600 60h150l-20 70h-110l-30 34 8-34h-18z" fill="#fff" stroke="#000" stroke-width="6" stroke-linejoin="round"/>${t(672, 106, 'GG!', 34, { fill: '#000', a: 'middle', w: 900 })}`,
  ),

  'style-pastel-anime': wrap(
    `${fullBg('url(#pbg)')}<g filter="url(#b30)"><circle cx="150" cy="130" r="90" fill="#fff" opacity=".5"/><circle cx="660" cy="150" r="110" fill="#ffd9ec" opacity=".6"/><circle cx="640" cy="430" r="90" fill="#c9f2ff" opacity=".5"/><circle cx="130" cy="430" r="80" fill="#e6d9ff" opacity=".55"/></g>
${sparkle(130, 110, 22, '#fff', 0.9)}${sparkle(680, 300, 16, '#fff', 0.9)}${sparkle(640, 90, 12, '#fff', 0.8)}
${character({ id: 'p', hair: '#c9b8ff', hairD: '#a48fe8', hairL: '#8f78d6', skin: '#fff1ea', skinS: '#f7d2c8', neckS: '#f0c2b8', top: '#bfe3f2', topD: '#9ccbe0', topL: '#e3f4fb', ol: '#8a6aa8', ow: 3, iris: ['#6a5acd', '#9fb8ff', '#ffd9ec'], accent: '#ffc2e0', hs: '#f4eefc', hsL: '#ffffff', lip: '#e08aa0', blushC: '#ffb3c8', mouth: 'smile' })}
<g filter="url(#b14)" opacity=".5"><ellipse cx="340" cy="210" rx="60" ry="40" fill="#fff"/><ellipse cx="470" cy="330" rx="50" ry="60" fill="#d9b8e8"/></g>`,
    lg('pbg', ['#e9dcff', '#ffe3ee', '#d9f3ff'], 'd'),
  ),

  'style-chibi': wrap(
    `${fullBg('url(#cbg)')}<circle cx="400" cy="270" r="230" fill="#fff" opacity=".22"/>
${sparkle(140, 120, 24, '#fff')}${sparkle(660, 150, 18, '#fff')}${sparkle(620, 420, 14, '#fff', 0.8)}${sparkle(170, 400, 12, '#fff', 0.8)}
${chibi(400, 190, 1.05, { mood: 'happy', headset: true })}`,
    lg('cbg', ['#ff9ec4', '#ffc58f'], 'd'),
  ),

  'style-cartoon': wrap(
    `${fullBg('#ffcf40')}${speedLines(400, 290, 24, 0, 700, '#ffb300', 60)}
${character({ id: 'k', hair: '#ff6a3d', hairD: '#d9481f', hairL: '#b8380f', skin: '#ffd9b0', skinS: '#ffd9b0', neckS: '#f2b98a', top: '#2fb5ff', topD: '#1b8fd6', topL: '#7fd4ff', ol: '#1a1a1a', ow: 9, accent: '#9cfb59', hs: '#2a2a2a', hsL: '#666', eyes: 'dot', mouth: 'grin', shade: false, blush: true, blushC: '#ff7a59', brows: 'up' })}
${g('translate(650 110) rotate(12)', `<path d="M0-52l14 32 34 6-24 24 6 34-30-16-30 16 6-34-24-24 34-6z" fill="#fff" stroke="#1a1a1a" stroke-width="8" stroke-linejoin="round"/>`)}`,
  ),

  'style-flat-vector': wrap(
    `${fullBg('#17324d')}<circle cx="400" cy="270" r="240" fill="#1f4a6e"/><path d="M400 270l420 420H260z" fill="#12283d" opacity=".55"/>
<g fill="#9cfb59"><rect x="90" y="110" width="70" height="12" rx="6"/><rect x="640" y="400" width="90" height="12" rx="6"/></g><circle cx="660" cy="130" r="26" fill="#4fd0ff"/><circle cx="130" cy="420" r="18" fill="#ffcf40"/>
${character({ id: 'f', hair: '#ff6f61', hairD: '#d9534a', hairL: '#d9534a', skin: '#ffd2b3', skinS: '#f2b596', neckS: '#f2b596', top: '#9cfb59', topD: '#7fd443', topL: '#c6ff9a', ow: 0, accent: '#4fd0ff', hs: '#12283d', hsL: '#2f6a96', eyes: 'dot', ol: '#12283d', mouth: 'smile', blush: false, shine: false, strings: false })}`,
  ),

  'style-pixel-art': wrap(
    `${fullBg('url(#pxbg)')}
<g fill="#fff" opacity=".9"><rect x="70" y="90" width="72" height="24"/><rect x="94" y="66" width="48" height="24"/><rect x="620" y="130" width="96" height="24"/><rect x="644" y="106" width="48" height="24"/></g>
<g fill="#ffe66b"><rect x="640" y="250" width="12" height="12"/><rect x="110" y="250" width="12" height="12"/><rect x="700" y="330" width="12" height="12"/></g>
<rect y="480" width="800" height="70" fill="#3fa86a"/><g fill="#2f8452">${Array.from({ length: 17 }, (_, i) => `<rect x="${i * 48}" y="480" width="24" height="24"/>`).join('')}</g><rect y="528" width="800" height="22" fill="#7a4a2a"/>
${pixelSprite()}`,
    lg('pxbg', ['#3a6fd8', '#7fc4ff']),
  ),

  'style-digital-painting': wrap(
    `${fullBg('url(#dsky)')}<circle cx="560" cy="210" r="210" fill="url(#dsun)"/><circle cx="560" cy="210" r="60" fill="#fff4d6" filter="url(#b6)"/>
<g filter="url(#b14)" opacity=".7"><ellipse cx="220" cy="150" rx="200" ry="26" fill="#ffb9a0"/><ellipse cx="640" cy="110" rx="180" ry="20" fill="#ffd9b0"/><ellipse cx="380" cy="230" rx="240" ry="18" fill="#c98ab8"/></g>
<path d="M0 330l90-90 70 60 110-140 90 110 80-70 120 120 90-80 150 130v180H0z" fill="#6a5a9a" filter="url(#b2)"/>
<path d="M0 330l90-90 40 34-60 120zM270 160l40 50-50 130zM540 230l50 50-40 100z" fill="#9a86c4" opacity=".6" filter="url(#b2)"/>
<rect y="300" width="800" height="120" fill="#ffd9b0" opacity=".22" filter="url(#b30)"/>
<path d="M0 400l140-70 110 50 130-80 150 70 110-50 160 70v160H0z" fill="#3a3066" filter="url(#b2)"/>
<path d="M0 470l170-50 130 30 160-56 340 80v76H0z" fill="#191430"/>
<g fill="#0e0b1e"><path d="M250 420l8-60 6-26 6 26 8 60z"/><path d="M256 366c-18 14-26 34-26 58 12-12 20-28 26-46z"/><circle cx="264" cy="326" r="10"/><path d="M272 352l44-30 3 5-42 36z"/></g>
<path d="M316 322l22-15" stroke="#fff3cf" stroke-width="4" stroke-linecap="round" filter="url(#glow)"/>
<g stroke="#fff" stroke-linecap="round" opacity=".28" filter="url(#b2)"><path d="M60 60c50-14 110-14 170 0M420 60c60-12 120-12 190 2M90 250c40-10 90-10 130 2" stroke-width="7" fill="none"/></g>
<g fill="#1b1436"><path d="M640 470l16-70 16 70zM690 480l12-52 12 52zM90 480l14-60 14 60z"/></g>`,
    lg('dsky', ['#1c1a4a', '#5a3a8a', '#e07a8a', '#ffc58f']) + rg('dsun', '#fff0c2', '#ff9a6a', 0),
  ),

  'style-viking': wrap(
    `${fullBg('url(#parch)')}<rect x="20" y="20" width="760" height="510" fill="none" stroke="#5a3a1a" stroke-width="6"/><rect x="34" y="34" width="732" height="482" fill="none" stroke="#5a3a1a" stroke-width="2"/>
${Array.from({ length: 12 }, (_, i) => `<path d="M${70 + i * 58} 52q14-14 28 0t28 0" fill="none" stroke="#7a2a1a" stroke-width="5" stroke-linecap="round"/><path d="M${70 + i * 58} 498q14 14 28 0t28 0" fill="none" stroke="#7a2a1a" stroke-width="5" stroke-linecap="round"/>`).join('')}
<path d="M180 120l440 320M620 120L180 440" stroke="#4a2f16" stroke-width="16" stroke-linecap="round"/>
<path d="M150 96c40-10 70 6 80 40l-46 30c-24-16-36-40-34-70zM650 96c-40-10-70 6-80 40l46 30c24-16 36-40 34-70z" fill="url(#silver)" stroke="#2a1a0c" stroke-width="5" stroke-linejoin="round"/>
<circle cx="400" cy="278" r="170" fill="#8c2f2f" stroke="#2a1a0c" stroke-width="8"/>
<path d="M400 108a170 170 0 0 1 170 170H400zM400 448a170 170 0 0 1-170-170h170z" fill="#d9b45a"/>
<circle cx="400" cy="278" r="170" fill="none" stroke="url(#gold)" stroke-width="16"/><circle cx="400" cy="278" r="150" fill="none" stroke="#2a1a0c" stroke-width="3"/>
<path d="M400 128v300M250 278h300" stroke="#2a1a0c" stroke-width="5"/>
${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((d) => `<circle cx="${(400 + 170 * Math.cos((d * Math.PI) / 180)).toFixed(0)}" cy="${(278 + 170 * Math.sin((d * Math.PI) / 180)).toFixed(0)}" r="6" fill="#2a1a0c"/>`).join('')}
<g fill="none" stroke="#2a1a0c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M300 190c30-20 50 20 20 30s-10 50 20 30M500 366c-30 20-50-20-20-30s10-50-20-30"/><path d="M470 180l30 20-30 20M470 180v60M330 320v60l26-30-26-30"/></g>
<circle cx="400" cy="278" r="42" fill="url(#silver)" stroke="#2a1a0c" stroke-width="6"/><circle cx="400" cy="278" r="14" fill="#2a1a0c"/>
${t(400, 508, 'ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ', 20, { fill: '#5a3a1a', a: 'middle', ls: 6, w: 700, o: 0 })}`,
    lg('parch', ['#e9d6a8', '#d2b67a', '#b8975a'], 'd'),
  ),

  'style-vtuber-model': wrap(
    `${fullBg('url(#vbg)')}<g stroke="#fff" stroke-opacity=".06" stroke-width="1">${Array.from({ length: 20 }, (_, i) => `<path d="M${i * 40} 0v550M0 ${i * 40}h800"/>`).join('')}</g>
${g('translate(-110 0)', character({ id: 'v', hair: '#b58aff', hairD: '#8a5fe0', hairL: '#6f48c4', top: '#f4f0ff', topD: '#d9d0f4', topL: '#ffffff', ol: '#3a2a5a', ow: 4, iris: ['#1b3a78', '#3f9ad6', '#9af0ff'], accent: '#ff8ad0', headset: false, hairStyle: 'bun', mouth: 'smile', strings: false }))}
<g fill="none" stroke="#5ff0ff" stroke-width="1.5" opacity=".75"><path d="M198 232l92-118 92 118-92 136zM198 232h184M290 114v254M244 173l92 118M336 173l-92 118"/><g fill="#5ff0ff"><circle cx="198" cy="232" r="4"/><circle cx="382" cy="232" r="4"/><circle cx="290" cy="114" r="4"/><circle cx="290" cy="368" r="4"/><circle cx="244" cy="173" r="4"/><circle cx="336" cy="173" r="4"/><circle cx="244" cy="291" r="4"/><circle cx="336" cy="291" r="4"/></g></g>
${rr(520, 60, 250, 430, 14, 'fill="url(#panel)" stroke="#b58aff" stroke-opacity=".6" stroke-width="1.5"')}${t(540, 92, 'LAYERS', 14, { ls: 3 })}
${['Hair · front', 'Eyebrows', 'Eyes · left', 'Eyes · right', 'Mouth', 'Face', 'Hair · back', 'Body', 'Arms'].map((n, i) => `${rr(536, 108 + i * 41, 218, 33, 8, `fill="#ffffff" fill-opacity="${i === 2 ? 0.16 : 0.06}"`)}<rect x="546" y="${116 + i * 41}" width="18" height="18" rx="4" fill="${['#b58aff', '#6f48c4', '#3f9ad6', '#3f9ad6', '#ff8ad0', '#ffe6d6', '#8a5fe0', '#f4f0ff', '#f4f0ff'][i]}"/>${t(574, 130 + i * 41, n, 13, { w: 600, fill: '#e8e4ff' })}<circle cx="738" cy="${125 + i * 41}" r="4" fill="#5ff0ff"/>`).join('')}`,
    lg('vbg', ['#1a1436', '#2c1f5a'], 'd'),
  ),

  'style-pfp-cinematic': wrap(
    `${fullBg('#07060d')}<g filter="url(#b30)"><circle cx="230" cy="180" r="150" fill="#3a5bff" opacity=".5"/><circle cx="590" cy="380" r="170" fill="#ff5f3a" opacity=".42"/></g>${stars(40, 31, 800, 550, 0.5)}
<circle cx="400" cy="275" r="236" fill="none" stroke="url(#neon)" stroke-width="10" filter="url(#glow)"/>
<clipPath id="pfpc"><circle cx="400" cy="275" r="226"/></clipPath>
<g clip-path="url(#pfpc)"><rect width="800" height="550" fill="url(#pin)"/>
${g('translate(0 26)', character({ id: 'q', hair: '#2a2f6a', hairD: '#161a40', hairL: '#0e1130', skin: '#f2c4a8', skinS: '#b9806c', neckS: '#a06a5a', top: '#14162c', topD: '#0a0b18', topL: '#22264a', ol: '#06060e', ow: 4, iris: ['#0a1a4a', '#2f7ad6', '#9af0ff'], accent: '#ff7a3a', hs: '#0a0b14', hsL: '#3a4070', mouth: 'smug', eyes: 'half', blush: false }))}
<path d="M492 150c30 60 30 150-8 232" fill="none" stroke="#ff8a4a" stroke-width="10" stroke-linecap="round" filter="url(#b6)" opacity=".9"/>
<path d="M310 150c-30 60-30 150 8 232" fill="none" stroke="#5a8aff" stroke-width="8" stroke-linecap="round" filter="url(#b6)" opacity=".8"/></g>
${sparkle(170, 110, 14, '#bcd0ff', 0.9)}${sparkle(640, 120, 10, '#ffd0b0', 0.9)}
${rr(300, 468, 200, 44, 22, 'fill="#07060d" stroke="url(#neon)" stroke-width="3"')}${t(400, 498, 'NIGHTWOLF', 20, { a: 'middle', ls: 4 })}`,
    lg('pin', ['#1a2250', '#0b0c1c']),
  ),

  'style-esports-mascot': wrap(
    `${fullBg('url(#ebg)')}${speedLines(400, 260, 18, 60, 700, '#ffffff10', 40)}
<path d="${shield(400, 262, 400, 440)}" fill="#14101f" stroke="#ff6a4d" stroke-width="14" stroke-linejoin="round"/>
<path d="${shield(400, 262, 350, 390)}" fill="url(#esh)"/>
${wolf(400, 236, 1.5, { main: '#ff6a4d', dark: '#a8321f', light: '#fff1e0', eye: '#ffd45a', ol: '#14101f', ow: 7 })}
<path d="M150 400h500l-30 44 30 44H150l30-44z" fill="#ffd45a" stroke="#14101f" stroke-width="8" stroke-linejoin="round"/>
${t(400, 462, 'IRON WOLVES', 44, { a: 'middle', fill: '#14101f', w: 900, ls: 3 })}`,
    lg('ebg', ['#2a0f14', '#0e0a12'], 'd') + lg('esh', ['#3a1a22', '#1a0f18']),
  ),

  'style-sticker': wrap(
    `${fullBg('url(#chk)')}
${g('translate(290 280) rotate(-8)', `<g filter="url(#ds)"><circle r="186" fill="#fff"/></g><circle r="168" fill="#ffd27a"/>${emote(0, 10, 136, { mood: 'wink', headset: true })}`)}
${g('translate(600 170) rotate(10)', `<g filter="url(#ds)"><rect x="-116" y="-74" width="232" height="148" rx="44" fill="#fff"/></g><rect x="-100" y="-58" width="200" height="116" rx="32" fill="#7c5cff"/>${t(0, 26, 'GG!', 76, { a: 'middle', w: 900, x: 'stroke="#2a1a6a" stroke-width="6" paint-order="stroke"' })}`)}
${g('translate(610 400) rotate(-6)', `<g filter="url(#ds)"><path transform="scale(9)" d="M0 12C-19-3-15-18-5-18c4 0 5 3 5 5 0-2 1-5 5-5 10 0 14 15-5 30z" fill="#fff"/></g><path transform="scale(7.200)" d="M0 12C-19-3-15-18-5-18c4 0 5 3 5 5 0-2 1-5 5-5 10 0 14 15-5 30z" fill="#ff4f86"/>`)}`,
  ),

  'style-comic-ink': wrap(
    `${fullBg('#ffd23f')}<rect width="800" height="550" fill="url(#dots)" opacity=".2"/>
<path d="M0 0h470l-90 550H0z" fill="#2b6cb0"/><path d="M0 0h470l-90 550H0z" fill="url(#dots)" opacity=".25"/>
<path d="M470 0l-90 550" stroke="#fff" stroke-width="14"/><rect x="10" y="10" width="780" height="530" fill="none" stroke="#111" stroke-width="12"/>
${character({ id: 'i', hair: '#e63946', hairD: '#a01825', hairL: '#111', skin: '#ffe0c2', skinS: '#111', neckS: '#111', top: '#1d3557', topD: '#111', topL: '#2b6cb0', ol: '#111', ow: 8, iris: ['#111', '#1d3557', '#4fb0ff'], accent: '#ffd23f', hs: '#111', hsL: '#555', mouth: 'grin', brows: 'angry', blush: false })}
${g('translate(650 130) rotate(8)', `<path d="M0-96l24 44 48-22-12 50 54 14-46 30 30 44-52-6-8 52-38-38-38 38-8-52-52 6 30-44-46-30 54-14-12-50 48 22z" fill="#fff" stroke="#111" stroke-width="8" stroke-linejoin="round"/>${t(0, 18, 'POW!', 46, { a: 'middle', fill: '#e63946', w: 900, x: 'stroke="#111" stroke-width="3"' })}`)}`,
  ),

  'style-line-art': wrap(
    `${fullBg('#101a2e')}<g stroke="#5f86c4" stroke-opacity=".18" stroke-width="1">${Array.from({ length: 20 }, (_, i) => `<path d="M${i * 40} 0v550M0 ${i * 40}h800"/>`).join('')}</g>
<g fill="none" stroke="#5f86c4" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="8 8"><ellipse cx="400" cy="240" rx="110" ry="140"/><path d="M400 80v400M270 254h260M290 300h220"/></g>
${character({ id: 'l', hair: '#101a2e', hairD: '#101a2e', hairL: '#e8f0ff', skin: '#101a2e', skinS: '#101a2e', neckS: '#101a2e', top: '#101a2e', topD: '#101a2e', topL: '#101a2e', ol: '#e8f0ff', ow: 3.500, iris: ['#101a2e', '#101a2e', '#101a2e'], accent: '#e8f0ff', hs: '#101a2e', hsL: '#e8f0ff', white: '#101a2e', lip: '#101a2e', mouth: 'smile', blush: false, shade: false, shine: false })}
<g fill="none" stroke="#e8f0ff" stroke-width="3.500" stroke-linecap="round"><path d="M286 240c-6-150 234-150 228 0"/><rect x="262" y="214" width="40" height="84" rx="18"/><rect x="498" y="214" width="40" height="84" rx="18"/><ellipse cx="358" cy="258" rx="20" ry="26"/><ellipse cx="442" cy="258" rx="20" ry="26"/></g>
${t(60, 510, 'CLEAN LINE ART · READY TO COLOUR', 13, { fill: '#8fb0e8', ls: 3, w: 600 })}`,
  ),
};
