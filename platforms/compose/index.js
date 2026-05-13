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
          files: [{ destination: 'NovaColorsPrimitives.kt', format: 'compose/color-primitives' }],
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
  const primitives = new StyleDictionary(
    {
      source: [typography.primitivesSource],
      usesDtcg: true,
      platforms: {
        compose: {
          buildPath: typography.outputDir,
          files: [
            { destination: 'NovaFontFamilies.kt', format: 'compose/typography-font-families' },
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
