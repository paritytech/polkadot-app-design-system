import StyleDictionary from 'style-dictionary';
import { pascal, camel, isReference } from '../../lib/utils.js';
import { analyseTypographyRoles, roleShape } from '../../lib/typography-analysis.js';
import { propertyName, FONT_WEIGHT_CONSTANT } from './kotlin.js';

const ROOT = 'Typography';
const FONT_FAMILIES_OBJECT = 'NovaFontFamilies';
export const BASE_CLASS = 'NovaTypography';
const PACKAGE = 'io.pcf.polkadotapp.designsystem.typography';

const fontFamilySlug = (fontName) => camel(fontName);

const inlineFamily = (entry) =>
  `${FONT_FAMILIES_OBJECT}.${fontFamilySlug(String(entry.resolved))}`;
const inlineSize = (entry) => `${entry.resolved}.sp`;
const inlineWeight = (entry) => {
  if (isReference(entry.ref)) {
    const leaf = String(entry.ref.slice(1, -1).split('.').pop()).toLowerCase();
    return FONT_WEIGHT_CONSTANT[leaf] ?? `FontWeight(${entry.resolved})`;
  }
  return `FontWeight(${entry.resolved})`;
};

const renderTextStyle = (familyEntry, weightEntry, fontSizeEntry, lineHeightEntry, indent) => [
  `TextStyle(`,
  `${indent}    fontFamily = ${inlineFamily(familyEntry)},`,
  `${indent}    fontWeight = ${inlineWeight(weightEntry)},`,
  `${indent}    fontSize = ${inlineSize(fontSizeEntry)},`,
  `${indent}    lineHeight = ${inlineSize(lineHeightEntry)}`,
  `${indent})`,
].join('\n');

const sortedByCamelKey = (items, keyFn) =>
  items.slice().sort((a, b) => camel(keyFn(a)).localeCompare(camel(keyFn(b))));

const formatFontFamiliesObject = (primitives) => {
  const fontStyles = primitives.filter((t) => t.path[1] === 'font-style');
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

const formatTypographyBaseClass = (roles) => {
  const sortedRoles = roles.slice().sort((a, b) => a.role.localeCompare(b.role));

  const fields = sortedRoles.map((r) => {
    const propName = propertyName(r.role);
    const shape = roleShape(r);
    if (shape.kind === 'single') return `    abstract val ${propName}: TextStyle`;
    return `    abstract val ${propName}: ${pascal(r.role)}`;
  });

  const classBlocks = sortedRoles
    .filter((r) => roleShape(r).kind !== 'single')
    .flatMap((r) => {
      const shape = roleShape(r);
      const className = pascal(r.role);
      if (shape.kind === 'sizes') {
        const sortedSizes = sortedByCamelKey(r.sizes, (s) => s.size || 'regular');
        const params = sortedSizes.map((s, i) => {
          const tail = i < sortedSizes.length - 1 ? ',' : '';
          return `        val ${propertyName(s.size || 'regular')}: TextStyle${tail}`;
        });
        return ['', `    data class ${className}(`, ...params, `    )`];
      }
      const sortedWeights = sortedByCamelKey(r.weights, (w) => w.name || 'regular');
      const sortedSizes = sortedByCamelKey(r.sizes, (s) => s.size || 'regular');
      const weightParams = sortedWeights.map((w, i) => {
        const tail = i < sortedWeights.length - 1 ? ',' : '';
        return `        val ${propertyName(w.name || 'regular')}: Sizes${tail}`;
      });
      const sizeParams = sortedSizes.map((s, i) => {
        const tail = i < sortedSizes.length - 1 ? ',' : '';
        return `            val ${propertyName(s.size || 'regular')}: TextStyle${tail}`;
      });
      return [
        '',
        `    data class ${className}(`,
        ...weightParams,
        `    ) {`,
        '',
        `        data class Sizes(`,
        ...sizeParams,
        `        )`,
        `    }`,
      ];
    });

  return [
    `package ${PACKAGE}`,
    '',
    'import androidx.compose.ui.text.TextStyle',
    '',
    `abstract class ${BASE_CLASS} {`,
    ...fields,
    ...classBlocks,
    '}',
    '',
  ].join('\n');
};

const formatTypographyConcrete = (roles, className) => {
  const sortedRoles = roles.slice().sort((a, b) => a.role.localeCompare(b.role));

  const overrides = sortedRoles.map((r) => {
    const propName = propertyName(r.role);
    const shape = roleShape(r);

    if (shape.kind === 'single') {
      const weight = r.weights[0];
      const size = r.sizes[0];
      const style = renderTextStyle(r.family, weight.entry, size.fontSize, size.lineHeight, '    ');
      return `    override val ${propName} = ${style}`;
    }

    const ctor = pascal(r.role);

    if (shape.kind === 'sizes') {
      const weight = r.weights[0];
      const sortedSizes = sortedByCamelKey(r.sizes, (s) => s.size || 'regular');
      const lines = sortedSizes.map((s, i) => {
        const tail = i < sortedSizes.length - 1 ? ',' : '';
        const style = renderTextStyle(r.family, weight.entry, s.fontSize, s.lineHeight, '        ');
        return `        ${propertyName(s.size || 'regular')} = ${style}${tail}`;
      });
      return [`    override val ${propName} = ${ctor}(`, ...lines, '    )'].join('\n');
    }

    const sortedWeights = sortedByCamelKey(r.weights, (w) => w.name || 'regular');
    const sortedSizes = sortedByCamelKey(r.sizes, (s) => s.size || 'regular');
    const weightLines = sortedWeights.map((w, wi) => {
      const wTail = wi < sortedWeights.length - 1 ? ',' : '';
      const sizeLines = sortedSizes.map((s, si) => {
        const sTail = si < sortedSizes.length - 1 ? ',' : '';
        const style = renderTextStyle(r.family, w.entry, s.fontSize, s.lineHeight, '            ');
        return `            ${propertyName(s.size || 'regular')} = ${style}${sTail}`;
      });
      return [
        `        ${propertyName(w.name || 'regular')} = ${ctor}.Sizes(`,
        ...sizeLines,
        `        )${wTail}`,
      ].join('\n');
    });
    return [`    override val ${propName} = ${ctor}(`, ...weightLines, '    )'].join('\n');
  });

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
      const primitives = dictionary.allTokens.filter((t) => t.path[0] === ROOT);
      return formatFontFamiliesObject(primitives);
    },
  });

  StyleDictionary.registerFormat({
    name: 'compose/typography-base',
    format: ({ dictionary }) => {
      const themeTokens = dictionary.allTokens.filter((t) => t.path[0] !== ROOT);
      const { roles, skipLog } = analyseTypographyRoles(themeTokens);
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
      const themeTokens = dictionary.allTokens.filter((t) => t.path[0] !== ROOT);
      const { roles, skipLog } = analyseTypographyRoles(themeTokens);
      if (skipLog.length > 0) {
        console.log(`\n[typography] Skipped while generating ${options.className}:`);
        for (const line of skipLog) console.log(line);
      }
      return formatTypographyConcrete(roles, options.className);
    },
  });
};

export const primitivesSource = 'source/New Number:String/Strings/Values.json';
export const outputDir = 'out/android/typography/';
export const themes = [
  {
    source: 'source/Typography/Polkadot App Default.json',
    className: 'DefaultTypography',
    file: 'DefaultTypography.kt',
  },
  {
    source: 'source/Typography/Value.json',
    className: 'ValueTypography',
    file: 'ValueTypography.kt',
  },
];
