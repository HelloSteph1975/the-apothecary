import { MoonGlyph } from '../../lib/moonGlyph.jsx';
import { CARD_LAYOUT, madeText, useByText } from '../../lib/labels.js';

const MOON = 0.18; // inches, as in the PDF

function Text({ className, text, pt, lines }) {
  return (
    <p className={`label-text ${className}`} data-lines={lines} style={{ fontSize: `${pt}pt`, WebkitLineClamp: lines }}>{text}</p>
  );
}

// One label, positioned in inches on its sheet. Only the fields its size shows are drawn, and each block is clamped
// to its allowed lines so nothing spills out of the label.
export function LabelCard({ size, slot, label }) {
  const lay = CARD_LAYOUT[size.key];
  const shows = new Set(size.fields);
  const left = size.left + (slot % size.cols) * size.pitchX;
  const top = size.top + Math.floor(slot / size.cols) * size.pitchY;
  const moon = label.show_moon && label.phase && label.made_on && shows.has('made_on');
  return (
    <div className={`label-card label-${size.shape}`} data-testid="label-card" data-shape={size.shape}
      style={{ left: `${left}in`, top: `${top}in`, width: `${size.width}in`, height: `${size.height}in`, padding: `${lay.pad}in`, gap: `${lay.gap}pt` }}>
      {label.name && <Text className="label-name" text={label.name} pt={lay.name[0]} lines={lay.name[1]} />}
      {lay.latin && shows.has('latin_name') && label.latin_name && <Text className="label-latin" text={label.latin_name} pt={lay.latin[0]} lines={lay.latin[1]} />}
      {label.made_on && shows.has('made_on') && (
        <p className="label-text label-made" style={{ fontSize: `${lay.made}pt` }}>
          <span>{madeText(label.made_on)}</span>
          {moon && <MoonGlyph phase={label.phase} size={MOON * 96} />}
        </p>
      )}
      {label.expires_on && shows.has('expires_on') && <Text className="label-expiry" text={useByText(label.expires_on)} pt={lay.expiry} lines={1} />}
      {lay.ingredients && shows.has('ingredients') && label.ingredients && <Text className="label-ingredients" text={label.ingredients} pt={lay.ingredients[0]} lines={lay.ingredients[1]} />}
      {lay.caution && shows.has('caution') && label.caution && <Text className="label-caution" text={label.caution} pt={lay.caution[0]} lines={lay.caution[1]} />}
    </div>
  );
}
