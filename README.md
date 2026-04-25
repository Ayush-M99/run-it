# Run-It

Territory-based running game. You run in real life → your distance inside each neighborhood polygon converts to points → at midnight the top scorer "wins" the region for that day. Built as a 5–10 day MVP to demo GPS tracking, real geospatial logic in PostGIS, realtime leaderboards, and a Mapbox-styled map UI.

**Stack:** Expo dev-build · React Native · Supabase (Postgres + PostGIS + pg_cron + Realtime) · Mapbox · expo-location (background) · TypeScript end-to-end.

## Architecture

```
   ┌────────────────────────────────┐         ┌─────────────────────────────────────┐
   │  Expo dev-build (phone)        │         │  Supabase                           │
   │                                │         │                                     │
   │  ── lib ─────────────          │         │  Postgres + PostGIS:                │
   │  supabase.ts (client)          │         │   profiles, regions(geom Polygon),  │
   │  auth.tsx (provider)           │         │   runs, run_points(geom Point),     │
   │  location.ts (TaskManager BG)  │         │   region_scores, daily_…_winners    │
   │  runs.ts (upload + rpc)        │         │                                     │
   │  distance.ts (haversine UI)    │  https  │  RPC functions:                     │
   │  colors.ts (uid → HSL)         │ ───────►│   regions_as_geojson()              │
   │                                │         │   process_run(uuid)  ← line clip    │
   │  ── screens ────────           │         │   snapshot_daily_winners(date)      │
   │  SignIn  MapHome  Run          │         │                                     │
   │  Leaderboard  Profile          │         │  Realtime channel:                  │
   │                                │ ◄─────  │   region_scores changes → UI        │
   │  AsyncStorage:                 │  ws     │                                     │
   │   bg-buffer (crash safety)     │         │  pg_cron @ 00:05:                   │
   │   active-run                   │         │   snapshot_daily_winners()          │
   └────────────────────────────────┘         └─────────────────────────────────────┘
```

### Data flow — one run end-to-end

1. Tap **Start** → `expo-location.startLocationUpdatesAsync` registers the BG task.
2. Each fix is filtered (drop `accuracy > 50 m`, drop instantaneous speed > 20 km/h vs prior point) and appended to the AsyncStorage buffer; the UI polls the buffer every 1 s and redraws the polyline.
3. Tap **Stop** → bulk-insert one `runs` row + N `run_points` rows (chunked, 500/insert) → `supabase.rpc('process_run', { p_run_id })`.
4. `process_run` builds a `LINESTRING` from `run_points`, intersects against every region (`ST_Intersection`), measures each piece in meters (`ST_Length(geography)`), upserts `region_scores` for `current_date`.
5. Leaderboard screen subscribes to realtime changes on `region_scores` filtered by region+today.
6. Daily at 00:05 UTC, `pg_cron` runs `snapshot_daily_winners(current_date - 1)` which writes the top scorer per region into `daily_region_winners`.
7. The Map home screen colors each region by yesterday's winner (HSL hashed from their uuid) and outlines regions you won in gold.

### Anti-cheat
Two filters, applied client-side before a point ever enters the buffer: accuracy gate (≤ 50 m) and instantaneous speed gate (≤ 20 km/h vs the prior accepted point). Anything beyond this is out of scope for the MVP.

---

## Files

```
.
├── App.tsx                          nav + auth gate + Mapbox token bootstrap
├── app.json                         Expo plugins, BG-location permissions
├── eas.json                         dev / preview / prod build profiles
├── .env.example                     copy → .env, fill in values
├── lib/
│   ├── supabase.ts                  client init (RN AsyncStorage persistence)
│   ├── auth.tsx                     AuthProvider + useAuth()
│   ├── location.ts                  BG TaskManager + filters + AsyncStorage buffer
│   ├── runs.ts                      uploadRun() — insert + chunked points + rpc
│   ├── distance.ts                  haversine (UI live distance only)
│   └── colors.ts                    stable per-user HSL/hex
├── screens/
│   ├── SignIn.tsx                   email/password
│   ├── MapHome.tsx                  Mapbox map, regions colored by yesterday's winner
│   ├── Run.tsx                      Start/Stop, live polyline + distance + timer
│   ├── Leaderboard.tsx              today's top 20 in a region, realtime
│   └── Profile.tsx                  totals + sign-out
├── supabase/
│   ├── schema.sql                   tables, indexes, RLS, signup trigger, insert_region helper
│   ├── functions.sql                regions_as_geojson, process_run, snapshot_daily_winners
│   └── cron.sql                     pg_cron schedule + one-time backfill
└── scripts/
    ├── fetch_regions.ts             OSM Overpass → data/regions.geojson
    ├── load_regions.ts              GeoJSON → regions table (service role)
    └── seed_fake_users.ts           8 fake users + 30 synthetic runs
```

---

## Setup (one-time, before any `expo start`)

### 1. External accounts

**Mapbox** — https://account.mapbox.com (free)
- Create a **public token** (default scopes) → goes into `.env` as `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN` and into `app.json` → `extra.mapboxPublicToken`.
- Create a **secret token** with the `DOWNLOADS:READ` scope → register as an EAS secret (used at native build time, never in the JS bundle):
  ```bash
  eas secret:create --scope project --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN --value sk.eyJ...
  ```

**Supabase** — https://supabase.com (free)
1. Create a project. Settings → API:
   - `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
   - `anon` public key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server scripts only — DO NOT ship in the app)
2. Database → Extensions → enable **postgis** and **pg_cron**.
3. SQL Editor → paste, in this order:
   1. [supabase/schema.sql](supabase/schema.sql)
   2. [supabase/functions.sql](supabase/functions.sql)
   3. [supabase/cron.sql](supabase/cron.sql)

If pg_cron isn't on your plan, skip `cron.sql` and run `select snapshot_daily_winners(current_date - 1);` manually each day, or wrap it in a Supabase Edge Function on a daily cron.

**EAS** (Expo build service)
```bash
npm i -g eas-cli
eas login        # sign up at expo.dev if needed
eas init         # links the project
```

### 2. Configure local env
```bash
cp .env.example .env
# edit .env and paste Supabase URL + anon + service_role + Mapbox tokens
```
Also paste the same Supabase URL + anon key + Mapbox public token into `app.json` → `extra` (so they're available at runtime via `Constants.expoConfig.extra`).

### 3. Seed your city's regions
```bash
npx tsx scripts/fetch_regions.ts "Bengaluru"      # or your city / district
npx tsx scripts/load_regions.ts                   # loads data/regions.geojson into Supabase
```

### 4. Seed fake demo users (so leaderboards aren't empty)
```bash
npx tsx scripts/seed_fake_users.ts
```

### 5. Build the dev client and install on a phone
```bash
eas build --profile development --platform android
# wait ~15 min queue + ~10 min build, download APK, install on phone
npx expo start --dev-client
# scan the QR with the dev-build app
```

iOS works too — same `--platform ios` — but Android is the simpler permission story for demo purposes.

---

## Verification

1. Open the app → sign up → drop into the Map tab → see real neighborhood polygons drawn.
2. Switch to the Run tab → grant **Always** location → tap **Start** → walk a short loop → tap **Stop**.
3. The "Run saved" alert shows your distance. Switch to Map → tap the region you ran in → see your row at the top of today's leaderboard.
4. Re-run the seed script (or run with a second account) → leaderboard reranks live via realtime.
5. Run `select * from daily_region_winners order by date desc limit 5;` in Supabase → see the snapshot rows.

---

## Known sharp edges

- **iOS background `Always` permission** requires a two-step prompt (`WhenInUse` first, then re-prompt). The app currently asks once; if iOS denies, demo on Android.
- **Overpass `name=` matching** is exact. If your city has no admin-level-8/9/10 boundaries with that exact name, edit the query in `scripts/fetch_regions.ts` (try `name:en`, or a parent area).
- **`pg_cron` is not on every Supabase plan**. Fallback: invoke `snapshot_daily_winners` from a Supabase Edge Function scheduled with cron-job.org, or just call the function manually before recording demo videos.
- **Random-walk seed runs** can occasionally produce paths that hug a polygon edge tightly; if `process_run` returns 0 distance for a region, re-roll.
