import StyleDictionary from 'style-dictionary';
import { camel, pascal, isReference } from '../../lib/utils.js';
import { parseTypescale, roleShape } from '../../lib/typography-analysis.js';
import { FONT_WEIGHT_CONSTANT } from './kotlin.js';

const PRIMITIVES_ROOT = 'Typography';
const THEME_ROOT = 'Typescale';
const FONT_FAMILIES_OBJECT = 'PolkadotFontFamilies';
export const BASE_CLASS = 'PolkadotTypography';
const PACKAGE = 'io.pcf.polkadotapp.designsystem.typography';

const fontFamilySlug = (fontName) => camel(fontName);

const inlineFamily = (entry) =>
  `${FONT_FAMILIES_OBJECT}.${fontFamilySlug(String(entry.resolved))}`;

const inlineSp = (entry) => `${entry.resolved}.sp`;

const inlineWeight = (entry) => {
  if (isReference(entry.ref)) {
    const leaf = String(entry.ref.slice(1, -1).split('.').pop()).toLowerCase();
    return FONT_WEIGHT_CONSTANT[leaf] ?? `FontWeight(${entry.resolved})`;
  }
  return `FontWeight(${entry.resolved})`;
};

const renderTextStyle = (variant, indent) => [
  `TextStyle(`,
  `${indent}    fontFamily = ${inlineFamily(variant.font)},`,
  `${indent}    fontWeight = ${inlineWeight(variant.weight)},`,
  `${indent}    fontSize = ${inlineSp(variant.size)},`,
  `${indent}    lineHeight = ${inlineSp(variant.lineHeight)},`,
  `${indent}    letterSpacing = ${inlineSp(variant.tracking)}`,
  `${indent})`,
].join('\n');

// "Inter" -> "inter", "Martian Mono" -> "martian_mono". The lib bundles one variable
// font per family at `res/font/<slug>_variable.ttf`; Compose selects the weight axis
// via FontVariation.Settings at the Font(...) call site.
const fontResourceSlug = (name) =>
  String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Walk all Typescale variants and collect every (font, weight) combination that the
// typography actually uses. The bundled variable font covers any weight; we emit one
// Font entry per weight so Compose can pick the right `FontVariation.weight(n)` to
// stamp onto the variable axis when resolving a TextStyle.
const collectFamilyWeights = (themeTokens) => {
  const { roles } = parseTypescale(themeTokens);
  // Map<fontName, Map<numericWeight, weightExpression>>
  const families = new Map();
  for (const role of roles) {
    for (const size of role.sizes) {
      for (const variant of size.variants) {
        const fontName = String(variant.font.resolved);
        const numeric = Number(variant.weight.resolved);
        const expr = inlineWeight(variant.weight);
        if (!families.has(fontName)) families.set(fontName, new Map());
        if (!families.get(fontName).has(numeric)) families.get(fontName).set(numeric, expr);
      }
    }
  }
  return families;
};

const formatFontFamiliesObject = (_primitives, themeTokens) => {
  const familyWeights = collectFamilyWeights(themeTokens);
  const sortedNames = [...familyWeights.keys()].sort();
  const familyDecls = sortedNames.flatMap((name) => {
    const slug = fontFamilySlug(name);
    const resource = `R.font.${fontResourceSlug(name)}_variable`;
    const entries = [...familyWeights.get(name).entries()].sort((a, b) => a[0] - b[0]);
    const fontLines = entries.map(([numeric, expr], i) => {
      const tail = i < entries.length - 1 ? ',' : '';
      return `        Font(${resource}, ${expr}, variationSettings = FontVariation.Settings(FontVariation.weight(${numeric})))${tail}`;
    });
    return [`    val ${slug} = FontFamily(`, ...fontLines, `    )`];
  });

  return [
    `@file:OptIn(ExperimentalTextApi::class)`,
    '',
    `package ${PACKAGE}`,
    '',
    'import androidx.compose.ui.text.ExperimentalTextApi',
    'import androidx.compose.ui.text.font.Font',
    'import androidx.compose.ui.text.font.FontFamily',
    'import androidx.compose.ui.text.font.FontVariation',
    'import androidx.compose.ui.text.font.FontWeight',
    'import io.pcf.polkadotapp.designsystem.R',
    '',
    `object ${FONT_FAMILIES_OBJECT} {`,
    ...familyDecls,
    '}',
    '',
  ].join('\n');
};

// Render the inner data-class blocks for a role's base class shape.
const baseClassRoleBlocks = (role) => {
  const className = pascal(role.name);
  const shape = roleShape(role);

  if (shape.kind === 'flat') {
    const params = role.sizes.map((s, i) => {
      const tail = i < role.sizes.length - 1 ? ',' : '';
      return `        val ${camel(s.name)}: TextStyle${tail}`;
    });
    return ['', `    data class ${className}(`, ...params, `    )`];
  }

  if (shape.kind === 'uniform') {
    const params = role.sizes.map((s, i) => {
      const tail = i < role.sizes.length - 1 ? ',' : '';
      return `        val ${camel(s.name)}: Sizes${tail}`;
    });
    const sizesParams = shape.variantKeys.map((k, i) => {
      const tail = i < shape.variantKeys.length - 1 ? ',' : '';
      return `            val ${k}: TextStyle${tail}`;
    });
    return [
      '',
      `    data class ${className}(`,
      ...params,
      `    ) {`,
      '',
      `        data class Sizes(`,
      ...sizesParams,
      `        )`,
      `    }`,
    ];
  }

  // mixed
  const outerParams = role.sizes.map((s, i) => {
    const tail = i < role.sizes.length - 1 ? ',' : '';
    return `        val ${camel(s.name)}: ${pascal(s.name)}${tail}`;
  });
  const sizeBlocks = role.sizes.flatMap((s) => {
    const params = s.variants.map((v, i) => {
      const tail = i < s.variants.length - 1 ? ',' : '';
      return `            val ${v.key}: TextStyle${tail}`;
    });
    return [
      '',
      `        data class ${pascal(s.name)}(`,
      ...params,
      `        )`,
    ];
  });
  return [
    '',
    `    data class ${className}(`,
    ...outerParams,
    `    ) {`,
    ...sizeBlocks,
    `    }`,
  ];
};

const COMPOSITION_LOCAL = 'LocalPolkadotTypography';

const formatTypographyBaseClass = (roles) => {
  const fields = roles.map((r) => `    abstract val ${camel(r.name)}: ${pascal(r.name)}`);
  const blocks = roles.flatMap(baseClassRoleBlocks);

  return [
    `package ${PACKAGE}`,
    '',
    'import androidx.compose.runtime.staticCompositionLocalOf',
    'import androidx.compose.ui.text.TextStyle',
    '',
    `abstract class ${BASE_CLASS} {`,
    ...fields,
    ...blocks,
    '}',
    '',
    `val ${COMPOSITION_LOCAL} = staticCompositionLocalOf<${BASE_CLASS}> {`,
    `    error("${COMPOSITION_LOCAL} not provided")`,
    '}',
    '',
  ].join('\n');
};

const concreteRoleOverride = (role) => {
  const propName = camel(role.name);
  const className = pascal(role.name);
  const shape = roleShape(role);

  if (shape.kind === 'flat') {
    const lines = role.sizes.map((s, i) => {
      const tail = i < role.sizes.length - 1 ? ',' : '';
      const style = renderTextStyle(s.variants[0], '        ');
      return `        ${camel(s.name)} = ${style}${tail}`;
    });
    return [`    override val ${propName} = ${className}(`, ...lines, '    )'].join('\n');
  }

  if (shape.kind === 'uniform') {
    const lines = role.sizes.map((s, i) => {
      const tail = i < role.sizes.length - 1 ? ',' : '';
      const variantLines = s.variants.map((v, vi) => {
        const vTail = vi < s.variants.length - 1 ? ',' : '';
        const style = renderTextStyle(v, '            ');
        return `            ${v.key} = ${style}${vTail}`;
      });
      return [
        `        ${camel(s.name)} = ${className}.Sizes(`,
        ...variantLines,
        `        )${tail}`,
      ].join('\n');
    });
    return [`    override val ${propName} = ${className}(`, ...lines, '    )'].join('\n');
  }

  // mixed
  const lines = role.sizes.map((s, i) => {
    const tail = i < role.sizes.length - 1 ? ',' : '';
    const sizeClass = pascal(s.name);
    const variantLines = s.variants.map((v, vi) => {
      const vTail = vi < s.variants.length - 1 ? ',' : '';
      const style = renderTextStyle(v, '            ');
      return `            ${v.key} = ${style}${vTail}`;
    });
    return [
      `        ${camel(s.name)} = ${className}.${sizeClass}(`,
      ...variantLines,
      `        )${tail}`,
    ].join('\n');
  });
  return [`    override val ${propName} = ${className}(`, ...lines, '    )'].join('\n');
};

const formatTypographyConcrete = (roles, className) => {
  const overrides = roles.map(concreteRoleOverride);
  return [
    `package ${PACKAGE}`,
    '',
    'import androidx.compose.ui.text.TextStyle',
    'import androidx.compose.ui.text.font.FontWeight',
    'import androidx.compose.ui.unit.sp',
    '',
    `class ${className} : ${BASE_CLASS}() {`,
    ...overrides,
    '}',
    '',
  ].join('\n');
};

export const register = () => {
  StyleDictionary.registerFormat({
    name: 'compose/typography-font-families',
    format: ({ dictionary }) => {
      const primitives = dictionary.allTokens.filter((t) => t.path[0] === PRIMITIVES_ROOT);
      const themeTokens = dictionary.allTokens.filter((t) => t.path[0] === THEME_ROOT);
      return formatFontFamiliesObject(primitives, themeTokens);
    },
  });

  StyleDictionary.registerFormat({
    name: 'compose/typography-base',
    format: ({ dictionary }) => {
      const themeTokens = dictionary.allTokens.filter((t) => t.path[0] === THEME_ROOT);
      const { roles, skipLog } = parseTypescale(themeTokens);
      if (skipLog.length > 0) {
        console.log('\n[typography] Skipped during base-class analysis:');
        for (const line of skipLog) console.log(line);
      }
      return formatTypographyBaseClass(roles);
    },
  });

  StyleDictionary.registerFormat({
    name: 'compose/typography-concrete',
    format: ({ dictionary, options }) => {
      const themeTokens = dictionary.allTokens.filter((t) => t.path[0] === THEME_ROOT);
      const { roles, skipLog } = parseTypescale(themeTokens);
      if (skipLog.length > 0) {
        console.log(`\n[typography] Skipped while generating ${options.className}:`);
        for (const line of skipLog) console.log(line);
      }
      return formatTypographyConcrete(roles, options.className);
    },
  });
};

export const primitivesSource = 'source/Number Primitives/Values.json';
export const outputDir = 'out/android/typography/';
export const themes = [
  {
    source: 'source/Typography/Polkadot App Default.json',
    className: 'PolkadotDefaultTypography',
    file: 'PolkadotDefaultTypography.kt',
  },
];
