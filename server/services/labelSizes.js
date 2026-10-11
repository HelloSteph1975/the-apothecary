// Label sheet layouts on US letter (8.5 x 11 inches). All measurements are in inches; PDF points are inches x 72.
export const LABEL_SIZES = [
  {
    key: 'small-round', name: 'Small round', shape: 'circle', width: 2, height: 2, cols: 3, rows: 4,
    left: 0.75, top: 0.5, pitchX: 2.5, pitchY: 2.5, perSheet: 12,
    fields: ['name', 'made_on', 'expires_on'],
  },
  {
    key: 'medium-rect', name: 'Medium rectangle', shape: 'rect', width: 3.5, height: 2, cols: 2, rows: 5,
    left: 0.5, top: 0.5, pitchX: 4, pitchY: 2, perSheet: 10,
    fields: ['name', 'latin_name', 'made_on', 'expires_on', 'ingredients', 'caution'],
  },
  {
    key: 'large-rect', name: 'Large rectangle', shape: 'rect', width: 4, height: 3.33, cols: 2, rows: 3,
    left: 0.25, top: 0.5, pitchX: 4, pitchY: 3.33, perSheet: 6,
    fields: ['name', 'latin_name', 'made_on', 'expires_on', 'ingredients', 'caution'],
  },
];

export const sizeByKey = key => LABEL_SIZES.find(s => s.key === key) ?? null;
