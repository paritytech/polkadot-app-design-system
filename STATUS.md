# Status — Design Tokens Migration

Snapshot of work to date and remaining steps, so we can pick up cleanly next session.

**Last updated**: 2026-05-14 (later)

---

## Done

### Token generation pipeline

- [x] Style Dictionary v5 set up (ESM, Node ≥20, single `npm install`)
- [x] Custom Kotlin/Compose formatters written from scratch
- [x] DTCG format support via `usesDtcg: true` (parses `$value`/`$type` from Figma Tokens Studio exports)
- [x] Reference resolution working (`{Color.zinc.950}` → resolved value or primitive reference)
- [x] Build runs end-to-end with one `node build.js` command

### Generated outputs

Kotlin output below is generated from `tokensMay13v4.zip` (latest Figma archive).

- [x] **Colors** — primitives (`PolkadotColorsPrimitives`, 115 entries) + abstract palette (`PolkadotColorsPalette` with nested data classes) + concrete (`PolkadotDefaultPalette`)
- [x] **Font families** — `PolkadotFontFamilies` using Google Fonts provider (`inter`, `manrope`, `martianMono`)
- [x] **Typography** — abstract base (`PolkadotTypography`) with per-role data classes, nested by `role.size[.variant]`:
  - **flat** (one variant per size, TextStyle directly): `display.large`, `headline.medium`, `emoji.small`
  - **uniform** (all sizes share variant set, shared `Sizes` inner class): `body.medium.regular`, `body.medium.emphasized`, `paragraph.large.mono`, `label.small.captionEmphasized`
  - **mixed** (sizes have different variant sets, per-size inner classes): `title.large.regular`, `title.medium.regular`, `title.medium.emphasized`
  - Variant keys: `regular`, `emphasized`, `mono`, `monoEmphasized`, `caption`, `captionEmphasized` — emitted only when the source has the required field (`weightEmphasized`, `fontMono`, `trackingCaption`)
  - Concrete impl: `PolkadotDefaultTypography`
- [x] **Spacings** — `PolkadotSpacings` + `PolkadotDefaultSpacings` (Dp, semantic scale `spaceZero/spaceTiny/spaceExtraSmall/spaceSmall/spaceMedium/spaceMediumIncreased/spaceLarge/spaceExtraLarge/spaceExtraLargeIncreased`)
- [x] **Radii** — `PolkadotRadii` + `PolkadotDefaultRadii` (returns `Shape`; semantic scale `radiusZero/radiusTiny/...` through `radiusFull`; `radiusFull` = `CircleShape`, controlled by `fullShapeKey` in `dimensions.js`)
- [x] **Borders** — `PolkadotBorders` + `PolkadotDefaultBorders` (Dp, semantic scale `borderDefault/borderMedium/borderLarge`)

### Repo organization

- [x] Source layout matches Figma export verbatim: `source/{Color Primitives,Number Primitives,Theme,Typography}/`
- [x] Code split into `lib/` (platform-independent analysis) + `platforms/compose/` (Kotlin emitters)
- [x] Output organized as `out/android/<category>/` mirroring the Android repo's `design-system/src/main/java/.../designsystem/`
- [x] `README.md` documenting structure, build, integration, and "how to add iOS"
- [x] `.gitignore` excluding `node_modules`, `out/`, and `.DS_Store`

### Designer conversation

- [x] Source-data issues walked through with design team and resolved in the v4 export; `design-tokens-issues.md` removed
- [x] `tracking` units clarified — emitted as `.sp` per the source values

### Naming refactor

- [x] Dropped legacy `Nova` prefix → `Polkadot` everywhere in scripts and docs
- [x] Replaced `Real` impl prefix with `Default` → all concretes now `PolkadotDefault<Category>` (uniform across colors/typography/dimensions)
- [x] Concrete impls: `PolkadotDefaultPalette`, `PolkadotDefaultTypography`, `PolkadotDefaultSpacings`, `PolkadotDefaultRadii`, `PolkadotDefaultBorders`

### Typography schema rewrite

The Figma export's typography schema changed between archives. We now consume the **Typescale** shape (one entry per typescale, with inline `font`/`weight`/`size`/`lineHeight`/`tracking` properties plus optional variant fields `weightEmphasized`/`fontMono`/`trackingCaption`).

- [x] `lib/typography-analysis.js` rewritten — parses Typescale entries, splits each name into `(role, size)`, emits one TextStyle variant per valid combination
- [x] `platforms/compose/typography.js` rewritten — emits nested data classes per role using the same `roleShape` decision rule as the original (flat / uniform / mixed), now keyed on variant set instead of weight set
- [x] `letterSpacing` derived from the source `tracking` field (treated as `.sp`)
- [x] `regular` added to `FONT_WEIGHT_CONSTANT` as an alias for `FontWeight.Normal` (the new source uses `regular` where the old used `normal`)
- [x] StyleDictionary configured to tolerate broken refs in typography (logs instead of throwing) — a few entries had stale refs in earlier exports; the analyzer skip-log captures any per-entry drops

### CompositionLocals

Each generated abstract base file now appends a `staticCompositionLocalOf` declaration so consumers can wire the design system into a Compose theme with minimal boilerplate.

- [x] `LocalPolkadotColors` in `colors/PolkadotColorsPalette.kt`
- [x] `LocalPolkadotTypography` in `typography/PolkadotTypography.kt`
- [x] `LocalPolkadotSpacings` in `spacings/PolkadotSpacings.kt`
- [x] `LocalPolkadotRadii` in `radii/PolkadotRadii.kt`
- [x] `LocalPolkadotBorders` in `borders/PolkadotBorders.kt`
- [x] Each errors loudly when accessed without a Provider (`error("LocalPolkadot<X> not provided")`)
- [x] Naming follows existing consumer convention (`LocalNova<Category>` → `LocalPolkadot<Category>`, no `Palette` suffix on colors)

### Android distribution

- [x] Distribution repo at `github.com/novasamatech/polkadot-app-design-system-android` — Compose library wrapping generated Kotlin
- [x] `design-system/build.gradle.kts` configured for JitPack publish via `maven-publish` plugin (groupId `com.github.novasamatech`, `release` publication with sources jar)
- [x] JitPack publishing live — consumable as `implementation("com.github.novasamatech:polkadot-app-design-system-android:<tag>")` after adding `maven("https://jitpack.io")` to consumer's `settings.gradle.kts`
- [x] Verified end-to-end: artifact resolves in a consumer project, generated classes import cleanly
- [x] Tags published: `0.1.0` (initial drop with the v2 export and rewritten typography), `0.1.1` (regenerated from v4: semantic dimension names + Emoji.Small fix), `0.1.2` (`CircleShape` for `radiusFull` + `LocalPolkadot*` CompositionLocal exports). Tags use no `v` prefix.

### Skipped (explicit decisions)

- ❌ `Size` tokens (`Size.12`, `Size.14`, ...) — fixed inventory, no abstraction needed; revisit if useful
- ❌ `Opacity` tokens (`Opacity.2`, ..., `Opacity.100`) — most opacity usage is baked into colors; revisit if call sites need them

---

## Left to do

### Tokens repo (this directory)

Remote is live at `git@nova:novasamatech/polkadot-app-design-system.git`. Local `main` is **1 commit ahead** of `origin/main` (the typography rewrite + CompositionLocals work), plus uncommitted edits in `STATUS.md` and `platforms/compose/{colors,dimensions,typography}.js`.

- [ ] Commit pending changes and push `main` to `origin`
- [ ] First tag (`v0.1.0`) — distinct from the Android repo's `0.1.x` tags (those track JitPack artifact versions)
- [ ] (Optional) **CI workflow** — GitHub Action that runs `npm install && node build.js` on every push to verify the build doesn't break

### Designer conversation

- [ ] **Confirm theme scope** — are Dark/Light themes coming? (The earlier `Typography/Value.json` second theme was dropped in v4 — confirm that's intentional.)

### Android integration (in `polkadot-app-android-v2`)

This is the bulk of remaining work — mostly mechanical call-site migration.

- [ ] **Replace handwritten infra files** in `design/src/main/java/io/pcf/polkadotapp/design/configs/`:
  - `Spacings.kt` — keep the `LocalPolkadotSpacings` `CompositionLocal`, remove the old abstract class & `PolkadotDefaultSpacings`, import generated equivalents from the `spacings` package
  - `Typography.kt` — same pattern; remove old `PolkadotTypography`/`PolkadotDefaultTypography` blocks, import generated `PolkadotTypography` and a concrete impl
  - `FontFamilies.kt` — fully replaced by generated `PolkadotFontFamilies`; the generator's version is byte-equivalent to today's manual one
  - `colors/palettes/{PolkadotColorsPalette,DarkColorsPalette}.kt` — fully replaced by generated versions
- [ ] **Update `Theme.kt`** to use the generated `LocalPolkadot*` CompositionLocals:
  ```kotlin
  CompositionLocalProvider(
      LocalPolkadotColors provides PolkadotDefaultPalette(),
      LocalPolkadotTypography provides PolkadotDefaultTypography(),
      LocalPolkadotSpacings provides PolkadotDefaultSpacings(),
      LocalPolkadotRadii provides PolkadotDefaultRadii(),
      LocalPolkadotBorders provides PolkadotDefaultBorders(),
  ) { content() }
  ```
  - Expose `PolkadotTheme.radii` and `PolkadotTheme.borders` accessors (don't exist today). Pattern:
    ```kotlin
    object PolkadotTheme {
        val radii: PolkadotRadii @Composable @ReadOnlyComposable get() = LocalPolkadotRadii.current
        val borders: PolkadotBorders @Composable @ReadOnlyComposable get() = LocalPolkadotBorders.current
    }
    ```
- [ ] **Migrate call sites** — mechanical but large:
  - Spacings (by value):
    - `spacing4` → `spaceExtraSmall`
    - `spacing8` → `spaceSmall`
    - `spacing12` → `spaceMedium`
    - `spacing16` → `spaceMediumIncreased`
    - `spacing24` → `spaceLarge`
    - … etc
  - Typography (new nested API):
    - `theme.typography.titleXL` → `theme.typography.title.extraLarge.regular` (or `.display.extraLarge` if it's bigger display copy)
    - `theme.typography.bodyM` → `theme.typography.body.medium.regular`
    - `theme.typography.bodySSemiBold` → `theme.typography.body.small.emphasized`
    - `theme.typography.caption1` → `theme.typography.label.small.caption` (or `.label.small.regular` depending on intent)
  - Colors:
    - `theme.colors.backgroundPrimary` → `theme.colors.bg.surface.main`
    - `theme.colors.textAndIconsPrimary` → `theme.colors.fg.primary`
    - … etc, per the new semantic names
- [ ] **Compile + run** — verify nothing regresses visually. Type checker catches name mismatches; the visual checks are on you.

### iOS (later, when iOS team is ready)

- [ ] **Create `platforms/swift/`** with files mirroring `platforms/compose/`:
  - `swift.js` — Swift identifier rules, hex→`Color(red:green:blue:opacity:)` converter
  - `colors.js`, `typography.js`, `dimensions.js` — Swift emitters
  - `index.js` — `register()` + `run()`
- [ ] **Wire into `build.js`** — two extra lines (`import` + `swift.register()`/`swift.run()`)
- [ ] **`out/ios/`** mirrors the Swift project's source layout

The `lib/` directory contains all platform-independent work (token tree, reference resolution, typography role analysis); Swift formatters reuse it without modification.

### Cross-repo release automation (the original vision)

Target flow: designer PR in tokens repo → on merge, regenerate Kotlin, bump version, open PR in Android distribution repo → on Android merge, tag → JitPack publishes.

- [ ] **Action in tokens repo** that, on merge to `main` touching `source/**`:
  - runs `node build.js`
  - bumps version in distribution repo's `gradle.properties` (or wherever we choose to track it)
  - opens PR in `polkadot-app-design-system-android` with the regenerated `out/android/**` copied into `design-system/src/main/java/.../`
- [ ] **Action in distribution repo** that, on merge to `main` from the above PR, auto-tags with the bumped version and pushes the tag → JitPack picks it up
- [ ] **Tokens Studio Git sync** — point Figma's Tokens Studio plugin at the tokens repo so designers commit JSON directly. Eliminates the manual zip handoff and makes step 1 fully automatic from the design side.
- [ ] **Versioning/changelog discipline** — tag every release, maintain `CHANGELOG.md` (especially once iOS consumes the same source)

---

## Key files for next session

- `build.js` — entry point, 5 lines
- `platforms/compose/index.js` — registers SD formatters and runs the pipeline
- `lib/typography-analysis.js` — Typescale parser; splits each entry into role/size, generates variants per `variantBuilders`. Exports `roleShape` (flat / uniform / mixed) consumed by the Kotlin formatter
- `platforms/compose/typography.js` — Kotlin emitter for typography; the three role shapes are formatted in `baseClassRoleBlocks` and `concreteRoleOverride`
- `README.md` — architecture overview
- `design-tokens-issues.md` — designer conversation list

## How to verify everything still works

### Tokens generator

```
cd /Users/den/IdeaProjects/polkadot-app-design-system
node build.js
find out -name "*.kt" | wc -l    # should be 12
```

Expected: 12 Kotlin files emitted, no errors. Typography skip-log should be empty for the v4 export (earlier exports had `Emoji Small` skipped because of a broken ref to `{Typography.font-size.20}` — fixed in v4). All output deterministic.

### Android distribution (local Maven smoke test)

```
cd /Users/den/AndroidProjects/polkadot-app-design-system-android
./gradlew :design-system:publishToMavenLocal
ls ~/.m2/repository/com/github/novasamatech/polkadot-app-design-system-android/
```

Expected: AAR + sources jar + pom + module file under a version dir.

### JitPack release

Tag a commit on `main` and push the tag — JitPack auto-builds and serves. Watch:

```
https://jitpack.io/com/github/novasamatech/polkadot-app-design-system-android/<tag>/build.log
```

## Gotchas worth remembering

- **Never run `./gradlew updateDaemonJvm`** in the Android repo. It writes `gradle/gradle-daemon-jvm.properties` pinning the daemon to JBR-with-JCEF, which JitPack's Linux build image can't unpack (Gradle 9 issue) or run (JBR's `libjvm.so` needs glibc ≥ 2.27 and JitPack has older). If the file appears, delete it and don't commit it. Consider gitignoring.
- **Pre-tag dance**: when re-pushing after fixes, the same tag won't trigger a rebuild — either move the tag (delete + recreate locally and on origin) or bump to a fresh tag. JitPack caches per-tag.
