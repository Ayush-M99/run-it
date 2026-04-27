# Run-It MVP — Territory-Based Running Game

## Context

Solo developer building a resume-grade MVP in 5–10 days. The app gamifies real-world running: a city is divided into polygon regions, GPS distance covered inside a region converts to points, daily leaderboards crown one winner per region. Goal is **end-to-end working demo**, not production scale. Optimize for speed, clarity, and a strong "system design + geospatial + mobile" interview narrative.

**Confirmed decisions (from clarifying Q&A):**

| Decision      | Choice                                | Rationale                                                                                                                     |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GPS mode      | **Background tracking required**      | Real running with screen-off. Costs ~1 day (EAS dev build), but it's the honest experience and the strongest interview story. |
| Backend       | **Supabase (Postgres + PostGIS)**     | Server-side point-in-polygon and line-clipping in SQL. Real geospatial story for interviews.                                  |
| Region source | **Real OSM neighborhood polygons**    | Authentic data via Overpass API. ~1–2 hrs prep.                                                                               |
| Auth          | **Email + password**                  | Native Supabase Auth, zero extra config.                                                                                      |
| Map lib       | **`@rnmapbox/maps`**                  | Custom styling looks better in demo video. Requires free Mapbox token + Expo config plugin.                                   |
| Ownership     | **Daily winner + persistent history** | `daily_region_winners` table; map shows yesterday's winner. Enables stats screens.                                            |
| Demo data     | **Seed script with 5–10 fake users**  | Leaderboards look populated in the demo video.                                                                                |
| Demo city     | **`{{CITY}}` — fill in day 1**        | Pick your home city or default to Lower Manhattan if you want a recognizable stand-in.                                        |

---

## Refined MVP Definition

A React Native (Expo dev-build) mobile app where an authenticated user starts a run, the app records GPS in the background, computes the path's total distance and the distance traversed inside each predefined neighborhood polygon, awards points (1 point per 10 m), and updates that region's daily leaderboard. The home screen shows a Mapbox map of the city colored by yesterday's winning user per region. At local midnight a scheduled job snapshots that day's winners into history.

**Out of scope (don't build, don't even prototype):** smartwatch sync, complex anti-cheat, multiplayer battles, notifications, social features, payments, web app.

---

## System Design

### High-level architecture

```
[Expo dev-build app]                         [Supabase]
  - expo-location (BG TaskManager)            - auth (email/password)
  - @rnmapbox/maps                            - postgres + postgis
  - AsyncStorage (crash buffer)               - rpc: process_run(run_id)
  - @turf/* (client distance only)            - realtime channels (leaderboards)
         │                                    - pg_cron (daily winner snapshot)
         │  https + supabase-js                       │
         └──────────────────────────────────────────► │
                                              regions │ runs │ run_points │
                                              region_scores │ daily_region_winners │ profiles
```

### Data flow — one run end-to-end

1. User taps **Start Run** → `expo-location.startLocationUpdatesAsync` registers a background task.
2. Each location callback: filter (accuracy ≤ 50 m, speed ≤ 20 km/h, time delta ≥ 1 s); append to in-memory buffer + mirror to AsyncStorage (crash safety).
3. UI subscribes to the same buffer and renders the live polyline on the map.
4. User taps **Stop Run** → app `INSERT`s one row into `runs` + bulk `INSERT` into `run_points`, then calls RPC `process_run(run_id)`.
5. `process_run` (Postgres function) builds a `LINESTRING` from the points, uses `ST_Intersection` against each region polygon, sums per-region length, converts to points, upserts `region_scores` for `date = today`.
6. Leaderboard screen subscribes via Supabase realtime to `region_scores` filtered by `region_id` + today.
7. At local midnight a `pg_cron` job inserts the top user per region into `daily_region_winners`.
8. Map home screen reads `daily_region_winners` for `date = yesterday` and colors each polygon by winner.

### Data model (final, minimal)

```sql
-- Built-in: auth.users (Supabase)

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);

create table regions (
  id serial primary key,
  name text not null,
  geom geometry(Polygon, 4326) not null
);
create index regions_geom_idx on regions using gist (geom);

create table runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_m numeric not null,
  processed_at timestamptz
);

create table run_points (
  run_id uuid references runs on delete cascade,
  ts timestamptz not null,
  geom geometry(Point, 4326) not null,
  primary key (run_id, ts)
);

create table region_scores (
  region_id int references regions,
  user_id uuid references auth.users,
  date date not null,
  distance_m numeric not null default 0,
  points int not null default 0,
  primary key (region_id, user_id, date)
);
create index region_scores_lookup on region_scores (region_id, date, points desc);

create table daily_region_winners (
  region_id int references regions,
  date date not null,
  user_id uuid references auth.users,
  points int not null,
  primary key (region_id, date)
);
```

RLS: `regions` public read; `runs` / `run_points` insert+select only for `auth.uid() = user_id`; `region_scores` / `daily_region_winners` / `profiles` public read, service-role write.

### Key components (React Native side)

| Module                | Purpose                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `lib/supabase.ts`     | Single client init                                                                          |
| `lib/location.ts`     | Background TaskManager registration + buffer + filters                                      |
| `lib/distance.ts`     | Haversine helpers (used only for live UI distance; canonical distance computed server-side) |
| `screens/MapHome`     | Mapbox map, regions colored by yesterday's winner                                           |
| `screens/Run`         | Start/Stop, live distance + duration, live polyline                                         |
| `screens/Leaderboard` | Tap a region → see today's top users (realtime)                                             |
| `screens/Profile`     | Total runs, total distance, regions you've ever won                                         |

---

## Execution Plan (8 days + 2 buffer)

> Each day must end with the listed deliverable demo-able. If a day slips, **cut polish** before cutting features 1–6.

### Day 1 — Foundations & "hello map"

- `npx create-expo-app run-it --template`; `eas init`; configure EAS dev build profile.
- Create Supabase project; save URL + anon key to `.env`.
- Create Mapbox account; install `@rnmapbox/maps`; add Expo config plugin with token.
- Build first dev-build (`eas build --profile development --platform android`); install on physical phone.
- Verify Mapbox map renders centered on `{{CITY}}`.
- **Deliverable:** App runs on phone, shows Mapbox map of your city.

### Day 2 — Region data prep

- Pick `{{CITY}}` (or a district if huge). Use Overpass API (`overpass-turbo.eu`) with a query like:
  ```
  [out:json][timeout:25];
  area["name"="{{CITY}}"]->.a;
  relation["boundary"="administrative"]["admin_level"~"^(8|9|10)$"](area.a);
  out geom;
  ```
- Export GeoJSON; clean to ~10–25 polygons (too many = noisy demo).
- Write a one-shot Node script that loads each Feature into the `regions` table via `ST_GeomFromGeoJSON`.
- Render regions as Mapbox `FillLayer` on the home screen.
- **Deliverable:** Map shows real city neighborhoods as translucent polygons.

### Day 3 — Auth + foreground GPS + run UI

- Supabase email/password auth (sign up, sign in, sign out, profile-row trigger on signup).
- `expo-location` foreground tracking working; live polyline on the Run screen.
- Start/Stop buttons; basic timer + live distance (Haversine on client, just for UI).
- **Deliverable:** You can sign in, tap start, walk around, see your blue path drawn live.

### Day 4 — Background tracking + persistence

- Register `TaskManager` background location task; `Location.startLocationUpdatesAsync` with `foregroundService` notification on Android, `Always` permission flow on iOS.
- AsyncStorage buffer flushes on every batch so a crash doesn't lose a run.
- On Stop: bulk insert into `runs` + `run_points` (chunk to ≤ 500 rows per insert).
- Anti-cheat filter (drop points with `accuracy > 50` or instantaneous speed > 20 km/h).
- **Deliverable:** Lock the phone, run for 5 min, unlock — full path is recorded and saved.

### Day 5 — Server-side region attribution (the geospatial money shot)

- Write the `process_run(run_uuid uuid)` Postgres function. Core query:
  ```sql
  with line as (
    select st_makeline(geom order by ts) as geom
    from run_points where run_id = run_uuid
  ),
  segments as (
    select r.id as region_id,
           st_length(
             st_intersection(line.geom, r.geom)::geography
           ) as dist_m
    from regions r, line
    where st_intersects(line.geom, r.geom)
  )
  insert into region_scores (region_id, user_id, date, distance_m, points)
  select region_id, $user_id, current_date, dist_m, floor(dist_m / 10)::int
  from segments where dist_m > 0
  on conflict (region_id, user_id, date)
  do update set distance_m = region_scores.distance_m + excluded.distance_m,
                points     = region_scores.points     + excluded.points;
  ```
- App calls `supabase.rpc('process_run', { run_uuid })` after Stop.
- **Deliverable:** After a run that crosses 2 regions, both rows appear in `region_scores` with realistic distances.

### Day 6 — Leaderboards + profile

- Leaderboard screen: tap region on map → bottom sheet with top 10 users today (`region_scores` join `profiles`).
- Wire Supabase Realtime channel on `region_scores` filtered by region+date so the board updates live.
- Profile screen: total distance, total runs, lifetime regions won (count from `daily_region_winners`).
- **Deliverable:** Two test accounts, two runs, leaderboard ranks correctly and updates live.

### Day 7 — Daily winner snapshot + ownership UI

- Try `pg_cron` first: `select cron.schedule('snapshot-winners', '0 0 * * *', $$ ... $$)`. The job inserts top scorer per region for `current_date - 1` into `daily_region_winners`.
- Fallback if pg_cron not enabled on your Supabase plan: a Supabase Edge Function on a daily schedule, or compute "current leader" on-read with a view (acceptable shortcut).
- Map home: color each region by `daily_region_winners` row for yesterday; stable per-user color (hash user_id → HSL).
- "Owned by you" highlight on regions you've won.
- **Deliverable:** Map looks like a territory game — colored patches with owner badges.

### Day 8 — Seed data, polish, demo video, README

- Seed script: 8 fake `auth.users` + profiles + 30 synthetic runs (random LineStrings inside random regions, distributed across the last 7 days). Run `process_run` for each.
- README with: demo GIF, architecture diagram, schema, "what I'd build next" section.
- Record 60–90 sec demo video: sign in → run a short loop → see it appear on leaderboard → see colored map.
- **Deliverable:** Pushable repo + video link ready to drop on resume.

### Days 9–10 — Buffer

Reserved for: iOS background-location permission gotchas, EAS build queue waits, any one feature that slipped. **Do not add scope here.**

---

## Technical Decisions (justified)

- **Expo dev-build (not bare RN, not Expo Go).** Background location needs native config, but bare RN throws away Expo's tooling. Dev-build is the sweet spot.
- **Supabase over Firebase.** PostGIS does the geometry math in one SQL query; the same logic in Firestore needs client-side Turf.js per run, which is slower, drains battery, and tells a weaker interview story.
- **Server-authoritative scoring.** Client only computes UI-distance; canonical distance and per-region attribution run in `process_run`. Prevents trivial cheating via tampered client and is "the right thing" architecturally.
- **`@rnmapbox/maps` over `react-native-maps`.** Pretty styles for video; vector tiles handle hundreds of polygons cheaply. Cost: 30 min extra config on day 1.
- **No realtime location streaming to backend.** Points are batched on Stop. Realtime per-point streaming costs battery, costs DB writes, adds nothing to the demo.
- **Points = `floor(distance_m / 10)`.** Round number, easy to explain, gives a 5 km run = 500 points.
- **Anti-cheat = two filters and done.** Drop bad-accuracy points, drop teleports. Anything more is out of scope per the brief.
- **Skipping** Redux / Zustand / React Query — Supabase client + a few `useState` hooks are enough at this scale. Adding state libraries is overengineering for an 8-day MVP.

---

## Implementation Guidance — the tricky parts

### Background location on Android

- Set `expo-location` plugin in `app.json` with `locationAlwaysAndWhenInUsePermission`, `isAndroidBackgroundLocationEnabled: true`, `isAndroidForegroundServiceEnabled: true`.
- The foreground service notification ("Run-It is tracking your run") is **mandatory** — Android kills tasks without it.

### Background location on iOS

- Info.plist needs `NSLocationAlwaysAndWhenInUseUsageDescription` and the `UIBackgroundModes: location` key (set via Expo plugin).
- iOS will only grant `Always` after the user grants `WhenInUse` first and then re-prompts. Build the permission flow as two steps.

### AsyncStorage crash buffer pattern

```ts
// On every location callback in the BG task:
const buffer = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
buffer.push({ ts, lat, lng, acc, speed });
await AsyncStorage.setItem(KEY, JSON.stringify(buffer));
// On Stop: read buffer, upload, then clear.
// On app cold-start: if KEY exists, prompt "recover unsaved run?".
```

### Anti-cheat filter (apply before saving each point)

```ts
if (loc.coords.accuracy > 50) return; // drop noisy point
const dt = (loc.timestamp - last.timestamp) / 1000;
const d = haversine(last, loc.coords);
if (d / dt > 5.56) return; // 5.56 m/s = 20 km/h
```

### The line-clipping query (day 5)

- Cast to `geography` **only when measuring** (`::geography` inside `ST_Length`). Doing the `ST_Intersection` in geography is slow.
- Verify with one test run that hits 2 regions: the sum of intersected lengths should approximately equal the total Haversine distance.

### Mapbox layer for "owned" regions

- One `FillLayer` with a data-driven style: `fillColor: ['get', 'ownerColor']`. Build the FeatureCollection on the client by joining `regions` with `daily_region_winners` once on screen mount.

### Seed script approach (day 8)

- Generate runs as random walks inside a region's bounding box, then `ST_Intersection` them with the region polygon to keep them realistic.
- Bypass RLS via `service_role` key (server-side only — never ship this key in the app).

---

## Risks & Mitigations

| Risk                                                                      | Likelihood | Mitigation                                                                                           |
| ------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| iOS `Always` permission rejected → no background tracking on iOS          | High       | Build & demo on Android first (easier permissions). iOS becomes "stretch" not blocker.               |
| EAS build queue takes 30+ min, eating dev time                            | Medium     | Trigger builds in background while you work on backend / SQL locally.                                |
| `pg_cron` unavailable on your Supabase plan                               | Medium     | Fallback to a daily Edge Function or compute "today's leader" via a view on read.                    |
| GPS noise indoors makes testing miserable                                 | High       | Test outdoors only. Have a mock-location dev toggle (`expo-location` mocking) for indoor work.       |
| `ST_Intersection` returns MultiLineString and edge cases break length sum | Medium     | Wrap the line operations in `ST_CollectionExtract(..., 2)` and verify with one known route on day 5. |
| Mapbox config plugin breaks Android dev build                             | Low–Medium | Test the empty Mapbox map on day 1, before any other features depend on it.                          |
| Solo dev burnout / scope creep                                            | Constant   | If a day slips, cut Day 7's "owned by you" badge and Day 8's polish — never cut Days 1–6.            |

---

## Verification (how to know it actually works end-to-end)

1. **Auth:** Sign up two accounts on the same dev-build. Both appear in `profiles`.
2. **Region rendering:** Map shows ~10–25 translucent polygons over your city.
3. **Background tracking:** Start a run, lock the phone, walk a 5-minute loop, return — `runs` row exists with `distance_m` matching reality within ±10%.
4. **Region attribution:** A run that crosses 2 regions creates 2 rows in `region_scores` whose summed `distance_m` ≈ `runs.distance_m`.
5. **Leaderboard:** Two accounts, two runs in the same region — the higher-scoring one appears on top, live.
6. **Daily snapshot:** Manually invoke the snapshot function with `current_date` — `daily_region_winners` populates correctly.
7. **Map ownership:** Home screen colors the region you won.
8. **Demo data:** After running the seed script, every region has a populated leaderboard and a colored owner.

---

## Files / paths to create

```
run-it/
├── app.json                          # Expo + plugins (location, mapbox)
├── eas.json                          # dev / preview / prod build profiles
├── .env                              # SUPABASE_URL, ANON_KEY, MAPBOX_TOKEN
├── App.tsx                           # nav + auth gate
├── lib/
│   ├── supabase.ts
│   ├── location.ts                   # TaskManager + filters + buffer
│   └── distance.ts                   # haversine for UI only
├── screens/
│   ├── SignIn.tsx
│   ├── MapHome.tsx
│   ├── Run.tsx
│   ├── Leaderboard.tsx
│   └── Profile.tsx
├── supabase/
│   ├── schema.sql                    # tables + indexes + RLS
│   ├── functions.sql                 # process_run + snapshot
│   ├── cron.sql                      # pg_cron schedule (or edge fn)
│   └── seed/
│       ├── load_regions.ts           # OSM GeoJSON → regions table
│       └── fake_users.ts             # 8 users + 30 synthetic runs
└── README.md                         # demo gif, arch diagram, schema
```
