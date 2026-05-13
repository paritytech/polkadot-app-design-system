import StyleDictionary from 'style-dictionary';
import { propertyName } from './kotlin.js';

// Per-category configs. Each entry maps a source token group (Spacer/Radius/Border)
// to an abstract+concrete Kotlin class pair.
export const dimensionConfigs = [
  {
    root: 'Spacer',
    baseClass: 'NovaSpacings',
    concreteClass: 'RealNovaSpacings',
    package: 'io.pcf.polkadotapp.designsystem.spacings',
    baseFormat: 'compose/spacings-base',
    concreteFormat: 'compose/spacings-concrete',
    baseFile: 'NovaSpacings.kt',
    concreteFile: 'RealNovaSpacings.kt',
    outputDir: 'out/android/spacings/',
    kind: 'dp',
  },
  {
    root: 'Radius',
    baseClass: 'NovaRadii',
    concreteClass: 'RealNovaRadii',
    package: 'io.pcf.polkadotapp.designsystem.radii',
    baseFormat: 'compose/radii-base',
    concreteFormat: 'compose/radii-concrete',
    baseFile: 'NovaRadii.kt',
    concreteFile: 'RealNovaRadii.kt',
    outputDir: 'out/android/radii/',
    kind: 'shape',
    // Leaf names matching this key are emitted as CircleShape rather than RoundedCornerShape.
    fullShapeKey: 'full',
  },
  {
    root: 'Border',
    baseClass: 'NovaBorders',
    concreteClass: 'RealNovaBorders',
    package: 'io.pcf.polkadotapp.designsystem.borders',
    baseFormat: 'compose/borders-base',
    concreteFormat: 'compose/borders-concrete',
    baseFile: 'NovaBorders.kt',
    concreteFile: 'RealNovaBorders.kt',
    outputDir: 'out/android/borders/',
    kind: 'dp',
  },
];

export const primitivesSource = 'source/New Number:String/Strings/Values.json';

const sortByValueAsc = (a, b) => (a.$value ?? a.value) - (b.$value ?? b.value);

const dimensionFieldType = (cfg) => (cfg.kind === 'shape' ? 'Shape' : 'Dp');

const dimensionConcreteRhs = (token, cfg) => {
  const value = token.$value ?? token.value;
  const leaf = token.path[1];
  if (cfg.kind === 'shape') {
    return leaf === cfg.fullShapeKey ? 'CircleShape' : `RoundedCornerShape(${value}.dp)`;
  }
  return `${value}.dp`;
};

const formatDimensionBase = (tokens, cfg) => {
  const sorted = tokens.filter((t) => t.path[0] === cfg.root).sort(sortByValueAsc);
  const type = dimensionFieldType(cfg);
  const fields = sorted.map((t) => `    abstract val ${propertyName(t.path[1])}: ${type}`);
  const imports =
    cfg.kind === 'shape'
      ? ['import androidx.compose.ui.graphics.Shape']
      : ['import androidx.compose.ui.unit.Dp'];
  return [
    `package ${cfg.package}`,
    '',
    ...imports,
    '',
    `abstract class ${cfg.baseClass} {`,
    ...fields,
    '}',
    '',
  ].join('\n');
};

const formatDimensionConcrete = (tokens, cfg) => {
  const sorted = tokens.filter((t) => t.path[0] === cfg.root).sort(sortByValueAsc);
  const type = dimensionFieldType(cfg);
  const overrides = sorted.map(
    (t) => `    override val ${propertyName(t.path[1])}: ${type} = ${dimensionConcreteRhs(t, cfg)}`
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
