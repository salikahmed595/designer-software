// Shared drawing parts for the thumbnail illustrations. Everything is original vector art, 800 x 550.

const BASE = `
<filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="b2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="b6" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="b14" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="b30" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="30"/></filter>
<filter id="ds" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000" flood-opacity=".5"/></filter>
<pattern id="chk" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#1d1f29"/><rect width="20" height="20" fill="#272a37"/><rect x="20" y="20" width="20" height="20" fill="#272a37"/></pattern>
<pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="2.600"/></pattern>
<linearGradient id="neon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b06bff"/><stop offset="1" stop-color="#4fe3ff"/></linearGradient>
<linearGradient id="pk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b06bff"/><stop offset="1" stop-color="#ff5fa8"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".5" stop-color="#ffc93c"/><stop offset="1" stop-color="#b8761a"/></linearGradient>
<linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c3ccd8"/><stop offset="1" stop-color="#6f7a8c"/></linearGradient>
<linearGradient id="bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd0a0"/><stop offset=".5" stop-color="#d0854a"/><stop offset="1" stop-color="#7a4520"/></linearGradient>
<linearGradient id="panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17132b" stop-opacity=".93"/><stop offset="1" stop-color="#0c0a18" stop-opacity=".96"/></linearGradient>`;

export const wrap = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 550" font-family="Segoe UI, Arial, sans-serif">\n<defs>${BASE}${defs}</defs>\n${body}\n</svg>\n`;

export const lg = (id, colors, dir = 'v') => {
  const [x2, y2] = dir === 'h' ? [1, 0] : dir === 'd' ? [1, 1] : [0, 1];
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${colors.map((c, i) => `<stop offset="${(i / (colors.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
};
export const rg = (id, inner, outer, o = 0, cx = 0.5, cy = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".6"><stop offset="0" stop-color="${inner}"/><stop offset="1" stop-color="${outer}" stop-opacity="${o}"/></radialGradient>`;

/** Text. o: fill, w (weight), a (anchor), ls (letter spacing), o (opacity), x (extra attributes). */
export const t = (x, y, s, size, o = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${o.w ?? 800}" fill="${o.fill ?? '#fff'}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.o ? ` opacity="${o.o}"` : ''}${o.x ? ` ${o.x}` : ''}>${s}</text>`;

export const rr = (x, y, w, h, r, attrs) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${attrs}/>`;
export const fullBg = (fill) => `<rect width="800" height="550" fill="${fill}"/>`;
export const g = (transform, body, attrs = '') => `<g transform="${transform}" ${attrs}>${body}</g>`;
export const sparkle = (x, y, r, fill = '#fff', o = 1) =>
  `<path d="M${x} ${y - r}l${r * 0.28} ${r * 0.72} ${r * 0.72} ${r * 0.28}-${r * 0.72} ${r * 0.28}-${r * 0.28} ${r * 0.72}-${r * 0.28}-${r * 0.72}-${r * 0.72}-${r * 0.28} ${r * 0.72}-${r * 0.28}z" fill="${fill}" opacity="${o}"/>`;

const rnd = (seed) => {
  let x = seed;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
};
export const stars = (n, seed = 7, w = 800, h = 300, o = 0.8) => {
  const r = rnd(seed);
  let out = '';
  for (let i = 0; i < n; i++) out += `<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" r="${(0.6 + r() * 1.4).toFixed(1)}"/>`;
  return `<g fill="#fff" opacity="${o}">${out}</g>`;
};
export const confetti = (n, seed, x0, y0, w, h) => {
  const r = rnd(seed);
  const cols = ['#b06bff', '#4fe3ff', '#ff5fa8', '#ffd27a', '#9cfb59'];
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * h;
    out += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(5 + r() * 7).toFixed(0)}" height="${(3 + r() * 4).toFixed(0)}" rx="1" fill="${cols[i % 5]}" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
  }
  return out;
};
export const panel = (x, y, w, h, stroke = '#b06bff', r = 12) => rr(x, y, w, h, r, `fill="url(#panel)" stroke="${stroke}" stroke-opacity=".6" stroke-width="1.5"`);
export const heart = (cx, cy, s, fill) =>
  `<path transform="translate(${cx} ${cy}) scale(${s})" d="M0 9C-14-2-11-13-4-13c3 0 4 2 4 4 0-2 1-4 4-4 7 0 10 11-4 22z" fill="${fill}"/>`;
export const star5 = (cx, cy, r, fill, extra = '') => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, rad = i % 2 ? r * 0.44 : r;
    d += `${i ? 'L' : 'M'}${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`;
  }
  return `<path d="${d}z" fill="${fill}" ${extra}/>`;
};
export const shield = (cx, cy, w, h) =>
  `M${cx} ${cy - h / 2}l${w / 2} ${h * 0.14}v${h * 0.34}c0 ${h * 0.3}-${w * 0.22} ${h * 0.44}-${w / 2} ${h * 0.52}c-${w * 0.28}-${h * 0.08}-${w / 2}-${h * 0.22}-${w / 2}-${h * 0.52}v-${h * 0.34}z`;
export const bolt = (cx, cy, s, fill, extra = '') =>
  `<path transform="translate(${cx} ${cy}) scale(${s})" d="M10-50L-30 8h22l-10 42 40-56H0z" fill="${fill}" ${extra}/>`;

/* ---------- full-canvas scenes ---------- */

export function scene(kind) {
  if (kind === 'sunset') {
    return {
      defs: lg('sky', ['#140b33', '#4a1f6e', '#e2557a', '#ffb36b']) + rg('sun', '#fff6d6', '#ff8a5c', 0),
      body: `${fullBg('url(#sky)')}${stars(26, 3, 800, 200)}<circle cx="470" cy="330" r="160" fill="url(#sun)"/><circle cx="470" cy="330" r="46" fill="#fff3cf"/>
<path d="M0 360l70-70 60 40 80-90 70 70 60-40 90 80 80-60 70 50 90-90 60 60 70-40v280H0z" fill="#3b2468"/>
<path d="M0 410l90-60 70 40 60-50 90 60 70-30 100 60 90-70 110 60 120-50v180H0z" fill="#27174c"/>
<path d="M0 470l120-50 90 26 120-44 130 40 110-36 230 60v84H0z" fill="#140c2c"/>`,
    };
  }
  if (kind === 'night') {
    return {
      defs: lg('sky', ['#070b1f', '#14224a', '#2a3f78']) + rg('moon', '#eaf2ff', '#9fc0ff', 0),
      body: `${fullBg('url(#sky)')}${stars(60, 11, 800, 330)}<circle cx="610" cy="140" r="120" fill="url(#moon)" opacity=".5"/><circle cx="610" cy="140" r="52" fill="#f1f6ff"/><circle cx="594" cy="128" r="10" fill="#d5e2f6"/><circle cx="626" cy="158" r="7" fill="#d5e2f6"/>
<path d="M0 420l110-70 90 50 110-80 120 70 100-50 130 60 140-70v220H0z" fill="#111c3f"/>
<path d="M0 470l150-40 120 30 150-50 160 44 220-40v136H0z" fill="#0a1230"/>
<g fill="#060b20"><path d="M70 470l18-60 18 60zM110 480l14-46 14 46zM690 462l20-66 20 66zM640 474l14-46 14 46z"/></g>`,
    };
  }
  if (kind === 'cyber') {
    let grid = '';
    for (let i = -8; i <= 8; i++) grid += `<path d="M${400 + i * 22} 360L${400 + i * 130} 550"/>`;
    for (let j = 0; j < 7; j++) grid += `<path d="M0 ${360 + j * j * 5 + j * 6}h800"/>`;
    return {
      defs: lg('sky', ['#0a0420', '#2a0a52', '#7a1f8f']) + lg('sunc', ['#ffe66b', '#ff5fa8']),
      body: `${fullBg('url(#sky)')}${stars(40, 5, 800, 240)}<circle cx="400" cy="300" r="120" fill="url(#sunc)"/>
<g fill="#2a0a52"><rect x="270" y="296" width="260" height="8"/><rect x="270" y="318" width="260" height="10"/><rect x="270" y="340" width="260" height="14"/></g>
<g fill="#12062e"><rect x="40" y="250" width="60" height="110"/><rect x="110" y="210" width="46" height="150"/><rect x="170" y="270" width="70" height="90"/><rect x="560" y="230" width="56" height="130"/><rect x="630" y="270" width="80" height="90"/><rect x="720" y="220" width="50" height="140"/></g>
<g fill="#4fe3ff" opacity=".8"><rect x="50" y="262" width="6" height="6"/><rect x="66" y="282" width="6" height="6"/><rect x="120" y="226" width="6" height="6"/><rect x="136" y="256" width="6" height="6"/><rect x="186" y="286" width="6" height="6"/><rect x="572" y="246" width="6" height="6"/><rect x="590" y="276" width="6" height="6"/><rect x="646" y="286" width="6" height="6"/><rect x="734" y="240" width="6" height="6"/><rect x="750" y="280" width="6" height="6"/></g>
<rect y="360" width="800" height="190" fill="#0a0420"/><g stroke="#ff5fa8" stroke-width="1.5" opacity=".75" fill="none">${grid}</g>`,
    };
  }
  if (kind === 'space') {
    return {
      defs: rg('sp', '#2a1a5e', '#06040f', 1, 0.4, 0.4),
      body: `${fullBg('url(#sp)')}<g filter="url(#b30)"><circle cx="180" cy="160" r="90" fill="#b06bff" opacity=".35"/><circle cx="640" cy="400" r="110" fill="#4fe3ff" opacity=".22"/><circle cx="560" cy="120" r="70" fill="#ff5fa8" opacity=".22"/></g>${stars(90, 21, 800, 550, 0.9)}`,
    };
  }
  // arena: dark stage with spotlights
  return {
    defs: lg('sky', ['#0b0716', '#1d1238', '#0b0716']),
    body: `${fullBg('url(#sky)')}<g filter="url(#b14)" opacity=".45"><path d="M140 0l-120 550h200z" fill="#b06bff"/><path d="M660 0l-120 550h240z" fill="#4fe3ff"/><path d="M400 0l-90 550h180z" fill="#ff5fa8" opacity=".6"/></g>${stars(50, 9, 800, 550, 0.35)}`,
  };
}

/* ---------- the studio's sample character (head and shoulders, centred on 400) ---------- */

const eyePair = (draw) => draw(356, 1) + draw(444, -1);

export function character(o = {}) {
  const p = {
    x: 0, y: 0, s: 1, id: 'c',
    hair: '#ff8fd0', hairD: '#c9479a', hairL: '#a23580', skin: '#ffe6d6', skinS: '#f6bfa8', neckS: '#f2ae96',
    top: '#2c3170', topD: '#1f2355', topL: '#3a4090', ol: '#4a1746', ow: 5,
    iris: ['#3b1a78', '#8a3fd6', '#ff9ad8'], accent: '#5ff0ff', hs: '#15172c', hsL: '#4a4f80', white: '#ffffff', lip: '#b8324f', blushC: '#ff8fa8',
    eyes: 'anime', mouth: 'open', hairStyle: 'long', headset: true, blush: true, shine: true, strings: true, shade: true,
    ...o,
  };
  const st = p.ow ? `stroke="${p.ol}" stroke-width="${p.ow}" stroke-linejoin="round"` : '';
  const ln = (w = p.ow || 4) => `fill="none" stroke="${p.ol}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const irisId = `${p.id}iris`, faceId = `${p.id}face`;
  const facePath = 'M308 232c0-84 40-118 92-118s92 34 92 118c0 72-38 124-92 136-54-12-92-64-92-136z';

  const back = {
    long: `<path d="M270 300c-22-150 40-212 130-212s152 62 130 212c8 70-6 130-36 170H306c-30-40-44-100-36-170z" fill="${p.hairD}" ${st}/><path d="M296 330c-10 50-4 100 14 140M504 330c10 50 4 100-14 140M330 360c-4 40 0 80 10 110M470 360c4 40 0 80-10 110" fill="none" stroke="${p.hairL}" stroke-width="5" stroke-linecap="round"/>`,
    short: `<path d="M284 290c-18-136 38-204 116-204s134 68 116 204c2 34-4 58-14 76H298c-10-18-16-42-14-76z" fill="${p.hairD}" ${st}/>`,
    bun: `<circle cx="308" cy="118" r="40" fill="${p.hair}" ${st}/><circle cx="492" cy="118" r="40" fill="${p.hair}" ${st}/><path d="M284 290c-18-136 38-204 116-204s134 68 116 204c2 34-4 58-14 76H298c-10-18-16-42-14-76z" fill="${p.hairD}" ${st}/>`,
  }[p.hairStyle];

  const animeEye = (cx, dir) => `<ellipse cx="${cx}" cy="254" rx="27" ry="30" fill="${p.white}"/><ellipse cx="${cx + 2 * dir}" cy="258" rx="20" ry="26" fill="url(#${irisId})"/><ellipse cx="${cx + 2 * dir}" cy="260" rx="9" ry="13" fill="#1b0b33"/><ellipse cx="${cx - 6}" cy="244" rx="8" ry="10" fill="#fff"/><circle cx="${cx + 11}" cy="272" r="4.500" fill="#fff" opacity=".9"/><path d="M${cx - 30 * dir} 244c${8 * dir}-22 ${46 * dir}-28 ${62 * dir}-6" ${ln(8)}/><path d="M${cx - 30 * dir} 244l${-10 * dir}-6M${cx - 25 * dir} 236l${-7 * dir}-10" ${ln(5)}/><path d="M${cx - 20} 284c12 6 28 6 40 0" ${ln(3)}/>`;
  const eyes = {
    anime: eyePair(animeEye),
    wink: animeEye(356, 1) + `<path d="M420 258q24-22 48 0" ${ln(7)}/>`,
    half: eyePair(animeEye) + `<rect x="324" y="220" width="152" height="30" fill="${p.skin}"/><path d="M328 250h56M416 250h56" ${ln(7)}/>`,
    dot: eyePair((cx) => `<ellipse cx="${cx}" cy="256" rx="12" ry="17" fill="${p.ol}"/><circle cx="${cx - 4}" cy="249" r="4.500" fill="#fff"/>`),
    closed: eyePair((cx) => `<path d="M${cx - 24} 260q24-24 48 0" ${ln(7)}/>`),
    wide: eyePair((cx) => `<ellipse cx="${cx}" cy="254" rx="28" ry="32" fill="${p.white}" ${p.ow ? `stroke="${p.ol}" stroke-width="4"` : ''}/><circle cx="${cx}" cy="256" r="11" fill="url(#${irisId})"/><circle cx="${cx}" cy="256" r="5" fill="#1b0b33"/><circle cx="${cx - 4}" cy="251" r="3" fill="#fff"/>`),
    heart: eyePair((cx) => `<path transform="translate(${cx} 252) scale(2.300)" d="M0 9C-14-2-11-13-4-13c3 0 4 2 4 4 0-2 1-4 4-4 7 0 10 11-4 22z" fill="#ff4f86" ${p.ow ? `stroke="${p.ol}" stroke-width="1.5"` : ''}/>`),
  }[p.eyes];
  const brows = {
    angry: `<path d="M326 200l54 22M474 200l-54 22" ${ln(8)}/>`,
    sad: `<path d="M328 222l50-16M472 222l-50-16" ${ln(6)}/>`,
    up: `<path d="M330 198c14-12 34-14 50-8M470 198c-14-12-34-14-50-8" ${ln(5)}/>`,
    none: '',
  }[p.brows ?? ''] ?? `<path d="M330 212c14-10 34-12 50-6M470 212c-14-10-34-12-50-6" fill="none" stroke="${p.hairL}" stroke-width="5" stroke-linecap="round"/>`;
  const mouth = {
    open: `<path d="M378 326c8 16 36 16 44 0z" fill="${p.lip}" ${p.ow ? `stroke="${p.ol}" stroke-width="4" stroke-linejoin="round"` : ''}/><path d="M388 338c8 4 16 4 24 0" stroke="#ff9db0" stroke-width="5" stroke-linecap="round"/>`,
    smile: `<path d="M380 328q20 16 40 0" ${ln(5)}/>`,
    flat: `<path d="M384 332h32" ${ln(5)}/>`,
    o: `<ellipse cx="400" cy="334" rx="10" ry="14" fill="#7a1f3a" ${p.ow ? `stroke="${p.ol}" stroke-width="4"` : ''}/>`,
    frown: `<path d="M382 340q18-16 36 0" ${ln(5)}/>`,
    smug: `<path d="M382 330q16 12 34-6" ${ln(5)}/>`,
    grin: `<path d="M370 320q30 38 60 0z" fill="#fff" ${p.ow ? `stroke="${p.ol}" stroke-width="4" stroke-linejoin="round"` : ''}/><path d="M374 328h52" ${ln(2.5)}/>`,
    shout: `<path d="M372 318h56l-8 30q-20 14-40 0z" fill="#7a1f3a" ${p.ow ? `stroke="${p.ol}" stroke-width="4" stroke-linejoin="round"` : ''}/><path d="M378 320h44v7h-44z" fill="#fff"/>`,
  }[p.mouth];

  return `<g transform="translate(${p.x} ${p.y}) scale(${p.s})">
<defs><linearGradient id="${irisId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.iris[0]}"/><stop offset=".55" stop-color="${p.iris[1]}"/><stop offset="1" stop-color="${p.iris[2]}"/></linearGradient><clipPath id="${faceId}"><path d="${facePath}"/></clipPath></defs>
${back}
<path d="M176 550c8-78 74-124 170-140h108c96 16 162 62 170 140z" fill="${p.top}" ${st}/>
${p.shade ? `<path d="M176 550c8-58 50-96 110-118-30 40-44 80-48 118zM624 550c-8-58-50-96-110-118 30 40 44 80 48 118z" fill="${p.topD}"/>` : ''}
<path d="M330 414c14 40 44 62 70 66 26-4 56-26 70-66" fill="${p.topL}" ${st}/>
${p.strings ? `<path d="M372 470v56M428 470v56" stroke="#eef0ff" stroke-width="5" stroke-linecap="round"/><circle cx="372" cy="530" r="6" fill="#eef0ff"/><circle cx="428" cy="530" r="6" fill="#eef0ff"/>` : ''}
<path d="M368 340h64v70c-16 22-48 22-64 0z" fill="${p.skin}" ${p.ow ? `stroke="${p.ol}" stroke-width="${Math.max(2, p.ow - 1)}" stroke-linejoin="round"` : ''}/>
${p.shade ? `<path d="M368 352c18 18 46 18 64 0v22c-18 14-46 14-64 0z" fill="${p.neckS}"/>` : ''}
<path d="${facePath}" fill="${p.skin}" ${st}/>
${p.shade ? `<g clip-path="url(#${faceId})"><path d="M300 110h200v104c-34-14-60-20-100-20s-66 6-100 20z" fill="${p.skinS}"/><path d="M300 250c8 50 30 86 56 104-34-6-56-40-64-80z" fill="${p.skinS}" opacity=".7"/></g>` : ''}
${p.blush ? `<ellipse cx="340" cy="296" rx="24" ry="13" fill="${p.blushC}" opacity=".45"/><ellipse cx="460" cy="296" rx="24" ry="13" fill="${p.blushC}" opacity=".45"/>` : ''}
${eyes}${brows}
<path d="M398 296l-5 10h8" fill="none" stroke="${p.ow ? '#d98a78' : p.skinS}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
${mouth}
<path d="M296 250c-12-104 38-166 104-166s116 62 104 166c-10-34-24-58-44-72 4 26-2 50-14 68-6-30-18-52-36-66-4 32-18 58-42 76 2-26-4-50-18-68-10 28-28 50-54 62z" fill="${p.hair}" ${st}/>
<path d="M296 250c-6 44-2 84 12 116-18-22-28-62-26-104zM504 250c6 44 2 84-12 116 18-22 28-62 26-104z" fill="${p.hair}" ${st}/>
${p.shine ? `<path d="M330 150c40-30 100-30 140 0" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="12" stroke-linecap="round" stroke-dasharray="46 14 70 14 30 200"/>` : ''}
${p.headset ? `<path d="M286 240c-6-150 234-150 228 0" fill="none" stroke="${p.hs}" stroke-width="20" stroke-linecap="round"/><path d="M300 200c18-96 182-96 200 0" fill="none" stroke="${p.hsL}" stroke-width="5" stroke-linecap="round"/>
<rect x="262" y="214" width="40" height="84" rx="18" fill="${p.hs}" stroke="${p.ow ? '#0c0d1c' : 'none'}" stroke-width="5"/><rect x="498" y="214" width="40" height="84" rx="18" fill="${p.hs}" stroke="${p.ow ? '#0c0d1c' : 'none'}" stroke-width="5"/>
<rect x="272" y="230" width="8" height="52" rx="4" fill="${p.accent}"/><rect x="520" y="230" width="8" height="52" rx="4" fill="${p.accent}"/>
<path d="M282 296c4 44 40 62 86 52" fill="none" stroke="${p.hs}" stroke-width="8" stroke-linecap="round"/><ellipse cx="372" cy="346" rx="12" ry="8" fill="${p.hs}"/>` : ''}
</g>`;
}

/* ---------- chibi head (emotes, stickers, small avatars). Drawn in a 200-unit box around 0,0. ---------- */

export function emote(cx, cy, r, o = {}) {
  const p = { skin: '#ffe6d6', hair: '#ff8fd0', hairD: '#c9479a', ol: '#3a1238', ow: 7, mood: 'happy', ...o };
  const st = `stroke="${p.ol}" stroke-width="${p.ow}" stroke-linejoin="round"`;
  const ln = (w = p.ow) => `fill="none" stroke="${p.ol}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const openEye = (x) => `<ellipse cx="${x}" cy="24" rx="15" ry="20" fill="${p.ol}"/><ellipse cx="${x - 4}" cy="15" rx="6" ry="8" fill="#fff"/><circle cx="${x + 6}" cy="34" r="3" fill="#fff"/>`;
  const arc = (x) => `<path d="M${x - 18} 30q18-22 36 0" ${ln()}/>`;
  const face = {
    happy: arc(-36) + arc(36) + `<path d="M-22 52q22 30 44 0z" fill="#b8324f" ${st}/>`,
    lol: `<path d="M-54 14l30 12-30 12M54 14l-30 12 30 12" ${ln()}/><path d="M-30 46q30 42 60 0z" fill="#b8324f" ${st}/><path d="M-20 50h40v8h-40z" fill="#fff"/><path d="M-66 44q-10 18 0 26 10-8 0-26zM66 44q-10 18 0 26 10-8 0-26z" fill="#6fd3ff" stroke="${p.ol}" stroke-width="4"/>`,
    love: `<path transform="translate(-36 26) scale(2.200)" d="M0 9C-14-2-11-13-4-13c3 0 4 2 4 4 0-2 1-4 4-4 7 0 10 11-4 22z" fill="#ff4f86" stroke="${p.ol}" stroke-width="2"/><path transform="translate(36 26) scale(2.200)" d="M0 9C-14-2-11-13-4-13c3 0 4 2 4 4 0-2 1-4 4-4 7 0 10 11-4 22z" fill="#ff4f86" stroke="${p.ol}" stroke-width="2"/><path d="M-16 56q16 20 32 0z" fill="#b8324f" ${st}/>`,
    rage: openEye(-36) + openEye(36) + `<path d="M-62-2l44 18M62-2l-44 18" ${ln(9)}/><path d="M-28 50h56l-8 24q-20 12-40 0z" fill="#7a1f3a" ${st}/><path d="M-22 52h44v7h-44z" fill="#fff"/><path d="M52-52l10 10M72-52l-10 10M52-28l10-10M72-28l-10-10" stroke="#ff3b5c" stroke-width="7" stroke-linecap="round"/>`,
    sad: openEye(-36) + openEye(36) + `<path d="M-58 2l40-12M58 2l-40-12" ${ln(6)}/><path d="M-18 66q18-18 36 0" ${ln()}/><path d="M-44 46q-9 18 0 26 9-8 0-26z" fill="#6fd3ff" stroke="${p.ol}" stroke-width="4"/>`,
    wow: `<circle cx="-36" cy="22" r="20" fill="#fff" ${st}/><circle cx="36" cy="22" r="20" fill="#fff" ${st}/><circle cx="-36" cy="24" r="7" fill="${p.ol}"/><circle cx="36" cy="24" r="7" fill="${p.ol}"/><ellipse cx="0" cy="62" rx="12" ry="16" fill="#7a1f3a" ${st}/>`,
    smug: `<path d="M-56 22h40M16 22h40" ${ln(8)}/><ellipse cx="-34" cy="30" rx="10" ry="8" fill="${p.ol}"/><ellipse cx="38" cy="30" rx="10" ry="8" fill="${p.ol}"/><path d="M-18 58q16 12 36-8" ${ln()}/>`,
    wink: openEye(-36) + arc(36) + `<path d="M-22 52q22 30 44 0z" fill="#fff" ${st}/><path d="M-18 60h36" ${ln(3)}/>`,
    sleepy: `<path d="M-54 28h36M18 28h36" ${ln()}/><ellipse cx="0" cy="58" rx="8" ry="10" fill="#7a1f3a" ${st}/>`,
  }[p.mood] ?? ''; // mood "none" = no face (back view)
  const blush = p.mood === 'rage' || p.mood === 'none' ? '' : `<ellipse cx="-58" cy="50" rx="14" ry="8" fill="#ff8fa8" opacity=".55"/><ellipse cx="58" cy="50" rx="14" ry="8" fill="#ff8fa8" opacity=".55"/>`;
  return `<g transform="translate(${cx} ${cy}) scale(${r / 100})">
<path d="M-104 10c-10-80 40-128 104-128s114 48 104 128c0 46-10 76-28 96h-152c-18-20-28-50-28-96z" fill="${p.hairD}" ${st}/>
<ellipse cx="0" cy="12" rx="86" ry="82" fill="${p.mood === 'rage' ? '#ffc4b0' : p.skin}" ${st}/>
${blush}${face}
<path d="M-92 8c-8-72 36-116 92-116s100 44 92 116c-12-32-28-50-50-60 2 22-6 40-20 52-4-24-16-40-34-50-6 26-22 46-46 58 2-20-2-36-12-50-8 22-18 38-22 50z" fill="${p.hair}" ${st}/>
<path d="M-40-96c20-14 60-14 80 0" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="9" stroke-linecap="round" stroke-dasharray="26 10 40 60"/>
${o.headset ? `<path d="M-98 10c-4-112 200-112 196 0" fill="none" stroke="#15172c" stroke-width="14" stroke-linecap="round"/><rect x="-114" y="-6" width="28" height="56" rx="13" fill="#1d2040" stroke="#0c0d1c" stroke-width="5"/><rect x="86" y="-6" width="28" height="56" rx="13" fill="#1d2040" stroke="#0c0d1c" stroke-width="5"/><rect x="-106" y="8" width="6" height="28" rx="3" fill="#5ff0ff"/>` : ''}
</g>`;
}

/** Full-body chibi: the emote head on a small body. */
export function chibi(cx, cy, s, o = {}) {
  const p = { top: '#2c3170', topL: '#3a4090', bottom: '#1b1d3a', shoe: '#ff5fa8', ol: '#3a1238', wave: true, ...o };
  const st = `stroke="${p.ol}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`;
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
<ellipse cx="0" cy="252" rx="86" ry="12" fill="#000" opacity=".3"/>
<rect x="-40" y="176" width="32" height="60" rx="14" fill="${p.bottom}" ${st}/><rect x="8" y="176" width="32" height="60" rx="14" fill="${p.bottom}" ${st}/>
<ellipse cx="-28" cy="240" rx="26" ry="14" fill="${p.shoe}" ${st}/><ellipse cx="28" cy="240" rx="26" ry="14" fill="${p.shoe}" ${st}/>
<path d="M-52 196q-6-70 52-78 58 8 52 78q-52 18-104 0z" fill="${p.top}" ${st}/>
<path d="M-22 122q22 30 44 0" fill="${p.topL}" ${st}/>
<path d="M-50 134q-34 22-30 60" fill="none" stroke="${p.ol}" stroke-width="30" stroke-linecap="round"/><path d="M-50 134q-34 22-30 60" fill="none" stroke="${p.top}" stroke-width="17" stroke-linecap="round"/><circle cx="-80" cy="198" r="13" fill="${o.skin ?? '#ffe6d6'}" ${st}/>
${p.wave ? `<path d="M50 134q40-10 46-56" fill="none" stroke="${p.ol}" stroke-width="30" stroke-linecap="round"/><path d="M50 134q40-10 46-56" fill="none" stroke="${p.top}" stroke-width="17" stroke-linecap="round"/><circle cx="97" cy="72" r="13" fill="${o.skin ?? '#ffe6d6'}" ${st}/>` : `<path d="M50 134q34 22 30 60" fill="none" stroke="${p.ol}" stroke-width="30" stroke-linecap="round"/><path d="M50 134q34 22 30 60" fill="none" stroke="${p.top}" stroke-width="17" stroke-linecap="round"/><circle cx="80" cy="198" r="13" fill="${o.skin ?? '#ffe6d6'}" ${st}/>`}
${emote(0, 0, 112, o)}
</g>`;
}

/* ---------- mascot: an angular wolf head, drawn in a 200-unit box around 0,0 ---------- */

export function wolf(cx, cy, s, o = {}) {
  const p = { main: '#7c5cff', dark: '#3a2a8a', light: '#e8e4ff', eye: '#5ff0ff', ol: '#12101f', ow: 7, ...o };
  const st = p.ow ? `stroke="${p.ol}" stroke-width="${p.ow}" stroke-linejoin="round"` : '';
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
<path d="M-72-44l-22-84 62 50zM72-44l22-84-62 50z" fill="${p.main}" ${st}/><path d="M-70-58l-12-46 34 28zM70-58l12-46-34 28z" fill="${p.dark}"/>
<path d="M-82-52l52-30 30 10 30-10 52 30 18 62-38 32-20 50-42 22-42-22-20-50-38-32z" fill="${p.main}" ${st}/>
<path d="M-100 10l-22 26 38 6zM100 10l22 26-38 6z" fill="${p.main}" ${st}/>
<path d="M-52-20l52-22 52 22-10 62-22 46-20 10-20-10-22-46z" fill="${p.light}"/>
<path d="M-66-22l52 16-4 8-46-10zM66-22l-52 16 4 8 46-10z" fill="${p.ol}"/>
<path d="M-58-8l40 12-8 14-28-8zM58-8l-40 12 8 14 28-8z" fill="${p.eye}"/>
<path d="M-16 62h32l-16 18z" fill="${p.ol}"/><path d="M-34 84l34 18 34-18" fill="none" stroke="${p.ol}" stroke-width="${p.ow || 5}" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M-22 92l6 14 8-10zM22 92l-6 14-8-10z" fill="#fff" stroke="${p.ol}" stroke-width="3" stroke-linejoin="round"/>
<path d="M0-40v44" stroke="${p.dark}" stroke-width="5" stroke-linecap="round" opacity=".5"/>
</g>`;
}
