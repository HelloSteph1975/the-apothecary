const ink = { fill: 'none', stroke: '#5a4330', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function Calendula({ size = 120 }) {
  return (
    <svg viewBox="0 0 80 120" height={size} aria-hidden="true" {...ink}>
      <path d="M40 118 C40 95 39 70 40 42" />
      <path d="M40 92 C30 87 22 89 16 82 C24 79 33 82 40 88" />
      <path d="M40 74 C50 69 57 71 63 64 C55 61 47 65 40 70" />
      <g transform="translate(40 28)">
        <circle r="6" />
        <circle r="3" />
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} transform={`rotate(${i * (360 / 14)})`} d="M0 -7 C-3 -13 -2 -20 0 -22 C2 -20 3 -13 0 -7" />
        ))}
      </g>
      <g transform="translate(58 46) scale(.55)">
        <circle r="6" />
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} transform={`rotate(${i * 36})`} d="M0 -7 C-3 -13 -2 -19 0 -21 C2 -19 3 -13 0 -7" />
        ))}
      </g>
      <path d="M40 42 C46 45 52 46 56 47" />
    </svg>
  );
}

export function Chamomile({ size = 120 }) {
  const flower = (x, y, s) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r="5" />
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse key={i} transform={`rotate(${i * 30}) translate(0 -11)`} rx="2.6" ry="6" />
      ))}
    </g>
  );
  return (
    <svg viewBox="0 0 90 120" height={size} aria-hidden="true" {...ink}>
      <path d="M45 118 C44 90 40 60 30 30" />
      <path d="M45 100 C52 80 60 62 66 44" />
      <path d="M44 84 C48 70 50 58 52 52" />
      <path d="M38 70 l-6 -3 M38 70 l-2 -6 M58 70 l5 -4 M58 70 l1 -6 M42 95 l-7 -1 M42 95 l-4 -5" />
      {flower(30, 26, 1)}
      {flower(66, 40, .8)}
      {flower(52, 50, .55)}
    </svg>
  );
}

export function Lavender({ size = 120 }) {
  const floretFill = { fill: '#8e7fa3', fillOpacity: 0.6, strokeWidth: 0.7 };
  const leafFill = { fill: '#8a9a7a', fillOpacity: 0.55, strokeWidth: 0.8 };
  const base = [35, 116];
  // One slender spike: a curved stem, then whorled tiers of tiny florets on the top third only.
  const spike = (key, [cx, cy], [tx, ty]) => {
    const at = t => [
      (1 - t) ** 2 * base[0] + 2 * (1 - t) * t * cx + t * t * tx,
      (1 - t) ** 2 * base[1] + 2 * (1 - t) * t * cy + t * t * ty,
    ];
    const tiers = [
      { t: 0.7, n: 5, w: 5.4 },
      { t: 0.77, n: 5, w: 5 },
      { t: 0.84, n: 4, w: 4.2 },
      { t: 0.91, n: 3, w: 3.2 },
      { t: 0.97, n: 2, w: 1.8 },
    ];
    return (
      <g key={key}>
        <path d={`M${base[0]} ${base[1]} Q${cx} ${cy} ${tx} ${ty}`} strokeWidth="0.9" />
        {tiers.map(({ t, n, w }, ti) => {
          const [x, y] = at(t);
          return (
            <g key={ti}>
              {ti < 2 && <path d={`M${x - 2.2} ${y + 4.4} L${x} ${y + 2.4} L${x + 2.2} ${y + 4.4}`} strokeWidth="0.6" />}
              {Array.from({ length: n }, (_, i) => {
                const f = n === 1 ? 0 : i / (n - 1) - 0.5;
                const fx = x + f * 2 * w;
                const fy = y + (i % 2 ? 1.3 : -1.1) - Math.abs(f) * 1.2;
                return <circle key={i} cx={fx} cy={fy} r={ti < 3 ? 1.7 : 1.4} {...floretFill} />;
              })}
            </g>
          );
        })}
        <ellipse cx={tx} cy={ty - 1} rx="1" ry="1.8" {...floretFill} />
      </g>
    );
  };
  // Long thin blades in opposite pairs, low on the plant only.
  const pair = (y, angle, len) => [-1, 1].map(side => (
    <path key={`${y}${side}`} transform={`translate(${base[0] + side * 0.6} ${y}) rotate(${side * angle})`}
      d={`M0 0 Q1.6 ${-len / 2} 0 ${-len} Q-1.6 ${-len / 2} 0 0 Z`} {...leafFill} />
  ));
  return (
    <svg viewBox="0 0 70 120" height={size} aria-hidden="true" {...ink}>
      {pair(114, 52, 18)}
      {pair(107, 40, 17)}
      {pair(100, 30, 15)}
      {pair(93, 20, 14)}
      {spike('a', [28, 70], [16, 16])}
      {spike('b', [36, 60], [36, 6])}
      {spike('c', [42, 72], [55, 22])}
    </svg>
  );
}

// A climbing vine for the corners of the page sheet. Drawn for the top-left corner; CSS mirrors it for the others.
export function VineCorner({ className }) {
  const leaf = (x, y, r, k = 1) => <path key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${r}) scale(${k})`} d="M0 0 C4 -6 12 -7 16 -2 C11 2 5 3 0 0 Z" fill="#6b8455" stroke="#4a6440" strokeWidth=".8" />;
  const flower = (x, y, k) => (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {Array.from({ length: 8 }, (_, i) => <ellipse key={i} transform={`rotate(${i * 45}) translate(0 -6)`} rx="2.2" ry="4.5" fill="#f4ecd8" stroke="#5a4330" strokeWidth=".7" />)}
      <circle r="2.6" fill="#c9a24a" stroke="#5a4330" strokeWidth=".6" />
    </g>
  );
  return (
    <svg className={className} viewBox="0 0 170 170" aria-hidden="true">
      <path d="M8 164 C10 114 20 70 42 42 C64 16 106 8 164 8" fill="none" stroke="#4a6440" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M26 84 C36 82 44 74 47 62 M72 22 C78 34 88 40 100 40 M14 130 C22 128 28 122 30 114 M118 11 C122 20 130 24 138 23" fill="none" stroke="#4a6440" strokeWidth="1.4" strokeLinecap="round" />
      {leaf(10, 146, -70)}{leaf(12, 128, -110)}{leaf(15, 112, -60)}{leaf(18, 96, -115)}
      {leaf(24, 78, -55)}{leaf(30, 62, -125)}{leaf(38, 50, -50)}{leaf(47, 62, -150, .9)}
      {leaf(52, 34, -110)}{leaf(58, 28, -25)}{leaf(72, 22, -120)}{leaf(80, 18, -15)}
      {leaf(100, 40, 20, .9)}{leaf(96, 12, -140)}{leaf(104, 10, -8)}{leaf(122, 8, -130)}
      {leaf(130, 8, 8)}{leaf(138, 23, 20, .9)}{leaf(150, 8, -125, .9)}{leaf(14, 130, -40, .8)}
      {flower(42, 42, 1.25)}
      {flower(108, 12, .8)}
    </svg>
  );
}

// The small sprig that sits on the top edge of a framed panel.
export function LeafOrnament() {
  return (
    <svg viewBox="0 0 60 16" width="60" height="16" aria-hidden="true" fill="none" stroke="#4a6440" strokeWidth="1" strokeLinecap="round">
      <path d="M4 8 H24 M36 8 H56" />
      <path d="M30 13 V3 M30 9 C26 8 24 5 24 3 C27 3 29 5 30 8 M30 9 C34 8 36 5 36 3 C33 3 31 5 30 8" fill="#6b8455" />
    </svg>
  );
}

export const BOTANICALS = { calendula: Calendula, chamomile: Chamomile, lavender: Lavender };
