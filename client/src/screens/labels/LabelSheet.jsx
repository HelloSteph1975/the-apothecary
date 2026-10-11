import { layoutSheets, startSlot } from '../../lib/labels.js';
import { LabelCard } from './LabelCard.jsx';

// The sheets as they will print: full size in inches, shown smaller on screen by the CSS.
export function LabelSheet({ size, start, labels }) {
  const sheets = layoutSheets(size, start, labels);
  const first = startSlot(size, start);
  return (
    <div className="label-sheets">
      {sheets.map((slots, p) => (
        <div className="label-page-frame" key={p}>
          <p className="label-page-title no-print">Sheet {p + 1} of {sheets.length}</p>
          <div className="label-page" data-testid="label-page">
            {p === 0 && Array.from({ length: first }, (_, slot) => (
              <div key={`empty-${slot}`} className={`label-slot-empty label-${size.shape}`} data-testid="label-slot-empty"
                style={{
                  left: `${size.left + (slot % size.cols) * size.pitchX}in`,
                  top: `${size.top + Math.floor(slot / size.cols) * size.pitchY}in`,
                  width: `${size.width}in`, height: `${size.height}in`,
                }} />
            ))}
            {slots.map(entry => entry && <LabelCard key={entry.slot} size={size} slot={entry.slot} label={entry.label} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
