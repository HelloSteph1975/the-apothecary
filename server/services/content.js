import { seedGrimoire, linkItemsOnce } from './grimoire.js';
import { seedRecipeTypes } from './recipeTypes.js';

// Starter content, run at startup and after a restore. Each step logs its own failure so the app still opens;
// linking skips itself when the grimoire seed didn't finish.
export function contentMaintenance(db, { seed = seedGrimoire, link = linkItemsOnce, seedTypes = seedRecipeTypes } = {}) {
  const steps = [['Seeding the grimoire', seed], ['Linking jars to the grimoire', link], ['Seeding the recipe types', seedTypes]];
  for (const [label, fn] of steps) {
    try { fn(db); } catch (err) { console.error(`${label} failed (the app will still run):`, err); }
  }
}
