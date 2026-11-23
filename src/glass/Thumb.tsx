import { useId, type ReactNode } from 'react';
import { CATEGORIES, getCategory, getTemplate } from '../state/catalog';

/**
 * One original, hand-drawn SVG thumbnail per artwork type, so a designer can recognise
 * the deliverable at a glance. These are schematic previews — not generated or produced artwork.
 * `a` = main colour, `b` = secondary colour (defaults come from the category, or from the brief).
 */
type Draw = (a: string, b: string) => ReactNode;
type Mood = 'smile' | 'open' | 'wow' | 'sad' | 'angry' | 'heart';

const D = '#12141b';
const st = (c: string, w = 2.5) => ({ fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });
const tx = (size: number, fill = '#ffffff') => ({ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', fontWeight: 800, fontSize: size, textAnchor: 'middle' as const, fill });

const bust = (cx: number, cy: number, a: string, b: string, s = 1) => (
  <g transform={`translate(${cx} ${cy}) scale(${s})`}>
    <path d="M-24 30c0-16 10-22 24-22s24 6 24 22z" fill={a} />
    <circle cx="0" cy="-6" r="13" fill={b} />
  </g>
);

const face = (cx: number, cy: number, r: number, mood: Mood, fill: string) => {
  const ex = r * 0.36;
  const ey = cy - r * 0.12;
  const e = Math.max(1.4, r * 0.11);
  const w = Math.max(1.5, r * 0.1);
  const m = cy + r * 0.38;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      {mood === 'heart' ? (
        <>
          <text x={cx - ex} y={ey + r * 0.2} {...tx(r * 0.55, '#ff4f86')}>♥</text>
          <text x={cx + ex} y={ey + r * 0.2} {...tx(r * 0.55, '#ff4f86')}>♥</text>
        </>
      ) : (
        <>
          <circle cx={cx - ex} cy={ey} r={e} fill={D} />
          <circle cx={cx + ex} cy={ey} r={e} fill={D} />
        </>
      )}
      {mood === 'angry' && <path d={`M${cx - ex - e * 2} ${ey - e * 3}l${e * 4} ${e * 1.6}M${cx + ex + e * 2} ${ey - e * 3}l${-e * 4} ${e * 1.6}`} {...st(D, w)} />}
      {mood === 'open' && <ellipse cx={cx} cy={m} rx={r * 0.2} ry={r * 0.26} fill={D} />}
      {mood === 'wow' && <circle cx={cx} cy={m} r={r * 0.15} fill={D} />}
      {(mood === 'sad' || mood === 'angry') && <path d={`M${cx - r * 0.3} ${m + r * 0.12}q${r * 0.3} ${-r * 0.3} ${r * 0.6} 0`} {...st(D, w)} />}
      {(mood === 'smile' || mood === 'heart') && <path d={`M${cx - r * 0.32} ${m - r * 0.08}q${r * 0.32} ${r * 0.36} ${r * 0.64} 0`} {...st(D, w)} />}
    </g>
  );
};

const shield = (cx: number, fill: string) => (
  <g>
    <path d={`M${cx} 28l18 6v17c0 12-8 20-18 26-10-6-18-14-18-26V34z`} fill={fill} />
    <path d={`M${cx - 8} 52l8-7 8 7M${cx - 8} 61l8-7 8 7`} {...st(D, 2.5)} />
  </g>
);

const figure = (cx: number, a: string, b: string, back = false) => (
  <g>
    <circle cx={cx} cy="32" r="8" fill={back ? a : b} />
    <rect x={cx - 9} y="43" width="18" height="26" rx="6" fill={a} />
    <rect x={cx - 8} y="70" width="6" height="16" rx="3" fill={b} opacity=".8" />
    <rect x={cx + 2} y="70" width="6" height="16" rx="3" fill={b} opacity=".8" />
  </g>
);

const ART: Record<string, Draw> = {
  /* ---------- Streaming ---------- */
  'stream-overlay': (a, b) => (
    <>
      <rect x="14" y="14" width="132" height="82" rx="6" {...st(a)} />
      <rect x="14" y="14" width="132" height="12" rx="6" fill={a} opacity=".35" />
      <circle cx="23" cy="20" r="2.5" fill="#ff6b8a" />
      <rect x="20" y="62" width="38" height="28" rx="4" {...st(b, 2)} />
      <rect x="112" y="32" width="28" height="58" rx="4" fill={a} opacity=".22" />
      <path d="M117 42h18M117 52h13M117 62h18M117 72h10M117 82h15" {...st(b, 2)} />
    </>
  ),
  'starting-soon': (a, b) => (
    <>
      <circle cx="80" cy="55" r="42" {...st(a, 3)} strokeDasharray="70 194" opacity=".8" />
      <text x="80" y="52" {...tx(15)}>STARTING</text>
      <text x="80" y="70" {...tx(15, a)}>SOON</text>
      <circle cx="70" cy="84" r="2.5" fill={b} /><circle cx="80" cy="84" r="2.5" fill={b} opacity=".7" /><circle cx="90" cy="84" r="2.5" fill={b} opacity=".4" />
    </>
  ),
  'webcam-frame': (a, b) => (
    <>
      <rect x="34" y="14" width="92" height="68" rx="10" {...st(a, 4)} />
      {bust(80, 50, a, b, 0.9)}
      <path d="M26 30V18a10 10 0 0 1 10-10h14M134 66v12a10 10 0 0 1-10 10h-14" {...st(b, 3)} />
      <rect x="48" y="78" width="64" height="16" rx="8" fill={a} />
      <rect x="60" y="84" width="40" height="4" rx="2" fill={D} opacity=".55" />
    </>
  ),
  'brb-screen': (a, b) => (
    <>
      <text x="80" y="66" {...tx(40, a)}>BRB</text>
      <path d="M60 78h40" {...st(b, 3)} />
      <text x="80" y="94" {...tx(8, '#ffffff')} opacity=".75">BE RIGHT BACK</text>
      <rect x="22" y="22" width="5" height="16" rx="2" fill={b} /><rect x="31" y="22" width="5" height="16" rx="2" fill={b} />
    </>
  ),
  'stream-alert': (a, b) => (
    <>
      <rect x="18" y="36" width="124" height="38" rx="19" fill={a} opacity=".22" />
      <rect x="18" y="36" width="124" height="38" rx="19" {...st(a, 2)} />
      <circle cx="40" cy="55" r="13" fill={a} />
      <text x="40" y="60" {...tx(14)}>♥</text>
      <text x="96" y="52" {...tx(9)}>NEW FOLLOWER</text>
      <text x="96" y="65" {...tx(8, b)}>NightWolf</text>
      <path d="M128 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM26 82l1.5 3.5L31 87l-3.5 1.5L26 92l-1.5-3.5L21 87l3.5-1.5z" fill={b} />
    </>
  ),
  'stream-panels': (a, b) => (
    <>
      {[14, 60, 106].map((x, i) => (
        <g key={x}>
          <rect x={x} y="26" width="40" height="58" rx="6" {...st(a, 2)} />
          <rect x={x} y="26" width="40" height="15" rx="6" fill={a} opacity=".4" />
          <text x={x + 20} y="37" {...tx(7)}>{['ABOUT', 'RULES', 'LINKS'][i]}</text>
          <path d={`M${x + 7} 52h26M${x + 7} 61h20M${x + 7} 70h24`} {...st(b, 2)} opacity=".8" />
        </g>
      ))}
    </>
  ),
  'offline-screen': (a, b) => (
    <>
      <circle cx="80" cy="42" r="17" fill={b} />
      <circle cx="88" cy="36" r="15" fill={D} />
      <circle cx="34" cy="28" r="1.8" fill="#fff" /><circle cx="122" cy="24" r="1.4" fill="#fff" /><circle cx="130" cy="52" r="1.8" fill="#fff" /><circle cx="26" cy="60" r="1.3" fill="#fff" />
      <text x="80" y="86" {...tx(16)} letterSpacing="3">OFFLINE</text>
      <path d="M52 94h56" {...st(a, 2)} />
    </>
  ),
  'full-stream-kit': (a, b) => (
    <>
      <rect x="18" y="16" width="84" height="52" rx="5" fill={a} opacity=".16" /><rect x="18" y="16" width="84" height="52" rx="5" {...st(a, 2)} />
      <rect x="36" y="28" width="84" height="52" rx="5" fill={D} /><rect x="36" y="28" width="84" height="52" rx="5" {...st(b, 2)} />
      <rect x="54" y="40" width="84" height="52" rx="5" fill={D} /><rect x="54" y="40" width="84" height="52" rx="5" {...st('#ffffff', 2)} />
      <rect x="60" y="70" width="22" height="16" rx="3" {...st(a, 2)} />
      <path d="M112 52h20M112 61h14M112 70h20" {...st(b, 2)} />
      <text x="96" y="58" {...tx(9, a)}>KIT</text>
    </>
  ),

  /* ---------- Discord ---------- */
  'server-icon': (a) => (
    <>
      <circle cx="80" cy="55" r="36" fill={a} opacity=".2" /><circle cx="80" cy="55" r="36" {...st(a, 2)} />
      <rect x="57" y="32" width="46" height="46" rx="15" fill={a} />
      <text x="80" y="66" {...tx(31)}>N</text>
    </>
  ),
  'server-banner': (a, b) => (
    <>
      <rect x="10" y="28" width="140" height="54" rx="8" fill={a} opacity=".75" />
      <path d="M10 66c30-18 50 10 80-6s40-10 60-2v16a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8z" fill={b} opacity=".55" />
      <circle cx="128" cy="40" r="14" fill="#ffffff" opacity=".14" />
      <text x="80" y="58" {...tx(14)}>NIGHT GUILD</text>
    </>
  ),
  'profile-art': (a, b) => (
    <>
      <rect x="26" y="20" width="108" height="32" rx="8" fill={a} opacity=".5" />
      <circle cx="56" cy="58" r="23" fill={D} />
      {face(56, 58, 18, 'smile', b)}
      <circle cx="72" cy="73" r="6" fill="#57f287" stroke={D} strokeWidth="3" />
      <rect x="88" y="62" width="42" height="7" rx="3.5" fill="#fff" opacity=".85" />
      <rect x="88" y="75" width="28" height="5" rx="2.5" fill="#fff" opacity=".4" />
    </>
  ),
  'welcome-banner': (a, b) => (
    <>
      <rect x="10" y="30" width="140" height="50" rx="10" fill={a} opacity=".22" /><rect x="10" y="30" width="140" height="50" rx="10" {...st(a, 2)} />
      {face(36, 55, 15, 'smile', b)}
      <text x="98" y="54" {...tx(13)}>WELCOME</text>
      <text x="98" y="67" {...tx(7, b)}>MEMBER #1,024</text>
    </>
  ),
  'invite-splash': (a, b) => (
    <>
      <rect x="12" y="12" width="136" height="86" rx="8" fill={a} opacity=".2" /><rect x="12" y="12" width="136" height="86" rx="8" {...st(a, 2)} opacity=".6" />
      <path d="M12 80c26-22 46-4 70-18s44-6 66 4v24a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8z" fill={a} opacity=".3" />
      <rect x="50" y="26" width="60" height="58" rx="8" fill={D} /><rect x="50" y="26" width="60" height="58" rx="8" {...st('#ffffff', 1.5)} opacity=".5" />
      <circle cx="80" cy="45" r="10" fill={a} />
      <rect x="60" y="66" width="40" height="12" rx="6" fill={b} />
      <text x="80" y="75" {...tx(7, D)}>JOIN</text>
    </>
  ),
  'role-icons': (a, b) => (
    <>
      {[29, 63, 97, 131].map((x) => (<g key={x}><circle cx={x} cy="55" r="15" fill={a} opacity=".2" /><circle cx={x} cy="55" r="15" {...st(a, 2)} /></g>))}
      <path d="M21 61l-2-11 6 4 4-7 4 7 6-4-2 11z" fill={b} />
      <path d="M63 45l9 3v7c0 6-4 9-9 11-5-2-9-5-9-11v-7z" fill={b} />
      <path d="M97 45l3 7 7 .6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7-5.4-4.7 7-.6z" fill={b} />
      <path d="M134 44l-9 12h6l-3 10 9-13h-6z" fill={b} />
    </>
  ),
  'event-poster': (a, b) => (
    <>
      <rect x="48" y="8" width="64" height="94" rx="6" fill={a} opacity=".22" /><rect x="48" y="8" width="64" height="94" rx="6" {...st(a, 2)} />
      <rect x="56" y="16" width="26" height="24" rx="4" fill={b} />
      <text x="69" y="33" {...tx(13, D)}>24</text>
      <text x="80" y="58" {...tx(10)}>GAME</text>
      <text x="80" y="71" {...tx(10, a)}>NIGHT</text>
      <rect x="60" y="82" width="40" height="9" rx="4.5" fill={a} />
    </>
  ),
  'bot-avatar': (a, b) => (
    <>
      <path d="M80 36V24" {...st(b, 3)} /><circle cx="80" cy="21" r="4.5" fill={b} />
      <rect x="46" y="50" width="9" height="15" rx="3" fill={b} /><rect x="105" y="50" width="9" height="15" rx="3" fill={b} />
      <rect x="54" y="36" width="52" height="44" rx="13" fill={a} />
      <circle cx="68" cy="55" r="6.5" fill="#fff" /><circle cx="92" cy="55" r="6.5" fill="#fff" />
      <circle cx="68" cy="55" r="2.8" fill={D} /><circle cx="92" cy="55" r="2.8" fill={D} />
      <rect x="68" y="67" width="24" height="5" rx="2.5" fill={D} opacity=".5" />
    </>
  ),

  /* ---------- Characters & VTubers ---------- */
  'gaming-avatar': (a, b) => (
    <>
      <circle cx="80" cy="52" r="38" fill={a} opacity=".16" />
      {bust(80, 54, a, b, 1.25)}
      <path d="M61 46a19 19 0 0 1 38 0" {...st('#ffffff', 3.5)} />
      <rect x="56" y="43" width="8" height="14" rx="4" fill="#fff" /><rect x="96" y="43" width="8" height="14" rx="4" fill="#fff" />
      <path d="M60 57c0 9 7 12 14 12" {...st('#ffffff', 2.5)} />
    </>
  ),
  mascot: (a) => (
    <>
      <path d="M57 28l10 26-20-5zM103 28L93 54l20-5z" fill={a} />
      <path d="M50 52c0-13 15-20 30-20s30 7 30 20c0 17-15 30-30 36-15-6-30-19-30-36z" fill={a} />
      <path d="M65 68c4 8 11 14 15 16 4-2 11-8 15-16-7-4-23-4-30 0z" fill="#fff" />
      <path d="M61 52l11 5M99 52l-11 5" {...st(D, 3.5)} />
      <circle cx="80" cy="79" r="3.2" fill={D} />
    </>
  ),
  'chibi-character': (a, b) => (
    <>
      <rect x="67" y="66" width="26" height="24" rx="10" fill={a} />
      <circle cx="80" cy="44" r="26" fill={b} />
      <path d="M54 44a26 26 0 0 1 52 0c-9-9-17-11-26-11s-17 2-26 11z" fill={a} />
      <ellipse cx="70" cy="49" rx="3.4" ry="5.5" fill={D} /><ellipse cx="90" cy="49" rx="3.4" ry="5.5" fill={D} />
      <circle cx="62" cy="57" r="4" fill="#ff7da8" opacity=".6" /><circle cx="98" cy="57" r="4" fill="#ff7da8" opacity=".6" />
      <path d="M75 60q5 4 10 0" {...st(D, 2)} />
    </>
  ),
  pngtuber: (a, b) => (
    <>
      {face(50, 50, 23, 'smile', b)}
      {face(110, 50, 23, 'open', b)}
      <path d="M27 50a23 23 0 0 1 46 0c-8-8-15-9-23-9s-15 1-23 9zM87 50a23 23 0 0 1 46 0c-8-8-15-9-23-9s-15 1-23 9z" fill={a} />
      <text x="50" y="92" {...tx(8)} opacity=".8">IDLE</text>
      <text x="110" y="92" {...tx(8, a)}>TALKING</text>
    </>
  ),
  'vtuber-art': (a, b) => (
    <>
      <rect x="40" y="12" width="62" height="80" rx="6" {...st(a, 2)} opacity=".35" />
      <rect x="49" y="17" width="62" height="80" rx="6" {...st(a, 2)} opacity=".65" />
      <rect x="58" y="22" width="62" height="80" rx="6" fill={D} /><rect x="58" y="22" width="62" height="80" rx="6" {...st(a, 2)} />
      <path d="M74 60a15 15 0 0 1 30 0v26H74z" fill={a} opacity=".7" />
      <circle cx="89" cy="50" r="11" fill={b} />
      <path d="M78 50a11 11 0 0 1 22 0c-4-4-7-5-11-5s-7 1-11 5z" fill={a} />
      <path d="M22 40h12M22 50h12M22 60h12" {...st(b, 3)} />
    </>
  ),
  'anime-portrait': (a, b) => (
    <>
      <path d="M50 78c-10-40 8-66 30-66s40 26 30 66c-6-10-10-14-30-14s-24 4-30 14z" fill={a} />
      <ellipse cx="80" cy="56" rx="22" ry="26" fill={b} />
      <path d="M57 50c2-18 12-24 23-24s21 6 23 24c-8-8-12-12-23-12s-15 4-23 12z" fill={a} />
      <ellipse cx="70" cy="59" rx="5" ry="7" fill={D} /><ellipse cx="90" cy="59" rx="5" ry="7" fill={D} />
      <circle cx="71.5" cy="56.5" r="1.8" fill="#fff" /><circle cx="91.5" cy="56.5" r="1.8" fill="#fff" />
      <path d="M76 73q4 3 8 0" {...st(D, 1.8)} />
    </>
  ),
  'expression-sheet': (_a, b) => (
    <>
      {([['smile', 44, 36], ['open', 80, 36], ['wow', 116, 36], ['angry', 44, 74], ['heart', 80, 74], ['sad', 116, 74]] as [Mood, number, number][]).map(([m, x, y]) => (
        <g key={m}>{face(x, y, 15, m, b)}</g>
      ))}
    </>
  ),
  'character-sheet': (a, b) => (
    <>
      {figure(44, a, b)}
      <g>
        <circle cx="80" cy="32" r="8" fill={b} />
        <rect x="74" y="43" width="12" height="26" rx="6" fill={a} />
        <rect x="77" y="70" width="6" height="16" rx="3" fill={b} opacity=".8" />
      </g>
      {figure(116, a, b, true)}
      <path d="M22 90h116" {...st('#ffffff', 1.5)} opacity=".4" />
      <text x="44" y="102" {...tx(6)} opacity=".7">FRONT</text><text x="80" y="102" {...tx(6)} opacity=".7">SIDE</text><text x="116" y="102" {...tx(6)} opacity=".7">BACK</text>
    </>
  ),

  /* ---------- Emotes & Badges ---------- */
  'static-emotes': (a, b) => (
    <>
      {face(42, 55, 19, 'smile', b)}
      {face(80, 55, 19, 'wow', a)}
      {face(118, 55, 19, 'heart', b)}
    </>
  ),
  'chibi-emotes': (a, b) => (
    <>
      {face(80, 58, 31, 'heart', b)}
      <path d="M49 58a31 31 0 0 1 62 0c-10-11-20-13-31-13s-21 2-31 13z" fill={a} />
      <path d="M124 22l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5zM30 30l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill={a} />
    </>
  ),
  'discord-emojis': (a, b) => (
    <>
      {([['smile', 44, 36], ['wow', 80, 36], ['heart', 116, 36], ['open', 44, 74], ['sad', 80, 74], ['angry', 116, 74]] as [Mood, number, number][]).map(([m, x, y], i) => (
        <g key={m}>
          <rect x={x - 15} y={y - 15} width="30" height="30" rx="8" fill={a} opacity=".18" />
          {face(x, y, 10.5, m, i % 2 ? a : b)}
        </g>
      ))}
    </>
  ),
  'sub-badges': (a, b) => (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <circle cx={24 + i * 28} cy="50" r="11.5" fill={a} opacity={0.3 + i * 0.175} />
          <circle cx={24 + i * 28} cy="50" r="11.5" {...st(b, 1.5)} opacity={0.4 + i * 0.15} />
          <text x={24 + i * 28} y={53 + i * 0.6} {...tx(8 + i * 1.6, D)}>★</text>
          <text x={24 + i * 28} y="78" {...tx(7)} opacity=".75">{['1', '3', '6', '12', '24'][i]}</text>
        </g>
      ))}
      <text x="80" y="94" {...tx(6, b)}>MONTHS</text>
    </>
  ),
  'sticker-pack': (a, b) => (
    <>
      <path d="M112 30l5 11 12 1.5-9 8 2.5 12-10.5-6-10.5 6 2.5-12-9-8 12-1.5z" fill={a} stroke="#fff" strokeWidth="4" strokeLinejoin="round" transform="rotate(14 112 46)" />
      <circle cx="70" cy="58" r="31" fill="#fff" />
      {face(70, 58, 26, 'smile', b)}
      <path d="M90 80l11-2-9 11z" fill="#e6e6e6" />
    </>
  ),
  'rank-badges': () => (
    <>
      {shield(44, '#c98a5a')}
      {shield(80, '#cfd6e0')}
      {shield(116, '#ffd45a')}
    </>
  ),
  'point-icons': (a, b) => (
    <>
      <path d="M76 22l26 20-26 46-26-46z" fill={a} />
      <path d="M50 42h52M76 22l-10 20 10 46 10-46z" {...st('#ffffff', 1.5)} opacity=".65" />
      <circle cx="118" cy="72" r="14" fill={b} /><circle cx="118" cy="72" r="14" {...st(D, 1.5)} opacity=".3" />
      <text x="118" y="77" {...tx(14, D)}>★</text>
      <path d="M118 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" />
    </>
  ),
  'text-emotes': (a, b) => (
    <>
      <text x="52" y="66" {...tx(32, a)} stroke="#fff" strokeWidth="1.5">GG</text>
      <text x="112" y="46" {...tx(15, b)} transform="rotate(-8 112 46)">HYPE</text>
      <text x="114" y="80" {...tx(15)} transform="rotate(6 114 80)">LOL</text>
    </>
  ),

  /* ---------- Gaming Branding ---------- */
  'gaming-logo': (a) => (
    <>
      <path d="M80 12l36 12v28c0 23-16 37-36 46-20-9-36-23-36-46V24z" fill={a} opacity=".18" />
      <path d="M80 12l36 12v28c0 23-16 37-36 46-20-9-36-23-36-46V24z" {...st(a, 3)} />
      <path d="M89 26L63 60h15l-7 26 28-36H84z" fill={a} />
    </>
  ),
  'esports-logo': (a, b) => (
    <>
      <path d="M80 8l34 11v26c0 20-15 33-34 41-19-8-34-21-34-41V19z" {...st(b, 2.5)} />
      <path d="M60 28l11 12h18l11-12v24L80 76 60 52z" fill={a} />
      <path d="M67 48l8 3M93 48l-8 3" {...st(D, 3)} />
      <path d="M76 62h8l-4 5z" fill={D} />
      <rect x="34" y="82" width="92" height="18" rx="4" fill={a} />
      <text x="80" y="95" {...tx(11, D)}>WOLVES</text>
    </>
  ),
  'youtube-thumbnail': (a, b) => (
    <>
      <rect x="14" y="16" width="132" height="76" rx="7" fill={a} opacity=".18" /><rect x="14" y="16" width="132" height="76" rx="7" {...st(a, 2)} />
      <text x="54" y="50" {...tx(21)}>EPIC</text>
      <text x="54" y="74" {...tx(21, a)}>WIN!</text>
      {bust(112, 54, a, b, 1)}
      <rect x="120" y="72" width="20" height="14" rx="4" fill="#ff4d4d" /><path d="M127.5 75.5l6 3.5-6 3.5z" fill="#fff" />
    </>
  ),
  'youtube-banner': (a, b) => (
    <>
      <rect x="8" y="28" width="144" height="54" rx="7" fill={a} opacity=".2" /><rect x="8" y="28" width="144" height="54" rx="7" {...st(a, 2)} opacity=".6" />
      <path d="M8 70c24-14 40 6 64-4s40-12 80-2v10a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8z" fill={a} opacity=".35" />
      <rect x="42" y="40" width="76" height="30" rx="4" {...st(b, 1.8)} strokeDasharray="5 4" />
      <text x="80" y="59" {...tx(10)}>CHANNEL</text>
    </>
  ),
  'team-banner': (a, b) => (
    <>
      <rect x="10" y="22" width="140" height="66" rx="8" fill={a} opacity=".16" /><rect x="10" y="22" width="140" height="66" rx="8" {...st(a, 2)} />
      {bust(46, 52, a, b, 0.75)}
      {bust(114, 52, a, b, 0.75)}
      {bust(80, 48, a, b, 1)}
      <rect x="44" y="76" width="72" height="12" rx="3" fill={a} />
      <text x="80" y="85" {...tx(8, D)}>THE SQUAD</text>
    </>
  ),
  'tournament-poster': (a, b) => (
    <>
      <rect x="48" y="6" width="64" height="98" rx="6" fill={a} opacity=".16" /><rect x="48" y="6" width="64" height="98" rx="6" {...st(a, 2)} />
      <path d="M68 20h24v11c0 9-5 15-12 16-7-1-12-7-12-16z" fill={b} />
      <path d="M68 24h-7c0 8 3 12 8 13M92 24h7c0 8-3 12-8 13" {...st(b, 2.5)} />
      <rect x="78" y="47" width="4" height="8" fill={b} /><rect x="69" y="55" width="22" height="5" rx="2" fill={b} />
      <text x="80" y="78" {...tx(12)}>CUP</text>
      <text x="80" y="92" {...tx(7, a)}>GRAND FINALS</text>
    </>
  ),
  'gaming-wallpaper': (a, b) => (
    <>
      <rect x="22" y="14" width="116" height="70" rx="6" fill={D} /><rect x="22" y="14" width="116" height="70" rx="6" {...st('#ffffff', 2)} opacity=".65" />
      <circle cx="112" cy="34" r="9" fill={b} />
      <path d="M25 81l31-38 20 22 22-30 37 46z" fill={a} opacity=".8" />
      <path d="M25 81l31-38 12 13-10 25z" fill={a} />
      <path d="M80 84v12M64 97h32" {...st('#ffffff', 2.5)} opacity=".65" />
    </>
  ),
  'merch-art': (a) => (
    <>
      <path d="M56 22l-28 13 9 17 13-5v44h60V47l13 5 9-17-28-13c-3 6-9 9-24 9s-21-3-24-9z" fill="#1c2420" />
      <path d="M56 22l-28 13 9 17 13-5v44h60V47l13 5 9-17-28-13c-3 6-9 9-24 9s-21-3-24-9z" {...st(a, 2.5)} />
      <path d="M84 46L70 64h8l-4 14 15-19h-8z" fill={a} />
    </>
  ),

  /* ---------- Category cover for the not-yet-available Animation category ---------- */
  'animation-cover': (a, b) => (
    <>
      <circle cx="80" cy="55" r="30" {...st(a, 5)} strokeDasharray="120 70" />
      <circle cx="80" cy="55" r="30" {...st(b, 5)} strokeDasharray="40 150" strokeDashoffset="-130" />
      <path d="M80 41l3.5 10.5L94 55l-10.5 3.5L80 69l-3.5-10.5L66 55l10.5-3.5z" fill="#fff" />
    </>
  ),
};

/* ---------- Art-style thumbnails (Production page): the same kind of subject, drawn in each manner ---------- */
Object.assign(ART, {
  'style-anime-cel': ART['anime-portrait'],
  'style-vtuber-model': ART['vtuber-art'],
  'style-chibi': ART['chibi-character'],
  'style-esports-mascot': ART['esports-logo'],
  'style-sticker': ART['sticker-pack'],
  'style-pfp-cinematic': (a, b) => (
    <>
      <circle cx="80" cy="52" r="40" fill={a} opacity=".25" />
      <circle cx="80" cy="52" r="40" {...st(a, 3)} />
      <path d="M40 52a40 40 0 0 1 22-36" {...st('#ffffff', 3)} opacity=".8" />
      {bust(80, 58, D, b, 1.3)}
      <path d="M97 44a17 17 0 0 0-8-12" {...st('#ffffff', 3)} />
      <path d="M49 97c0-21 13-29 31-29" {...st(a, 3)} />
      <path d="M124 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" />
    </>
  ),
  'style-flat-vector': (a, b) => (
    <>
      <circle cx="112" cy="36" r="15" fill={b} />
      <path d="M0 92l44-52 30 34 26-28 60 46v18H0z" fill={a} />
      <path d="M0 92l44-52 18 20-22 50H0z" fill={a} opacity=".6" />
      <rect x="0" y="94" width="160" height="16" fill={D} opacity=".35" />
      <circle cx="30" cy="26" r="5" fill="#fff" opacity=".9" /><circle cx="42" cy="24" r="7" fill="#fff" opacity=".9" /><circle cx="54" cy="27" r="5" fill="#fff" opacity=".9" />
    </>
  ),
  'style-comic-ink': (a, b) => (
    <>
      {[0, 1, 2, 3, 4, 5].flatMap((r) => [0, 1, 2, 3, 4, 5, 6, 7].map((c) => <circle key={`${r}-${c}`} cx={14 + c * 19 + (r % 2) * 9} cy={12 + r * 17} r={1 + (c + r) * 0.22} fill={a} opacity=".5" />))}
      <path d="M106 14l8 14 15-6-5 15 15 6-15 6 5 15-15-6-8 14-8-14-15 6 5-15-15-6 15-6-5-15 15 6z" fill={b} stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <text x="106" y="48" {...tx(13, D)}>POW</text>
      <circle cx="52" cy="62" r="26" fill="#ffe3c4" stroke={D} strokeWidth="4" />
      <path d="M26 60c2-22 16-30 28-30s22 8 24 26c-10-8-18-10-28-8s-16 6-24 12z" fill={D} />
      <path d="M40 60l10 3M66 60l-8 3" {...st(D, 3.5)} /><path d="M44 76q8 5 16 0" {...st(D, 3)} />
    </>
  ),
  'style-semi-real': (a, b) => (
    <>
      <ellipse cx="80" cy="98" rx="44" ry="26" fill={a} />
      <ellipse cx="70" cy="96" rx="26" ry="20" fill="#fff" opacity=".14" />
      <rect x="72" y="62" width="16" height="18" rx="6" fill={a} />
      <ellipse cx="80" cy="46" rx="21" ry="25" fill={b} />
      <ellipse cx="90" cy="50" rx="13" ry="21" fill={a} opacity=".3" />
      <ellipse cx="71" cy="38" rx="8" ry="11" fill="#fff" opacity=".28" />
      <path d="M58 44c0-18 10-26 22-26s22 8 22 26c-6-10-12-14-22-14s-16 4-22 14z" fill="#3a2a26" />
      <ellipse cx="72" cy="48" rx="3" ry="2" fill="#2a1d1a" /><ellipse cx="88" cy="48" rx="3" ry="2" fill="#2a1d1a" />
      <path d="M75 60q5 2 10 0" {...st('#8a4a44', 2)} />
    </>
  ),
  'style-line-art': (a) => (
    <>
      <path d="M48 98c0-16 14-24 32-24s32 8 32 24" {...st(a, 2.5)} />
      <ellipse cx="80" cy="48" rx="21" ry="25" {...st(a, 2.5)} />
      <path d="M58 46c0-20 10-28 22-28s22 8 22 28c-6-10-12-14-22-14s-16 4-22 14z" {...st(a, 2.5)} />
      <path d="M68 49h8M84 49h8M75 62q5 3 10 0" {...st(a, 2.5)} />
      <path d="M20 26l14 4M126 30l14-4M22 84l10-2M128 82l10 2" {...st(a, 1.5)} opacity=".5" />
    </>
  ),
} satisfies Record<string, Draw>);

export const hasArt = (id: string): boolean => id in ART;

interface ThumbProps {
  id: string;
  /** override colours (used by the live direction preview) */
  a?: string;
  b?: string;
  className?: string;
}

/** Decorative: every card that uses it also carries the artwork name as text. */
export function Thumb({ id, a, b, className = '' }: ThumbProps) {
  const uid = `thumb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const template = getTemplate(id);
  const category = template ? getCategory(template.categoryId) : CATEGORIES.find((c) => c.coverId === id);
  const [ca, cb] = category?.colors ?? ['#9cfb59', '#5fe3ff'];
  const A = a ?? ca;
  const B = b ?? cb;
  const draw = ART[id];
  return (
    <svg data-thumb={id} viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice" className={`block w-full ${className}`} aria-hidden focusable={false}>
      <defs>
        <radialGradient id={uid} cx=".64" cy=".36" r=".8">
          <stop offset="0" stopColor={A} stopOpacity=".4" />
          <stop offset="1" stopColor={A} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="110" fill={D} />
      <rect width="160" height="110" fill={`url(#${uid})`} />
      {draw ? draw(A, B) : null}
    </svg>
  );
}
