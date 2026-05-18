import StyleDictionary from 'style-dictionary';
import { camel, isReference } from '../../lib/utils.js';
import { fontWeightExpr } from './swift.js';

const THEME_ROOT = 'Typescale';

// iOS uses semantic role names for the font family, not literal font names.
// Map from Figma/source font name → Swift TypographyFontFamily enum case.
// New families added in source must get an entry here or the build errors.
const FONT_ROLE_BY_NAME = {
  Inter: 'sans',
  'Martian Mono': 'mono',
  Manrope: 'accent',
};

const fontRoleSlug = (fontName) => {
  const role = FONT_ROLE_BY_NAME[fontName];
  if (!role) {
    throw new Error(
      `[swift typography] No semantic role mapped for font "${fontName}". ` +
        `Add it to FONT_ROLE_BY_NAME in platforms/swift/typography.js.`
    );
  }
  return role;
};

// Role + size ordering mirrors the iOS hand-written file.
const ROLE_ORDER = ['Display', 'Headline', 'Title', 'Paragraph', 'Body', 'Label', 'Emoji'];
const SIZE_ORDER = ['ExtraLarge', 'Large', 'Medium', 'Small', 'Tiny'];

const orderIndex = (list, item) => {
  const i = list.indexOf(item);
  return i < 0 ? list.length : i;
};

const buildEntries = (themeTokens) => {
  const byName = new Map();
  for (const t of themeTokens) {
    if (t.path[0] !== THEME_ROOT) continue;
    const entryName = t.path[1];
    const prop = t.path[2];
    const ref = t.original.$value ?? t.original.value;
    const resolved = t.$value ?? t.value;
    if (!byName.has(entryName)) byName.set(entryName, {});
    byName.get(entryName)[prop] = { ref, resolved };
  }
  return byName;
};

const isBroken = (entry) =>
  entry === undefined || (isReference(entry.ref) && entry.resolved === entry.ref);

const splitName = (name) => {
  const idx = name.indexOf(' ');
  if (idx < 0) return { role: name, size: '' };
  return { role: name.slice(0, idx), size: name.slice(idx + 1) };
};

const sortedEntries = (byName) => {
  const arr = [];
  for (const [name, props] of byName.entries()) {
    const missing = ['font', 'weight', 'size', 'lineHeight'].filter((k) => isBroken(props[k]));
    if (missing.length > 0) {
      arr.push({ name, props, broken: missing });
      continue;
    }
    if (isBroken(props.tracking)) props.tracking = { ref: '0', resolved: 0 };
    const { role, size } = splitName(name);
    arr.push({ name, props, role, size });
  }
  const valid = arr.filter((e) => !e.broken);
  const skipLog = arr
    .filter((e) => e.broken)
    .map((e) => `  - ${e.name}: missing/unresolved ${e.broken.join(', ')}`);
  valid.sort((a, b) => {
    const r = orderIndex(ROLE_ORDER, a.role) - orderIndex(ROLE_ORDER, b.role);
    if (r !== 0) return r;
    return orderIndex(SIZE_ORDER, a.size) - orderIndex(SIZE_ORDER, b.size);
  });
  return { entries: valid, skipLog };
};

const specCase = (entry) => {
  const caseName = camel(entry.name);
  const family = `.${fontRoleSlug(entry.props.font.resolved)}`;
  const monoFamily = !isBroken(entry.props.fontMono)
    ? `.${fontRoleSlug(entry.props.fontMono.resolved)}`
    : null;
  const weight = fontWeightExpr(entry.props.weight);
  const emphasizedWeight = !isBroken(entry.props.weightEmphasized)
    ? fontWeightExpr(entry.props.weightEmphasized)
    : null;
  const size = entry.props.size.resolved;
  const lineHeight = entry.props.lineHeight.resolved;
  const tracking = entry.props.tracking.resolved;

  const fields = [['family', family]];
  if (monoFamily) fields.push(['monoFamily', monoFamily]);
  fields.push(['size', size]);
  fields.push(['weight', weight]);
  if (emphasizedWeight) fields.push(['emphasizedWeight', emphasizedWeight]);
  fields.push(['lineHeight', lineHeight]);
  fields.push(['tracking', tracking]);

  const multiline = monoFamily !== null || emphasizedWeight !== null;
  if (!multiline) {
    const args = fields.map(([k, v]) => `${k}: ${v}`).join(', ');
    return `        case .${caseName}: .init(${args})`;
  }
  const lines = fields.map(
    ([k, v], i) => `                ${k}: ${v}${i < fields.length - 1 ? ',' : ''}`
  );
  return [`        case .${caseName}: .init(`, ...lines, '            )'].join('\n');
};

// Group consecutive entries by role for MARK headers in the UIFont/Font
// extensions, and for blank-line separators between role groups in the
// TypographyStyle static factories.
const groupByRole = (entries) => {
  const groups = [];
  let current = null;
  for (const e of entries) {
    if (current && current.role === e.role) {
      current.entries.push(e);
    } else {
      current = { role: e.role, entries: [e] };
      groups.push(current);
    }
  }
  return groups;
};

const formatTypescale = (entries) => {
  const cases = entries.map((e) => `        case ${camel(e.name)}`);
  const specs = entries.map(specCase);

  const groups = groupByRole(entries);
  const staticGroups = groups.flatMap((g, i) => {
    const prefix = i === 0 ? [] : [''];
    return [
      ...prefix,
      ...g.entries.map(
        (e) => `    static var ${camel(e.name)}: TypographyStyle { .init(typescale: .${camel(e.name)}) }`
      ),
    ];
  });

  return [
    'import CoreGraphics',
    '',
    'public extension TypographyStyle {',
    '    enum Typescale: String, CaseIterable, Hashable {',
    ...cases,
    '    }',
    '}',
    '',
    'public extension TypographyStyle.Typescale {',
    '    var spec: TypographyStyleSpec {',
    '        switch self {',
    ...specs,
    '        }',
    '    }',
    '}',
    '',
    'public extension TypographyStyle {',
    ...staticGroups,
    '}',
    '',
  ].join('\n');
};

const intersperseRoleMark = (groups, render) =>
  groups.flatMap((g, i) => {
    const header = i === 0 ? [`    // MARK: ${g.role}`, ''] : ['', `    // MARK: ${g.role}`, ''];
    return [...header, ...g.entries.map(render)];
  });

// Font tokens are @MainActor because they resolve through TypographyManager,
// which lives on the main actor. Theme color tokens stay non-isolated since
// they go through UIColor(dynamicProvider:) — that resolver is pure and reads
// the live trait collection without touching the manager.
const formatUIFontExtension = (groups) => {
  const lines = intersperseRoleMark(
    groups,
    (e) => `    static var ${camel(e.name)}: UIFont { .app(.${camel(e.name)}) }`
  );
  return [
    'import UIKit',
    '',
    '@MainActor',
    'public extension UIFont {',
    ...lines,
    '}',
    '',
  ].join('\n');
};

const formatSwiftUIFontExtension = (groups) => {
  const lines = intersperseRoleMark(
    groups,
    (e) => `    static var ${camel(e.name)}: Font { .app(.${camel(e.name)}) }`
  );
  return [
    'import SwiftUI',
    '',
    '@MainActor',
    'public extension Font {',
    ...lines,
    '}',
    '',
  ].join('\n');
};

const formatSelection = (families) => {
  const cases = families.map((f) => `    case ${f.selectionKey}`);
  return [
    'public enum TypographySelection: String, Codable, CaseIterable, Hashable {',
    ...cases,
    '}',
    '',
  ].join('\n');
};

const formatRegistry = (families) => {
  const factories = families.map(
    (f, i) => `        .${f.selectionKey}: ${f.className}.init${i < families.length - 1 ? ',' : ''}`
  );
  return [
    'public enum TypographyFamiliesRegistry {',
    '    public static let factories: [TypographySelection: () -> TypographyFamily] = [',
    ...factories,
    '    ]',
    '',
    `    public static let \`default\`: TypographySelection = .${families[0].selectionKey}`,
    '',
    '    public static func makeFamily(_ selection: TypographySelection) -> TypographyFamily {',
    `        (factories[selection] ?? ${families[0].className}.init)()`,
    '    }',
    '}',
    '',
  ].join('\n');
};

// Walk primitives at `Typography.{fontStyle,fontWeight}.*` — these drive the
// case lists of TypographyFontFamily / TypographyFontWeight. Keeping them
// data-driven prevents silent drift when design adds a new family-role or a
// new weight (the alternative is hand-maintained Swift enums that no longer
// match the source).
const primitiveCases = (dict, group) =>
  dict.allTokens.filter((t) => t.path[0] === 'Typography' && t.path[1] === group);

const pascalCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const postscriptSlug = (fontName) => fontName.replace(/\s+/g, '');

const formatFontFamilyEnum = (cases) => {
  const lines = cases.map((t) => `    case ${t.path[2]}`);
  return [
    'public enum TypographyFontFamily: String, Hashable {',
    ...lines,
    '}',
    '',
  ].join('\n');
};

const formatFontWeightEnum = (cases) => {
  const lines = cases.map((t) => `    case ${t.path[2]}`);
  return [
    'public enum TypographyFontWeight: Hashable {',
    ...lines,
    '}',
    '',
  ].join('\n');
};

// Per-family concrete `TypographyFamily` impl. The font lookup is fully
// derivable from source (font names live in `fontStyle.*`, weight suffixes
// are PascalCased weight case names) — only the `systemFont` fallback is
// iOS-platform glue, which the generator embeds directly since this whole
// platform is iOS-specific.
const formatFamilyClass = (familyCases, weightCases, family) => {
  const postscriptCases = familyCases.map(
    (t) => `        case .${t.path[2]}: "${postscriptSlug(t.$value ?? t.value)}-\\(suffix(weight))"`
  );
  const suffixCases = weightCases.map(
    (t) => `        case .${t.path[2]}: "${pascalCase(t.path[2])}"`
  );
  return [
    'import UIKit',
    '',
    `public final class ${family.className}: TypographyFamily, @unchecked Sendable {`,
    `    public let id = "${family.selectionKey}"`,
    '',
    '    public init() {}',
    '',
    '    public func font(family: TypographyFontFamily, weight: TypographyFontWeight, size: CGFloat) -> UIFont {',
    '        let name = postscriptName(family: family, weight: weight)',
    '        if let font = UIFont(name: name, size: size) {',
    '            return font',
    '        }',
    '        return UIFont.systemFont(ofSize: size, weight: weight.uiFontWeight)',
    '    }',
    '}',
    '',
    `private extension ${family.className} {`,
    '    func postscriptName(family: TypographyFontFamily, weight: TypographyFontWeight) -> String {',
    '        switch family {',
    ...postscriptCases,
    '        }',
    '    }',
    '',
    '    func suffix(_ weight: TypographyFontWeight) -> String {',
    '        switch weight {',
    ...suffixCases,
    '        }',
    '    }',
    '}',
    '',
  ].join('\n');
};

const validEntries = (dict) => {
  const themeTokens = dict.allTokens.filter((t) => t.path[0] === THEME_ROOT);
  const { entries, skipLog } = sortedEntries(buildEntries(themeTokens));
  if (skipLog.length > 0) {
    console.log('\n[swift typography] Skipped:');
    for (const line of skipLog) console.log(line);
  }
  return entries;
};

export const register = () => {
  StyleDictionary.registerFormat({
    name: 'swift/typography-typescale',
    format: ({ dictionary }) => formatTypescale(validEntries(dictionary)),
  });

  StyleDictionary.registerFormat({
    name: 'swift/uifont-tokens',
    format: ({ dictionary }) => formatUIFontExtension(groupByRole(validEntries(dictionary))),
  });

  StyleDictionary.registerFormat({
    name: 'swift/swiftui-font-tokens',
    format: ({ dictionary }) => formatSwiftUIFontExtension(groupByRole(validEntries(dictionary))),
  });

  StyleDictionary.registerFormat({
    name: 'swift/typography-selection',
    format: () => formatSelection(families),
  });

  StyleDictionary.registerFormat({
    name: 'swift/typography-families-registry',
    format: () => formatRegistry(families),
  });

  StyleDictionary.registerFormat({
    name: 'swift/typography-font-family-enum',
    format: ({ dictionary }) => formatFontFamilyEnum(primitiveCases(dictionary, 'fontStyle')),
  });

  StyleDictionary.registerFormat({
    name: 'swift/typography-font-weight-enum',
    format: ({ dictionary }) => formatFontWeightEnum(primitiveCases(dictionary, 'fontWeight')),
  });

  StyleDictionary.registerFormat({
    name: 'swift/typography-family-concrete',
    format: ({ dictionary, options }) =>
      formatFamilyClass(
        primitiveCases(dictionary, 'fontStyle'),
        primitiveCases(dictionary, 'fontWeight'),
        options.family
      ),
  });
};

export const primitivesSource = 'source/Number Primitives/Values.json';
export const outputDir = 'out/ios/typography/';
export const families = [
  {
    source: 'source/Typography/Polkadot App Default.json',
    className: 'PolkadotDefaultTypography',
    selectionKey: 'polkadotDefault',
  },
];
