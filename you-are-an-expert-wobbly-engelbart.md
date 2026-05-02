# Run-It → "Jet Lag" UI Redesign

## Context

Run-It MVP is functionally complete: Expo dev-build, Supabase + PostGIS backend, Mapbox map, BG GPS, leaderboards, daily winner snapshots — all wired and demoable. The current UI is a generic Strava-style dark theme (`#0b1a2b` / `#3aa0ff`) that doesn't match the user's vision: **playful yet premium, board-game tactility, like the maps and scoreboards in _Jet Lag: The Game_**.

This plan covers a UI-only redesign. **Stack stays React Native + Expo** — the GPS pipeline, Supabase RPCs, realtime channels, and Mapbox integration are reused unchanged. Framing shifts to a **territory board game**: map = the board, regions = tiles you claim, glowing player tokens for rivals, animated route playback after each run, parchment land tones with bold display type. Timeline: **2–3 weeks of full polish**, including animated route draw, custom Mapbox parchment style, and share-card export from the post-run summary.

---

## Locked decisions

| Question          | Answer                                                                         |
| ----------------- | ------------------------------------------------------------------------------ |
| Framework         | React Native + Expo (no Flutter rewrite)                                       |
| Framing           | Territory board game                                                           |
| Surfaces in scope | MapHome, Run, Leaderboard, **new** RunSummary; Profile = chrome/font swap only |
| Timeline          | 2–3 weeks, full polish                                                         |
| Animation lib     | `react-native-reanimated` v4 + `react-native-svg`                              |
| Maps              | Custom Mapbox Studio parchment style (URL-referenced, not local JSON)          |
| Fonts             | Bebas Neue (display) + Inter (body) via `expo-font`                            |
| State             | Plain hooks + Supabase client — no new state library                           |
| Backend           | Untouched — no schema/RPC changes                                              |

---

## Theme system — `lib/ui/`

```
d:\run_it\lib\ui\
  tokens.ts          palette, space, radii, shadows, z-index
  typography.ts      font families + type scale (hero / title / badge / body / caption)
  fonts.ts           useAppFonts() — expo-font hook
  theme.ts           composes tokens + typography
  ThemeProvider.tsx  context + useTheme() hook
  index.ts           barrel export
  components/        primitives (see below)
```

**Palette** (from the user's reference HTML):

```
cream     #F5F0E8   landFill #E8E0D0   blue   #2D6BE4
ink       #1A1A2E   landEdge #C8BEA8   red    #E84040
parchment #F5F0E8   water    #A8D8EA   yellow #F5C842
glowGold  #FFD84A                      green  #3CB371
```

Rationale for `lib/ui/` not `components/`: matches existing convention (`lib/auth.tsx`, `lib/supabase.ts`, `lib/colors.ts`).

### Wiring without "big bang" rewrite

Modify only [App.tsx](App.tsx):

1. Wrap `<AuthProvider>` with `<ThemeProvider>`.
2. Block render until `useAppFonts()` resolves (reuse the auth-gate `ActivityIndicator`).
3. Replace inline `navTheme` ([App.tsx:35-46](App.tsx#L35-L46)) with one derived from `tokens.palette` — single change re-themes React Navigation header + tab bar globally.

Each screen migrates one at a time: replace hardcoded `#0b1a2b` / `#3aa0ff` with theme reads. Until migrated, a screen looks dark-on-cream — ugly but functional.

### Reuse existing helpers

- [lib/colors.ts](lib/colors.ts) `userColorHex(uid)` — keep as-is (load-bearing for Mapbox data-driven styling). Add sibling `userColorWithGlow(uid)` returning `{ base, glow }` for `PlayerToken`.
- [lib/geo.ts](lib/geo.ts) `pointInPolygon` — reused for the new region-entered toast on Run.

---

## Custom Mapbox style — Studio, not local JSON

Build a parchment style in **Mapbox Studio** (duplicate "Outdoors", recolor land=`#E8E0D0`, water=`#A8D8EA`, roads=thin `#C8BEA8`, hide POI, low-contrast brown labels). Publish, paste URL into `app.json` → `extra.mapboxParchmentStyleUrl`, read it in [App.tsx](App.tsx) alongside the existing token bootstrap, and replace `Mapbox.StyleURL.Dark` in [screens/MapHome.tsx:124](screens/MapHome.tsx#L124) and [screens/Run.tsx:109](screens/Run.tsx#L109).

Local `style.json` rejected: requires self-hosting tiles/glyphs/sprites — two days of yak-shaving against a 14-day budget.

**Region styling tweaks** (against parchment): drop `FillLayer` opacity from 0.45 → 0.30, bump `LineLayer` opacity to 0.85, keep `isMine` gold border (rename `#ffd84a` → `palette.glowGold`).

---

## Reusable primitives — `lib/ui/components/`

| File                  | Purpose                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Surface.tsx`         | Parchment card: double-border (outer landEdge / inner landFill 1px inset), soft shadow, optional `tilt` for board-stack feel |
| `PlayerToken.tsx`     | Circle in `userColorHex(uid)` + animated glow ring (Reanimated `withRepeat` 1500ms scale 1→1.6) — **the signature element**  |
| `CoinRow.tsx`         | Horizontal coin chips with stagger pop-in (`withDelay(i*80, withSpring)`)                                                    |
| `ChallengeCard.tsx`   | Slide-up card popup (replaces immediate-navigate on MapHome region tap)                                                      |
| `CountdownBadge.tsx`  | Pill with monospaced digits (Leaderboard "resets in 04:12:08")                                                               |
| `BebasNumber.tsx`     | Big display number with optional 0→value count-up via `useAnimatedReaction`                                                  |
| `ScoreboardRow.tsx`   | Leaderboard row: rank chip + token + name + points + km                                                                      |
| `PrimaryButton.tsx`   | Ink-on-yellow chunky board-game button                                                                                       |
| `SecondaryButton.tsx` | Outlined parchment button                                                                                                    |
| `Toast.tsx`           | Top slide-down ("Region claimed! +120")                                                                                      |

All consume `useTheme()`, never hardcode hex. Each accepts `size?: 'sm' | 'md' | 'lg'` where it makes sense.

Build a `screens/_DesignSystem.tsx` (gated `__DEV__`) that renders every primitive on one scrollable page for visual QA.

---

## Per-screen redesign

### MapHome — [screens/MapHome.tsx](screens/MapHome.tsx)

**Data hooks kept verbatim:** `regions_as_geojson` RPC, `daily_region_winners` query, `current_region_leaders` RPC, realtime `region_scores` channel, `fc` FeatureCollection construction.

**Layout:**

```
+-----------------------------------------------+
| [Today | Yesterday]   CITY NAME (Bebas)  [⚙] |
+-----------------------------------------------+
|                                               |
|         <Mapbox parchment basemap>            |
|         regions filled in player hues         |
|         your-owned regions: gold deckle edge  |
|                                               |
|   +---- ChallengeCard (on tap) -------------+ |
|   | [Token] Greenwich Village                | |
|   | "Held by @sam · 1240 pts · 4.2 km"       | |
|   | [Open leaderboard]  [Plan a run]         | |
|   +-----------------------------------------+ |
+-----------------------------------------------+
```

**Changes:**

- Parchment basemap, lower fill opacity, gold deckle border for owned regions.
- Header strip with **Today / Yesterday segmented control** — toggles between `todayLeaders` and `yesterdayWinners` (both already in state). No new fetch.
- **ChallengeCard popup replaces immediate navigate** on region tap. Primary action calls existing `onRegionTap` callback.
- On-map `PlayerToken` overlays at region centroids — **deferred** (first item to drop if time slips).

### Run — [screens/Run.tsx](screens/Run.tsx)

**Hooks kept:** `useLiveRun`, `startRun`, `stopRun`, `recoverActiveRun`, `uploadRun`, `pathDistanceMeters`, elapsed `setInterval`, MapView + UserLocation + polyline.

**Removed:** the in-screen `<Modal>` summary block ([Run.tsx:150-190](screens/Run.tsx#L150-L190)). On stop success, `navigation.navigate('RunSummary', ...)` instead.

**Layout:**

```
+-----------------------------------------------+
| ⏸  02:34 (Bebas)              [PlayerToken] |
+-----------------------------------------------+
|                                               |
|        <Mapbox parchment + polyline>          |
|                                               |
|   ╔═ Toast: "Claimed Bushwick! +120" ═╗      |
+-----------------------------------------------+
| Surface (parchment HUD)                       |
|  DISTANCE   TIME      POINTS                  |
|  3.42 KM    18:42     342  ●●●●●●●●          |
|                                               |
|   ┌─────── PrimaryButton ───────┐             |
|   │         STOP RUN             │            |
|   └─────────────────────────────┘             |
+-----------------------------------------------+
```

**Changes:**

- Polyline color → `userColorHex(session.user.id)` (was hardcoded `#3aa0ff` at [Run.tsx:117](screens/Run.tsx#L117)).
- HUD wrapped in `Surface`, numbers swapped to `BebasNumber`.
- **Region-entered toast (new behavior):** on each new GPS point, run `pointInPolygon` from [lib/geo.ts](lib/geo.ts) against loaded regions; on first entry to a region this run, push a `Toast`. Track visited regions in a local `Set`. Region list loaded once at mount via `regions_as_geojson` RPC.

### Leaderboard — [screens/Leaderboard.tsx](screens/Leaderboard.tsx)

**Hooks kept:** `region_scores`-with-`profiles!inner` query, realtime channel, `today` derivation, `Row` shape.

**Layout:**

```
+-----------------------------------------------+
|  ← back   GREENWICH VILLAGE (Bebas)           |
|           Today's leaderboard                 |
+-----------------------------------------------+
| Surface (parchment, slight tilt -1°)          |
|  ┌─ ScoreboardRow ─────────────────────────┐  |
|  │  01  [Token] sam       1240 / 4.20 km   │  |
|  │  02  [Token] you (me)   980 / 3.30 km   │  ← gold deckle on isMe
|  │  03  [Token] alex       720 / 2.40 km   │  |
|  └──────────────────────────────────────────┘  |
|                                               |
|  CountdownBadge: "Resets in 04:12:08"         |
+-----------------------------------------------+
```

**Changes:**

- `ScoreboardRow` replaces inline row JSX (same data, prettier shell).
- Small `PlayerToken` replaces 12px dot.
- `CountdownBadge` to local midnight (client-side `setInterval`, no query).
- Realtime onUpdate triggers 600ms row-bg-color pulse via Reanimated shared value keyed by `user_id`.

### RunSummary — `screens/RunSummary.tsx` (new)

**Wiring** in [App.tsx](App.tsx):

```ts
<Stack.Screen name="RunSummary" component={RunSummary}
  options={{ headerShown: false, presentation: 'modal' }} />
```

RootStack adds: `RunSummary: { distanceM, durationMs, points, pointCount, coords: [number,number][], userId, regionsClaimed: number[] }`.

**Layout:**

```
+-----------------------------------------------+
|  ✕                                            |
|         RUN COMPLETE (Bebas hero)             |
|                                               |
|  ┌── Surface (tilted -1°) ───────────────────┐|
|  │   <Mapbox snapshot, route drawn over it> │|
|  │   route animates in over ~1.8s on mount  │|
|  └──────────────────────────────────────────┘|
|                                               |
|  3.42 KM (Bebas)        18:42 (Bebas)        |
|                                               |
|  CoinRow: 342 points  ●●●●●●●● (count-up)    |
|  "Claimed: Bushwick, Williamsburg"            |
|                                               |
|  [Share card]  [Done]                         |
+-----------------------------------------------+
```

**Animated route playback (highest-ROI animation):**

1. Render `Mapbox.snapshotManager.takeSnap({ ... styleURL: PARCHMENT_STYLE_URL })` as a static `<Image>` background.
2. Overlay `react-native-svg` `<Path>` with `strokeDasharray` + animated `strokeDashoffset` driven by Reanimated `progress: 0 → 1` over 1800ms `Easing.out(Easing.cubic)`. Convert lat/lng → pixel space via the snapshot bbox. Avoids "animating live MapView" entirely.

**Score count-up:** `BebasNumber` tweens 0 → value over 1200ms via `useAnimatedReaction` writing to `useState` (Reanimated can't animate text content directly — standard workaround).

---

## Animation strategy — `react-native-reanimated` v4

Add via `npx expo install react-native-reanimated react-native-svg react-native-view-shot expo-sharing expo-font`.

| Element                                | Animation                                   | Cost    |
| -------------------------------------- | ------------------------------------------- | ------- |
| `PlayerToken` pulse ring               | `withRepeat(withTiming(scale 1→1.6, 1500))` | trivial |
| `ChallengeCard` slide-up               | `withSpring(translateY)` on mount           | trivial |
| `Toast` slide-down + auto-dismiss 2.5s | `withSpring`                                | trivial |
| `RunSummary` route draw                | SVG `strokeDashoffset` 1.8s                 | medium  |
| `BebasNumber` count-up                 | `useAnimatedReaction` → state               | trivial |
| `CoinRow` stagger                      | `withDelay(i*80, withSpring(scale))`        | trivial |
| Leaderboard row pulse on update        | bg-color tween 600ms                        | trivial |

**Top-3 ROI (build first, sells the redesign on its own):**

1. RunSummary animated route draw
2. PlayerToken pulse ring (used on 4 screens)
3. RunSummary count-up + coin pop-in

**Skip:** on-map polygon pulsing (forces Mapbox redraws, janky), live-Run polyline progressive draw (user is staring at the road).

---

## Share-card export

- `react-native-view-shot` wraps an off-screen sub-tree (`position: absolute; left: -9999`) at fixed 1080×1920 (IG story).
- Capture: `await ref.current.capture({ format: 'png', quality: 1 })` → file URI.
- Share: `expo-sharing` `Sharing.shareAsync(uri, { mimeType: 'image/png' })`.

**Critical caveat:** `view-shot` cannot reliably capture a live `<MapView>` on Android (separate GL surface — comes back blank). Fix: never include MapView in the captured tree. Use the same `Mapbox.snapshotManager.takeSnap` PNG that powers the on-screen visual; SVG route overlays on top — both plain RN views, capture works.

Fallback if `snapshotManager` API drift in `@rnmapbox/maps` 10.3: Mapbox Static Images REST API (`https://api.mapbox.com/styles/v1/{user}/{styleId}/static/...`).

---

## Sequenced milestones (~14 working days)

**M1 — Foundation (days 1–2)**
Deps install, babel config for Reanimated, fonts in `assets/fonts/`, build `lib/ui/{tokens,typography,fonts,theme,ThemeProvider}.ts`, wire into [App.tsx](App.tsx), update `navTheme`.
**Demo:** app boots on cream background, Bebas Neue in headers, screens still functional but visually inconsistent.

**M2 — Primitives (days 3–5)**
Build all 10 components in `lib/ui/components/`. Build `screens/_DesignSystem.tsx` for visual QA.
**Demo:** dev-only design system screen shows every primitive including pulse animation.

**M3 — Mapbox parchment + MapHome (days 6–8)**
Build parchment style in Studio, paste URL in `app.json`. Restyle [MapHome.tsx](screens/MapHome.tsx): parchment basemap, header strip, segmented Today/Yesterday, ChallengeCard popup.
**Demo:** map matches reference HTML; tapping a region pops a card.

**M4 — Run + RunSummary (days 9–12)**
Restyle [Run.tsx](screens/Run.tsx) HUD, per-user polyline color, region-entered toast. Strip in-screen modal, navigate to RunSummary. Build `screens/RunSummary.tsx`: snapshot, animated SVG route, count-up, coin row, share button via `view-shot` + `expo-sharing`.
**Demo:** full happy path — start, stop, see animated summary, share PNG.

**M5 — Leaderboard + polish (days 13–14)**
Restyle [Leaderboard.tsx](screens/Leaderboard.tsx) with ScoreboardRow, CountdownBadge, row-pulse on realtime update. Apply Surface chrome + Bebas headers to [Profile.tsx](screens/Profile.tsx) (no layout work). iOS + Android dev-client QA. Tweak shadows, scales, timings.
**Demo:** full app feels cohesive on both platforms.

---

## Risks & gotchas

1. **Reanimated babel plugin** must be the **last** plugin in `babel.config.js`. After install, `npx expo start --clear`. Forgetting → silent "worklet not compiled" no-op.
2. **Custom font caching on Android dev-build.** Use distinct family keys (`BebasNeue`, no spaces). May need `npx expo prebuild --clean` first time fonts are added — Metro reload alone won't pick up native asset changes.
3. **Mapbox Studio fonts** may require paid tier in some regions. Fallback: built-in serif options.
4. **`view-shot` + Mapbox.** Never capture live MapView (covered above).
5. **`Mapbox.snapshotManager` API drift** in `@rnmapbox/maps` 10.x. Verify against installed 10.3 docs. Fallback: Static Images REST API.
6. **Nav-param coord payload** — fine up to ~2000 GPS points. Beyond that, persist run id and re-fetch polyline on RunSummary mount.

### Cut order if time slips

1. On-map `PlayerToken` overlays at region centroids
2. Region-entered toast on Run
3. Share-card export (keep RunSummary itself)
4. Leaderboard row-pulse on realtime update
5. **Last resort:** custom Mapbox parchment style → fall back to `Mapbox.StyleURL.Light`. Do **not** cut Bebas Neue / parchment chrome — that's 80% of the perceived redesign.

### Out of scope

- New backend tables/columns (region-entered tracking is client-side only)
- State management library
- `lib/colors.ts` rewrite (load-bearing for Mapbox data-driven styling)
- Profile redesign beyond chrome/font swap

---

## Critical files to create / modify

**New:**

- `lib/ui/tokens.ts`, `typography.ts`, `fonts.ts`, `theme.ts`, `ThemeProvider.tsx`, `index.ts`
- `lib/ui/components/{Surface,PlayerToken,CoinRow,ChallengeCard,CountdownBadge,BebasNumber,ScoreboardRow,PrimaryButton,SecondaryButton,Toast}.tsx`
- `screens/RunSummary.tsx`
- `screens/_DesignSystem.tsx` (dev-only)
- `assets/fonts/{BebasNeue-Regular,Inter-Regular,Inter-Bold}.ttf`

**Modify:**

- [App.tsx](App.tsx) — add ThemeProvider + useAppFonts gate, parchment navTheme, register RunSummary screen, read `mapboxParchmentStyleUrl` from `extra`
- [screens/MapHome.tsx](screens/MapHome.tsx) — parchment styleURL, header strip, segmented Today/Yesterday, ChallengeCard popup
- [screens/Run.tsx](screens/Run.tsx) — Surface HUD, BebasNumber, per-user polyline color, region-entered toast, navigate to RunSummary
- [screens/Leaderboard.tsx](screens/Leaderboard.tsx) — ScoreboardRow, CountdownBadge, row-pulse
- [screens/Profile.tsx](screens/Profile.tsx) — chrome/font swap only
- `app.json` — `extra.mapboxParchmentStyleUrl`
- `babel.config.js` — add `react-native-reanimated/plugin` last
- `package.json` — new deps via `expo install`

**Reused unchanged:**

- All of `supabase/`, `lib/supabase.ts`, `lib/auth.tsx`, `lib/location.ts`, `lib/runs.ts`, `lib/distance.ts`, `lib/geo.ts`, `lib/colors.ts`, `scripts/*`

---

## Verification

End-to-end happy path on a physical phone:

1. Cold-launch — splash → auth gate → SignIn (parchment, Bebas inputs).
2. Sign in → MapHome shows parchment basemap + colored regions. Toggle Today/Yesterday — colors shift. Tap a region → ChallengeCard slides up.
3. Tap Run tab → HUD in parchment. Tap Start → permission flow → polyline draws in your color as you walk. Cross into another region → toast.
4. Tap Stop → navigate to RunSummary. Watch route draw over snapshot, score count up, coins pop in. Tap Share → PNG opens in share sheet.
5. Tap Done → back to MapHome. Tap your region → Leaderboard shows your row pulsing gold, CountdownBadge ticking.
6. Run `_DesignSystem` screen (dev only) — every primitive renders correctly on iOS and Android.

Pre-flight: `npm run typecheck`, `npm run doctor`, no Reanimated worklet warnings in Metro logs.
