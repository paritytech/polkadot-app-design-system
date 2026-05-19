# Polkadot Design Tokens

Style Dictionary v5 build that generates platform-specific code from a single source of design tokens (colors, typography, spacings, radii, shapes, borders). Currently emits **Kotlin / Jetpack Compose**; structured to add **Swift / SwiftUI** alongside.

## Quick start

```
npm install
node build.js
```

Generated output appears under `out/<platform>/`.

## Layout

```
.
├── source/                  Figma Tokens Studio export (drop zip contents in as-is)
│   ├── $metadata.json                  token set order
│   ├── $themes.json                    theme configurations
│   ├── New Colors Primitives/
│   │   └── Values.json                 raw palette (zinc.950, blue.500, ...)
│   ├── New Number:String/
│   │   └── Strings/
│   │       └── Values.json             font sizes, weights, line heights, Spacer, Radius, Border, Size, Opacity
│   ├── Theme/
│   │   └── Polkadot App Default.json   semantic colors (fg.primary -> {Color.zinc.100})
│   └── Typography/
│       ├── Polkadot App Default.json   Heading uses Manrope
│       └── Value.json                  Heading uses Inter
│
├── lib/                     Platform-independent analysis
│   ├── utils.js                 pascal/camel/isReference
│   ├── token-tree.js            buildTree, sortedEntries
│   └── typography-analysis.js   role/size/weight pairing, skip-log
│
├── platforms/
│   └── compose/             Kotlin / Jetpack Compose emitters
│       ├── kotlin.js            ktIdent, hexToComposeColor, FontWeight map
│       ├── colors.js            primitives object + abstract palette + concrete palettes
│       ├── typography.js        FontFamilies object + abstract Typography + concrete typographies
│       ├── dimensions.js        Spacer/Radius/Border (shared generator, config-driven)
│       └── index.js             registers SD formatters, runs the pipeline
│
├── build.js                 Entry point: imports platforms, registers, runs
├── package.json
└── out/                     Generated code (gitignored by default; commit if your consumer model needs it)
    └── android/
        ├── colors/
        ├── typography/
        ├── spacings/
        ├── radii/
        ├── shapes/
        └── borders/
```

## How to update tokens from a new Figma export

1. Designer exports tokens from Figma Tokens Studio → produces a zip.
2. Extract the zip and replace the contents of `source/` with the extracted folder's contents (no renaming — the layout is verbatim).
3. `node build.js`
4. Inspect `out/` diff and commit `source/`.

If [Tokens Studio Git sync](https://docs.tokens.studio/sync-providers/sync-providers-github) is set up, step 2 is automatic — Figma writes directly to a repo and you pull instead of unzipping.

## How Android consumes the output

Manual copy:

1. Run `node build.js` in this repo.
2. Copy `out/android/` contents into the Android project at `design/src/main/java/io/pcf/polkadotapp/design/configs/`.
3. The generated Kotlin packages match those file paths (`io.pcf.polkadotapp.designsystem.colors.*`, etc.) — copy is a direct mirror.
4. Replace handwritten `Spacings.kt`, `Typography.kt`, `FontFamilies.kt` with imports of the generated equivalents; update `Theme.kt` to construct and provide them via the existing `CompositionLocal`s.

## Adding a new platform (iOS Swift)

1. Create `platforms/swift/` with the same file layout as `platforms/compose/`:
   - `swift.js` — Swift-specific helpers (hex → `Color(red: green: blue: opacity:)`, identifier rules)
   - `colors.js`, `typography.js`, `dimensions.js` — Swift emitters using the same shared `lib/` analysis
   - `index.js` — `register()` + `run()`
2. Add `import * as swift from './platforms/swift/index.js'` plus `swift.register()` and `await swift.run()` in `build.js`.

The `lib/` directory contains all platform-independent logic: token tree building, reference resolution, typography role analysis. Each platform only implements the *emission* (turning a structured token into a code string).

## Architecture notes

- **Shared analysis, per-platform emission** — `lib/` knows what tokens are and how they relate; `platforms/compose/` knows how to write Kotlin. iOS adds an analogous platform without touching `lib/`.
- **Style Dictionary** handles reference resolution (`{Color.zinc.950}` → `#121212`) and source-file merging. Each platform registers custom formatters and runs pipelines tailored to its outputs.
- **DTCG format** (`$type`, `$value`) is auto-detected via `usesDtcg: true`. The Figma Tokens Studio export uses this format natively.
- **No magic value handling** — fractional `Dp`, numeric leaves, missing atoms, etc. are emitted faithfully or skipped with a logged reason. Design issues are escalated to the source, not papered over.

## Source data caveats

The current Figma export has several known issues — see [`design-tokens-issues.md`](./design-tokens-issues.md) for the full list to discuss with design.
