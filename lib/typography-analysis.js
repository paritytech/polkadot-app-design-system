// Platform-independent typography analysis for the Typescale schema.
//
// Each typescale entry (e.g. "Display Large", "Label Small") has inline
// font/weight/size/lineHeight/tracking properties plus optional variants
// (weightEmphasized, fontMono, trackingCaption). We split each entry into a
// (role, size) pair and emit one or more TextStyle variants per entry. The
// formatter decides nesting shape (flat / uniform / mixed) at the role level.

import { camel, isReference } from './utils.js';

const isBroken = (entry) =>
  entry === undefined ||
  (isReference(entry.ref) && entry.resolved === entry.ref);

// Order sizes by physical scale, not alphabetically.
const SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large', 'ExtraLarge'];
// Material 3-ish role order for readable output.
const ROLE_ORDER = ['Display', 'Headline', 'Title', 'Body', 'Paragraph', 'Label', 'Emoji'];

const orderIndex = (list, item) => {
  const i = list.indexOf(item);
  return i < 0 ? list.length : i;
};

// "Display Large" -> { role: "Display", size: "Large" }.
// "Title ExtraLarge" -> { role: "Title", size: "ExtraLarge" }.
// Single-word entries (none today) -> { role: <name>, size: "" }.
const splitName = (typescaleName) => {
  const idx = typescaleName.indexOf(' ');
  if (idx < 0) return { role: typescaleName, size: '' };
  return { role: typescaleName.slice(0, idx), size: typescaleName.slice(idx + 1) };
};

// Variant generation rules. `requires` lists the source props that must exist
// (and be resolvable) for the variant to be emitted. `build` picks which
// source field maps to each TextStyle dimension; size and lineHeight always
// come from the entry's own fields.
const variantBuilders = [
  {
    key: 'regular',
    requires: [],
    build: (p) => ({ font: p.font, weight: p.weight, tracking: p.tracking }),
  },
  {
    key: 'emphasized',
    requires: ['weightEmphasized'],
    build: (p) => ({ font: p.font, weight: p.weightEmphasized, tracking: p.tracking }),
  },
  {
    key: 'mono',
    requires: ['fontMono'],
    build: (p) => ({ font: p.fontMono, weight: p.weight, tracking: p.tracking }),
  },
  {
    key: 'monoEmphasized',
    requires: ['fontMono', 'weightEmphasized'],
    build: (p) => ({ font: p.fontMono, weight: p.weightEmphasized, tracking: p.tracking }),
  },
  {
    key: 'caption',
    requires: ['trackingCaption'],
    build: (p) => ({ font: p.font, weight: p.weight, tracking: p.trackingCaption }),
  },
  {
    key: 'captionEmphasized',
    requires: ['trackingCaption', 'weightEmphasized'],
    build: (p) => ({ font: p.font, weight: p.weightEmphasized, tracking: p.trackingCaption }),
  },
];

export const parseTypescale = (themeTokens) => {
  const byEntry = new Map();
  for (const t of themeTokens) {
    if (t.path[0] !== 'Typescale') continue;
    const entryName = t.path[1];
    const prop = t.path[2];
    const ref = t.original.$value ?? t.original.value;
    const resolved = t.$value ?? t.value;
    if (!byEntry.has(entryName)) byEntry.set(entryName, {});
    byEntry.get(entryName)[prop] = { ref, resolved };
  }

  const rolesMap = new Map();
  const skipLog = [];

  for (const [name, props] of byEntry.entries()) {
    const { role, size } = splitName(name);

    const missing = ['font', 'weight', 'size', 'lineHeight'].filter((k) => isBroken(props[k]));
    if (missing.length > 0) {
      skipLog.push(`  - ${name}: missing/unresolved ${missing.join(', ')}`);
      continue;
    }
    if (isBroken(props.tracking)) {
      props.tracking = { ref: '0', resolved: 0 };
    }

    const variants = [];
    for (const v of variantBuilders) {
      if (v.requires.some((k) => isBroken(props[k]))) continue;
      const built = v.build(props);
      variants.push({
        key: v.key,
        font: built.font,
        weight: built.weight,
        size: props.size,
        lineHeight: props.lineHeight,
        tracking: built.tracking,
      });
    }

    if (!rolesMap.has(role)) rolesMap.set(role, []);
    rolesMap.get(role).push({ name: size, variants });
  }

  const roles = [];
  for (const [name, sizes] of rolesMap.entries()) {
    sizes.sort((a, b) => orderIndex(SIZE_ORDER, a.name) - orderIndex(SIZE_ORDER, b.name));
    roles.push({ name, sizes });
  }
  roles.sort((a, b) => orderIndex(ROLE_ORDER, a.name) - orderIndex(ROLE_ORDER, b.name));

  return { roles, skipLog };
};

// Decide nesting shape at the role level:
// - flat: all sizes have exactly one variant -> Role(size: TextStyle, ...)
// - uniform: all sizes share the same variant set -> Role(size: Sizes, ...) { Sizes(variant: TextStyle, ...) }
// - mixed: variant sets differ across sizes -> Role(size: <Size>, ...) { Size(...); ... }
export const roleShape = (role) => {
  const allSingle = role.sizes.every((s) => s.variants.length === 1);
  if (allSingle) return { kind: 'flat' };

  const signature = (s) => s.variants.map((v) => v.key).join(',');
  const uniqueSigs = new Set(role.sizes.map(signature));
  if (uniqueSigs.size === 1) {
    return {
      kind: 'uniform',
      variantKeys: role.sizes[0].variants.map((v) => v.key),
    };
  }
  return { kind: 'mixed' };
};
