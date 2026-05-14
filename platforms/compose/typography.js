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

const formatFontFamiliesObject = (primitives) => {
  // Source shape: path = ['Typography', 'fontStyle', 'sans|mono|accent'] with the font name as $value.
  const fontStyles = primitives.filter((t) => t.path[1] === 'fontStyle');
  const uniqueNames = [...new Set(fontStyles.map((t) => String(t.$value ?? t.value)))].sort();
  const lines = uniqueNames.map(
    (name) =>
      `    val ${fontFamilySlug(name)} = FontFamily(Font(googleFont = GoogleFont("${name}"), fontProvider = provider))`
  );
  return [
    `package ${PACKAGE}`,
    '',
    'import androidx.compose.ui.text.font.FontFamily',
    'import androidx.compose.ui.text.googlefonts.Font',
    'import androidx.compose.ui.text.googlefonts.GoogleFont',
    'import io.pcf.polkadotapp.designsystem.R',
    '',
    `object ${FONT_FAMILIES_OBJECT} {`,
    '    private val provider = GoogleFont.Provider(',
    '        providerAuthority = "com.google.android.gms.fonts",',
    '        providerPackage = "com.google.android.gms",',
    '        certificates = R.array.com_google_android_gms_fonts_certs',
    '    )',
    '',
    ...lines,
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
      return formatFontFamiliesObject(primitives);
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
