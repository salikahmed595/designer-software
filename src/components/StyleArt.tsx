import type { StyleGlyph, VisualStyle } from '../state/styles';

/** Original CSS/SVG placeholder art per style — simple geometric motifs, no copied imagery. */
function Glyph({ glyph, ink }: { glyph: StyleGlyph; ink: string }) {
  const s = { stroke: ink, fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (glyph) {
    case 'none':
      return null;
    case 'cube':
      return (<g {...s}><path d="M50 22l22 12v26L50 72 28 60V34z" /><path d="M28 34l22 12 22-12M50 46v26" /></g>);
    case 'check':
      return (<g {...s}><rect x="30" y="28" width="40" height="40" rx="9" /><path d="M39 48l8 8 14-16" /></g>);
    case 'pen':
      return (<g {...s}><path d="M36 30l22 6 8 22-14 12-22-8-6-22z" /><circle cx="46" cy="48" r="4" /><path d="M58 58l12 12" /></g>);
    case 'squiggle':
      return (<g {...s}><path d="M30 40c0-10 18-10 18 0s-18 16-6 22 26-12 18-20-14 10-4 18 14 4 16-2" /></g>);
    case 'camera':
      return (<g {...s}><rect x="28" y="36" width="44" height="30" rx="6" /><path d="M40 36l4-7h12l4 7" /><circle cx="50" cy="51" r="8" /></g>);
    case 'vector':
      return (<g {...s}><path d="M30 64c4-20 16-30 30-30" /><circle cx="60" cy="34" r="4" /><path d="M54 52l14 4-6 4 6 8-4 2-6-8-4 6z" /></g>);
    case 'comic':
      return (
        <g>
          <rect x="16" y="18" width="30" height="30" fill="#fff" stroke="#222" strokeWidth="2" />
          <rect x="50" y="18" width="34" height="62" fill="#e86a33" stroke="#222" strokeWidth="2" />
          <rect x="16" y="52" width="30" height="28" fill="#2b6cb0" stroke="#222" strokeWidth="2" />
          <circle cx="67" cy="40" r="9" fill="#f4e3c1" stroke="#222" strokeWidth="2" />
          <path d="M58 70c3-10 15-10 18 0" fill="#f4e3c1" stroke="#222" strokeWidth="2" />
          <path d="M22 26h18M22 32h14M22 38h18" stroke="#222" strokeWidth="2" />
        </g>
      );
    case 'lamp':
      return (
        <g>
          <circle cx="66" cy="28" r="14" fill="rgba(255,214,140,.25)" />
          <circle cx="66" cy="28" r="4" fill="#ffd88a" />
          <path d="M66 32v52" stroke="#2a2a2a" strokeWidth="2.5" />
          <rect x="18" y="62" width="34" height="12" rx="4" fill="#24211a" />
          <path d="M10 84h80" stroke="#3a3426" strokeWidth="3" />
        </g>
      );
    case 'pixel': {
      const px = [[3,1],[4,1],[5,1],[6,1],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[2,3],[4,3],[5,3],[7,3],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[3,5],[6,5],[2,6],[3,6],[4,6],[5,6],[6,6],[7,6],[2,7],[7,7]];
      return (<g>{px.map(([x, y]) => (<rect key={`${x}-${y}`} x={18 + x * 7} y={14 + y * 7} width="7" height="7" fill={y === 3 && (x === 4 || x === 5) ? '#ffeb3b' : '#3fb950'} />))}<rect x="76" y="18" width="5" height="34" fill="#cfe8ff" /></g>);
    }
    case 'figure':
      return (<g fill="#141414"><circle cx="50" cy="26" r="6" /><path d="M44 34h12l4 26-4 26h-4l-2-22-2 22h-4l-4-26z" fill="#f5f0ea" /></g>);
    case 'film':
      return (<g {...s}><rect x="24" y="30" width="52" height="36" rx="3" /><path d="M24 38h52M24 58h52" /><path d="M30 34h2M38 34h2M46 34h2M54 34h2M62 34h2M70 34h2M30 62h2M38 62h2M46 62h2M54 62h2M62 62h2M70 62h2" /></g>);
    case 'city':
      return (<g {...s} strokeWidth={1.6}><path d="M14 80V50h12v30M28 80V34h14v46M44 80V24h10v56M56 80V44h14v36M72 80V56h14v24" /><path d="M32 42h6M32 50h6M32 58h6M47 32h4M47 40h4M60 52h6M60 60h6" /><circle cx="78" cy="28" r="6" /><path d="M8 82h84" /></g>);
    case 'prism':
      return (<g><path d="M50 20L30 74h40z" fill="none" stroke="#fff" strokeWidth="1.8" /><path d="M10 50L44 48" stroke="#fff" strokeWidth="2" />{['#ff3b3b','#ff9f1c','#ffe14d','#35d07f','#2fa8ff','#8a5cff'].map((c, i) => (<path key={c} d={`M56 50L92 ${36 + i * 6}`} stroke={c} strokeWidth="2.2" />))}</g>);
    case 'cloud':
      return (<g><path d="M30 64h40a12 12 0 0 0-2-24 16 16 0 0 0-30-2 12 12 0 0 0-8 26z" fill="rgba(255,255,255,.55)" stroke="rgba(255,255,255,.9)" strokeWidth="2" /></g>);
    case 'sun':
      return (<g><circle cx="72" cy="26" r="9" fill="#ffb020" /><path d="M10 66c14-8 26-8 40 0s26 8 40 0v24H10z" fill="#3fa9c9" /><rect x="20" y="40" width="16" height="20" fill="#f08a3c" /><rect x="40" y="34" width="18" height="26" fill="#e8c27a" /><path d="M20 40l8-8 8 8M40 34l9-9 9 9" fill="#c4512b" /></g>);
    case 'flower':
      return (<g fill="none" stroke="#1a1a1a" strokeWidth="1.6"><path d="M50 78V46" /><circle cx="50" cy="38" r="8" /><path d="M50 30c-6-10 6-10 0 0M58 38c10-6 10 6 0 0M42 38c-10-6-10 6 0 0" /><path d="M24 84c10-14 30-18 52 0" /></g>);
    case 'temple':
      return (<g><circle cx="62" cy="40" r="22" fill="#d13b1e" /><path d="M22 74h50M24 70h46M26 52h42" stroke="#2a0b05" strokeWidth="3" />{[30, 40, 50, 60].map((x) => (<rect key={x} x={x} y="52" width="4" height="18" fill="#2a0b05" />))}<path d="M24 52l23-10 23 10" fill="#2a0b05" /></g>);
    case 'blueprint':
      return (<g fill="none" stroke="#8fb8ff" strokeWidth="1.4"><path d="M0 25h100M0 50h100M0 75h100M25 0v100M50 0v100M75 0v100" opacity=".25" /><path d="M28 40c0-8 44-8 44 0v20H28zM30 60v14M70 60v14M28 46h44" /></g>);
    case 'people':
      return (<g><circle cx="34" cy="36" r="8" fill="#ffd166" /><path d="M20 72c2-14 26-14 28 0z" fill="#06d6a0" /><circle cx="64" cy="40" r="8" fill="#ef476f" /><path d="M50 78c2-14 26-14 28 0z" fill="#118ab2" /><rect x="60" y="14" width="22" height="16" rx="3" fill="#fff" opacity=".85" /><path d="M64 26l5-5 4 3 6-6" stroke="#1e7d4f" strokeWidth="2" fill="none" /></g>);
    case 'village':
      return (<g><path d="M0 70c20-6 40-6 100 0v30H0z" fill="#6fb2d0" />{[[14, 44, '#f2c98a'], [32, 36, '#e9a86b'], [52, 40, '#f5e0b5'], [70, 34, '#e7b07a']].map(([x, y, c]) => (<rect key={String(x)} x={Number(x)} y={Number(y)} width="16" height={70 - Number(y)} fill={String(c)} />))}<rect x="60" y="18" width="6" height="18" fill="#d58b55" /></g>);
    case 'bear':
      return (<g><circle cx="50" cy="52" r="20" fill="#ffd4a3" /><circle cx="34" cy="34" r="7" fill="#ffd4a3" /><circle cx="66" cy="34" r="7" fill="#ffd4a3" /><path d="M30 40c4-16 36-16 40 0" fill="#ff8a3d" /><circle cx="43" cy="52" r="2.5" fill="#222" /><circle cx="57" cy="52" r="2.5" fill="#222" /><path d="M46 60c2 2 6 2 8 0" stroke="#222" strokeWidth="2" fill="none" /></g>);
    case 'brush':
      return (<g><path d="M20 76L68 28" stroke="#1d3bff" strokeWidth="7" strokeLinecap="round" /><path d="M68 28l10-8 2 2-8 10z" fill="#222" /><circle cx="30" cy="34" r="10" fill="#ffd23f" opacity=".9" /><path d="M56 70c8-10 20-6 24 4" stroke="#ff4fa3" strokeWidth="6" fill="none" strokeLinecap="round" /></g>);
    case 'ghost':
      return (<g><path d="M34 76V44a16 16 0 0 1 32 0v32l-6-5-5 5-5-5-5 5-5-5z" fill="#f3f3f3" /><circle cx="44" cy="46" r="3" fill="#111" /><circle cx="56" cy="46" r="3" fill="#111" /><path d="M26 54l8-4M74 54l-8-4" stroke="#f3f3f3" strokeWidth="5" strokeLinecap="round" /></g>);
    case 'mountain':
      return (<g><path d="M8 80l26-40 14 18 12-26 32 48z" fill="#4ca1af" /><path d="M34 40l6 18-14 22zM60 32l8 28 24 20z" fill="#2c7a87" /><path d="M54 44l6-12 6 10z" fill="#e8f6f8" /></g>);
    case 'neon':
      return (<g fill="none" strokeWidth="2.4"><rect x="24" y="30" width="52" height="34" rx="6" stroke="#ff2e97" /><path d="M34 54l8-14 8 14 8-14 8 14" stroke="#3ef2ff" /><path d="M20 76h60" stroke="#ff2e97" opacity=".6" /></g>);
    case 'leaf':
      return (<g fill="none" stroke="#3b3a2a" strokeWidth="1.6"><path d="M30 78c0-28 14-46 40-52-2 28-16 46-40 52z" /><path d="M30 78c10-14 22-28 40-52M42 60l-6-8M52 48l-8-6M60 38l-6-6" /></g>);
    case 'star':
      return (<g><circle cx="50" cy="50" r="28" fill="#fff" /><path d="M50 30l6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2z" fill="#d7263d" /></g>);
    case 'grid':
      return (<g><rect x="16" y="16" width="32" height="40" fill="#e63946" /><rect x="52" y="16" width="32" height="18" fill="#1d3557" /><rect x="52" y="38" width="32" height="46" fill="none" stroke="#1d3557" strokeWidth="2" /><path d="M16 64h32M16 72h24M16 80h28" stroke="#1d3557" strokeWidth="3" /></g>);
    case 'drop':
      return (<g><path d="M50 18c14 20 22 32 22 42a22 22 0 0 1-44 0c0-10 8-22 22-42z" fill="url(#chrome)" stroke="#fff" strokeWidth="1.5" /><defs><linearGradient id="chrome" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset=".5" stopColor="#8a8a8a" /><stop offset="1" stopColor="#f0f0f0" /></linearGradient></defs></g>);
  }
}

/** Callers must give positioning + size via className (e.g. "absolute inset-0" or "relative h-6 w-6"). */
export function StyleArt({ style, className = 'relative' }: { style: VisualStyle; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`} style={{ background: style.gradient }} aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
        <Glyph glyph={style.glyph} ink={style.light ? '#1a1a1a' : '#ffffff'} />
      </svg>
    </div>
  );
}
