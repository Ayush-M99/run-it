# Run-It — Remaining Tasks

Status as of 2026-04-28. TypeScript clean. Backend fully connected (verified below).

---

## Backend / Database Integration Status

| Check                                       | Result                                              |
| ------------------------------------------- | --------------------------------------------------- |
| Supabase reachable                          | ✅                                                  |
| `regions_as_geojson()`                      | ✅ 22 rows                                          |
| `current_region_leaders()`                  | ✅ (applied to DB — was missing from live instance) |
| `snapshot_daily_winners()`                  | ✅                                                  |
| `process_run()`                             | ✅                                                  |
| `insert_region()`                           | ✅ (service role only)                              |
| TABLE regions                               | ✅ 22 rows                                          |
| TABLE runs                                  | ✅ 80 rows                                          |
| TABLE run_points                            | ✅ 6400 rows                                        |
| TABLE region_scores                         | ✅ 150 rows                                         |
| TABLE daily_region_winners                  | ✅ 20 rows                                          |
| TABLE profiles                              | ✅ 8 rows                                           |
| JOIN region_scores + profiles (Leaderboard) | ✅ (FK added — was missing)                         |
| JOIN daily_region_winners (Map)             | ✅                                                  |
| Realtime channel (region_scores)            | ✅ (wired in Leaderboard + MapHome)                 |

**Two integration bugs fixed during this audit:**

1. `current_region_leaders` RPC existed in `functions.sql` but was never applied to the local Supabase instance → applied via `docker exec`.
2. `profiles!inner` join in Leaderboard was failing — no FK between `region_scores` and `profiles` → added `region_scores_profile_fkey` and `daily_region_winners_profile_fkey` to DB, `schema.sql`, and migration file.

**For cloud Supabase deployment:** re-run `supabase/schema.sql` + `supabase/functions.sql` via SQL editor, or run `supabase db push` if linked.

---

## Must-Do Before First Real Device Run

### 1. Mapbox token (blocking — app won't show map without it)

- Go to https://account.mapbox.com
- Create a **public token** (default scopes) → paste into `.env` as `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN`
- Also paste into `app.json → extra.mapboxPublicToken`
- Create a **secret token** with `DOWNLOADS:READ` scope → paste into `.env` as `MAPBOX_DOWNLOADS_TOKEN` (needed for EAS native build)

### 2. EAS dev build (blocking — new native deps require recompile)

The following packages added in this session have native code that requires a new dev client build:

- `react-native-reanimated` v4
- `react-native-svg`
- `react-native-view-shot`
- `expo-font`
- `expo-sharing`

```bash
eas build --profile development --platform android
# wait ~15 min, download APK, install on phone
npx expo start --dev-client
```

Metro hot-reload won't pick up native deps — a full rebuild is required.

### 3. Custom Mapbox parchment style (high impact — currently using outdoors-v12 fallback)

- Open Mapbox Studio → duplicate "Outdoors" style
- Recolor: land = `#E8E0D0`, water = `#A8D8EA`, roads = `#C8BEA8` (thin), hide POI icons, use low-contrast brown labels
- Publish → copy the style URL (`mapbox://styles/youruser/yourstyleid`)
- Paste into `app.json → extra.mapboxParchmentStyleUrl`
- App reads this at runtime in MapHome and Run screens

---

## Should-Do (Quality / Completeness)

### 4. Unit tests (vitest) ✅

All three test files written and passing (9 tests):

- `tests/unit/distance.test.ts` — haversine, pathDistanceMeters
- `tests/unit/colors.test.ts` — determinism, valid hex output
- `tests/unit/geo.test.ts` — bbox, pointInPolygon, randomWalk
- `tests/integration/process-run.sql.test.ts` — PostGIS integration (runs in CI with real DB)
- `vitest.config.ts` added

### 5. GitHub Actions CI ✅

`.github/workflows/ci.yml` — runs typecheck, lint, format:check, unit tests, integration tests against PostGIS Docker service.

### 6. ESLint config ✅

`eslint.config.mjs` — typescript-eslint + react-hooks plugin + no-unused-vars.

### 7. Leaderboard `any` cast ✅

`screens/Leaderboard.tsx` — `r: any` replaced with typed `RawRow` interface (cast through `unknown` since Supabase client without generated types infers the join shape differently than PostgREST actually returns).

---

## Nice-to-Have (Polish / Post-MVP)

### 8. On-map PlayerToken overlays

Deferred from M3. Would show the leading player's token at each region centroid on the MapHome map. Skipped because:

- Requires computing pixel coordinates from lat/lng via `MapView.getPointInView` (async, re-runs on camera move)
- OR using a Mapbox `SymbolLayer` with a dynamically generated colored circle sprite

Recommended approach when ready: `SymbolLayer` with a `FillExtrusionLayer`-style runtime sprite. Don't use absolute-positioned `View` overlays over Mapbox — they don't track camera movement.

### 9. Supabase generated types

```bash
npx supabase gen types typescript --local > lib/database.types.ts
```

Eliminates `any` casts in Leaderboard, Profile, MapHome data fetches.

### 10. pg_cron fallback for cloud Supabase

`pg_cron` is not available on all Supabase plans. If not available:

- Create `supabase/functions/snapshot-winners/index.ts` (Deno Edge Function — already exists in repo)
- Schedule it daily via [cron-job.org](https://cron-job.org) or Supabase's built-in Edge Function cron
- OR call `snapshot_daily_winners(current_date - 1)` manually before demo

### 11. iOS background location two-step prompt ✅

`lib/location.ts → ensurePermissions()` — now checks `getBackgroundPermissionsAsync()` before re-prompting (short-circuits if already granted), and explicitly requests foreground before background on every call so iOS shows the correct upgrade flow.

### 12. Crash-recovery on app cold-start

`lib/location.ts` saves the active-run marker to AsyncStorage. On cold-start, `Run.tsx` calls `recoverActiveRun()` and resumes the timer. However, the map polyline is lost (buffer is read but the live hook starts fresh). Consider saving the point buffer too and rehydrating `useLiveRun` state on recovery.

### 13. Doctor script — `--skip-mapbox` flag ✅

`scripts/doctor.ts` — `--skip-mapbox` flag downgrades Mapbox token checks from FAIL to WARN, so CI (which has no Mapbox tokens) can pass. Doctor exits 0 with a warning note.

### 14. Share card — snapshot fallback ✅

`screens/RunSummary.tsx` — when `snapshotManager.takeSnap` fails (no token, no network), the map container now shows the animated SVG route on a parchment background instead of a spinning ActivityIndicator. Route animation triggers regardless of snapshot success via `.finally()`.

### 15. Region-entered toast bounding-box pre-filter ✅

`screens/Run.tsx` — each region row now stores a pre-computed `bb` (from `bbox()` at load time). On every GPS point, a cheap min/max check skips the ray-cast for regions whose bounding box doesn't contain the point. Scales to 100+ regions with negligible overhead.

---

## Done (reference)

| Item                                                                                                                                               | Status |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Expo dev-build + EAS config                                                                                                                        | ✅     |
| Supabase schema (6 tables + RLS + trigger)                                                                                                         | ✅     |
| PostGIS functions (process_run, snapshot_daily_winners, current_region_leaders, regions_as_geojson)                                                | ✅     |
| pg_cron schedule                                                                                                                                   | ✅     |
| BG GPS (TaskManager + foreground service notification)                                                                                             | ✅     |
| Anti-cheat filters (accuracy ≤ 50m, speed ≤ 20 km/h)                                                                                               | ✅     |
| AsyncStorage crash buffer                                                                                                                          | ✅     |
| Run upload (chunked 500/insert + process_run RPC)                                                                                                  | ✅     |
| OSM region fetch + load scripts                                                                                                                    | ✅     |
| Seed script (80 runs, 8 users, snapshot)                                                                                                           | ✅     |
| Doctor script                                                                                                                                      | ✅     |
| lib/geo.ts (pointInPolygon, bbox, randomWalk)                                                                                                      | ✅     |
| lib/ui theme system (tokens, typography, ThemeProvider)                                                                                            | ✅     |
| 10 UI primitives (Surface, PlayerToken, CoinRow, ChallengeCard, CountdownBadge, BebasNumber, ScoreboardRow, PrimaryButton, SecondaryButton, Toast) | ✅     |
| Fonts: Bebas Neue + Inter                                                                                                                          | ✅     |
| MapHome — parchment theme, Today/Yesterday toggle, ChallengeCard popup                                                                             | ✅     |
| Run — parchment HUD, per-user polyline color, region-entered toast                                                                                 | ✅     |
| RunSummary — Mapbox snapshot, animated SVG route draw, count-up, coin pop-in, share card                                                           | ✅     |
| Leaderboard — ScoreboardRow, CountdownBadge, realtime flash                                                                                        | ✅     |
| Profile — parchment chrome, Bebas stats                                                                                                            | ✅     |
| SignIn — parchment background, Bebas wordmark                                                                                                      | ✅     |
| TypeScript clean (0 errors)                                                                                                                        | ✅     |
| FK region_scores → profiles (Leaderboard join)                                                                                                     | ✅     |
| FK daily_region_winners → profiles                                                                                                                 | ✅     |
| current_region_leaders RPC deployed to local DB                                                                                                    | ✅     |
