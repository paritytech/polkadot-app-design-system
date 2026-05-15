// Emits `out/android/themes/PolkadotAppTheme.kt` — an enum whose cases are
// bare tags and whose member functions `colors()` / `typography()` resolve the
// concrete palette and typography for the case via an exhaustive `when`.
// Adding a theme is a compile-time check on both branches.
//
// Construction is lazy — palettes/typographies allocate only when their
// resolver is called, so non-selected themes cost nothing at enum-load time.
//
// Spacings/radii/borders stay global (not theme-scoped in source), so they
// don't enter this registry. The consumer's `PolkadotTheme` composable picks
// a selection (e.g. from preferences) and calls `selection.colors()` /
// `selection.typography()`.
//
// Today there's one theme (`Default`). Adding more themes means appending
// entries to `colors.themes` / `typography.themes` and re-running the build.
// Pairing rule is index-based: the i-th colors theme pairs with the i-th
// typography theme; shorter list falls back to index 0.

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { pascal } from '../../lib/utils.js';
import * as colors from './colors.js';
import * as typography from './typography.js';

const PACKAGE = 'io.pcf.polkadotapp.designsystem.themes';
const OUTPUT_PATH = 'out/android/themes/PolkadotAppTheme.kt';
const ENUM_NAME = 'PolkadotAppTheme';
// Earlier iteration produced a separate factory object; clean it up so stale
// output doesn't get copied into the distribution lib.
const STALE_PATH = 'out/android/themes/PolkadotThemes.kt';

const caseNameFromColors = (className) =>
  pascal(className.replace(/^Polkadot/, '').replace(/Palette$/, ''));

// The persistence key (`selectionKey`) comes from the themes config in
// colors.js. It must be specified explicitly so the id stays stable even if
// the Kotlin case name or the concrete class names get renamed — consumers
// store this value in prefs and look up themes by it via `fromId(id)`.
const buildCases = () => {
  const colorList = colors.themes;
  const typoList = typography.themes;
  const count = Math.max(colorList.length, typoList.length);

  const cases = [];
  for (let i = 0; i < count; i++) {
    const colorTheme = colorList[i] ?? colorList[0];
    const typoTheme = typoList[i] ?? typoList[0];
    if (!colorTheme.selectionKey) {
      throw new Error(
        `Theme at index ${i} (${colorTheme.className}) is missing required \`selectionKey\` in colors.themes config`
      );
    }
    cases.push({
      name: caseNameFromColors(colorTheme.className),
      id: colorTheme.selectionKey,
      colorsClass: colorTheme.className,
      typographyClass: typoTheme.className,
    });
  }
  return cases;
};

const formatFile = (cases) => {
  const colorsImports = [...new Set(cases.map((c) => c.colorsClass))]
    .sort()
    .map((cls) => `import io.pcf.polkadotapp.designsystem.colors.${cls}`);
  const typographyImports = [...new Set(cases.map((c) => c.typographyClass))]
    .sort()
    .map((cls) => `import io.pcf.polkadotapp.designsystem.typography.${cls}`);

  const caseLines = cases.map((c, i) => {
    const tail = i < cases.length - 1 ? ',' : ';';
    return `    ${c.name}(id = "${c.id}")${tail}`;
  });
  const colorsArms = cases.map((c) => `        ${c.name} -> ${c.colorsClass}()`);
  const typographyArms = cases.map((c) => `        ${c.name} -> ${c.typographyClass}()`);

  return [
    `package ${PACKAGE}`,
    '',
    'import io.pcf.polkadotapp.designsystem.colors.PolkadotColorsPalette',
    ...colorsImports,
    'import io.pcf.polkadotapp.designsystem.typography.PolkadotTypography',
    ...typographyImports,
    '',
    `enum class ${ENUM_NAME}(val id: String) {`,
    ...caseLines,
    '',
    '    fun colors(): PolkadotColorsPalette = when (this) {',
    ...colorsArms,
    '    }',
    '',
    '    fun typography(): PolkadotTypography = when (this) {',
    ...typographyArms,
    '    }',
    '',
    '    companion object {',
    `        val DEFAULT = ${cases[0].name}`,
    '',
    `        fun fromId(id: String?): ${ENUM_NAME} = entries.find { it.id == id } ?: DEFAULT`,
    '    }',
    '}',
    '',
  ].join('\n');
};

export const run = async () => {
  const cases = buildCases();
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, formatFile(cases));
  if (existsSync(STALE_PATH)) rmSync(STALE_PATH);
  console.log(`\ncompose\n✔︎ ${OUTPUT_PATH}`);
};
