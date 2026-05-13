# Status — Design Tokens Migration

Snapshot of work to date and remaining steps, so we can pick up cleanly next session.

**Last updated**: 2026-05-13

---

## Done

### Token generation pipeline

- [x] Style Dictionary v5 set up (ESM, Node ≥20, single `npm install`)
- [x] Custom Kotlin/Compose formatters written from scratch
- [x] DTCG format support via `usesDtcg: true` (parses `$value`/`$type` from Figma Tokens Studio exports)
- [x] Reference resolution working (`{Color.zinc.950}` → resolved value or primitive reference)
- [x] Build runs end-to-end with one `node build.js` command

### Generated outputs

All Kotlin output below is generated from the `tokens_12_05.zip` Figma archive.

- [x] **Colors** — primitives (`PolkadotColorsPrimitives`, 115 entries) + abstract palette (`PolkadotColorsPalette` with nested data classes) + concrete (`PolkadotDefaultPalette`)
- [x] **Font families** — `PolkadotFontFamilies` using Google Fonts provider (`inter`, `manrope`, `martianMono`)
- [x] **Typography** — abstract base (`PolkadotTypography` with `heading/body/button/code` and nested role classes) + concrete impls (`PolkadotDefaultTypography`, `PolkadotValueTypography`)
- [x] **Spacings** — `PolkadotSpacings` + `PolkadotDefaultSpacings` (Dp, semantic scale `zero/xs/sm/md/lg/xl/2xl/3xl/4xl`)
- [x] **Radii** — `PolkadotRadii` + `PolkadotDefaultRadii` (returns `Shape`, `full` = `CircleShape`)
- [x] **Borders** — `PolkadotBorders` + `PolkadotDefaultBorders` (Dp, scale `xs/sm/md/lg/xl`)

### Repo organization

- [x] Source files reorganized into `source/{colors,numbers,typography}/`
- [x] Code split into `lib/` (platform-independent analysis) + `platforms/compose/` (Kotlin emitters)
- [x] Output organized as `out/android/<category>/` mirroring `design/src/main/java/.../configs/`
- [x] `README.md` documenting structure, build, integration, and "how to add iOS"
- [x] `.gitignore` excluding `node_modules` and `.DS_Store`
- [x] `design-tokens-issues.md` — full list of source-data issues for the designer conversation

### Naming refactor (this session)

- [x] Dropped legacy `Nova` prefix → `Polkadot` everywhere in scripts and docs
- [x] Replaced `Real` impl prefix with `Default` → all concretes now `PolkadotDefault<Category>` (uniform across colors/typography/dimensions)
- [x] Concrete impls renamed to `PolkadotDefaultPalette`, `PolkadotDefaultTypography`, `PolkadotValueTypography`, `PolkadotDefaultSpacings`, `PolkadotDefaultRadii`, `PolkadotDefaultBorders`

### Android distribution

- [x] Empty distribution repo created at `github.com/novasamatech/polkadot-app-design-system-android` (Compose library wrapping generated Kotlin)
- [x] `design-system/build.gradle.kts` configured for JitPack publish via `maven-publish` plugin (groupId `com.github.novasamatech`, `release` publication with sources jar)
- [x] First JitPack release published — consumable as `implementation("com.github.novasamatech:polkadot-app-design-system-android:<tag>")` after adding `maven("https://jitpack.io")` to consumer's `settings.gradle.kts`
- [x] Verified end-to-end: artifact resolves in a consumer project, generated classes import cleanly

### Skipped (explicit decisions)

- ❌ `Size` tokens (`Size.12`, `Size.14`, ...) — fixed inventory, no abstraction needed; revisit if useful
- ❌ `Opacity` tokens (`Opacity.2`, ..., `Opacity.100`) — most opacity usage is baked into colors; revisit if call sites need them

---

## Left to do

### Tokens repo (this directory)

- [ ] **`git init`**, first commit, push to `github.com/novasamatech/polkadot-app-design-system`
- [ ] **First version tag** (`v0.1.0`)
- [ ] (Optional) **CI workflow** — GitHub Action that runs `npm install && node build.js` on every push to verify the build doesn't break

### Designer conversation

- [ ] **Walk through `design-tokens-issues.md`** with the design team. Most items are one-line JSON edits. After fixes:
  - Re-export from Figma → drop new JSONs into `source/` → `node build.js` → re-commit
- [ ] **Confirm theme scope** — are Dark/Light themes coming? Is `Typography/Value.json` a real shippable theme?

### Android integration (in `polkadot-app-android-v2`)

This is the bulk of remaining work — mostly mechanical call-site migration.

- [ ] **Replace handwritten infra files** in `design/src/main/java/io/pcf/polkadotapp/design/configs/`:
  - `Spacings.kt` — keep the `LocalPolkadotSpacings` `CompositionLocal`, remove the old abstract class & `PolkadotDefaultSpacings`, import generated equivalents from the `spacings` package
  - `Typography.kt` — same pattern; remove old `PolkadotTypography`/`PolkadotDefaultTypography` blocks, import generated `PolkadotTypography` and a concrete impl
  - `FontFamilies.kt` — fully replaced by generated `PolkadotFontFamilies`; the generator's version is byte-equivalent to today's manual one
  - `colors/palettes/{PolkadotColorsPalette,DarkColorsPalette}.kt` — fully replaced by generated versions
- [ ] **Update `Theme.kt`** to:
  - Construct `PolkadotDefaultPalette()`, `PolkadotDefaultTypography()`, `PolkadotDefaultSpacings()`, `PolkadotDefaultRadii()`, `PolkadotDefaultBorders()`
  - Provide each via `CompositionLocal`s
  - Expose `PolkadotTheme.radii` and `PolkadotTheme.borders` accessors (don't exist today)
- [ ] **Migrate call sites** — purely mechanical, but large:
  - `theme.spacings.spacing4` → `theme.spacings.sm`
  - `theme.spacings.spacing8` → `theme.spacings.md`
  - `theme.spacings.spacing12` → `theme.spacings.lg`
  - `theme.spacings.spacing16` → `theme.spacings.xl`
  - (continue mapping by value)
  - `theme.typography.titleXL` → `theme.typography.heading.xl`
  - `theme.typography.bodyM` → `theme.typography.body.regular.l`
  - `theme.typography.bodySSemiBold` → `theme.typography.body.semibold.s`
  - `theme.typography.caption1` → `theme.typography.body.regular.s` (or define a new role if needed)
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
- `lib/typography-analysis.js` — the trickiest piece; pairs Font-Size with Line-Height per role/weight
- `README.md` — architecture overview
- `design-tokens-issues.md` — designer conversation list

## How to verify everything still works

### Tokens generator

```
cd /Users/den/IdeaProjects/polkadot-app-design-system
node build.js
find out -name "*.kt" | wc -l    # should be 13
```

Expected: 13 Kotlin files emitted, no errors. Typography skip-log lists 7 expected dropouts (Heading base, Heading S, Body base, Body XS, Body M, Body MS, Emoji). All output deterministic.

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
