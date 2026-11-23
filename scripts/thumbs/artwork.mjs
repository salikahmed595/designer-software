// Artwork-type thumbnails: what each deliverable looks like when finished.
import { bolt, character, chibi, confetti, emote, fullBg, g, heart, lg, panel, rr, scene, shield, sparkle, star5, t, wolf, wrap } from './lib.mjs';

const dark = (a = '#1a1436', b = '#0b0a16') => lg('dk', [a, b], 'd');
/** A scene cropped into a rounded box. */
const boxed = (s, x, y, w, h, r, id = 'bx') =>
  `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath><g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 800 550" preserveAspectRatio="xMidYMid slice">${s.body}</svg></g>`;
/** The sample character cropped to its face, inside a circle. */
const avatar = (cx, cy, r, o = {}, id = 'av') =>
  `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${r}" fill="${o.bg ?? '#2a2450'}"/><g clip-path="url(#${id})"><svg x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" viewBox="230 70 340 340">${character({ id, ...o })}</svg></g>`;
const tile = (x, y, w, h, body, fill = '#ffffff', o = 0.06) => `${rr(x, y, w, h, 18, `fill="${fill}" fill-opacity="${o}" stroke="#fff" stroke-opacity=".12"`)}${body}`;
const wings = (cx, cy, fill) =>
  `<path d="M${cx - 44} ${cy - 10}c-40-30-70-20-86 10 24-6 40 0 50 14-20-2-32 6-38 20 26-10 52-6 74 6zM${cx + 44} ${cy - 10}c40-30 70-20 86 10-24-6-40 0-50 14 20-2 32 6 38 20-26-10-52-6-74 6z" fill="${fill}" stroke="#12101f" stroke-width="4" stroke-linejoin="round"/>`;
const trophy = (cx, cy, s) =>
  g(`translate(${cx} ${cy}) scale(${s})`, `<path d="M-40-60h80v36c0 36-18 58-40 62-22-4-40-26-40-62z" fill="url(#gold)" stroke="#5a3a0a" stroke-width="5" stroke-linejoin="round"/><path d="M-40-48h-26c0 30 12 46 32 50M40-48h26c0 30-12 46-32 50" fill="none" stroke="url(#gold)" stroke-width="10" stroke-linecap="round"/><rect x="-8" y="38" width="16" height="26" fill="url(#gold)"/><rect x="-36" y="62" width="72" height="16" rx="5" fill="url(#gold)" stroke="#5a3a0a" stroke-width="4"/>${star5(0, -22, 18, '#fff7d6')}`);
const mug = (cx, cy) =>
  `<g stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"><path d="M${cx - 22} ${cy - 70}q-14-18 0-34t0-34M${cx + 8} ${cy - 70}q-14-18 0-34t0-34"/></g><path d="M${cx - 50} ${cy - 50}h100v70q0 30-50 30t-50-30z" fill="#ff5fa8" stroke="#12101f" stroke-width="6" stroke-linejoin="round"/><path d="M${cx + 50} ${cy - 30}q40 0 40 26t-40 26" fill="none" stroke="#ff5fa8" stroke-width="12"/><ellipse cx="${cx}" cy="${cy - 50}" rx="50" ry="12" fill="#6a3a2a" stroke="#12101f" stroke-width="6"/>`;
const controller = (cx, cy, s, fill = '#fff') =>
  g(`translate(${cx} ${cy}) scale(${s})`, `<path d="M-50-22h100c26 0 38 30 38 54 0 16-20 20-30 6l-18-22h-80l-18 22c-10 14-30 10-30-6 0-24 12-54 38-54z" fill="${fill}" stroke="#12101f" stroke-width="5" stroke-linejoin="round"/><path d="M-44-2h24M-32-14v24" stroke="#12101f" stroke-width="7" stroke-linecap="round"/><circle cx="30" cy="-10" r="6" fill="#ff5fa8"/><circle cx="46" cy="4" r="6" fill="#4fe3ff"/>`);
const robot = (cx, cy, s) =>
  g(`translate(${cx} ${cy}) scale(${s})`, `<path d="M0-96v-34" stroke="#c3ccd8" stroke-width="8" stroke-linecap="round"/><circle cx="0" cy="-138" r="13" fill="#ff5fa8" filter="url(#glow)"/><rect x="-116" y="-30" width="24" height="52" rx="10" fill="#8a94a8"/><rect x="92" y="-30" width="24" height="52" rx="10" fill="#8a94a8"/><rect x="-94" y="-96" width="188" height="164" rx="46" fill="url(#silver)" stroke="#12101f" stroke-width="7"/><rect x="-72" y="-60" width="144" height="74" rx="30" fill="#12101f"/><circle cx="-34" cy="-24" r="19" fill="#4fe3ff" filter="url(#glow)"/><circle cx="34" cy="-24" r="19" fill="#4fe3ff" filter="url(#glow)"/><circle cx="-34" cy="-24" r="7" fill="#fff"/><circle cx="34" cy="-24" r="7" fill="#fff"/><path d="M-36 38h72" stroke="#12101f" stroke-width="12" stroke-linecap="round"/><path d="M-22 32v12M0 32v12M22 32v12" stroke="#c3ccd8" stroke-width="4"/>`);
const glyphs = {
  crown: (c) => `<path d="M-30 18l-8-40 22 16 16-28 16 28 22-16-8 40z" fill="${c}" stroke="#12101f" stroke-width="4" stroke-linejoin="round"/>`,
  shield: (c) => `<path d="${shield(0, 0, 54, 64)}" fill="${c}" stroke="#12101f" stroke-width="4" stroke-linejoin="round"/>`,
  star: (c) => star5(0, 0, 32, c, 'stroke="#12101f" stroke-width="4" stroke-linejoin="round"'),
  gem: (c) => `<path d="M-30-10l16-20h28l16 20-30 40z" fill="${c}" stroke="#12101f" stroke-width="4" stroke-linejoin="round"/><path d="M-30-10h60M-14-30l14 60 14-60" fill="none" stroke="#fff" stroke-width="2.500" opacity=".7"/>`,
  brush: (c) => `<path d="M-30 30c0-16 10-22 20-18l34-44 12 10-36 42c4 12-10 20-30 10z" fill="${c}" stroke="#12101f" stroke-width="4" stroke-linejoin="round"/>`,
  pad: () => controller(0, 2, 0.5),
  bot: () => robot(0, 14, 0.24),
  heart: (c) => `${heart(0, -2, 2.800, c)}`,
  bolt: (c) => bolt(0, 0, 0.72, c, 'stroke="#12101f" stroke-width="5" stroke-linejoin="round"'),
  coin: (c) => `<circle r="32" fill="${c}" stroke="#12101f" stroke-width="4"/><circle r="22" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>${star5(0, 0, 14, '#fff')}`,
  potion: (c) => `<path d="M-10-34h20v18c20 8 26 24 26 34 0 16-16 22-36 22s-36-6-36-22c0-10 6-26 26-34z" fill="#eaf2ff" stroke="#12101f" stroke-width="4" stroke-linejoin="round"/><path d="M-30 14q30-14 60 0c0 14-14 20-30 20s-30-6-30-20z" fill="${c}"/><rect x="-14" y="-42" width="28" height="10" rx="4" fill="#7a4a2a" stroke="#12101f" stroke-width="3"/>`,
  chest: (c) => `<path d="M-38-6c0-22 16-30 38-30s38 8 38 30z" fill="${c}" stroke="#12101f" stroke-width="4" stroke-linejoin="round"/><rect x="-38" y="-6" width="76" height="40" rx="4" fill="#7a4a2a" stroke="#12101f" stroke-width="4"/><rect x="-10" y="-14" width="20" height="24" rx="4" fill="url(#gold)" stroke="#12101f" stroke-width="3"/>`,
  fire: () => `<path d="M0-40c8 18 30 26 30 52 0 20-14 30-30 30s-30-10-30-30c0-14 8-20 14-30 2 10 6 14 10 14 0-14-2-22 6-36z" fill="#ff7a3a" stroke="#12101f" stroke-width="4" stroke-linejoin="round"/><path d="M0 0c6 8 14 12 14 22 0 10-6 16-14 16s-14-6-14-16c0-8 8-12 14-22z" fill="#ffd45a"/>`,
  skull: () => `<path d="M-30-6c0-22 14-34 30-34s30 12 30 34c0 12-6 18-12 22v14h-36v-14c-6-4-12-10-12-22z" fill="#f1f1f6" stroke="#12101f" stroke-width="4" stroke-linejoin="round"/><circle cx="-12" cy="-6" r="8" fill="#12101f"/><circle cx="12" cy="-6" r="8" fill="#12101f"/><path d="M-8 22v8M0 22v8M8 22v8" stroke="#12101f" stroke-width="3"/>`,
  thumb: () => `<path d="M-30 0h14v34h-14zM-12 2c8-6 12-18 12-34 12 0 16 10 12 26h18c8 0 10 8 6 12 4 4 2 10-2 12 2 4 0 10-4 10-2 6-6 8-12 8h-30z" fill="#ffd27a" stroke="#12101f" stroke-width="4" stroke-linejoin="round"/>`,
};
const playerColors = [
  { hair: '#4fd0ff', hairD: '#2a8fc0', hairL: '#1b6f9a', accent: '#ff5fa8' },
  { hair: '#9cfb59', hairD: '#5fb82a', hairL: '#3f8f1a', accent: '#b06bff' },
  { hair: '#ff8fd0', hairD: '#c9479a', hairL: '#a23580', accent: '#5ff0ff' },
  { hair: '#ffd45a', hairD: '#d9a02a', hairL: '#a8761a', accent: '#4fe3ff' },
  { hair: '#b58aff', hairD: '#8a5fe0', hairL: '#6f48c4', accent: '#9cfb59' },
];

const cyber = scene('cyber'), night = scene('night'), sunset = scene('sunset'), space = scene('space'), arena = scene('arena');
const neonTitle = (y, s, size, fill = '#fff', ls = 6) => t(400, y, s, size, { a: 'middle', w: 900, ls, fill, x: 'filter="url(#glow)"' });

export const ARTWORK = {
  /* ================= Streaming ================= */
  'starting-soon': wrap(
    `${cyber.body}<rect width="800" height="550" fill="#0a0420" opacity=".3"/>
${neonTitle(170, 'STARTING', 96)}${neonTitle(262, 'SOON', 96, 'url(#pk)', 16)}
${rr(290, 296, 220, 58, 29, 'fill="#0a0420" stroke="url(#neon)" stroke-width="3" filter="url(#glow)"')}${t(400, 336, '04 : 59', 30, { a: 'middle', ls: 4 })}
<circle cx="376" cy="386" r="6" fill="#fff"/><circle cx="400" cy="386" r="6" fill="#fff" opacity=".6"/><circle cx="424" cy="386" r="6" fill="#fff" opacity=".3"/>
${panel(110, 474, 580, 50, '#4fe3ff')}${t(400, 506, 'NIGHTWOLF   ·   RANKED CLIMB   ·   FOLLOW SO YOU NEVER MISS A STREAM', 13, { a: 'middle', ls: 2, w: 700 })}`,
    cyber.defs,
  ),

  'webcam-frame': wrap(
    `${fullBg('url(#chk)')}
${rr(140, 70, 520, 380, 26, 'fill="url(#neon)" filter="url(#glow)"')}${rr(152, 82, 496, 356, 16, 'fill="url(#dk)"')}
<clipPath id="wc"><rect x="152" y="82" width="496" height="356" rx="16"/></clipPath><g clip-path="url(#wc)"><circle cx="520" cy="150" r="120" fill="#b06bff" opacity=".3" filter="url(#b30)"/>${character({ x: 136, y: 96, s: 0.66 })}</g>
<path d="M126 130V96a40 40 0 0 1 40-40h60M674 390v34a40 40 0 0 1-40 40h-60" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
${rr(566, 96, 68, 28, 8, 'fill="#ff3b5c"')}<circle cx="580" cy="110" r="5" fill="#fff"/>${t(590, 116, 'LIVE', 14)}
${rr(190, 420, 300, 62, 14, 'fill="#0c0a18" stroke="url(#neon)" stroke-width="3"')}<rect x="190" y="420" width="10" height="62" rx="5" fill="url(#neon)"/>${t(218, 461, 'NIGHTWOLF', 28, { ls: 3 })}
${t(400, 520, 'Transparent centre · drops straight into the stream', 14, { a: 'middle', w: 600, fill: '#9d97c2' })}`,
    dark('#2c2450', '#151226'),
  ),

  'brb-screen': wrap(
    `${night.body}<rect width="800" height="550" fill="#070b1f" opacity=".25"/>
${neonTitle(200, 'BE RIGHT BACK', 76, '#fff', 4)}
${t(400, 250, 'Grabbing a drink · stay cosy, chat', 20, { a: 'middle', w: 600, fill: '#c9d6ff' })}
${mug(400, 390)}
${rr(250, 476, 300, 12, 6, 'fill="#000" fill-opacity=".45"')}${rr(250, 476, 190, 12, 6, 'fill="url(#pk)" filter="url(#glow)"')}${t(400, 518, 'BACK IN ABOUT 5 MINUTES', 13, { a: 'middle', ls: 3, w: 700 })}`,
    night.defs,
  ),

  'stream-alert': wrap(
    `${fullBg('url(#chk)')}${confetti(46, 12, 60, 30, 680, 480)}
${[['#ff5fa8', 'NEW FOLLOWER', 'PixelKat', heart(0, 0, 2.400, '#fff')], ['#b06bff', 'NEW SUBSCRIBER', 'vex · 6 months', star5(0, 0, 26, '#fff')], ['#4fe3ff', 'DONATION', 'Aiko · $5.00', bolt(0, 0, 0.56, '#fff')]]
  .map(([c, title, name, icon], i) => {
    const y = 60 + i * 152, x = 130 + (i % 2) * 40;
    return `<g filter="url(#ds)">${rr(x, y, 500, 118, 59, 'fill="#120f24"')}</g>${rr(x, y, 500, 118, 59, `fill="none" stroke="${c}" stroke-width="4" filter="url(#glow)"`)}<circle cx="${x + 59}" cy="${y + 59}" r="44" fill="${c}"/>${g(`translate(${x + 59} ${y + 61})`, icon)}${t(x + 124, y + 50, title, 16, { fill: c, ls: 4 })}${t(x + 124, y + 88, name, 32)}`;
  }).join('')}`,
  ),

  'stream-panels': wrap(
    `${fullBg('url(#dk)')}
${[['ABOUT ME', '#b06bff'], ['SCHEDULE', '#4fe3ff'], ['RULES', '#ff5fa8'], ['SUPPORT', '#ffd27a'], ['COMMUNITY', '#9cfb59'], ['SOCIALS', '#ff8a5c']]
  .map(([name, c], i) => {
    const x = 40 + (i % 3) * 248, y = 44 + Math.floor(i / 3) * 240;
    return `${rr(x, y, 224, 216, 16, `fill="#151226" stroke="${c}" stroke-width="2"`)}${rr(x, y, 224, 56, 16, `fill="${c}"`)}<rect x="${x}" y="${y + 36}" width="224" height="20" fill="${c}"/>${t(x + 112, y + 37, name, 20, { a: 'middle', fill: '#12101f', ls: 2 })}
<circle cx="${x + 44}" cy="${y + 100}" r="20" fill="${c}" opacity=".25"/><circle cx="${x + 44}" cy="${y + 100}" r="9" fill="${c}"/>
${rr(x + 78, y + 86, 122, 10, 5, 'fill="#fff" fill-opacity=".8"')}${rr(x + 78, y + 106, 90, 8, 4, 'fill="#fff" fill-opacity=".35"')}
${rr(x + 24, y + 140, 176, 8, 4, 'fill="#fff" fill-opacity=".3"')}${rr(x + 24, y + 160, 150, 8, 4, 'fill="#fff" fill-opacity=".3"')}${rr(x + 24, y + 180, 164, 8, 4, 'fill="#fff" fill-opacity=".3"')}`;
  }).join('')}`,
    dark(),
  ),

  'offline-screen': wrap(
    `${night.body}
${neonTitle(250, 'OFFLINE', 110, '#fff', 14)}
${t(400, 300, 'NEXT STREAM  ·  FRIDAY 8 PM', 22, { a: 'middle', ls: 4, fill: '#c9d6ff' })}
${['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d, i) => {
  const on = [2, 4, 5].includes(i), x = 134 + i * 78;
  return `${rr(x, 350, 64, 64, 14, on ? 'fill="url(#pk)" filter="url(#glow)"' : 'fill="#000" fill-opacity=".4" stroke="#fff" stroke-opacity=".2"')}${t(x + 32, 389, d, 15, { a: 'middle', fill: on ? '#fff' : '#8f9bc4' })}`;
}).join('')}`,
    night.defs,
  ),

  'full-stream-kit': wrap(
    `${fullBg('url(#dk)')}<circle cx="400" cy="275" r="260" fill="#b06bff" opacity=".12" filter="url(#b30)"/>
${[[-12, 150, 150, 'STARTING SOON', '#b06bff'], [8, 420, 120, 'BE RIGHT BACK', '#4fe3ff'], [-6, 640, 190, 'OFFLINE', '#ff5fa8'], [6, 170, 380, 'ALERTS', '#ffd27a'], [-8, 640, 410, 'PANELS', '#9cfb59']]
  .map(([rot, x, y, name, c]) => g(`translate(${x} ${y}) rotate(${rot})`, `<g filter="url(#ds)">${rr(-120, -72, 240, 144, 14, 'fill="#151226"')}</g>${rr(-120, -72, 240, 144, 14, `fill="none" stroke="${c}" stroke-width="3"`)}${rr(-120, -72, 240, 28, 14, `fill="${c}" fill-opacity=".9"`)}${t(0, 14, name, 22, { a: 'middle', w: 900 })}${rr(-70, 34, 140, 8, 4, `fill="${c}" fill-opacity=".7"`)}`)).join('')}
${g('translate(400 300)', `<g filter="url(#ds)">${rr(-170, -104, 340, 208, 16, 'fill="#0c0a18"')}</g>${rr(-170, -104, 340, 208, 16, 'fill="none" stroke="url(#neon)" stroke-width="4" filter="url(#glow)"')}${rr(-170, -104, 340, 30, 16, 'fill="url(#neon)" fill-opacity=".85"')}${rr(-156, 20, 96, 70, 8, 'fill="none" stroke="#b06bff" stroke-width="3"')}${rr(86, -60, 70, 150, 8, 'fill="#fff" fill-opacity=".1"')}${t(0, -30, 'STREAM OVERLAY', 20, { a: 'middle' })}`)}
${t(400, 530, '7 MATCHING PIECES · ONE LOOK', 15, { a: 'middle', ls: 4, fill: '#cfc6f5' })}`,
    dark(),
  ),

  /* ================= Discord ================= */
  'server-icon': wrap(
    `${fullBg('#1a1b24')}${rr(0, 0, 110, 550, 0, 'fill="#12131a"')}
${[70, 150, 230, 310, 390, 470].map((y, i) => `<circle cx="55" cy="${y}" r="30" fill="${['#2a2d3a', '#2a2d3a', '#7c5cff', '#2a2d3a', '#2a2d3a', '#2a2d3a'][i]}"/>`).join('')}<rect x="0" y="210" width="6" height="40" rx="3" fill="#fff"/>
${wolf(55, 232, 0.2, { ow: 0 })}
<circle cx="390" cy="262" r="176" fill="url(#neon)" filter="url(#glow)"/><circle cx="390" cy="262" r="162" fill="url(#dk)"/>${wolf(390, 262, 1.15, {})}
${[[640, 150, 56, '128 px'], [640, 300, 36, '64 px'], [640, 410, 20, '32 px']].map(([x, y, r, label]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#dk)" stroke="#7c5cff" stroke-width="3"/>${wolf(x, y, r / 150, { ow: r > 30 ? 6 : 0 })}${t(x, y + r + 26, label, 14, { a: 'middle', w: 600, fill: '#9d97c2' })}`).join('')}
${t(390, 496, 'Reads clearly at every size', 16, { a: 'middle', w: 600, fill: '#cfc6f5' })}`,
    dark('#2c1f5a', '#151226'),
  ),

  'server-banner': wrap(
    `${fullBg('#1a1b24')}${boxed(sunset, 50, 40, 700, 330, 18)}
<rect x="50" y="240" width="700" height="130" fill="#0c0a18" opacity=".45"/>
${t(400, 210, 'NIGHT GUILD', 84, { a: 'middle', w: 900, ls: 6, x: 'filter="url(#glow)"' })}${t(400, 258, 'A HOME FOR LATE-NIGHT GAMERS', 20, { a: 'middle', ls: 6, fill: '#ffe3c2' })}
${rr(50, 392, 700, 118, 18, 'fill="#12131a"')}<circle cx="120" cy="451" r="40" fill="#7c5cff"/>${wolf(120, 452, 0.26, { ow: 0 })}
${t(180, 444, 'Night Guild', 28)}<circle cx="188" cy="474" r="6" fill="#57f287"/>${t(202, 480, '1,204 online', 16, { w: 600, fill: '#b9bbd0' })}<circle cx="330" cy="474" r="6" fill="#8a8ea0"/>${t(344, 480, '8,310 members', 16, { w: 600, fill: '#b9bbd0' })}
${rr(600, 428, 120, 46, 23, 'fill="#57f287"')}${t(660, 458, 'Joined', 17, { a: 'middle', fill: '#0c2a14' })}`,
    sunset.defs,
  ),

  'profile-art': wrap(
    `${fullBg('url(#dk)')}<g filter="url(#ds)">${rr(200, 40, 400, 470, 22, 'fill="#12131a"')}</g>
${rr(200, 40, 400, 150, 22, 'fill="url(#neon)"')}<rect x="200" y="150" width="400" height="40" fill="url(#neon)"/><g filter="url(#b14)" opacity=".5"><circle cx="520" cy="90" r="50" fill="#fff"/></g>
<circle cx="290" cy="196" r="78" fill="#12131a"/>${avatar(290, 196, 66, { bg: '#3a2a6a' })}<circle cx="340" cy="244" r="17" fill="#57f287" stroke="#12131a" stroke-width="7"/>
${t(226, 318, 'NightWolf', 36)}${t(226, 348, 'nightwolf · she/her', 17, { w: 600, fill: '#b9bbd0' })}
${[['#b06bff', 'Streamer'], ['#4fe3ff', 'Ranked'], ['#ff5fa8', 'Artist']].map(([c, n], i) => `${rr(226 + i * 118, 370, 106, 34, 17, `fill="${c}" fill-opacity=".2" stroke="${c}"`)}<circle cx="${244 + i * 118}" cy="387" r="6" fill="${c}"/>${t(258 + i * 118, 393, n, 15, { w: 700 })}`).join('')}
${t(226, 444, 'ABOUT ME', 13, { ls: 3, fill: '#8f93a8' })}${rr(226, 458, 330, 9, 4, 'fill="#fff" fill-opacity=".5"')}${rr(226, 478, 250, 9, 4, 'fill="#fff" fill-opacity=".3"')}`,
    dark(),
  ),

  'welcome-banner': wrap(
    `${fullBg('#1a1b24')}${boxed(space, 40, 130, 720, 290, 28)}${rr(40, 130, 720, 290, 28, 'fill="none" stroke="url(#neon)" stroke-width="5" filter="url(#glow)"')}
<circle cx="190" cy="275" r="104" fill="url(#neon)"/><circle cx="190" cy="275" r="94" fill="#2a2450"/>${emote(190, 282, 70, { mood: 'happy', headset: true })}
${t(330, 236, 'WELCOME', 70, { w: 900, ls: 5, x: 'filter="url(#glow)"' })}${t(332, 294, 'PixelKat', 46, { fill: '#4fe3ff' })}${t(332, 340, 'You are member #1,024 of Night Guild', 19, { w: 600, fill: '#d9d4f5' })}
${sparkle(690, 180, 18)}${sparkle(650, 370, 12, '#fff', 0.8)}${t(400, 470, 'Posted automatically when someone joins', 15, { a: 'middle', w: 600, fill: '#9d97c2' })}`,
    space.defs,
  ),

  'invite-splash': wrap(
    `${cyber.body}<rect width="800" height="550" fill="#0a0420" opacity=".45"/>
<g filter="url(#ds)">${rr(240, 70, 320, 410, 22, 'fill="#17182233"')}${rr(240, 70, 320, 410, 22, 'fill="#171822"')}</g>
<circle cx="400" cy="160" r="56" fill="#7c5cff"/>${wolf(400, 162, 0.36, { ow: 0 })}
${t(400, 252, 'You have been invited to join', 15, { a: 'middle', w: 600, fill: '#b9bbd0' })}${t(400, 294, 'Night Guild', 36, { a: 'middle' })}
<circle cx="296" cy="330" r="6" fill="#57f287"/>${t(310, 336, '1,204 online', 15, { w: 600, fill: '#b9bbd0' })}<circle cx="426" cy="330" r="6" fill="#8a8ea0"/>${t(440, 336, '8,310 members', 15, { w: 600, fill: '#b9bbd0' })}
${rr(272, 378, 256, 56, 12, 'fill="url(#pk)" filter="url(#glow)"')}${t(400, 414, 'Accept invite', 20, { a: 'middle' })}
${t(400, 520, 'Full-screen art behind the invite card', 14, { a: 'middle', w: 600, fill: '#d9d4f5' })}`,
    cyber.defs,
  ),

  'role-icons': wrap(
    `${fullBg('url(#dk)')}
${[['crown', '#ffd45a', 'Admin'], ['shield', '#4fe3ff', 'Moderator'], ['star', '#ff5fa8', 'VIP'], ['gem', '#b06bff', 'Booster'], ['brush', '#ff8a5c', 'Artist'], ['pad', '#9cfb59', 'Gamer'], ['bot', '#c3ccd8', 'Bot'], ['heart', '#ff4f86', 'Supporter']]
  .map(([k, c, name], i) => {
    const x = 118 + (i % 4) * 188, y = 150 + Math.floor(i / 4) * 230;
    return `<circle cx="${x}" cy="${y}" r="72" fill="${c}" fill-opacity=".16" stroke="${c}" stroke-width="4"/>${g(`translate(${x} ${y}) scale(1.500)`, glyphs[k](c))}${rr(x - 62, y + 90, 124, 34, 17, `fill="${c}" fill-opacity=".2"`)}<circle cx="${x - 44}" cy="${y + 107}" r="6" fill="${c}"/>${t(x + 6, y + 113, name, 16, { a: 'middle', w: 700 })}`;
  }).join('')}`,
    dark(),
  ),

  'event-poster': wrap(
    `${arena.body}<g filter="url(#ds)">${rr(240, 30, 320, 490, 16, 'fill="url(#ep)"')}</g>${rr(254, 44, 292, 462, 10, 'fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"')}
${t(400, 96, 'NIGHT GUILD PRESENTS', 14, { a: 'middle', ls: 4, fill: '#ffe3f4' })}
${t(400, 170, 'GAME', 78, { a: 'middle', w: 900, ls: 4 })}${t(400, 240, 'NIGHT', 78, { a: 'middle', w: 900, ls: 4, fill: '#ffd45a' })}
${controller(400, 312, 1.300)}
${rr(290, 372, 220, 52, 26, 'fill="#12101f"')}${t(400, 406, 'FRI · 8 PM', 26, { a: 'middle', fill: '#ffd45a' })}
${t(400, 456, 'PRIZES  ·  VOICE CHAT  ·  ALL WELCOME', 13, { a: 'middle', ls: 2, w: 700 })}${t(400, 484, 'Join the Events channel to sign up', 13, { a: 'middle', w: 600, fill: '#ffe3f4' })}`,
    arena.defs + lg('ep', ['#7c2fd6', '#ff5fa8', '#ff8a5c']),
  ),

  'bot-avatar': wrap(
    `${fullBg('url(#dk)')}<circle cx="400" cy="270" r="250" fill="#4fe3ff" opacity=".12" filter="url(#b30)"/>
<circle cx="400" cy="270" r="206" fill="url(#neon)" filter="url(#glow)"/><circle cx="400" cy="270" r="192" fill="#171a2e"/>
${robot(400, 300, 1.250)}
${rr(520, 404, 110, 44, 10, 'fill="#5865f2"')}${t(575, 434, 'BOT', 22, { a: 'middle', ls: 3 })}<circle cx="560" cy="130" r="20" fill="#57f287" stroke="#12131a" stroke-width="7"/>`,
    dark('#1a2a4a', '#0b0a16'),
  ),

  /* ================= Characters & VTubers ================= */
  'gaming-avatar': wrap(
    `${space.body}<circle cx="400" cy="260" r="240" fill="none" stroke="url(#neon)" stroke-width="6" opacity=".7" filter="url(#glow)"/>
${character({ id: 'ga', hair: '#4fd0ff', hairD: '#2a8fc0', hairL: '#1b6f9a', accent: '#ff5fa8', iris: ['#0a2a5a', '#2f9ad6', '#9af0ff'], top: '#1a1436', topD: '#0f0b24', topL: '#3a2a6a', mouth: 'smug', eyes: 'wink' })}
${rr(40, 450, 250, 60, 14, 'fill="#0c0a18" stroke="url(#neon)" stroke-width="3"')}<rect x="40" y="450" width="10" height="60" rx="5" fill="url(#neon)"/>${t(66, 490, 'NIGHTWOLF', 26, { ls: 3 })}`,
    space.defs,
  ),

  mascot: wrap(
    `${fullBg('url(#mb)')}<circle cx="400" cy="280" r="230" fill="#fff" opacity=".14"/><ellipse cx="400" cy="486" rx="150" ry="20" fill="#000" opacity=".25"/>
<path d="M520 400c70-10 110-60 96-120-30 30-60 40-96 40z" fill="#ff8a3d" stroke="#2a1408" stroke-width="8" stroke-linejoin="round"/><path d="M594 300c14-8 22-14 22-20 4 30-6 50-24 62z" fill="#fff6e6"/>
<path d="M300 480c-10-90 20-170 100-170s110 80 100 170z" fill="#ff8a3d" stroke="#2a1408" stroke-width="8" stroke-linejoin="round"/><path d="M350 480c-4-60 10-110 50-110s54 50 50 110z" fill="#fff6e6"/>
<ellipse cx="340" cy="478" rx="44" ry="20" fill="#ff8a3d" stroke="#2a1408" stroke-width="8"/><ellipse cx="460" cy="478" rx="44" ry="20" fill="#ff8a3d" stroke="#2a1408" stroke-width="8"/>
<path d="M300 370c-50 0-70 30-62 66M500 370c50 0 70 30 62 66" fill="none" stroke="#2a1408" stroke-width="40" stroke-linecap="round"/><path d="M300 370c-50 0-70 30-62 66M500 370c50 0 70 30 62 66" fill="none" stroke="#ff8a3d" stroke-width="26" stroke-linecap="round"/>
${wolf(400, 226, 1.350, { main: '#ff8a3d', dark: '#c95a1a', light: '#fff6e6', eye: '#3ad6a0', ol: '#2a1408', ow: 6 })}
${sparkle(150, 140, 22)}${sparkle(660, 170, 16)}${rr(290, 500, 220, 36, 18, 'fill="#2a1408"')}${t(400, 525, 'EMBER THE FOX', 17, { a: 'middle', ls: 3 })}`,
    lg('mb', ['#3ad6a0', '#2a7fd6'], 'd'),
  ),

  'chibi-character': wrap(
    `${fullBg('url(#cb)')}<circle cx="400" cy="270" r="220" fill="#fff" opacity=".2"/>${sparkle(150, 130, 22)}${sparkle(650, 150, 18)}${sparkle(640, 420, 12, '#fff', 0.8)}
${chibi(400, 176, 1.080, { hair: '#6fd0ff', hairD: '#3a9ad6', top: '#ff7ab0', topL: '#ffb0d0', bottom: '#3a2a6a', shoe: '#ffd45a', mood: 'wink' })}`,
    lg('cb', ['#7c8cff', '#c9a0ff'], 'd'),
  ),

  pngtuber: wrap(
    `${fullBg('url(#dk)')}
${[['IDLE', 'smug', '#8f93a8', 2], ['TALKING', 'happy', '#57f287', 7]].map(([label, mood, c, bars], i) => {
  const x = 70 + i * 350;
  return `${rr(x, 50, 310, 400, 22, `fill="#171a2e" stroke="${c}" stroke-width="${i ? 5 : 2}"${i ? ' filter="url(#glow)"' : ''}`)}${rr(x, 50, 310, 400, 22, 'fill="url(#chk)" fill-opacity=".5"')}${emote(x + 155, 240, 118, { mood, headset: true })}
${rr(x + 85, 468, 140, 40, 20, `fill="${c}" fill-opacity=".2" stroke="${c}"`)}${t(x + 155, 495, label, 18, { a: 'middle', ls: 3, fill: c })}
${Array.from({ length: 9 }, (_, k) => `<rect x="${x + 24 + k * 12}" y="${420 - (k < bars ? 8 + ((k * 7) % 22) : 4)}" width="7" height="${k < bars ? 8 + ((k * 7) % 22) : 4}" rx="3" fill="${c}"/>`).join('')}`;
}).join('')}
<path d="M392 250h20M404 240l12 10-12 10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    dark(),
  ),

  'vtuber-art': wrap(
    `${fullBg('url(#dk)')}<g stroke="#fff" stroke-opacity=".06">${Array.from({ length: 20 }, (_, i) => `<path d="M${i * 40} 0v550M0 ${i * 40}h800"/>`).join('')}</g>
${character({ id: 'va', hair: '#b58aff', hairD: '#8a5fe0', hairL: '#6f48c4', top: '#f4f0ff', topD: '#d9d0f4', topL: '#ffffff', ol: '#3a2a5a', ow: 4, iris: ['#1b3a78', '#3f9ad6', '#9af0ff'], headset: false, hairStyle: 'bun', mouth: 'smile', strings: false })}
<g fill="none" stroke="#5ff0ff" stroke-width="2.500" stroke-dasharray="9 7">${rr(322, 218, 70, 76, 8, '')}${rr(408, 218, 70, 76, 8, '')}${rr(366, 312, 68, 46, 8, '')}${rr(286, 76, 228, 124, 10, '')}${rr(170, 400, 460, 150, 10, '')}</g>
${[[110, 256, 'EYE · L', 322, 256], [690, 256, 'EYE · R', 478, 256], [110, 336, 'MOUTH', 366, 336], [690, 130, 'HAIR · FRONT', 514, 130], [110, 470, 'BODY', 170, 470]].map(([x, y, label, lx, ly]) => `<path d="M${x < 400 ? x + 54 : x - 60} ${y}L${lx} ${ly}" stroke="#5ff0ff" stroke-width="1.5"/>${rr(x - 66, y - 16, 132, 32, 8, 'fill="#0c0a18" stroke="#5ff0ff"')}${t(x, y + 6, label, 13, { a: 'middle', ls: 2, fill: '#5ff0ff' })}`).join('')}
${t(400, 36, 'EVERY PART ON ITS OWN LAYER · READY FOR RIGGING', 13, { a: 'middle', ls: 3, fill: '#cfc6f5' })}`,
    dark('#1a1436', '#2c1f5a'),
  ),

  'anime-portrait': wrap(
    `${fullBg('url(#ap)')}<circle cx="400" cy="250" r="250" fill="#fff" opacity=".35" filter="url(#b30)"/>
${[[120, 110, 20], [660, 140, -30], [90, 380, 50], [700, 400, 10], [580, 60, 70], [230, 60, -50]].map(([x, y, r]) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M0-22c14 4 20 16 14 30-10 6-22 2-26-10 0-10 4-16 12-20z" fill="#ffd0e4" opacity=".9"/>`).join('')}
${character({ id: 'an', hair: '#3a6fd8', hairD: '#24499a', hairL: '#1b3470', iris: ['#0a2a5a', '#2f9ad6', '#c9f2ff'], top: '#fff6fa', topD: '#f2d6e2', topL: '#ffffff', ol: '#2a2450', headset: false, mouth: 'smile', strings: false })}
<path transform="translate(300 150) rotate(-20)" d="M0-26c16 4 24 18 16 34-12 8-26 2-30-12 0-12 4-18 14-22z" fill="#ff8fb8" stroke="#2a2450" stroke-width="4"/><circle cx="302" cy="152" r="6" fill="#ffd45a"/>`,
    lg('ap', ['#ffd9ec', '#c9e6ff'], 'd'),
  ),

  'expression-sheet': wrap(
    `${fullBg('url(#dk)')}
${[['happy', 'HAPPY'], ['rage', 'ANGRY'], ['sad', 'SAD'], ['wow', 'SHOCKED'], ['love', 'LOVE'], ['smug', 'SMUG']].map(([mood, label], i) => {
  const x = 150 + (i % 3) * 250, y = 140 + Math.floor(i / 3) * 256;
  return `${rr(x - 106, y - 110, 212, 236, 18, 'fill="#fff" fill-opacity=".05" stroke="#fff" stroke-opacity=".12"')}${emote(x, y, 76, { mood })}${t(x, y + 112, label, 15, { a: 'middle', ls: 3, fill: '#cfc6f5' })}`;
}).join('')}`,
    dark(),
  ),

  'character-sheet': wrap(
    `${fullBg('#f1ecf7')}<g stroke="#2a2450" stroke-opacity=".08">${Array.from({ length: 20 }, (_, i) => `<path d="M${i * 40} 0v550M0 ${i * 40}h800"/>`).join('')}</g>
${t(40, 52, 'NIGHTWOLF · REFERENCE SHEET', 20, { fill: '#2a2450', ls: 3 })}
${chibi(170, 190, 0.700, { mood: 'happy', wave: false })}${chibi(400, 190, 0.700, { mood: 'wink', wave: true })}${chibi(630, 190, 0.700, { mood: 'none', skin: '#ff8fd0', wave: false })}
<path d="M60 400h680" stroke="#2a2450" stroke-width="2" stroke-dasharray="6 6" opacity=".4"/>
${[[170, 'FRONT'], [400, 'POSE'], [630, 'BACK']].map(([x, l]) => t(x, 432, l, 15, { a: 'middle', ls: 4, fill: '#2a2450' })).join('')}
${['#ff8fd0', '#c9479a', '#ffe6d6', '#2c3170', '#ff5fa8', '#5ff0ff'].map((c, i) => `<circle cx="${250 + i * 60}" cy="490" r="22" fill="${c}" stroke="#2a2450" stroke-width="3"/>`).join('')}${t(200, 496, 'COLOURS', 13, { a: 'end', ls: 2, fill: '#2a2450' })}`,
  ),

  /* ================= Emotes & Badges ================= */
  'static-emotes': wrap(
    `${fullBg('url(#chk)')}
${[['lol', 'LOL'], ['love', 'LOVE'], ['rage', 'RAGE'], ['wow', 'WOW']].map(([mood, label], i) => `${emote(112 + i * 192, 190, 82, { mood })}${t(112 + i * 192, 322, label, 18, { a: 'middle', ls: 4 })}`).join('')}
${rr(150, 360, 500, 150, 18, 'fill="#12101f" fill-opacity=".85"')}${t(400, 392, 'READABLE AT EVERY CHAT SIZE', 13, { a: 'middle', ls: 3, fill: '#cfc6f5' })}
${[[250, 58, '112 px'], [400, 36, '56 px'], [520, 20, '28 px']].map(([x, r, l]) => `${emote(x, 444, r * 0.62, { mood: 'lol', ow: r > 30 ? 7 : 9 })}${t(x, 500, l, 12, { a: 'middle', w: 600, fill: '#9d97c2' })}`).join('')}`,
  ),

  'chibi-emotes': wrap(
    `${fullBg('url(#dk)')}
${['happy', 'sad', 'smug', 'wink', 'sleepy', 'wow'].map((mood, i) => {
  const x = 150 + (i % 3) * 250, y = 148 + Math.floor(i / 3) * 256;
  return `${rr(x - 104, y - 112, 208, 224, 26, `fill="${['#b06bff', '#4fe3ff', '#ff5fa8', '#ffd27a', '#9cfb59', '#ff8a5c'][i]}" fill-opacity=".18"`)}${emote(x, y + 4, 82, { mood, headset: true, hair: '#6fd0ff', hairD: '#3a9ad6' })}`;
}).join('')}`,
    dark(),
  ),

  'discord-emojis': wrap(
    `${fullBg('#1a1b24')}
${['heart', 'fire', 'star', 'skull', 'thumb', 'gem', 'bolt', 'lol'].map((k, i) => {
  const x = 118 + (i % 4) * 188, y = 150 + Math.floor(i / 4) * 230, c = ['#ff4f86', '', '#ffd45a', '', '', '#4fe3ff', '#ffd45a', ''][i];
  return `${tile(x - 80, y - 80, 160, 160, k === 'lol' ? emote(x, y + 2, 58, { mood: 'lol' }) : g(`translate(${x} ${y}) scale(2)`, glyphs[k](c)), '#2a2d3a', 1)}`;
}).join('')}
${rr(150, 470, 500, 52, 12, 'fill="#2a2d3a"')}${t(176, 503, 'gg everyone', 17, { w: 600, fill: '#e8e4ff' })}${g('translate(300 496) scale(.5)', glyphs.heart('#ff4f86'))}${g('translate(332 496) scale(.5)', glyphs.fire())}`,
  ),

  'sub-badges': wrap(
    `${fullBg('url(#dk)')}${t(400, 70, 'ONE SHAPE THAT LEVELS UP', 15, { a: 'middle', ls: 4, fill: '#cfc6f5' })}
${[['url(#bronze)', '1', 1], ['url(#silver)', '3', 2], ['url(#gold)', '6', 3], ['#b06bff', '12', 4], ['#4fe3ff', '24', 5]].map(([fill, m, n], i) => {
  const x = 104 + i * 148, r = 50 + i * 6;
  return `${n > 3 ? `<circle cx="${x}" cy="230" r="${r + 16}" fill="${fill}" opacity=".25" filter="url(#b14)"/>` : ''}<path d="${shield(x, 230, r * 1.800, r * 2.100)}" fill="${fill}" stroke="#12101f" stroke-width="6" stroke-linejoin="round"/>
${Array.from({ length: n }, (_, k) => star5(x + (k - (n - 1) / 2) * 20, 226 - Math.abs(k - (n - 1) / 2) * -6, 10, '#fff', 'stroke="#12101f" stroke-width="2"')).join('')}
${t(x, 350, m, 34, { a: 'middle' })}${t(x, 376, m === '1' ? 'MONTH' : 'MONTHS', 12, { a: 'middle', ls: 2, fill: '#9d97c2' })}`;
}).join('')}
${rr(220, 420, 360, 84, 16, 'fill="#12101f"')}${t(246, 452, 'IN CHAT', 12, { ls: 3, fill: '#9d97c2' })}
${[['url(#bronze)', 'mossy'], ['url(#gold)', 'Aiko'], ['#4fe3ff', 'PixelKat']].map(([f, n], i) => `<path d="${shield(256 + i * 112, 480, 18, 22)}" fill="${f}" stroke="#000" stroke-width="1.5"/>${t(270 + i * 112, 486, n, 15, { w: 700 })}`).join('')}`,
    dark(),
  ),

  'sticker-pack': wrap(
    `${fullBg('url(#chk)')}
${g('translate(200 190) rotate(-8)', `<g filter="url(#ds)"><circle r="150" fill="#fff"/></g><circle r="134" fill="#9cfb59"/>${emote(0, 8, 108, { mood: 'lol' })}`)}
${g('translate(560 150) rotate(8)', `<g filter="url(#ds)">${rr(-150, -76, 300, 152, 46, 'fill="#fff"')}</g>${rr(-134, -60, 268, 120, 34, 'fill="#ff5fa8"')}${t(0, 28, 'HYPE!', 78, { a: 'middle', w: 900, x: 'stroke="#7a1a4a" stroke-width="6" paint-order="stroke"' })}`)}
${g('translate(600 390) rotate(-6)', `<g filter="url(#ds)"><circle r="120" fill="#fff"/></g><circle r="106" fill="#2a2450"/>${wolf(0, 4, 0.720, {})}`)}
${g('translate(330 410) rotate(10)', `<g filter="url(#ds)"><path transform="scale(7.500)" d="M0 12C-19-3-15-18-5-18c4 0 5 3 5 5 0-2 1-5 5-5 10 0 14 15-5 30z" fill="#fff"/></g><path transform="scale(6)" d="M0 12C-19-3-15-18-5-18c4 0 5 3 5 5 0-2 1-5 5-5 10 0 14 15-5 30z" fill="#ff4f86"/>`)}`,
  ),

  'rank-badges': wrap(
    `${fullBg('url(#dk)')}
${[['url(#bronze)', 'BRONZE', 1], ['url(#silver)', 'SILVER', 2], ['url(#gold)', 'GOLD', 3], ['url(#plat)', 'PLATINUM', 4], ['url(#dia)', 'DIAMOND', 5]].map(([fill, name, n], i) => {
  const x = 100 + i * 150, y = 250 - (i === 2 ? 20 : 0) - (i > 2 ? 10 : 0);
  return `${n > 2 ? `<circle cx="${x}" cy="${y}" r="80" fill="${fill}" opacity=".2" filter="url(#b14)"/>` : ''}${n > 1 ? wings(x, y, fill) : ''}<path d="${shield(x, y, 104, 132)}" fill="${fill}" stroke="#12101f" stroke-width="6" stroke-linejoin="round"/><path d="${shield(x, y, 78, 102)}" fill="none" stroke="#12101f" stroke-opacity=".35" stroke-width="3"/>
${Array.from({ length: Math.min(n, 3) }, (_, k) => `<path d="M${x - 22} ${y - 14 + k * 18}l22-16 22 16" fill="none" stroke="#12101f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}${n > 3 ? star5(x, y - 44, 14, '#fff', 'stroke="#12101f" stroke-width="2"') : ''}
${t(x, y + 112, name, 15, { a: 'middle', ls: 3 })}`;
}).join('')}
${t(400, 500, 'ONE EMBLEM · FIVE TIERS', 15, { a: 'middle', ls: 4, fill: '#cfc6f5' })}`,
    dark() + lg('plat', ['#eafffb', '#8fe0d6', '#3a8f88']) + lg('dia', ['#eaf6ff', '#7cc8ff', '#2a6fd6']),
  ),

  'point-icons': wrap(
    `${fullBg('url(#dk)')}
${[['gem', '#4fe3ff', 'Gems'], ['coin', '#ffd45a', 'Coins'], ['potion', '#ff5fa8', 'Hydrate'], ['chest', '#ffd45a', 'Loot'], ['star', '#ffd45a', 'Highlight'], ['bolt', '#9cfb59', 'Power-up']].map(([k, c, name], i) => {
  const x = 150 + (i % 3) * 250, y = 140 + Math.floor(i / 3) * 256;
  return `${tile(x - 100, y - 100, 200, 220, `<circle cx="${x}" cy="${y}" r="62" fill="${c}" opacity=".16"/>${g(`translate(${x} ${y}) scale(2)`, glyphs[k](c))}${t(x, y + 100, name, 17, { a: 'middle', w: 700 })}`)}`;
}).join('')}`,
    dark(),
  ),

  'text-emotes': wrap(
    `${fullBg('url(#chk)')}
${[['GG', '#9cfb59', '#1f5a0a', 190, 170, -8, 150], ['HYPE', '#ff5fa8', '#7a1a4a', 560, 150, 6, 110], ['LOL', '#ffd45a', '#7a4a0a', 230, 400, 6, 120], ['EZ', '#4fe3ff', '#0a4a6a', 580, 390, -8, 150]].map(([word, fill, stroke, x, y, rot, size]) =>
  g(`translate(${x} ${y}) rotate(${rot})`, `${t(6, 48, word, size, { a: 'middle', w: 900, fill: '#000', o: 0.35 })}${t(0, 40, word, size, { a: 'middle', w: 900, fill, x: `stroke="#fff" stroke-width="22" paint-order="stroke" stroke-linejoin="round"` })}${t(0, 40, word, size, { a: 'middle', w: 900, fill, x: `stroke="${stroke}" stroke-width="8" paint-order="stroke" stroke-linejoin="round"` })}`)).join('')}`,
  ),

  /* ================= Gaming Branding ================= */
  'gaming-logo': wrap(
    `${fullBg('url(#dk)')}<circle cx="300" cy="250" r="230" fill="#9cfb59" opacity=".12" filter="url(#b30)"/>
<path d="${shield(300, 230, 300, 350)}" fill="#12101f" stroke="url(#lg1)" stroke-width="14" stroke-linejoin="round"/><path d="${shield(300, 230, 250, 296)}" fill="url(#lg1)" opacity=".18"/>
${bolt(300, 226, 2.600, 'url(#lg1)', 'stroke="#12101f" stroke-width="3" stroke-linejoin="round"')}
${t(300, 470, 'VOLTEX', 76, { a: 'middle', w: 900, ls: 8, fill: 'url(#lg1)' })}${t(300, 506, 'GAMING', 20, { a: 'middle', ls: 16 })}
${rr(560, 60, 190, 190, 20, 'fill="#fff"')}<path d="${shield(655, 150, 110, 128)}" fill="#12101f"/>${bolt(655, 148, 0.950, '#fff')}${t(655, 276, 'ONE COLOUR', 12, { a: 'middle', ls: 3, fill: '#9d97c2' })}
${rr(560, 300, 190, 190, 20, 'fill="#9cfb59"')}${bolt(655, 395, 1.500, '#12101f')}${t(655, 516, 'ICON ONLY', 12, { a: 'middle', ls: 3, fill: '#9d97c2' })}`,
    dark('#141a12', '#0b0a16') + lg('lg1', ['#e8ff9a', '#9cfb59', '#3fb86a']),
  ),

  'esports-logo': wrap(
    `${arena.body}<path d="${shield(400, 250, 420, 440)}" fill="#0c1024" stroke="#4fd0ff" stroke-width="14" stroke-linejoin="round"/><path d="${shield(400, 250, 366, 386)}" fill="url(#es)"/>
${wolf(400, 222, 1.500, { main: '#4fd0ff', dark: '#1b6f9a', light: '#eaf8ff', eye: '#ff5fa8', ol: '#0c1024', ow: 7 })}
<path d="M140 392h520l-32 46 32 46H140l32-46z" fill="#eaf8ff" stroke="#0c1024" stroke-width="8" stroke-linejoin="round"/>${t(400, 456, 'FROST WOLVES', 46, { a: 'middle', fill: '#0c1024', w: 900, ls: 3 })}
${star5(330, 520, 12, '#4fd0ff')}${star5(400, 524, 15, '#4fd0ff')}${star5(470, 520, 12, '#4fd0ff')}`,
    arena.defs + lg('es', ['#1a2a5a', '#0c1024']),
  ),

  'youtube-thumbnail': wrap(
    `${fullBg('#0f0f12')}${boxed(cyber, 40, 36, 720, 405, 18)}<rect x="40" y="36" width="720" height="405" rx="18" fill="#0a0420" opacity=".25"/>
<clipPath id="yt"><rect x="40" y="36" width="720" height="405" rx="18"/></clipPath><g clip-path="url(#yt)">${character({ id: 'yt', x: 300, y: 36, s: 0.800, eyes: 'wide', mouth: 'o', brows: 'up' })}</g>
${t(70, 170, 'EPIC', 112, { w: 900, fill: '#ffe14d', x: 'stroke="#12101f" stroke-width="12" paint-order="stroke" stroke-linejoin="round"' })}
${t(70, 268, 'COMEBACK', 76, { w: 900, x: 'stroke="#12101f" stroke-width="12" paint-order="stroke" stroke-linejoin="round"' })}
${g('translate(330 330) rotate(-8)', `${rr(-150, -40, 300, 80, 12, 'fill="#ff3b5c" stroke="#12101f" stroke-width="6"')}${t(0, 16, '1 HP LEFT?!', 42, { a: 'middle', w: 900 })}`)}
<path d="M420 300c60-30 100-30 150 0" fill="none" stroke="#ffe14d" stroke-width="12" stroke-linecap="round"/><path d="M546 270l30 34-44 8z" fill="#ffe14d"/>
${rr(676, 396, 70, 32, 6, 'fill="#000" fill-opacity=".85"')}${t(711, 419, '12:47', 17, { a: 'middle', w: 700 })}
<circle cx="72" cy="492" r="26" fill="#7c5cff"/>${wolf(72, 493, 0.170, { ow: 0 })}${rr(112, 470, 430, 14, 7, 'fill="#fff" fill-opacity=".85"')}${rr(112, 498, 240, 11, 5, 'fill="#fff" fill-opacity=".35"')}`,
    cyber.defs,
  ),

  'youtube-banner': wrap(
    `${fullBg('#0f0f12')}${boxed(space, 20, 150, 760, 250, 14)}
${rr(200, 196, 400, 158, 10, 'fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 8" opacity=".7"')}
<circle cx="268" cy="275" r="52" fill="#7c5cff"/>${wolf(268, 276, 0.340, { ow: 0 })}
${t(338, 270, 'NIGHTWOLF', 44, { w: 900, ls: 3, x: 'filter="url(#glow)"' })}${t(340, 304, 'NEW VIDEOS EVERY FRIDAY', 15, { ls: 4, fill: '#4fe3ff' })}
${emote(90, 280, 44, { mood: 'happy', headset: true })}${emote(712, 280, 44, { mood: 'wink', hair: '#6fd0ff', hairD: '#3a9ad6' })}
${t(400, 186, 'SAFE AREA · visible on every device', 12, { a: 'middle', ls: 2, fill: '#fff', o: 0.8 })}
${t(400, 110, 'CHANNEL BANNER', 22, { a: 'middle', ls: 8 })}${t(400, 450, 'Phones show the centre · TVs show the whole image', 15, { a: 'middle', w: 600, fill: '#9d97c2' })}`,
    space.defs,
  ),

  'team-banner': wrap(
    `${arena.body}
${[[110, 0.340], [255, 0.380], [400, 0.460], [545, 0.380], [690, 0.340]].map(([cx, s], i) => character({ id: `tb${i}`, x: cx - 400 * s, y: 430 - 550 * s, s, ...playerColors[i], eyes: ['anime', 'half', 'anime', 'wink', 'anime'][i], mouth: ['smile', 'smug', 'grin', 'smile', 'flat'][i], blush: false })).join('')}
<rect y="420" width="800" height="130" fill="url(#panel)"/><rect y="418" width="800" height="4" fill="url(#neon)" filter="url(#glow)"/>
${['KAI', 'MOSS', 'NIGHTWOLF', 'AIKO', 'VEX'].map((n, i) => t([110, 255, 400, 545, 690][i], 452, n, i === 2 ? 20 : 15, { a: 'middle', ls: 3, fill: i === 2 ? '#fff' : '#cfc6f5' })).join('')}
${t(400, 512, 'THE SQUAD', 48, { a: 'middle', w: 900, ls: 12, x: 'filter="url(#glow)"' })}
<circle cx="400" cy="62" r="40" fill="#7c5cff"/>${wolf(400, 63, 0.260, { ow: 0 })}`,
    arena.defs,
  ),

  'tournament-poster': wrap(
    `${arena.body}<g filter="url(#ds)">${rr(240, 26, 320, 498, 14, 'fill="url(#tp)"')}</g>${rr(254, 40, 292, 470, 8, 'fill="none" stroke="url(#gold)" stroke-width="3"')}
<circle cx="400" cy="170" r="110" fill="#ffd45a" opacity=".25" filter="url(#b30)"/>${trophy(400, 170, 1.250)}
${t(400, 318, 'WINTER CUP', 44, { a: 'middle', w: 900, ls: 3 })}${t(400, 352, '2026', 26, { a: 'middle', ls: 10, fill: '#ffd45a' })}
${rr(284, 372, 232, 44, 6, 'fill="url(#gold)"')}${t(400, 402, 'GRAND FINALS', 22, { a: 'middle', fill: '#2a1a0a', ls: 3 })}
${t(400, 452, '$10,000 PRIZE POOL', 19, { a: 'middle', ls: 2 })}${t(400, 484, 'DEC 12 · 8 PM · LIVE', 14, { a: 'middle', ls: 4, fill: '#c9d6ff' })}`,
    arena.defs + lg('tp', ['#1a2a6a', '#0c1024', '#2a0f3a']),
  ),

  'gaming-wallpaper': wrap(
    `${fullBg('url(#dk)')}<g filter="url(#ds)">${rr(70, 40, 660, 400, 18, 'fill="#12101f"')}</g>${boxed(cyber, 84, 54, 632, 372, 8)}
${g('translate(400 250)', wolf(0, 0, 0.900, { main: '#12062e', dark: '#12062e', light: '#1d0a44', eye: '#ff5fa8', ol: '#ff5fa8', ow: 3 }))}
<path d="M360 440h80l14 56H346z" fill="#2a2d3a"/>${rr(290, 494, 220, 16, 8, 'fill="#3a3d4a"')}
`,
    dark() + cyber.defs,
  ),

  'merch-art': wrap(
    `${fullBg('url(#mg)')}<ellipse cx="290" cy="500" rx="210" ry="20" fill="#000" opacity=".18"/>
<path d="M190 90l-130 60 44 86 66-26v280h240V210l66 26 44-86-130-60c-16 30-44 44-100 44s-84-14-100-44z" fill="#17161f" stroke="#000" stroke-width="5" stroke-linejoin="round"/>
<path d="M190 90c16 30 44 44 100 44s84-14 100-44c-18 44-52 64-100 64s-82-20-100-64z" fill="#2a2936"/>
<path d="${shield(290, 290, 150, 176)}" fill="none" stroke="#9cfb59" stroke-width="8" stroke-linejoin="round"/>${bolt(290, 288, 1.250, '#9cfb59')}${t(290, 420, 'VOLTEX', 34, { a: 'middle', w: 900, ls: 6, fill: '#9cfb59' })}
<g transform="translate(560 100) scale(.620)"><path d="M100 60l-110 60 30 220 60-10v130h240V330l60 10 30-220-110-60c-10 40-40 60-100 60s-90-20-100-60z" fill="#f4f4f8" stroke="#2a2936" stroke-width="7" stroke-linejoin="round"/><path d="M100 60c-10 60 30 110 100 110s110-50 100-110c-10 40-40 60-100 60s-90-20-100-60z" fill="#d9d9e2" stroke="#2a2936" stroke-width="7" stroke-linejoin="round"/><path d="M130 330h140v70H130z" fill="none" stroke="#2a2936" stroke-width="6"/></g>
<path transform="translate(650 240)" d="${shield(0, 0, 44, 52)}" fill="#12101f"/>${bolt(650, 239, 0.360, '#9cfb59')}
${t(630, 440, 'Front print · few colours', 15, { a: 'middle', w: 600, fill: '#4a4860' })}`,
    lg('mg', ['#eceaf4', '#cfcbe0'], 'd'),
  ),
};

