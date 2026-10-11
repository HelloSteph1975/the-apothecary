import { Sprout, Shovel, Scissors, ShoppingBasket, Leaf, Eye } from 'lucide-react';

// Mirrors GARDEN_KINDS and GARDEN_TASKS on the server (server/schemas.js); keep them in step.
export const GARDEN_KINDS = [
  { value: 'planted', label: 'Planted' },
  { value: 'sowed', label: 'Sowed' },
  { value: 'transplanted', label: 'Transplanted' },
  { value: 'pruned', label: 'Pruned' },
  { value: 'harvested', label: 'Harvested' },
  { value: 'foraged', label: 'Foraged' },
  { value: 'observed', label: 'Observed' },
];

export const GARDEN_TASKS = [
  { value: 'sow-above', label: 'Sow leafy and flowering plants' },
  { value: 'sow-root', label: 'Sow roots and bulbs' },
  { value: 'transplant', label: 'Transplant' },
  { value: 'prune', label: 'Prune' },
  { value: 'weed', label: 'Weed and tend' },
  { value: 'harvest-above', label: 'Gather leaves and flowers' },
  { value: 'harvest-root', label: 'Dig roots' },
];

export const KIND_ICON = {
  planted: Sprout, sowed: Sprout, transplanted: Shovel, pruned: Scissors,
  harvested: ShoppingBasket, foraged: Leaf, observed: Eye,
};

export const kindLabel = kind => GARDEN_KINDS.find(k => k.value === kind)?.label ?? kind;
export const taskLabel = task => GARDEN_TASKS.find(t => t.value === task)?.label ?? task;

// Same text as the server: "Harvested Calendula", the kind with a capital, then the plant name as stored.
export const entryTitle = (kind, plantName) => `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${plantName}`;

// Roots are dug in a shrinking moon; leaves, flowers and everything else are gathered in a full one.
export const harvestTaskFor = part => (part === 'root' ? 'harvest-root' : 'harvest-above');
