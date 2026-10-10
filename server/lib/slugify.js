// The key a rule uses for a recipe type: its stored slug, or its name lowercased with spaces as hyphens.
// Mirrored in client/src/lib/sky.js (slugOf); keep them the same.
export const slugify = name => String(name).trim().toLowerCase().replace(/\s+/g, '-');
export const typeKey = type => type?.slug ?? (type ? slugify(type.name) : null);
