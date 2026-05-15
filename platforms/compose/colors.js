import StyleDictionary from 'style-dictionary';
import { pascal, isReference } from '../../lib/utils.js';
import { buildTree, sortedEntries } from '../../lib/token-tree.js';
import { propertyName, hexToComposeColor } from './kotlin.js';

const ROOT = 'Color';
const PRIMITIVES_OBJECT = 'PolkadotColorsPrimitives';
export const BASE_CLASS = 'PolkadotColorsPalette';
const PACKAGE = 'io.pcf.polkadotapp.designsystem.colors';

const primitiveName = (path) => {
  const segs = path[0] === ROOT ? path.slice(1) : path;
  return segs.map((seg) => pascal(String(seg))).join('');
};
const groupDeclName = (path) => pascal(String(path[path.length - 1]));
const groupRefName = (path) => path.map((seg) => pascal(String(seg))).join('.');

const referenceToPrimitive = (refValue) => {
  const inner = refValue.slice(1, -1);
  return `${PRIMITIVES_OBJECT}.${primitiveName(inner.split('.'))}`;
};

const leafRhs = (token) => {
  const orig = token.original.$value ?? token.original.value;
  return isReference(orig) ? referenceToPrimitive(orig) : hexToComposeColor(orig);
};

const entryDeclType = (e) => (e.kind === 'leaf' ? 'Color' : groupDeclName(e.group.path));

const formatDataClass = (node, indent) => {
  const className = groupDeclName(node.path);
  const entries = sortedEntries(node);
  const params = entries.map((e, i) => {
    const tail = i < entries.length - 1 ? ',' : '';
    return `${indent}    val ${propertyName(e.key)}: ${entryDeclType(e)}${tail}`;
  });
  const subGroups = entries
    .filter((e) => e.kind === 'group')
    .map((e) => e.group)
    .sort((a, b) => groupDeclName(a.path).localeCompare(groupDeclName(b.path)));

  if (subGroups.length === 0) {
    return [`${indent}data class ${className}(`, ...params, `${indent})`];
  }
  const nestedClasses = subGroups.flatMap((g) => ['', ...formatDataClass(g, indent + '    ')]);
  return [
    `${indent}data class ${className}(`,
    ...params,
    `${indent}) {`,
    ...nestedClasses,
    `${indent}}`,
  ];
};

const COMPOSITION_LOCAL = 'LocalPolkadotColors';

const formatBaseClass = (tree) => {
  const entries = sortedEntries(tree);
  const fields = entries.map(
    (e) => `    abstract val ${propertyName(e.key)}: ${entryDeclType(e)}`
  );
  const topGroups = entries
    .filter((e) => e.kind === 'group')
    .map((e) => e.group)
    .sort((a, b) => groupDeclName(a.path).localeCompare(groupDeclName(b.path)));
  const classes = topGroups.flatMap((g) => ['', ...formatDataClass(g, '    ')]);

  return [
    `package ${PACKAGE}`,
    '',
    'import androidx.compose.runtime.staticCompositionLocalOf',
    'import androidx.compose.ui.graphics.Color',
    '',
    `abstract class ${BASE_CLASS} {`,
    ...fields,
    ...classes,
    '}',
    '',
    `val ${COMPOSITION_LOCAL} = staticCompositionLocalOf<${BASE_CLASS}> {`,
    `    error("${COMPOSITION_LOCAL} not provided")`,
    '}',
    '',
  ].join('\n');
};

const formatNestedInstantiation = (node, indent) => {
  const entries = sortedEntries(node);
  return entries
    .map((e, i) => {
      const tail = i < entries.length - 1 ? ',' : '';
      const prop = propertyName(e.key);
      if (e.kind === 'leaf') return `${indent}${prop} = ${leafRhs(e.token)}${tail}`;
      const ctor = groupRefName(e.group.path);
      const inner = formatNestedInstantiation(e.group, indent + '    ');
      return `${indent}${prop} = ${ctor}(\n${inner}\n${indent})${tail}`;
    })
    .join('\n');
};

const formatPalette = (tree, className) => {
  const overrides = sortedEntries(tree).map((e) => {
    const prop = propertyName(e.key);
    if (e.kind === 'leaf') return `    override val ${prop} = ${leafRhs(e.token)}`;
    const ctor = groupRefName(e.group.path);
    const inner = formatNestedInstantiation(e.group, '        ');
    return `    override val ${prop} = ${ctor}(\n${inner}\n    )`;
  });

  return [
    `package ${PACKAGE}`,
    '',
    'import androidx.compose.ui.graphics.Color',
    '',
    `class ${className} : ${BASE_CLASS}() {`,
    ...overrides,
    '}',
    '',
  ].join('\n');
};

export const register = () => {
  StyleDictionary.registerFormat({
    name: 'compose/color-primitives',
    format: ({ dictionary }) => {
      const tokens = dictionary.allTokens
        .filter((t) => t.path[0] === ROOT)
        .sort((a, b) => a.path.join('.').localeCompare(b.path.join('.')));
      const lines = tokens.map(
        (t) => `    val ${primitiveName(t.path)} = ${hexToComposeColor(t.$value ?? t.value)}`
      );
      return [
        `package ${PACKAGE}`,
        '',
        'import androidx.compose.ui.graphics.Color',
        '',
        `object ${PRIMITIVES_OBJECT} {`,
        ...lines,
        '}',
        '',
      ].join('\n');
    },
  });

  StyleDictionary.registerFormat({
    name: 'compose/color-base',
    format: ({ dictionary }) => {
      const semantic = dictionary.allTokens.filter((t) => t.path[0] !== ROOT);
      return formatBaseClass(buildTree(semantic));
    },
  });

  StyleDictionary.registerFormat({
    name: 'compose/color-palette',
    format: ({ dictionary, options }) => {
      const semantic = dictionary.allTokens.filter((t) => t.path[0] !== ROOT);
      return formatPalette(buildTree(semantic), options.className);
    },
  });
};

export const primitivesSource = 'source/Color Primitives/Values.json';
export const outputDir = 'out/android/colors/';
export const themes = [
  {
    source: 'source/Theme/Polkadot App Default.json',
    className: 'PolkadotDefaultPalette',
    selectionKey: 'polkadotDefault',
    file: 'PolkadotDefaultPalette.kt',
  },
];
