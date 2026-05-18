import StyleDictionary from 'style-dictionary';
import { camel } from '../../lib/utils.js';

// iOS consumes radii and spaces. Borders deferred until the iOS team adopts
// them (see STATUS.md). Adding new dimensions later is a config entry here
// — the formatter is shape-independent.
export const dimensionConfigs = [
  {
    root: 'Radius',
    enumName: 'DSRadii',
    file: 'DSRadii.swift',
    outputDir: 'out/ios/radii/',
  },
  {
    root: 'Space',
    enumName: 'DSSpacings',
    file: 'DSSpacings.swift',
    outputDir: 'out/ios/spacings/',
  },
];

export const primitivesSource = 'source/Number Primitives/Values.json';

const sortByValueAsc = (a, b) => (a.$value ?? a.value) - (b.$value ?? b.value);

// Drop the redundant group prefix from a leaf key (`radiusZero` → `zero` for
// root `Radius`). Source JSON encodes the group name into each leaf; the
// generator strips it so emitted property names don't repeat the category.
const stripGroupPrefix = (leaf, root) => {
  const prefix = root.toLowerCase();
  if (leaf.toLowerCase().startsWith(prefix) && leaf.length > prefix.length) {
    const rest = leaf.slice(prefix.length);
    return rest.charAt(0).toLowerCase() + rest.slice(1);
  }
  return leaf;
};

const leafName = (token, cfg) => camel(stripGroupPrefix(token.path[1], cfg.root));

// Swift accepts numeric underscores; format 9999 as 9_999 etc. for readability.
const formatNumber = (n) => {
  const s = String(n);
  if (Number.isInteger(n) && Math.abs(n) >= 1000) {
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '_');
  }
  return s;
};

const formatDimensionFile = (tokens, cfg) => {
  const sorted = tokens.filter((t) => t.path[0] === cfg.root).sort(sortByValueAsc);
  const lines = sorted.map((t) => {
    const value = t.$value ?? t.value;
    return `    public static let ${leafName(t, cfg)}: CGFloat = ${formatNumber(value)}`;
  });
  return [
    'import CoreGraphics',
    '',
    `public enum ${cfg.enumName} {`,
    ...lines,
    '}',
    '',
  ].join('\n');
};

export const register = () => {
  for (const cfg of dimensionConfigs) {
    StyleDictionary.registerFormat({
      name: `swift/dimensions-${cfg.root.toLowerCase()}`,
      format: ({ dictionary }) => formatDimensionFile(dictionary.allTokens, cfg),
    });
  }
};
