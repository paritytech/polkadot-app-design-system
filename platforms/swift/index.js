// Swift platform entry point: register all formatters, then run the build pipeline.

import StyleDictionary from 'style-dictionary';
import * as colors from './colors.js';
import * as typography from './typography.js';

export const register = () => {
  colors.register();
  typography.register();
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

  for (let i = 0; i < colors.themes.length; i++) {
    const theme = colors.themes[i];
    const files = [
      {
        destination: theme.file,
        format: 'swift/theme-colors-concrete',
        options: { theme },
      },
    ];
    if (i === 0) {
      files.push({
        destination: 'ThemeColorsProtocol.swift',
        format: 'swift/theme-colors-protocol',
      });
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
  // family-list metadata. Emit alongside the first family's typescale.
  for (let i = 0; i < typography.families.length; i++) {
    const family = typography.families[i];
    const files = [
      { destination: 'TypographyTypescale.swift', format: 'swift/typography-typescale' },
    ];
    if (i === 0) {
      files.push(
        { destination: 'TypographySelection.swift', format: 'swift/typography-selection' },
        {
          destination: 'TypographyFamiliesRegistry.swift',
          format: 'swift/typography-families-registry',
        }
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

export const run = async () => {
  await runColors();
  await runTypography();
};
