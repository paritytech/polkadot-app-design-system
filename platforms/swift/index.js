// Swift platform entry point: register all formatters, then run the build pipeline.

import StyleDictionary from 'style-dictionary';
import * as colors from './colors.js';
import * as typography from './typography.js';
import * as dimensions from './dimensions.js';

export const register = () => {
  colors.register();
  typography.register();
  dimensions.register();
};

const runColors = async () => {
  // ThemeSelection.swift and ThemesRegistry.swift are theme-list metadata; one
  // build emits both alongside the protocol. Per-theme concrete files are then
  // emitted in their own build runs so each can resolve refs against primitives.
  const registry = new StyleDictionary(
    {
      source: [colors.primitivesSource],
      usesDtcg: true,
      platforms: {
        swift: {
          buildPath: colors.outputDir,
          files: [
            { destination: 'ThemeSelection.swift', format: 'swift/theme-selection' },
            { destination: 'ThemesRegistry.swift', format: 'swift/themes-registry' },
          ],
        },
      },
    },
    { verbosity: 'verbose' }
  );
  await registry.hasInitialized;
  await registry.buildAllPlatforms();

  // For themes WITH source, emit the concrete Colors file (and on the first
  // such theme, the protocol + UIColor/Color extension files since those need
  // semantic tokens to walk). Source-less stub themes skip emission — their
  // file is hand-maintained in the iOS app's Generated/ until source ships.
  const realThemes = colors.themes.filter((t) => t.source);
  for (let i = 0; i < realThemes.length; i++) {
    const theme = realThemes[i];
    const files = [
      {
        destination: theme.file,
        format: 'swift/theme-colors-concrete',
        options: { theme },
      },
    ];
    if (i === 0) {
      files.push(
        { destination: 'ThemeColorsProtocol.swift', format: 'swift/theme-colors-protocol' },
        { destination: 'UIColor+Tokens.swift', format: 'swift/uicolor-tokens' },
        { destination: 'Color+Tokens.swift', format: 'swift/swiftui-color-tokens' }
      );
    }
    const sd = new StyleDictionary(
      {
        source: [colors.primitivesSource, theme.source],
        usesDtcg: true,
        platforms: { swift: { buildPath: colors.outputDir, files } },
      },
      { verbosity: 'verbose' }
    );
    await sd.hasInitialized;
    await sd.buildAllPlatforms();
  }
};

const runTypography = async () => {
  // TypographySelection.swift and TypographyFamiliesRegistry.swift are
  // family-list metadata. Emit alongside the first family's typescale, along
  // with the UIFont / Font extension token files (which need the typescale
  // entries to enumerate).
  for (let i = 0; i < typography.families.length; i++) {
    const family = typography.families[i];
    const files = [
      { destination: 'TypographyTypescale.swift', format: 'swift/typography-typescale' },
      {
        destination: `families/${family.className}.swift`,
        format: 'swift/typography-family-concrete',
        options: { family },
      },
    ];
    if (i === 0) {
      files.push(
        { destination: 'TypographySelection.swift', format: 'swift/typography-selection' },
        {
          destination: 'TypographyFamiliesRegistry.swift',
          format: 'swift/typography-families-registry',
        },
        {
          destination: 'TypographyFontFamily.swift',
          format: 'swift/typography-font-family-enum',
        },
        {
          destination: 'TypographyFontWeight.swift',
          format: 'swift/typography-font-weight-enum',
        },
        { destination: 'UIFont+Tokens.swift', format: 'swift/uifont-tokens' },
        { destination: 'Font+Tokens.swift', format: 'swift/swiftui-font-tokens' }
      );
    }
    const sd = new StyleDictionary(
      {
        source: [typography.primitivesSource, family.source],
        usesDtcg: true,
        // Same tolerance as the Compose run: typescale may reference primitive
        // paths that don't exist; analyser logs and skips affected entries.
        log: { errors: { brokenReferences: 'console' } },
        platforms: { swift: { buildPath: typography.outputDir, files } },
      },
      { verbosity: 'verbose' }
    );
    await sd.hasInitialized;
    await sd.buildAllPlatforms();
  }
};

const runDimensions = async () => {
  for (const cfg of dimensions.dimensionConfigs) {
    const sd = new StyleDictionary(
      {
        source: [dimensions.primitivesSource],
        usesDtcg: true,
        platforms: {
          swift: {
            buildPath: cfg.outputDir,
            files: [
              {
                destination: cfg.file,
                format: `swift/dimensions-${cfg.root.toLowerCase()}`,
              },
            ],
          },
        },
      },
      { verbosity: 'verbose' }
    );
    await sd.hasInitialized;
    await sd.buildAllPlatforms();
  }
};

export const run = async () => {
  await runColors();
  await runTypography();
  await runDimensions();
};
