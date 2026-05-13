// Build a hierarchical tree from a flat list of resolved Style Dictionary tokens.
// Used by the colors palette generator (semantic tokens form nested groups).

export const buildTree = (tokens) => {
  const root = { path: [], leaves: new Map(), groups: new Map() };
  for (const token of tokens) {
    let cur = root;
    for (let i = 0; i < token.path.length - 1; i++) {
      const seg = token.path[i];
      if (!cur.groups.has(seg)) {
        cur.groups.set(seg, {
          path: token.path.slice(0, i + 1),
          leaves: new Map(),
          groups: new Map(),
        });
      }
      cur = cur.groups.get(seg);
    }
    cur.leaves.set(token.path[token.path.length - 1], token);
  }
  return root;
};

// Return a single sorted array of leaf + group children at this node (alpha by key).
export const sortedEntries = (node) => {
  const out = [];
  for (const [k, v] of node.leaves) out.push({ key: k, kind: 'leaf', token: v });
  for (const [k, v] of node.groups) out.push({ key: k, kind: 'group', group: v });
  return out.sort((a, b) => a.key.localeCompare(b.key));
};
