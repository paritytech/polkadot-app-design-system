# Status — Design Tokens Migration

Snapshot of work to date and remaining steps, so we can pick up cleanly next session.

**Last updated**: 2026-05-15 — pick up here with full context: lib at `0.1.7` (variable fonts bundled, no GMS, AGP 8.12.3 + Kotlin 2.2.21 + compileSdk 36), consumer pinned to `0.1.7` with full Kotlin compile green, literals inventory recorded below, dimensions prefix-stripped vs colors verbatim is intentional (see "Naming conventions"). The consumer migration lives on `feature/design-system-tokens` (not merged to `master`); subsequent same-day commits after the 2026-05-14 STATUS write knocked out the deferred `AvatarColorScheme`, removed `NovaStableColors`, migrated `CircleShape`, updated the JS widget bridge to new token names, and stripped splash-screen + downloadable-font infrastructure from the consumer entirely — see Android integration section.

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

- [x] **Colors** — primitives (`PolkadotColorsPrimitives`, 115 entries; names verbatim from Figma source — e.g. `AmberAmber100`, `NeutralNeutral50`, `AdvancedAmethystAmethyst100` — see "Naming conventions" below) + abstract palette (`PolkadotColorsPalette` with nested data classes for `bg/fg/stroke/avatar/focus/shadow`) + concrete (`PolkadotDefaultPalette`)
- [x] **Font families** — `PolkadotFontFamilies` bundles variable fonts as Android resources (`res/font/{inter,manrope,martian_mono}_variable.ttf`). Each weight emits `Font(R.font.<family>_variable, FontWeight.X, variationSettings = FontVariation.Settings(FontVariation.weight(N)))`. No GoogleFonts dependency, no async download flash on cold start.
- [x] **Typography** — abstract base (`PolkadotTypography`) with per-role data classes, nested by `role.size[.variant]`:
  - **flat** (one variant per size, TextStyle directly): `display.large`, `headline.medium`, `emoji.small`
  - **uniform** (all sizes share variant set, shared `Sizes` inner class): `body.medium.regular`, `body.medium.emphasized`, `paragraph.large.mono`, `label.small.captionEmphasized`
  - **mixed** (sizes have different variant sets, per-size inner classes): `title.large.regular`, `title.medium.regular`, `title.medium.emphasized`
  - Variant keys: `regular`, `emphasized`, `mono`, `monoEmphasized`, `caption`, `captionEmphasized` — emitted only when the source has the required field (`weightEmphasized`, `fontMono`, `trackingCaption`)
  - Concrete impl: `PolkadotDefaultTypography`
- [x] **Spacings** — `PolkadotSpacings` + `PolkadotDefaultSpacings` (Dp, semantic scale `zero/tiny/extraSmall/small/medium/mediumIncreased/large/extraLarge/extraLargeIncreased`; group-name prefix stripped from leaf keys — see "Naming conventions")
- [x] **Radii** — `PolkadotRadii` + `PolkadotDefaultRadii` (returns `Shape`; semantic scale `zero/tiny/extraSmall/small/smallIncreased/medium/mediumIncreased/large/extraLarge/full`; `full` = `CircleShape`, controlled by `fullShapeKey` in `dimensions.js`)
- [x] **Borders** — `PolkadotBorders` + `PolkadotDefaultBorders` (Dp, semantic scale `default/medium/large`)

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

### Naming conventions

The Figma source JSON repeats each parent group's name as a prefix on every leaf (e.g. `Space.spaceZero`, `Border.borderDefault`, `neutral.neutral50`, `Advanced.Amethyst.amethyst100`). The generator handles this **inconsistently by category — intentionally**:

- **Dimensions (spacings / radii / borders)**: ancestor-prefix is **stripped** in `platforms/compose/dimensions.js` (`stripGroupPrefix`). Output: `spacings.zero`, `radii.full`, `borders.default`. Reason: consumer call sites read better without repetition (`PolkadotTheme.borders.default` not `.borderDefault`).
- **Colors**: leaf names emitted **verbatim** as `<group><leaf>` PascalCased — `AmberAmber100`, `ZincZinc100`, `AdvancedAmethystAmethyst100`. Reason: stay close to Figma's primitive naming so designer/code paths line up 1:1 during conversations. Consumer rarely references primitives directly — it goes through the semantic palette (`PolkadotTheme.colors.fg.primary`, etc.), so the verbosity stays inside the lib.

If this inconsistency ever needs revisiting, the strip logic for colors lives ready-to-resurrect at `stripAncestorPrefixes` in the colors.js git history; the dimensions logic in `dimensions.js` is the reference implementation.

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
- [x] Tags published: `0.1.0` (initial drop with the v2 export and rewritten typography), `0.1.1` (regenerated from v4: semantic dimension names + Emoji.Small fix), `0.1.2` (`CircleShape` for `radiusFull` + `LocalPolkadot*` CompositionLocal exports), `0.1.3` (drop redundant `space*`/`radius*`/`border*` leaf prefixes; `compileSdk` lowered 37→36 for AGP 8.12 compatibility), `0.1.4` (AGP 9.2.1 → 8.12.3 and Kotlin 2.3.21 → 2.2.21 to match consumer), `0.1.5` (kotlin plugin configuration fix), `0.1.6` (`PolkadotFontFamilies` emits per-weight `Font(weight = …)` entries derived from the Typescale — Inter Normal/Medium/SemiBold, Manrope SemiBold/Bold, Martian Mono Normal/Medium/SemiBold — so GMS downloads the real designed cuts instead of faux-bolding Regular), `0.1.7` (drop GoogleFonts entirely, bundle variable fonts as `res/font/{inter,manrope,martian_mono}_variable.ttf`; generator emits `Font(R.font.<family>_variable, FontWeight.X, variationSettings = FontVariation.Settings(FontVariation.weight(N)))` per weight). Compose BOM kept at `2026.05.00` — consumer to bump. Tags use no `v` prefix.

### Skipped (explicit decisions)

- ❌ `Size` tokens (`Size.12`, `Size.14`, ...) — fixed inventory, no abstraction needed; revisit if useful
- ❌ `Opacity` tokens (`Opacity.2`, ..., `Opacity.100`) — most opacity usage is baked into colors; revisit if call sites need them

---

## Left to do

### Tokens repo (this directory)

Remote live at `git@nova:novasamatech/polkadot-app-design-system.git`, `main` in sync with origin. Recent commit history covers the typography rewrite + CompositionLocals, prefix stripping for dimensions, v4 Figma sync, per-weight FontFamily fix, and the variable-font generator switch.

- [ ] (Optional) **CI workflow** — GitHub Action that runs `npm install && node build.js` on every push to verify the build doesn't break

### Designer conversation

- [ ] **Confirm theme scope** — are Dark/Light themes coming? (The earlier `Typography/Value.json` second theme was dropped in v4 — confirm that's intentional.)

### Android integration (in `polkadot-app-android-v2`)

Big-bang migration done. Consumer pinned to `0.1.7` (variable-font bundle); full Kotlin compile was green at `0.1.5` and the changes since have been incremental (font fixes only). The earlier `StatementTransportEvent.kt` IR-evaluator crash went away after the lib's AGP/Kotlin downgrade in `0.1.4`/`0.1.5`.

- [x] **Deleted dead handwritten files**: `Spacings.kt`, `Typography.kt`, `FontFamilies.kt`, `colors/palettes/{NovaColorsPalette,DarkColorsPalette}.kt`. Trimmed `colors/NovaColors.kt` to keep only `NovaStableColors`.
- [x] **Rewrote `Theme.kt`** with `PolkadotTheme` composable + accessor object exposing `colors`/`typography`/`spacings`/`radii`/`borders` (new); provides all five `LocalPolkadot*` CompositionLocals; inlines best-effort `toMaterialColorScheme()` / `toMaterialTypography()` helpers for the wrapping `MaterialTheme`.
- [x] **Migrated ~3000 call sites** in 4 mechanical perl passes:
  - `NovaTheme` → `PolkadotTheme` (2247 refs, 275 files)
  - **Spacings**: 581 sites mapped to semantic names; 57 off-scale sites hardcoded as `<N>.dp` literals (see below)
  - **Typography**: 416 sites mapped to nested `role.size[.variant]` API. Font-family shift for headers (Inter → Manrope) is intentional per the new design system.
  - **Colors**: 651 sites mapped to new nested groups (`fg.*`, `bg.surface.*`, `bg.action.*`, `stroke.*`); 95 sites for fill tokens hardcoded as `Color()` literals (see below)
- [x] **Radii & borders migration** — picked up after the first build pass, since these are new tokens (no old equivalent in the handwritten configs):
  - **Borders**: 21 sites (`BorderStroke(1.dp/2.dp, …)` and `.border(1.dp/2.dp, …)`) → `PolkadotTheme.borders.default`/`medium`
  - **Radii**: 82 exact-match sites (`RoundedCornerShape(0/4/6/8/12/16/24/32.dp)`) → `PolkadotTheme.radii.{zero,tiny,extraSmall,small,medium,mediumIncreased,large,extraLarge}`; 18 off-scale sites (14/20/22/28/40/48 dp) kept as `RoundedCornerShape(N.dp)` literals
  - Three top-level `private val`s holding precomputed shapes/widths (`OverlapThumbnailShape`, `ThumbnailShape`, `ThumbnailOuterShape` + their border-width siblings) were removed; usages inlined to `PolkadotTheme.radii.*` / `PolkadotTheme.borders.*` at the composable call site (the property accessors are `@Composable @ReadOnlyComposable` and can't be evaluated at file load).
- [x] **AvatarColorScheme migration** — `NovaAvatarPalette` and `NovaAvatarColors.kt` deleted. `AvatarColorScheme` enum re-cut from the old 8 colors (BlueViolet/Magenta/Cyan/Violet/Pink/Green/Yellow/Red) to the new 10 gemstones (Amethyst/Emerald/Garnet/Onyx/Opal/Pearl/Ruby/Sapphire/Topaz/Turquoise). `background`/`foreground` are now `@Composable @ReadOnlyComposable` properties that read from `PolkadotTheme.colors.avatar.bg/fg`. The hash-keyed dispatch (`from(key)`) is preserved but inlined into one function. Existing users **will be recolored** — bucket count and hue palette both changed; this was accepted as the right call rather than carrying the old palette forward.
- [x] **`NovaStableColors` removal** — the file held over from the first pass (`Gray*`, `BrandPink/Blue/Cyan`, `BrandLime*`, `WeeklyGamePillBackground`, `Yellow`, `Black70`) was deleted. Call sites replaced with `PolkadotColorsPrimitives.*` (e.g. `BrandPink → PinkPink600`, `BrandBlue → BlueBlue600`, `BrandCyan → AdvancedTurquoiseTurquoise600`, `Gray200/300 → NeutralNeutral900/950`, `BrandGreen → GreenGreen400`, `Yellow → AmberAmber500`, `Gray → ZincZinc100`, `Black70 → AlphaBlackBlackAlpha48`). **Caveat**: primitives are *not* semantic palette entries, so if the palette shifts they won't follow. Marked "for now" in the commit message — revisit if a semantic role gets added to the design system (e.g. brand-accent, off-surface).
- [x] **`CircleShape` migration** — ~40 call sites of `androidx.compose.foundation.shape.CircleShape` (mostly on avatars, round buttons, indicators, message-action chrome) swapped for `PolkadotTheme.radii.full`. The latter is `CircleShape` under the hood (`fullShapeKey` in `dimensions.js`), so behavior is identical; gain is one less import and a single source of truth.
- [x] **JS widget bridge token names** — `JsColor` and `JsTypographyStyle` SerialNames updated to the new dot-path tokens. `JsColor`: `textPrimary→fg.primary`, `textSecondary→fg.secondary`, `textTertiary→fg.tertiary`, `error→fg.error`, `success→fg.success`, `warning→fg.warning`. `JsTypographyStyle`: `headline→title.medium.regular`, `caption→body.small.regular`. Plus `JsWidget`/`ScaleWidgetMapper`/`ScaleWidgetModels`/`JsModifierExt`/`JsWidgetRenderer` adjusted for compat with the new contract. JS side must ship matching token strings.
- [x] **Splash screen + downloadable fonts removed from consumer** — completes the cold-start font story end-to-end. Detour: a `FontPreloader` was added that called `createFontFamilyResolver(context).preload(...)` for `inter`/`manrope`/`martianMono` with a 2 s timeout, then commented out because the splash gating added ~1 s. With variable fonts bundled in the AAR there's nothing async left to wait on, so the splash itself was dropped too. Deletions: `Theme.PolkadotApp.SplashScreen` style, `FontPreloader.kt`, `RootViewModel`'s `preloadFonts()` plumbing, `core-splashscreen` dep, `androidx-compose-ui-text-google-fonts` dep, the legacy `common/res/font/inter.xml` GMS-downloadable font config, the static `inter_regular/medium/semi_bold.ttf` fallback fonts, and `font_certs.xml`. Consumer now ships **zero** font assets — all three families come from the design system AAR.
- [x] **Ripple color tied to token** — `Theme.kt` had a hardcoded `Color(0x3DFFFFFF)` (the old `fill24`) for `LocalIndication provides ripple(color = …)`. Now `colors.fg.primary`. Drops one entry from the `Color(0x3DFFFFFF)` literal table below (4 → 3 sites, `design/theme/Theme.kt` removed from the file list).
- [x] **`InstructionGenerator` font fix** — the tattoo-evidence PDF generator was still loading the deleted `RCommon.font.inter_{regular,medium,semi_bold}` static cuts. Switched to a single `RDesign.font.inter_variable` typeface across all four `TextPaint`s, with `fontVariationSettings = "'wght' N"` per weight role (400 / 500 / 600). Matches the pattern the generated `PolkadotFontFamilies` uses on the Compose side.
- [x] **`KnownTokensFormatter` brand-color swap** — preview/mock token formatters that pinned `BrandPink/BrandBlue/BrandCyan` updated to the same primitive colors as the stable-color removal (`PinkPink600` / `BlueBlue600` / `AdvancedTurquoiseTurquoise600`). Tail end of the same cleanup.
- [x] **Legacy XML colors/themes cleanup** — `common/res/values/{attrs,colors,themes}.xml` pared down by ~60% (legacy Nova attrs, color refs, and theme entries that the Compose migration left orphaned). `bottom_nav_icon_tint.xml`, `fragment_main.xml`, `bg_tattoo_placeholder.xml` adjusted to match.
- [x] **Old voting screen deleted** — `feature/mobrules/impl/.../voting/{VoteFragment,VoteViewModel,VoteContract}` plus the entire `voting/compose/{components,icons}/` subtree (~2250 LOC: `VoteScreen`, `VotingCardContent`, `VideoCardContent`, `PhotoCardContent`, `ReportUsernameCardContent`, `CredentialsCardContent`, `VotingCardReportOverlay`, `VotingCardSensitiveContentOverlay`, `VoteButton`, `VotingControls`, `VotingStamp`, `EvidenceVideoController`, `VideoProofContentView`, etc.). Voting model classes (`VotingCaseUiModel`, `VotingOption`) moved `voting/model/` → `bot/model/`. Branch-incidental cleanup, not tokens-related — flagged because reviewers of the design-system PR will see it.
- [ ] **Visual QA** — type checker passes; visual regressions are still on the designer/QA side, especially around the typography font-family shift (Inter → Manrope on headers), the `AvatarColorScheme` recoloring, and the `NovaStableColors → primitives` swap.
- [ ] **Merge `feature/design-system-tokens` to `master`** — branch is up to date with origin; all migration work above is on this branch. Master is untouched.
- [x] **Font flash on cold start** — resolved in `0.1.7` by bundling variable fonts in the AAR (`res/font/{inter,manrope,martian_mono}_variable.ttf`). No more async download, no faux-text flash. AAR grew by ~670 KB; minSdk requirement is now effectively 26 for axis variation (consumer is 29, no issue). Variable fonts also future-proof against designers adding new weights — generator just emits another `Font(...)` line, no new resource file needed.

#### Hardcoded literals introduced in consumer

These design tokens had no clean equivalent in the new generated lib, so call sites were rewritten to inline literals rather than rounded/snapped to a semantic name. They are easy to grep for and revisit when the designer adds them to the scale.

**Color literals** (white/black at varying alphas — old `fill*` / `fillDark*` had no semantic counterpart in the new palette which uses zinc-based opaque surface tokens):

| Old token | Literal | Files |
|-----------|---------|-------|
| `fill2` | `Color(0x05FFFFFF)` | 1 |
| `fill6` | `Color(0x0FFFFFFF)` | 13 |
| `fill8` | `Color(0x14FFFFFF)` | 11 |
| `fill12` | `Color(0x1FFFFFFF)` | 26 |
| `fill18` | `Color(0x2EFFFFFF)` | 3 |
| `fill24` | `Color(0x3DFFFFFF)` | 2 |
| `fill30` | `Color(0x4DFFFFFF)` | 1 |
| `fill48` | `Color(0x7AFFFFFF)` | 2 |
| `fill70` | `Color(0xB3FFFFFF)` | 2 |
| `fillDark30` | `Color(0x4D000000)` | 3 |
| `fillDark45` | `Color(0x73000000)` | 13 |
| `fillDark66` | `Color(0xA8000000)` | 6 |
| `fillDark100` | `Color(0xFF000000)` | 24 |

Not in the literal list:
- `fill100` (opaque white) → migrated to `colors.fg.staticWhite` (semantic match).
- `appliedHover` (white@6%) was missed in the substitution pass — only appears in the deleted `palettes/NovaColorsPalette.kt`/`DarkColorsPalette.kt`, no live call sites.
- `textAndIconsDisabled` → migrated to `colors.fg.tertiary` as the closest dimmed-text role (white@27% → zinc-600). Slight visual drift.
- `appliedOverlay` (black@70%) → migrated to `colors.bg.surface.overlay` (black@48%). Alpha shift.

To find them: `grep -rn "Color(0x[0-9A-F]\{8\})" --include="*.kt" polkadot-app-android-v2`

**Spacing literals** (off-scale `spacing<N>` values that don't match the new 9-step semantic scale — 0/2/4/8/12/16/24/32/40 dp):

| Old token | Literal | Sites |
|-----------|---------|-------|
| `spacing6` | `6.dp` | 9 |
| `spacing10` | `10.dp` | 8 |
| `spacing14` | `14.dp` | 13 |
| `spacing20` | `20.dp` | 8 |
| `spacing28` | `28.dp` | 1 |
| `spacing36` | `36.dp` | 3 |
| `spacing44` | `44.dp` | 2 |
| `spacing48` | `48.dp` | 7 |
| `spacing56` | `56.dp` | 5 |
| `spacing64` | `64.dp` | 1 |

**Radius literals** (off-scale corner radii — new scale is 0/4/6/8/10/12/16/24/32 dp):

| Literal | Sites |
|---------|-------|
| `RoundedCornerShape(14.dp)` | 3 |
| `RoundedCornerShape(20.dp)` | 5 |
| `RoundedCornerShape(22.dp)` | 2 |
| `RoundedCornerShape(28.dp)` | 3 |
| `RoundedCornerShape(40.dp)` | 1 |
| `RoundedCornerShape(48.dp)` | 2 |

#### File-level inventory

Per-literal file lists below. Counts here may exceed the summary tables above because the audit catches *all* literal usages — including pre-existing incidental sizing (icon `defaultSize`s, fixed dimensions) that wasn't introduced by the migration but represents design-system gaps.

### Color literals

- `Color(0x05FFFFFF)` (fill2) — 1
  - `design/components/progress/Shimmer.kt`

- `Color(0x0FFFFFFF)` (fill6) — 13
  - `design/components/button/ButtonColors.kt`
  - `design/components/mnemonic/MnemonicHolder.kt`
  - `design/components/text/TextField.kt`
  - `feature/backup/impl/recover/compose/components/OptionButton.kt`
  - `feature/become-citizen/impl/presentation/reserve/tattooDetails/compose/components/Evidence.kt`
  - `feature/become-citizen/impl/presentation/reserve/tattooDetails/compose/components/Execution.kt`
  - `feature/become-citizen/impl/presentation/reserve/tattooDetails/compose/components/Review.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/PaymentMessage.kt`
  - `feature/fund/impl/presentation/fund/terms/compose/components/FundingWidget.kt`
  - `feature/identity/impl/presentation/credentials/add/compose/components/AddProofStepContent.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/AssetDetailsScreen.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/components/CoinageDetailScreens.kt`
  - `feature/wallet/impl/presentation/enterAmount/compose/SendEnterAmountScreen.kt`

- `Color(0x14FFFFFF)` (fill8) — 11
  - `common/presentation/notifications/permissionAsker/compose/NotificationPermissionAsker.kt`
  - `feature/chats/impl/presentation/feed/compose/components/ChatFooterLabel.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/FileMessage.kt`
  - `feature/chats/impl/presentation/feed/compose/components/separators/NewMessageSeparator.kt`
  - `feature/mobrules/impl/presentation/bot/compose/VotingButton.kt`
  - `feature/mobrules/impl/presentation/bot/renderer/MobRuleBotFooterRenderer.kt`
  - `feature/mobrules/impl/presentation/evidenceDetail/compose/MediaEvidenceDetailScreen.kt`
  - `feature/mobrules/impl/presentation/evidenceDetail/compose/components/VideoWatchCountdown.kt`
  - `feature/upgrade-username/api/presentation/bot/UpgradeUsernameWidget.kt`
  - `feature/videogame/impl/presentation/bot/compose/WeeklyGameBotFooter.kt`
  - `feature/videogame/impl/presentation/play/compose/components/PlayerCell.kt`

- `Color(0x1FFFFFFF)` (fill12) — 27
  - `design/components/avatar/NovaAddressAvatar.kt`
  - `design/components/button/ButtonColors.kt`
  - `design/components/compound/Switch.kt`
  - `design/components/mnemonic/MnemonicHolder.kt`
  - `design/components/progress/Shimmer.kt`
  - `feature/become-citizen/impl/presentation/photo/capture/compose/components/OverlayToggleButton.kt`
  - `feature/become-citizen/impl/presentation/reserve/list/compose/components/FamilyItemIcon.kt`
  - `feature/chats/api/presentation/common/ChatFooterNavigationButton.kt`
  - `feature/chats/api/presentation/faq/compose/Faq.kt`
  - `feature/chats/impl/presentation/chatRequestsList/compose/ChatRequestsListScreen.kt`
  - `feature/chats/impl/presentation/feed/compose/components/input/ChatInputRow.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/FileMessage.kt`
  - `feature/chats/impl/presentation/list/compose/components/ChatListContent.kt`
  - `feature/chats/impl/presentation/list/compose/components/ChatListLoading.kt`
  - `feature/fund/impl/presentation/fund/terms/compose/components/FundingOperations.kt`
  - `feature/fund/impl/presentation/fund/terms/compose/components/TokenChip.kt`
  - `feature/identity/impl/presentation/credentials/add/compose/components/AddHandleStepContent.kt`
  - `feature/identity/impl/presentation/credentials/add/compose/components/AddProofStepContent.kt`
  - `feature/mobrules/impl/presentation/bot/renderer/MobRuleVotedCaseMessageRenderer.kt`
  - `feature/mobrules/impl/presentation/evidenceDetail/compose/components/VideoWatchCountdown.kt`
  - `feature/settings/impl/presentation/backup/status/compose/components/BackupStatusStateContent.kt`
  - `feature/tokens/api/presentation/simpletokenlist/compose/components/AssetItem.kt`
  - `feature/usernames/api/presentation/compose/UsernameTextField.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/components/CoinageDetailScreens.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/components/CoinageStateCard.kt`
  - `feature/wallet/impl/presentation/enterAmount/compose/components/EnterAmountRecipient.kt`
  - `feature/wallet/impl/presentation/identityDetails/compose/IdentityDetailsScreen.kt`

- `Color(0x2EFFFFFF)` (fill18) — 3
  - `feature/become-citizen/impl/presentation/common/compose/EvidenceInstructionScreen.kt`
  - `feature/calls/impl/presentation/call/compose/components/CallControlButton.kt`
  - `feature/calls/impl/presentation/call/compose/components/CallStateBanner.kt`

- `Color(0x3DFFFFFF)` (fill24) — 2
  - `design/components/dialog/AlertDialog.kt`
  - `feature/chats/impl/presentation/feed/compose/components/input/ChatInputRow.kt`

- `Color(0x4DFFFFFF)` (fill30) — 1
  - `design/components/progress/Shimmer.kt`

- `Color(0x7AFFFFFF)` (fill48) — 2
  - `feature/chats/impl/presentation/feed/compose/components/dialog/components/MessageActionMenu.kt`
  - `feature/wallet/impl/presentation/identityDetails/compose/IdentityDetailsScreen.kt`

- `Color(0xB3FFFFFF)` (fill70) — 2
  - `feature/chats/impl/presentation/feed/compose/components/dialog/components/MessageActionMenu.kt`
  - `feature/videogame/impl/presentation/bot/compose/GameResultComposables.kt`

- `Color(0x4D000000)` (fillDark30) — 3
  - `design/components/button/ButtonColors.kt`
  - `design/components/progress/Shimmer.kt`
  - `feature/videogame/impl/presentation/play/compose/components/PlayerCell.kt`

- `Color(0x73000000)` (fillDark45) — 13
  - `common/presentation/compose/video/VideoPlayerControlsContainer.kt`
  - `design/components/progress/Shimmer.kt`
  - `feature/become-citizen/impl/presentation/bot/compose/EvidenceProvidedMessage.kt`
  - `feature/chats/impl/presentation/feed/compose/components/dialog/components/ExpandedEmojiPicker.kt`
  - `feature/chats/impl/presentation/feed/compose/components/dialog/components/MessageQuickReactions.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/MultimediaMessage.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/Utils.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/components/EditedLabel.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/components/Timestamp.kt`
  - `feature/mobrules/impl/presentation/bot/compose/MobRuleCaseCardWidget.kt`
  - `feature/mobrules/impl/presentation/evidenceDetail/compose/components/MediaEvidenceTopBar.kt`
  - `feature/videogame/impl/presentation/play/compose/components/HostUnavailableOverlay.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/AssetDetailsScreen.kt`

- `Color(0xA8000000)` (fillDark66) — 6
  - `feature/chats/impl/presentation/feed/compose/components/menu/MessageHistoryContent.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/ReplyPreviewBubble.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/components/EditedLabel.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/components/Timestamp.kt`
  - `feature/videogame/impl/presentation/play/compose/components/MusicIndicator.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/AssetDetailsScreen.kt`

- `Color(0xFF000000)` (fillDark100) — 8
  - `design/components/progress/Shimmer.kt`
  - `feature/chats/impl/presentation/feed/compose/components/ChatInputField.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/Utils.kt`
  - `feature/chats/impl/presentation/list/compose/components/ChatListHeader.kt`
  - `feature/chats/impl/presentation/list/compose/components/UnreadBadge.kt`
  - `feature/scan/impl/presentation/scanQr/compose/ImageOverlay.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/AssetDetailsScreen.kt`
  - `feature/wallet/impl/presentation/scanAddressQr/compose/ImageOverlay.kt`

### Spacing literals

- `6.dp` — 13
  - `feature/chats/impl/presentation/chatRequestsList/compose/components/ChatRequestListItem.kt`
  - `feature/chats/impl/presentation/feed/compose/components/input/ChatInputRow.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/ReplyPreviewBubble.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/TextMessage.kt`
  - `feature/chats/impl/presentation/list/compose/components/ChatListItem.kt`
  - `feature/chats/impl/presentation/list/compose/components/ChatListLoading.kt`
  - `feature/fund/impl/presentation/fund/terms/compose/components/FundingWidget.kt`
  - `feature/videogame/impl/presentation/bot/compose/components/UpcomingGameWidget.kt`
  - `feature/videogame/impl/presentation/play/compose/components/CommonComponents.kt`
  - `feature/videogame/impl/presentation/play/compose/components/PlayerCell.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/AssetDetailsScreen.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/components/CoinageDetailScreens.kt`
  - `feature/wallet/impl/presentation/common/CoinageDeepSearchWidget.kt`

- `10.dp` — 14
  - `common/presentation/notifications/permissionAsker/compose/NotificationPermissionAsker.kt`
  - `common/presentation/notifications/permissionAsker/compose/components/BenefitItem.kt`
  - `design/components/menu/MenuOption.kt`
  - `design/components/progress/SegmentedArcIndicator.kt`
  - `feature/chats/impl/presentation/feed/compose/components/ChatInputField.kt`
  - `feature/chats/impl/presentation/feed/compose/components/input/ChatInputRow.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/TextMessage.kt`
  - `feature/products/impl/presentation/spaBrowser/compose/components/BrowserMenuContent.kt`
  - `feature/videogame/impl/presentation/bot/compose/components/AlertSettingsContent.kt`
  - `feature/videogame/impl/presentation/play/compose/components/CommonComponents.kt`
  - `feature/videogame/impl/presentation/play/compose/components/PlayerCell.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/components/CoinageStateCard.kt`
  - `feature/wallet/impl/presentation/enterAmount/compose/components/EnterAmountRecipient.kt`
  - `feature/wallet/impl/presentation/sendPayment/compose/SendPaymentScreen.kt`

- `14.dp` — 13
  - `feature/become-citizen/impl/presentation/bot/compose/EvidenceProvidedMessage.kt`
  - `feature/chats/impl/presentation/feed/compose/components/input/ChatInputRow.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/FileMessage.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/MultimediaMessage.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/PaymentMessage.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/TextMessage.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/UnsupportedMessage.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/components/Timestamp.kt`
  - `feature/mobrules/impl/presentation/bot/compose/MobRuleCaseCardWidget.kt`
  - `feature/mobrules/impl/presentation/evidenceDetail/compose/components/VideoWatchCountdown.kt`
  - `feature/upgrade-username/api/presentation/bot/UpgradeUsernameWidget.kt`
  - `feature/videogame/impl/presentation/play/compose/components/MusicIndicator.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/components/CoinageDetailScreens.kt`

- `20.dp` — 23
  - `design/components/qr/QrCode.kt`
  - `feature/backup/impl/backupFound/compose/components/OverrideStep.kt`
  - `feature/backup/impl/recover/compose/components/OptionButton.kt`
  - `feature/become-citizen/impl/presentation/reserve/list/compose/components/CanApplyFooter.kt`
  - `feature/become-citizen/impl/presentation/reserve/list/compose/components/NotEnoughDepositFooter.kt`
  - `feature/chats/impl/presentation/feed/compose/components/dialog/components/MessageActionMenu.kt`
  - `feature/chats/impl/presentation/feed/compose/components/input/ChatInputRow.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/ContactAddedMessage.kt`
  - `feature/chats/impl/presentation/list/compose/components/ChatListLoading.kt`
  - `feature/chats/impl/presentation/list/compose/components/NewRequestsItem.kt`
  - `feature/chats/impl/presentation/search/compose/AddContactScreen.kt`
  - `feature/fund/impl/presentation/fund/terms/compose/components/FundingOperationItem.kt`
  - `feature/identity/impl/presentation/credentials/add/compose/components/AddProofStepContent.kt`
  - `feature/mobrules/impl/presentation/bot/compose/VotingButton.kt`
  - `feature/settings/impl/presentation/backup/conflict/compose/components/OverrideStep.kt`
  - `feature/settings/impl/presentation/currency/compose/components/CurrencyItem.kt`
  - `feature/transactions/api/api/presentation/outcome/compose/TransactionOutcomeScreen.kt`
  - `feature/upgrade-username/api/presentation/bot/UpgradeUsernameWidget.kt`
  - `feature/videogame/impl/presentation/play/compose/components/PlayerCell.kt`
  - `feature/videogame/impl/presentation/play/compose/components/TooltipsCommonComponent.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/AssetDetailsScreen.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/components/CoinageStateCard.kt`
  - `feature/wallet/impl/presentation/common/CoinageDeepSearchWidget.kt`

- `28.dp` — 11
  - `app/root/presentation/debug/compose/DebugMenuScreen.kt`
  - `common/presentation/notifications/permissionAsker/compose/NotificationPermissionAsker.kt`
  - `common/presentation/notifications/permissionAsker/compose/components/BenefitItem.kt`
  - `design/components/dialog/AlertDialog.kt`
  - `feature/backup/impl/backupFound/compose/components/OverrideStep.kt`
  - `feature/chats/impl/presentation/feed/compose/components/AttachFileButton.kt`
  - `feature/fund/impl/presentation/fund/terms/compose/components/FundingOperations.kt`
  - `feature/products/impl/presentation/productBotManagement/compose/ProductBotManagementScreen.kt`
  - `feature/settings/impl/presentation/backup/conflict/compose/components/OverrideStep.kt`
  - `feature/settings/impl/presentation/backup/status/compose/components/MnemonicConfirmationContent.kt`
  - `feature/usernames/api/presentation/compose/UsernameTextField.kt`

- `36.dp` — 4
  - `design/components/error/ErrorUiWidget.kt`
  - `feature/fund/impl/presentation/fund/terms/compose/components/FundHeader.kt`
  - `feature/videogame/impl/presentation/play/compose/components/MusicIndicator.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/AssetDetailsScreen.kt`

- `44.dp` — 2
  - `feature/chats/impl/presentation/feed/compose/components/messages/components/SwipeToReplyContainer.kt`
  - `feature/identity/impl/presentation/credentials/review/compose/CredentialsUnderReviewScreen.kt`

- `48.dp` — 23
  - `common/presentation/compose/video/VideoPlayerControlsContainer.kt`
  - `common/presentation/notifications/permissionAsker/compose/NotificationPermissionAsker.kt`
  - `common/presentation/notifications/permissionAsker/compose/components/BenefitItem.kt`
  - `design/components/avatar/NovaContactItem.kt`
  - `design/components/avatar/NovaUserAvatar.kt`
  - `design/components/bottomsheet/ModalBottomSheet.kt`
  - `feature/backup/impl/mnemonic/common/compose/components/Base.kt`
  - `feature/become-citizen/impl/presentation/common/compose/EvidenceInstructionScreen.kt`
  - `feature/become-citizen/impl/presentation/video/instructions/compose/components/PreconditionsBottomSheetContent.kt`
  - `feature/chats/api/presentation/common/ChatFooterNavigationButton.kt`
  - `feature/chats/impl/presentation/feed/compose/components/ScrollToNewButton.kt`
  - `feature/chats/impl/presentation/feed/compose/components/dialog/MessageActionDropdown.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/MultimediaMessage.kt`
  - `feature/mobrules/impl/presentation/bot/compose/MobRuleCaseCardWidget.kt`
  - `feature/mobrules/impl/presentation/evidenceDetail/compose/MediaEvidenceDetailScreen.kt`
  - `feature/settings/impl/presentation/backup/mnemonic/compose/MnemonicRevealScreen.kt`
  - `feature/settings/impl/presentation/backup/status/compose/components/BackupInProgressContent.kt`
  - `feature/settings/impl/presentation/backup/status/compose/components/BackupStatusStateContent.kt`
  - `feature/settings/impl/presentation/backup/status/compose/components/CheckingForBackup.kt`
  - `feature/tokens/api/presentation/simpletokenlist/compose/components/AssetItem.kt`
  - `feature/videogame/impl/presentation/addToCalendar/compose/VideoGameAddToCalendarScreen.kt`
  - `feature/videogame/impl/presentation/play/compose/components/CommonComponents.kt`
  - `feature/videogame/impl/presentation/play/compose/components/FinishedState.kt`

- `56.dp` — 10
  - `design/components/mnemonic/Mnemonic.kt`
  - `feature/become-citizen/impl/presentation/photo/capture/compose/components/TattooOverlay.kt`
  - `feature/calls/impl/presentation/call/compose/CallScreen.kt`
  - `feature/chats/impl/presentation/chatRequestsList/compose/components/ChatRequestListItem.kt`
  - `feature/chats/impl/presentation/list/compose/components/ChatListItem.kt`
  - `feature/identity/impl/presentation/credentials/add/compose/components/AddProofStepContent.kt`
  - `feature/settings/impl/presentation/backup/status/compose/components/BackupConflictContent.kt`
  - `feature/settings/impl/presentation/backup/status/compose/components/BackupExistsContent.kt`
  - `feature/settings/impl/presentation/backup/status/compose/components/GoogleDrivePermissionContent.kt`
  - `feature/settings/impl/presentation/backup/status/compose/components/NoBackupContent.kt`

- `64.dp` — 6
  - `design/components/error/ErrorUiWidget.kt`
  - `feature/become-citizen/impl/presentation/reserve/tattooDetails/compose/components/Review.kt`
  - `feature/chats/impl/presentation/feed/compose/components/messages/FileMessage.kt`
  - `feature/products/impl/presentation/signTransaction/compose/loaded/MainContent.kt`
  - `feature/sso/impl/presentation/pairRequest/compose/PairRequestScreen.kt`
  - `feature/wallet/impl/presentation/enterAmount/compose/components/EnterAmountRecipient.kt`

### Radius literals

- `RoundedCornerShape(14.dp)` — 2
  - `feature/chats/impl/presentation/feed/compose/components/input/ChatInputRow.kt`
  - `feature/mobrules/impl/presentation/bot/compose/MobRuleCaseCardWidget.kt`

- `RoundedCornerShape(20.dp)` — 5
  - `feature/become-citizen/impl/presentation/reserve/list/compose/components/CanApplyFooter.kt`
  - `feature/become-citizen/impl/presentation/reserve/list/compose/components/NotEnoughDepositFooter.kt`
  - `feature/chats/impl/presentation/feed/compose/components/input/ChatInputRow.kt`
  - `feature/fund/impl/presentation/fund/terms/compose/components/FundingOperationItem.kt`
  - `feature/wallet/impl/presentation/assetDetails/compose/AssetDetailsScreen.kt`

- `RoundedCornerShape(22.dp)` — 2
  - `feature/backup/impl/recover/compose/components/OptionButton.kt`
  - `feature/identity/impl/presentation/credentials/add/compose/components/AddProofStepContent.kt`

- `RoundedCornerShape(28.dp)` — 3
  - `app/root/presentation/debug/compose/DebugMenuScreen.kt`
  - `design/components/dialog/AlertDialog.kt`
  - `feature/products/impl/presentation/productBotManagement/compose/ProductBotManagementScreen.kt`

- `RoundedCornerShape(40.dp)` — 1
  - `feature/become-citizen/impl/presentation/common/compose/EvidenceInstructionScreen.kt`

- `RoundedCornerShape(48.dp)` — 2
  - `common/presentation/notifications/permissionAsker/compose/components/BenefitItem.kt`
  - `feature/mobrules/impl/presentation/evidenceDetail/compose/MediaEvidenceDetailScreen.kt`


### iOS

iOS team sent a template at `/Users/den/Downloads/Telegram Desktop/Generated/` describing the shape they want (colors + typography + their registry/selection plumbing). First pass landed 2026-05-15.

- [x] **`platforms/swift/`** mirroring `platforms/compose/`:
  - `swift.js` — `flatCamel` joins dotted token paths into single Swift camelCase identifiers (`fg.primary` → `fgPrimary`, `bg.surface.container-inverted` → `bgSurfaceContainerInverted`, `avatar.bg.amethyst` → `avatarBgAmethyst`); `hexToSwiftColor` emits `UIColor(rgbHex: 0xRRGGBB)` for 6-digit and `UIColor(rgbaHex: 0xRRRR_RRRR)` for 8-digit (the `_` between hex byte 2 and 3 matches the template); `fontFamilySlug` is camel of the font name (`"Inter"` → `inter`, `"Martian Mono"` → `martianMono`); `fontWeightExpr` extracts the leaf from `{Typography.fontWeight.semiBold}` refs and emits `.semiBold`.
  - `colors.js` — emits `ThemeColorsProtocol.swift` (protocol + `ThemeColor` enum + default `color(_:)` extension), `Themes/PolkadotDefaultTheme.swift` (concrete `CommonTheme` subclass with inner `Colors` class), `ThemeSelection.swift`, `ThemesRegistry.swift`. Walks semantic palette via flatten-and-sort; output is alphabetical by Swift identifier (matches Compose's `sortedEntries` convention; differs from the template's hand-curated `// MARK:`-grouped ordering — agreed cosmetic difference).
  - `typography.js` — emits `TypographyTypescale.swift` (`Typescale` enum with one case per source entry, `spec` switch returning `TypographyStyleSpec(family:[monoFamily:]size:weight:[emphasizedWeight:]lineHeight:tracking:)`, plus `TypographyStyle.<typescale>` static factories grouped by role with blank lines), `TypographySelection.swift`, `TypographyFamiliesRegistry.swift`. Role/size ordering: Display → Headline → Title → Paragraph → Body → Label → Emoji; sizes descending (ExtraLarge → Large → Medium → Small → Tiny). Multi-line spec format when `monoFamily` or `emphasizedWeight` is present, single-line otherwise — byte-identical to the template's wrapping. **Per user decision**, `family:` uses the literal font names (`.inter`, `.manrope`, `.martianMono`) rather than the template's abstract `.sans`/`.accent`/`.mono`.
  - `index.js` — `register()` + `run()`; two pipeline runs (colors, typography). Per-theme concrete files run in their own Style Dictionary build to resolve refs against primitives; registry + protocol files come along with the first theme's run.
- [x] **`build.js`** updated to `import * as swift` and call `swift.register()` / `await swift.run()`.
- [x] **`out/ios/`** flat at repo root with the seven Swift files (`ThemeColorsProtocol.swift`, `ThemeSelection.swift`, `ThemesRegistry.swift`, `Themes/PolkadotDefaultTheme.swift`, `TypographyTypescale.swift`, `TypographySelection.swift`, `TypographyFamiliesRegistry.swift`). Matches the template's directory layout.
- [x] **Diff vs. template** — 4 files byte-identical (`ThemeSelection`, `TypographySelection`, `ThemesRegistry`, `TypographyFamiliesRegistry`). `TypographyTypescale.swift` byte-identical apart from the agreed `.sans/.accent/.mono` → `.inter/.manrope/.martianMono` family swap. `ThemeColorsProtocol.swift` + `Themes/PolkadotDefaultTheme.swift` semantically identical (same identifiers, same hex literals, same `rgbHex:` vs `rgbaHex:` choice, same underscore split for 8-digit values) — only cosmetic difference is alphabetical ordering vs the template's MARK-grouped ordering.

The `lib/` directory remains platform-independent (`token-tree.js`, `utils.js`); `lib/typography-analysis.js` is unused by Swift (the iOS Typescale schema emits one spec per source entry rather than expanding into role/size/variant TextStyles like Compose does), but stays in place for Compose. The Swift typography emitter inlines its own ~10-line `byEntry` builder.

#### Open with the iOS team

- [ ] **Cosmetic ordering** — confirm alphabetical-by-identifier is acceptable, or send back a preferred grouping rule (current code in `platforms/swift/colors.js` sorts via `sortLeaves`; we can add a top-level group preference table if they want MARK headers).
- [ ] **`PolkadotDefaultTypography.swift`** — the family class referenced by `TypographyFamiliesRegistry.factories[.polkadotDefault]: PolkadotDefaultTypography.init`. We assume iOS team writes this by hand (it maps `.inter` / `.manrope` / `.martianMono` to actual `UIFont` resolutions with per-weight cuts — knowledge the generator doesn't have access to from the source). Confirm; if they want us to generate it too, we'll need a sample of `TypographyFamily`'s shape.
- [ ] **Dimensions / radii / borders** — not present in the template. Deferred until the iOS team picks a shape. We have all three in source; emitting Swift versions is a follow-up `platforms/swift/dimensions.js`.

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

Tokens repo (`polkadot-app-design-system`):

- `build.js` — entry point. Registers both `compose` and `swift` platforms; runs Compose pipeline then Swift pipeline.
- `platforms/compose/index.js` — registers SD formatters and runs the pipeline; three runs (colors / typography / dimensions). The typography run combines the primitives source with the first theme source so `formatFontFamiliesObject` can see which `(font, weight)` pairs the Typescale actually uses.
- `platforms/compose/typography.js` — Kotlin emitter for typography. `formatFontFamiliesObject` emits the bundled-variable-font `Font(...)` declarations. The three role shapes (flat / uniform / mixed) are formatted in `baseClassRoleBlocks` and `concreteRoleOverride`.
- `platforms/compose/colors.js` — colors emitter. `primitiveName` PascalCases path segments verbatim (no ancestor strip).
- `platforms/compose/dimensions.js` — spacings/radii/borders emitter. `stripGroupPrefix` removes the redundant `Space`/`Radius`/`Border` prefix from leaf keys before identifier generation.
- `platforms/swift/swift.js` — `flatCamel(path)`, `hexToSwiftColor(hex)`, `fontFamilySlug(name)`, `fontWeightExpr(entry)`.
- `platforms/swift/colors.js` — emits `ThemeColorsProtocol.swift`, `Themes/<class>.swift`, `ThemeSelection.swift`, `ThemesRegistry.swift`. Output sorted alphabetically by Swift identifier. `themes` list at the bottom holds per-theme metadata (`className`, `selectionKey`, `systemStyle`, `statusBarStyle`).
- `platforms/swift/typography.js` — emits `TypographyTypescale.swift`, `TypographySelection.swift`, `TypographyFamiliesRegistry.swift`. Inlines its own `buildEntries` byEntry parser; uses literal font slugs (`.inter`/`.manrope`/`.martianMono`); multi-line spec format only when `monoFamily` or `emphasizedWeight` is present.
- `platforms/swift/index.js` — `register()` + `run()`; two pipeline runs (colors, typography).
- `lib/typography-analysis.js` — Typescale parser; splits each entry into role/size, generates variants per `variantBuilders`. Exports `roleShape` (flat / uniform / mixed) consumed by the Kotlin formatter. (Swift typography emitter doesn't use this — it inlines its own byEntry loop because the iOS Typescale schema is one-spec-per-source-entry.)
- `README.md` — architecture overview

Android lib repo (`polkadot-app-design-system-android`):

- `design-system/build.gradle.kts` — AGP 8.12.3, Kotlin 2.2.21, compileSdk 36, minSdk 21, Compose BOM 2026.05.00. No GoogleFonts dependency anymore.
- `design-system/src/main/res/font/` — three bundled variable TTFs: `inter_variable.ttf`, `manrope_variable.ttf`, `martian_mono_variable.ttf`.
- `design-system/src/main/java/io/pcf/polkadotapp/designsystem/` — generated Kotlin (mirrors `out/android/`).

Consumer (`polkadot-app-android-v2`):

- `gradle/libs.versions.toml` — pin `design-system = "0.1.7"`.
- `design/src/main/java/io/pcf/polkadotapp/design/theme/Theme.kt` — `PolkadotTheme` composable + accessor object; wires the five `LocalPolkadot*` CompositionLocals and inlines Material-3 conversion helpers.
- `design/src/main/java/io/pcf/polkadotapp/design/configs/colors/AvatarColorScheme.kt` — only surviving handwritten color file: the 10-gemstone `AvatarColorScheme` enum with hash-keyed dispatch, now reading `PolkadotTheme.colors.avatar.bg/fg`. `NovaColors.kt` (`NovaStableColors`) and `NovaAvatarColors.kt` (`NovaAvatarPalette`) were deleted; their call sites moved to `PolkadotColorsPrimitives.*`.

## How to verify everything still works

### Tokens generator

```
cd <tokens-repo>
node build.js
find out -name "*.kt" | wc -l    # should be 12
```

Expected: 12 Kotlin files emitted, no errors. Typography skip-log should be empty for the v4 export (earlier exports had `Emoji Small` skipped because of a broken ref to `{Typography.font-size.20}` — fixed in v4). All output deterministic.

### Android distribution (local Maven smoke test)

```
cd <android-lib-repo>
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
