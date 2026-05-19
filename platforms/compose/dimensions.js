import StyleDictionary from 'style-dictionary';
import { propertyName } from './kotlin.js';

// Per-category configs. Each entry maps a source token group (Spacer/Radius/Border)
// to an abstract+concrete Kotlin class pair.
export const dimensionConfigs = [
  {
    root: 'Space',
    baseClass: 'PolkadotSpacings',
    concreteClass: 'PolkadotDefaultSpacings',
    package: 'io.pcf.polkadotapp.designsystem.spacings',
    baseFormat: 'compose/spacings-base',
    concreteFormat: 'compose/spacings-concrete',
    baseFile: 'PolkadotSpacings.kt',
    concreteFile: 'PolkadotDefaultSpacings.kt',
    outputDir: 'out/android/spacings/',
    kind: 'dp',
    compositionLocal: 'LocalPolkadotSpacings',
  },
  {
    root: 'Radius',
    baseClass: 'PolkadotRadii',
    concreteClass: 'PolkadotDefaultRadii',
    package: 'io.pcf.polkadotapp.designsystem.radii',
    baseFormat: 'compose/radii-base',
    concreteFormat: 'compose/radii-concrete',
    baseFile: 'PolkadotRadii.kt',
    concreteFile: 'PolkadotDefaultRadii.kt',
    outputDir: 'out/android/radii/',
    kind: 'dp',
    // `full` has no meaningful Dp value (it's CircleShape on the shapes side); skip it here.
    skipLeaves: ['full'],
    compositionLocal: 'LocalPolkadotRadii',
  },
  {
    root: 'Radius',
    baseClass: 'PolkadotShapes',
    concreteClass: 'PolkadotDefaultShapes',
    package: 'io.pcf.polkadotapp.designsystem.shapes',
    baseFormat: 'compose/shapes-base',
    concreteFormat: 'compose/shapes-concrete',
    baseFile: 'PolkadotShapes.kt',
    concreteFile: 'PolkadotDefaultShapes.kt',
    outputDir: 'out/android/shapes/',
    kind: 'shape',
    // Leaf names matching this key are emitted as CircleShape rather than RoundedCornerShape.
    fullShapeKey: 'full',
    compositionLocal: 'LocalPolkadotShapes',
  },
  {
    root: 'Border',
    baseClass: 'PolkadotBorders',
    concreteClass: 'PolkadotDefaultBorders',
    package: 'io.pcf.polkadotapp.designsystem.borders',
    baseFormat: 'compose/borders-base',
    concreteFormat: 'compose/borders-concrete',
    baseFile: 'PolkadotBorders.kt',
    concreteFile: 'PolkadotDefaultBorders.kt',
    outputDir: 'out/android/borders/',
    kind: 'dp',
    compositionLocal: 'LocalPolkadotBorders',
  },
];

export const primitivesSource = 'source/Number Primitives/Values.json';

const sortByValueAsc = (a, b) => (a.$value ?? a.value) - (b.$value ?? b.value);

const dimensionFieldType = (cfg) => (cfg.kind === 'shape' ? 'Shape' : 'Dp');

// Drop the redundant group prefix from a leaf key (e.g. "spaceZero" → "zero" for root "Space").
// Source JSON encodes the group name into each leaf; the generator strips it so emitted property
// names don't repeat the category (consumer writes `spacings.zero`, not `spacings.spaceZero`).
const stripGroupPrefix = (leaf, root) => {
  const prefix = root.toLowerCase();
  if (leaf.toLowerCase().startsWith(prefix) && leaf.length > prefix.length) {
    const rest = leaf.slice(prefix.length);
    return rest.charAt(0).toLowerCase() + rest.slice(1);
  }
  return leaf;
};

const leafName = (token, cfg) => stripGroupPrefix(token.path[1], cfg.root);

const dimensionConcreteRhs = (token, cfg) => {
  const value = token.$value ?? token.value;
  if (cfg.kind === 'shape') {
    return leafName(token, cfg) === cfg.fullShapeKey ? 'CircleShape' : `RoundedCornerShape(${value}.dp)`;
  }
  return `${value}.dp`;
};

const tokensForCfg = (tokens, cfg) => {
  const skip = new Set(cfg.skipLeaves ?? []);
  return tokens
    .filter((t) => t.path[0] === cfg.root && !skip.has(leafName(t, cfg)))
    .sort(sortByValueAsc);
};

const formatDimensionBase = (tokens, cfg) => {
  const sorted = tokensForCfg(tokens, cfg);
  const type = dimensionFieldType(cfg);
  const fields = sorted.map((t) => `    abstract val ${propertyName(leafName(t, cfg))}: ${type}`);
  const typeImports =
    cfg.kind === 'shape'
      ? ['import androidx.compose.ui.graphics.Shape']
      : ['import androidx.compose.ui.unit.Dp'];
  const imports = [...typeImports, 'import androidx.compose.runtime.staticCompositionLocalOf'];
  return [
    `package ${cfg.package}`,
    '',
    ...imports,
    '',
    `abstract class ${cfg.baseClass} {`,
    ...fields,
    '}',
    '',
    `val ${cfg.compositionLocal} = staticCompositionLocalOf<${cfg.baseClass}> {`,
    `    error("${cfg.compositionLocal} not provided")`,
    '}',
    '',
  ].join('\n');
};

const formatDimensionConcrete = (tokens, cfg) => {
  const sorted = tokensForCfg(tokens, cfg);
  const type = dimensionFieldType(cfg);
  const overrides = sorted.map(
    (t) => `    override val ${propertyName(leafName(t, cfg))}: ${type} = ${dimensionConcreteRhs(t, cfg)}`
  );
  const imports =
    cfg.kind === 'shape'
      ? [
          'import androidx.compose.foundation.shape.CircleShape',
          'import androidx.compose.foundation.shape.RoundedCornerShape',
          'import androidx.compose.ui.graphics.Shape',
          'import androidx.compose.ui.unit.dp',
        ]
      : ['import androidx.compose.ui.unit.Dp', 'import androidx.compose.ui.unit.dp'];
  return [
    `package ${cfg.package}`,
    '',
    ...imports,
    '',
    `class ${cfg.concreteClass} : ${cfg.baseClass}() {`,
    ...overrides,
    '}',
    '',
  ].join('\n');
};

export const register = () => {
  for (const cfg of dimensionConfigs) {
    StyleDictionary.registerFormat({
      name: cfg.baseFormat,
      format: ({ dictionary }) => formatDimensionBase(dictionary.allTokens, cfg),
    });
    StyleDictionary.registerFormat({
      name: cfg.concreteFormat,
      format: ({ dictionary }) => formatDimensionConcrete(dictionary.allTokens, cfg),
    });
  }
};
