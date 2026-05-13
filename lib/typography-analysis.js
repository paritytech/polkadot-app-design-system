// Platform-independent typography analysis.
// Takes a flat list of theme tokens (Font-Family/Font-Weight/Font-Size/Line-Height groups)
// and produces a structured description of composable TextStyles per role,
// plus a skip log of dropped combinations.

// Parse a leaf segment "Heading 3XL" -> { role: 'Heading', suffix: '3XL' }.
// Single-word leaves (e.g. "Heading", "Emoji") return suffix: null.
export const splitRoleSuffix = (leaf) => {
  const idx = leaf.indexOf(' ');
  if (idx < 0) return { role: leaf, suffix: null };
  return { role: leaf.slice(0, idx), suffix: leaf.slice(idx + 1) };
};

// Index theme tokens by group and role for easy lookup during analysis.
// Each entry is { ref: original unresolved $value, resolved: final $value }.
export const indexThemeTokens = (themeTokens) => {
  const out = {
    fontFamily: new Map(),
    fontWeight: new Map(),
    fontSize: new Map(),
    lineHeight: new Map(),
  };
  const ensureRole = (m, role) => {
    if (!m.has(role)) m.set(role, new Map());
    return m.get(role);
  };
  for (const t of themeTokens) {
    const group = t.path[0];
    const leaf = t.path[1];
    const ref = t.original.$value ?? t.original.value;
    const resolved = t.$value ?? t.value;
    const entry = { ref, resolved };
    const { role, suffix } = splitRoleSuffix(leaf);
    if (group === 'Font-Family') out.fontFamily.set(role, entry);
    else if (group === 'Font-Weight') ensureRole(out.fontWeight, role).set(suffix ?? '', entry);
    else if (group === 'Font-Size') ensureRole(out.fontSize, role).set(suffix ?? '', entry);
    else if (group === 'Line-Height') ensureRole(out.lineHeight, role).set(suffix ?? '', entry);
  }
  return out;
};

// Pair font-sizes with line-heights for a role using exact-suffix matching.
// Fallback: if both maps have exactly one entry, pair regardless of suffix (handles Code).
export const pairSizesForRole = (role, idx, skipLog) => {
  const fsMap = idx.fontSize.get(role) ?? new Map();
  const lhMap = idx.lineHeight.get(role) ?? new Map();
  const pairs = [];

  if (fsMap.size === 1 && lhMap.size === 1) {
    const [fsKey, fsEntry] = [...fsMap.entries()][0];
    const [, lhEntry] = [...lhMap.entries()][0];
    pairs.push({ size: fsKey, fontSize: fsEntry, lineHeight: lhEntry });
    return pairs;
  }

  const seen = new Set();
  for (const [size, fsEntry] of fsMap.entries()) {
    if (lhMap.has(size)) {
      pairs.push({ size, fontSize: fsEntry, lineHeight: lhMap.get(size) });
      seen.add(size);
    } else {
      skipLog.push(`  - ${role} ${size}: has Font-Size but no matching Line-Height`);
    }
  }
  for (const size of lhMap.keys()) {
    if (!seen.has(size)) {
      skipLog.push(`  - ${role} ${size}: has Line-Height but no matching Font-Size`);
    }
  }
  return pairs;
};

// Top-level analysis: returns the role definitions used by both abstract base and concrete palettes.
// Each role: { role, family: entry, weights: [{ name|null, entry }], sizes: [{ size, fontSize, lineHeight }] }
export const analyseTypographyRoles = (themeTokens) => {
  const idx = indexThemeTokens(themeTokens);
  const skipLog = [];
  const roles = new Set(idx.fontSize.keys());
  const out = [];

  for (const role of roles) {
    if (role === 'Emoji') {
      skipLog.push(`  - ${role}: only Font-Size available, skipping per config`);
      continue;
    }

    // Family — fallback to Body for Button.
    let familyEntry = idx.fontFamily.get(role);
    if (!familyEntry && role === 'Button') familyEntry = idx.fontFamily.get('Body');
    if (!familyEntry) {
      skipLog.push(`  - ${role}: no Font-Family entry and no fallback, skipping role`);
      continue;
    }

    // Weights.
    const weightMap = idx.fontWeight.get(role) ?? new Map();
    let weights;
    if (weightMap.size === 0) {
      skipLog.push(`  - ${role}: no Font-Weight entry, skipping role`);
      continue;
    } else if (weightMap.size === 1 && weightMap.has('')) {
      weights = [{ name: null, entry: weightMap.get('') }];
    } else {
      weights = [...weightMap.entries()].map(([name, entry]) => ({ name: name || null, entry }));
    }

    // Size×LineHeight pairs.
    const sizes = pairSizesForRole(role, idx, skipLog);
    if (sizes.length === 0) {
      skipLog.push(`  - ${role}: no composable sizes, skipping role`);
      continue;
    }

    out.push({ role, family: familyEntry, weights, sizes });
  }

  return { roles: out, skipLog };
};

// Classify a role's shape for the output structure.
export const roleShape = (role) => {
  const singleWeight = role.weights.length === 1;
  const singleSize = role.sizes.length === 1;
  if (singleWeight && singleSize) return { kind: 'single' };
  if (singleWeight) return { kind: 'sizes' };
  return { kind: 'weights-sizes' };
};
