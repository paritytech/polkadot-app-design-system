import StyleDictionary from 'style-dictionary';
import { flatCamel, hexToSwiftColor } from './swift.js';

const ROOT = 'Color';

// Path-segment label overrides for MARK names. Unmapped segments use their
// path name verbatim (so adding a new top-level like `gradient` shows up as
// "Gradient" without code changes). Lowercase form here; first letter is
// capitalized at top position by `capitalize`.
const LABEL = {
  fg: 'foreground',
  bg: 'background',
};

const labelFor = (seg) => LABEL[seg] || seg;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Derive MARK groups from token paths. For each top-level segment, if every
// token under it is path-depth 2 we emit a single flat group ("Foreground"
// for fg.*). If any token is depth 3+, we sub-group by `path[1]`
// ("Background — surface", "Avatar — bg"). Output order within a group is
// source-JSON order (Tokens Studio dictates it). Adding a new top-level
// category in source produces a new MARK automatically — no code change.
const groupLeaves = (leaves) => {
  const byTop = new Map();
  for (const leaf of leaves) {
    const top = leaf.token.path[0];
    if (!byTop.has(top)) byTop.set(top, []);
    byTop.get(top).push(leaf);
  }
  const groups = [];
  for (const [top, topLeaves] of byTop.entries()) {
    const needsSubGroup = topLeaves.some((l) => l.token.path.length > 2);
    if (!needsSubGroup) {
      groups.push({ mark: capitalize(labelFor(top)), leaves: topLeaves });
      continue;
    }
    const bySub = new Map();
    for (const leaf of topLeaves) {
      const sub = leaf.token.path[1];
      if (!bySub.has(sub)) bySub.set(sub, []);
      bySub.get(sub).push(leaf);
    }
    for (const [sub, subLeaves] of bySub.entries()) {
      groups.push({
        mark: `${capitalize(labelFor(top))} — ${labelFor(sub)}`,
        leaves: subLeaves,
      });
    }
  }
  return groups;
};

const toLeaves = (tokens) =>
  tokens.map((t) => ({
    token: t,
    ident: flatCamel(t.path),
    hex: hexToSwiftColor(t.$value ?? t.value),
  }));

const intersperseMark = (groups, render, indent = '    ') =>
  groups.flatMap((g, i) => {
    const header =
      i === 0
        ? [`${indent}// MARK: ${g.mark}`, '']
        : ['', `${indent}// MARK: ${g.mark}`, ''];
    return [...header, ...g.leaves.map(render)];
  });

const formatProtocol = (groups) => {
  const props = intersperseMark(groups, (l) => `    var ${l.ident}: UIColor { get }`);
  const allLeaves = groups.flatMap((g) => g.leaves);
  const caseGroups = groups.flatMap((g, i) => {
    const header = i === 0 ? [`    // ${g.mark}`] : ['', `    // ${g.mark}`];
    return [...header, ...g.leaves.map((l) => `    case ${l.ident}`)];
  });
  const arms = allLeaves.map((l) => `        case .${l.ident}: ${l.ident}`);

  return [
    'import UIKit',
    '',
    'public protocol ThemeColorsProtocol: Sendable {',
    ...props,
    '',
    '    func color(_ color: ThemeColor) -> UIColor',
    '}',
    '',
    'public enum ThemeColor: String, Hashable, CaseIterable {',
    ...caseGroups,
    '}',
    '',
    'public extension ThemeColorsProtocol {',
    '    func color(_ color: ThemeColor) -> UIColor {',
    '        switch color {',
    ...arms,
    '        }',
    '    }',
    '}',
    '',
  ].join('\n');
};

const formatConcreteTheme = (groups, theme) => {
  const lets = intersperseMark(
    groups,
    (l) => `        public let ${l.ident} = ${l.hex}`,
    '        '
  );
  return [
    'import UIKit',
    '',
    `public final class ${theme.className}: CommonTheme, @unchecked Sendable {`,
    '    public init() {',
    '        super.init(',
    `            id: "${theme.selectionKey}",`,
    `            statusBarStyle: .${theme.statusBarStyle},`,
    '            colors: Colors()',
    '        )',
    '    }',
    '',
    '    public final class Colors: ThemeColorsProtocol, @unchecked Sendable {',
    ...lets,
    '    }',
    '}',
    '',
  ].join('\n');
};

const formatUIColorExtension = (groups) => {
  const lines = intersperseMark(groups, (l) => `    static let ${l.ident} = app(.${l.ident})`);
  return [
    'import UIKit',
    '',
    'public extension UIColor {',
    ...lines,
    '}',
    '',
  ].join('\n');
};

const formatSwiftUIColorExtension = (groups) => {
  const lines = intersperseMark(
    groups,
    (l) => `    static var ${l.ident}: Color { .app(.${l.ident}) }`
  );
  return [
    'import SwiftUI',
    '',
    'public extension ShapeStyle where Self == Color {',
    ...lines,
    '}',
    '',
  ].join('\n');
};

const formatSelection = (themes) => {
  const cases = themes.map((t) => `    case ${t.selectionKey}`);
  return [
    'public enum ThemeSelection: String, Codable, CaseIterable, Hashable {',
    ...cases,
    '}',
    '',
  ].join('\n');
};

// The first entry in `themes` is the registry's default selection — the one
// the trait system falls back to when nothing else is specified, and the seed
// for the in-app theme picker. No light/dark split; iOS doesn't follow system
// appearance.
const formatRegistry = (themes) => {
  const factories = themes.map(
    (t, i) => `        .${t.selectionKey}: ${t.className}.init${i < themes.length - 1 ? ',' : ''}`
  );
  return [
    'public enum ThemesRegistry {',
    '    public static let factories: [ThemeSelection: () -> Theme] = [',
    ...factories,
    '    ]',
    '',
    `    public static let \`default\`: ThemeSelection = .${themes[0].selectionKey}`,
    '',
    '    public static func makeTheme(_ selection: ThemeSelection) -> Theme {',
    `        (factories[selection] ?? ${themes[0].className}.init)()`,
    '    }',
    '}',
    '',
  ].join('\n');
};

const semanticLeaves = (dict) => {
  const semantic = dict.allTokens.filter((t) => t.path[0] !== ROOT);
  return groupLeaves(toLeaves(semantic));
};

export const register = () => {
  StyleDictionary.registerFormat({
    name: 'swift/theme-colors-protocol',
    format: ({ dictionary }) => formatProtocol(semanticLeaves(dictionary)),
  });

  StyleDictionary.registerFormat({
    name: 'swift/theme-colors-concrete',
    format: ({ dictionary, options }) =>
      formatConcreteTheme(semanticLeaves(dictionary), options.theme),
  });

  StyleDictionary.registerFormat({
    name: 'swift/uicolor-tokens',
    format: ({ dictionary }) => formatUIColorExtension(semanticLeaves(dictionary)),
  });

  StyleDictionary.registerFormat({
    name: 'swift/swiftui-color-tokens',
    format: ({ dictionary }) => formatSwiftUIColorExtension(semanticLeaves(dictionary)),
  });

  StyleDictionary.registerFormat({
    name: 'swift/theme-selection',
    format: () => formatSelection(themes),
  });

  StyleDictionary.registerFormat({
    name: 'swift/themes-registry',
    format: () => formatRegistry(themes),
  });
};

export const primitivesSource = 'source/Color Primitives/Values.json';
export const outputDir = 'out/ios/colors/';

export const themes = [
  {
    // iOS still consumes a single theme. The old `Polkadot App Default.json`
    // was removed when the export split into named themes, so source the
    // default ("Berlin Night") here. The Swift class / selectionKey are left
    // unchanged to keep the iOS template contract stable until the iOS team
    // opts into the multi-theme naming the Android side now uses.
    source: 'source/Theme/Berlin Night.json',
    className: 'PolkadotDefaultTheme',
    selectionKey: 'polkadotDefault',
    file: 'themes/PolkadotDefaultTheme.swift',
    statusBarStyle: 'lightContent',
  },
];
