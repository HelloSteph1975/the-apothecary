import {
  FlaskConical, Droplet, CupSoda, CookingPot, Amphora, Bath, Sparkles, Flame, Leaf, Package, Moon, Sprout, Flower2, Wind,
} from 'lucide-react';

export const RECIPE_UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'fl oz', 'count', 'drops', 'tsp', 'tbsp', 'cup', 'parts']
  .map(value => ({ value, label: value === 'l' ? 'L' : value === 'count' ? 'Count' : value }));

export const RECIPE_ICONS = ['flask', 'droplet', 'cup', 'pot', 'jar', 'bath', 'sparkles', 'flame', 'leaf', 'package', 'moon', 'sprout', 'flower', 'wind']
  .map(value => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

const ICON_MAP = {
  flask: FlaskConical, droplet: Droplet, cup: CupSoda, pot: CookingPot, jar: Amphora, bath: Bath, sparkles: Sparkles,
  flame: Flame, leaf: Leaf, package: Package, moon: Moon, sprout: Sprout, flower: Flower2, wind: Wind,
};

export function TypeIcon({ icon, size = 20 }) {
  const Icon = ICON_MAP[icon] || Sprout;
  return <Icon size={size} aria-hidden="true" />;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function daysText(n) {
  if (n == null) return '';
  if (n === 0) return 'Ready when made';
  if (n % 7 === 0) return plural(n / 7, 'week');
  return plural(n, 'day');
}

export function shelfText(n) {
  if (n != null && n > 0 && n % 365 === 0) return plural(n / 365, 'year');
  return daysText(n);
}
