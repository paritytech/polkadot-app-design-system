> [!WARNING]
> This open source code is provided for research, experimentation, and developer education only. This code has not been audited, is actively experimental, and may contain bugs, vulnerabilities, or incomplete features. Use at your own risk and obtain legal advice as appropriate - DYOR.
>
> Parity doesn’t deploy the code but may update it based on community feedback.
>
> If you experience problems with any product or service that was built on or deployed from this code, you should contact the third party who deployed the code in its amended form, not Parity.

# Polkadot App Design System

A [Style Dictionary](https://styledictionary.com) v5 build that turns a single source of design tokens (colors, typography, spacings, radii, shapes, borders) into platform code:

- **Kotlin / Jetpack Compose** — consumed by [polkadot-app-design-system-android](https://github.com/paritytech/polkadot-app-design-system-android)
- **Swift / SwiftUI / UIKit** — consumed by [polkadot-app-design-system-ios](https://github.com/paritytech/polkadot-app-design-system-ios)

This repository holds the token source and the generator only. It publishes no package; the platform repositories above are what apps depend on.

## Quick start

Requires Node.js 24 or newer.

```
npm ci
node build.js
```

Generated output appears under `out/android/` and `out/ios/`. The `out/` directory is not committed.

## Layout

```
.
├── source/                  Figma Tokens Studio export (DTCG format), committed verbatim
│   ├── $metadata.json                  token set order
│   ├── $themes.json                    theme configurations
│   ├── Color Primitives/
│   │   └── Values.json                 raw palette
│   ├── Number Primitives/
│   │   └── Values.json                 font styles, sizes, weights, line heights, Space, Radius, Border, Opacity
│   ├── Theme/                          one file per color theme (semantic colors referencing primitives)
│   │   ├── Berlin Day.json
│   │   ├── Berlin Night.json           the default theme
│   │   ├── Lisbon.json
│   │   ├── Malta.json
│   │   └── Tokyo.json
│   └── Typography/
│       └── Polkadot App Default.json   typescale
│
├── lib/                     Platform-independent logic
│   ├── utils.js                 name casing, reference detection
│   ├── token-tree.js            builds a tree from flat tokens
│   └── typography-analysis.js   splits typescale entries into roles, sizes and variants
│
├── platforms/
│   ├── compose/             Kotlin / Jetpack Compose emitters
│   └── swift/               Swift / SwiftUI / UIKit emitters
│
├── build.js                 Entry point: registers both platforms, then runs them
└── out/                     Generated code (gitignored)
    ├── android/             colors, typography, spacings, radii, shapes, borders, themes
    └── ios/                 colors, typography, radii, spacings
```

Each platform directory has the same shape: `colors.js`, `typography.js` and `dimensions.js` hold the emitters, a helper file (`kotlin.js` / `swift.js`) holds language-specific formatting, and `index.js` registers the formats and runs the pipeline.

## Updating tokens from a new Figma export

1. Export tokens from Figma Tokens Studio. The export is a zip.
2. Replace the contents of `source/` with the extracted files, keeping the layout as exported.
3. Run `node build.js`.
4. Review the diff under `out/` and commit `source/`.

With [Tokens Studio Git sync](https://docs.tokens.studio/sync-providers/sync-providers-github), step 2 becomes a pull.

A color theme is one file in `source/Theme/`. Adding a file there adds a theme on both platforms, named after the file.

## How the platform repositories get the output

On every push to `main` that touches the token source or the generator, the [publish workflow](.github/workflows/publish_tokens.yml) runs the build and opens a pull request in each platform repository with the regenerated files:

| Output | Destination |
| --- | --- |
| `out/ios/` | `Sources/DesignSystem/Generated/` in polkadot-app-design-system-ios |
| `out/android/` | `design-system/src/main/java/io/paritytech/polkadotapp/designsystem/` in polkadot-app-design-system-android |

The destination directories are replaced wholesale, so generated files must not be edited by hand. To do the same manually, run the build and copy the two directories across.

## Fonts

The typography tokens reference Inter, Manrope, Martian Mono and Source Sans 3. This repository contains no font files. The generated code expects the fonts to be bundled by the platform repositories, which carry the font files and their licences.

## Adding a platform

1. Create `platforms/<name>/` with the same file layout as `platforms/compose/`.
2. Import the platform in `build.js`, then call its `register()` and `run()`.

`lib/` knows what the tokens are and how they relate; a platform only turns a structured token into a code string.

## Design notes

- **Style Dictionary** resolves references (`{Color.zinc.950}` → `#121212`) and merges source files. Each platform registers its own formats and runs pipelines tailored to its outputs.
- **DTCG format** (`$type`, `$value`) is enabled with `usesDtcg: true`. Figma Tokens Studio exports it natively.
- **No value fix-ups.** Tokens are emitted as they are in the source, or skipped with a logged reason. Typography entries that reference a missing primitive are dropped and reported in the build log.

## Security

Before deploying it for real use cases, you are responsible for:

- Reviewing the code yourself, we publish a reference, not a hardened production build
- Checking that the dependencies are up to date and free of known vulnerabilities
- Securing your own fork or deployment environment (keys, secrets, network configuration)
- Tracking the latest tagged release/commits for security fixes; older releases are not backported (exceptions might apply)

For Parity's security disclosure process, and Bug Bounty program, feel free to visit: https://parity.io/bug-bounty

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
