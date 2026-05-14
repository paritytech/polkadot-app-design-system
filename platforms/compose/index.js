// Compose platform entry point: register all formatters, then run the build pipeline.

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
  const primitives = new StyleDictionary(
    {
      source: [colors.primitivesSource],
      usesDtcg: true,
      platforms: {
        compose: {
          buildPath: colors.outputDir,
          files: [{ destination: 'PolkadotColorsPrimitives.kt', format: 'compose/color-primitives' }],
        },
      },
    },
    { verbosity: 'verbose' }
  );
  await primitives.hasInitialized;
  await primitives.buildAllPlatforms();

  for (let i = 0; i < colors.themes.length; i++) {
    const theme = colors.themes[i];
    const files = [
      {
        destination: theme.file,
        format: 'compose/color-palette',
        options: { className: theme.className },
      },
    ];
    if (i === 0) {
      files.push({ destination: `${colors.BASE_CLASS}.kt`, format: 'compose/color-base' });
    }
    const sd = new StyleDictionary(
      {
        source: [colors.primitivesSource, theme.source],
        usesDtcg: true,
        platforms: { compose: { buildPath: colors.outputDir, files } },
      },
      { verbosity: 'verbose' }
    );
    await sd.hasInitialized;
    await sd.buildAllPlatforms();
  }
};

const runTypography = async () => {
  // FontFamilies needs the Typescale entries to discover which (font, weight) pairs are
  // actually used — otherwise it emits one Regular cut per family and Compose faux-bolds
  // everything heavier. Pull in the first theme alongside primitives.
  const fontFamiliesSources = [typography.primitivesSource, typography.themes[0].source];
  const primitives = new StyleDictionary(
    {
      source: fontFamiliesSources,
      usesDtcg: true,
      // Same tolerance as the typescale build below: typescale may reference primitive
      // paths that don't exist (we'll just drop those variants).
      log: { errors: { brokenReferences: 'console' } },
      platforms: {
        compose: {
          buildPath: typography.outputDir,
          files: [
            { destination: 'PolkadotFontFamilies.kt', format: 'compose/typography-font-families' },
          ],
        },
      },
    },
    { verbosity: 'verbose' }
  );
  await primitives.hasInitialized;
  await primitives.buildAllPlatforms();

  for (let i = 0; i < typography.themes.length; i++) {
    const theme = typography.themes[i];
    const files = [
      {
        destination: theme.file,
        format: 'compose/typography-concrete',
        options: { className: theme.className },
      },
    ];
    if (i === 0) {
      files.push({
        destination: `${typography.BASE_CLASS}.kt`,
        format: 'compose/typography-base',
      });
    }
    const sd = new StyleDictionary(
      {
        source: [typography.primitivesSource, theme.source],
        usesDtcg: true,
        // Source typography file references some primitive paths that don't
        // exist (e.g. {Typography.font-size.20} when only fontSize20 is
        // defined). Our role analyzer drops the affected tokens downstream;
        // tell SD to log instead of throwing so the build still completes.
        log: { errors: { brokenReferences: 'console' } },
        platforms: { compose: { buildPath: typography.outputDir, files } },
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
          compose: {
            buildPath: cfg.outputDir,
            files: [
              { destination: cfg.baseFile, format: cfg.baseFormat },
              { destination: cfg.concreteFile, format: cfg.concreteFormat },
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
