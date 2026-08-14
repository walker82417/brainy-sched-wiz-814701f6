# Responsive layout, day-reset fix, monthly heatmap, smoother motion

Four things, in order of importance.

## 1. Make the board responsive

Today the whole dashboard is one fixed 1500px canvas that gets shrunk with a CSS
transform to fit the screen. That works on a big desktop and turns unreadable on
laptops, tablets and phones.

Change to a real responsive layout:

- **Desktop (>=1280px)** — keep the current 3-column look. Scaling stays, but
  capped so it never shrinks below a readable size.
- **Laptop (1024–1279px)** — drop scaling, let the grid reflow: timetable full
  width, bottom cards in 2 columns.
- **Tablet (768–1023px)** — single scaled column: exam strip becomes a
  horizontal scroller, timetable keeps its columns, cards stack.
- **Phone (<768px)** — no transform at all, natural vertical scroll. The
  timetable turns into stacked task cards (time + subject + timer + actions)
  instead of a wide table. Timer popup and Sunday planner become full-width
  sheets that fit a phone screen.

"No scroll on one page" stays true only on desktop; below that the page scrolls
normally, which is the only way it can stay readable.

## 2. Fix the evening reset (tasks flipping back to pending)

Confirmed problems in the current code that can wipe a day:

- The live listener treats "document not found" as "brand new day" and
  immediately re-writes a **fresh, empty** session set over the day. Firestore
  fires that state from its local cache too (offline blip, reconnect, sleep/wake),
  so a connection hiccup in the evening can blank the day and every finished task
  reappears as pending.
- The day key is built from **local** date, but the streak and heatmap keys are
  built from `toISOString()` which is **UTC**. In India that is a 5.5-hour skew,
  so the two never agree about which day it is.
- The listener subscribes once with the user id only, so the app never follows a
  real date change while it stays open.

Fix:

- Only initialise a day document when the snapshot is genuinely from the server
  and truly missing; ignore cache-only "missing" events.
- Never overwrite existing sessions/completions — merge, and keep any locally
  completed session that the incoming snapshot doesn't know about.
- One single local-date helper used everywhere (day key, streak, heatmap,
  analytics), so UTC drift can't shift a day.
- Watch for a real date change (and re-point the listener) instead of assuming
  the page loaded today.
- Before shipping, reproduce it: simulate a cache-miss snapshot and a clock past
  22:25 and confirm completed rows stay completed.

## 3. Monthly heatmap with month-over-month comparison

Replace the rolling 84-day grid with a **calendar-month view**:

- A month grid (weekday columns, real dates) for the selected month, with
  arrows to step back/forward through months.
- Beside it, a comparison panel for that month vs the previous month:
  sessions completed, hours studied, active days, best day, current/longest
  streak — each with an up/down delta versus last month.
- A compact spark row of the last 6 months so trend is visible at a glance.

All of it reads from data already stored (`heatmapLog` + `completedLog`), so no
backend change is needed.

## 4. Loading and start-up animation polish

- Loader: replace the fixed 5-second wait with a progress that tracks actual
  data readiness, then exits with a smooth handoff (no hard cut) — minimum ~1.8s,
  maximum ~5s so it never blocks you when data is fast.
- Smooth out the loader's ticker/bar easing and add a soft page-in for the
  dashboard behind it.
- Entrance animations become GPU-friendly (transform/opacity only) and staggered
  per section so the board assembles instead of popping.
- Motion respects `prefers-reduced-motion` throughout.

## Technical notes

- `src/routes/index.tsx`: snapshot-init guard using `snap.metadata.fromCache`
  and `hasPendingWrites`; single `localDateKey()` helper replacing all
  `toISOString().slice(0,10)` uses; date-rollover effect re-creating the daily
  doc ref; new monthly heatmap + comparison memos derived from `heatmapLog` and
  `completedLog`.
- `src/styles.css`: breakpoint layers for the `.tt-app` scale wrapper, grid
  reflow rules, mobile card variant of the timetable rows, full-width sheet
  variants of the modals, new heatmap/comparison styles.
- `src/components/StudyLoader.tsx`: readiness-driven progress + exit fade.
