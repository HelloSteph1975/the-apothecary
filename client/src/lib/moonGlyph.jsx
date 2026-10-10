// A small moon for each of the eight phases, drawn from a lit shape over a dark disc. Waxing moons are lit on the right.
const SHAPES = {
  'waxing crescent': { waxing: true, curve: 'crescent' },
  'first quarter': { waxing: true, curve: 'half' },
  'waxing gibbous': { waxing: true, curve: 'gibbous' },
  'waning gibbous': { waxing: false, curve: 'gibbous' },
  'last quarter': { waxing: false, curve: 'half' },
  'waning crescent': { waxing: false, curve: 'crescent' },
};

// The lit part: the right limb, then the terminator back to the top.
function litPath(curve) {
  if (curve === 'half') return 'M12 2 A10 10 0 0 1 12 22 Z';
  const bulge = curve === 'crescent' ? 0 : 1;
  return `M12 2 A10 10 0 0 1 12 22 A5 10 0 0 ${bulge} 12 2 Z`;
}

export function MoonGlyph({ phase, size = 20 }) {
  const shape = SHAPES[phase];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="moon-glyph">
      <circle cx="12" cy="12" r="10" fill={phase === 'full' ? 'var(--moon-lit, #f6edd2)' : 'var(--moon-dark, #4a3a2c)'} stroke="currentColor" strokeWidth="1.5" />
      {shape && <path d={litPath(shape.curve)} fill="var(--moon-lit, #f6edd2)" transform={shape.waxing ? undefined : 'translate(24 0) scale(-1 1)'} />}
    </svg>
  );
}
