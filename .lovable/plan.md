# Sunday Custom Study Day

Sundays get their own timetable that you build yourself each Sunday: pick the subjects, how long each one runs, and when each one starts. Every other day stays exactly as it is today.

## How it works

1. On a Sunday, when the dashboard opens, a "Plan your Sunday" popup appears (glass-style, matching the extension/start popups).
2. In the popup you add entries one by one:
   - Subject (pick from your existing subjects — Electrical Theory, Numericals, PYQs, Aptitude, Reasoning, GS, English, Revision — or type a custom one)
   - Start time (free choice, e.g. 7:30 AM)
   - Duration in minutes
   - Add as many entries as you want; each can be edited or removed before saving.
3. Save builds Sunday's timetable rows from those entries, sorted by start time. Overlaps are flagged with a warning before saving.
4. The dashboard then behaves normally for the rest of the day: start/pause/complete timers, extension trades, checklist auto-check on completion, ring progress, heatmap and analytics all read from these Sunday rows.
5. The plan is saved for that specific Sunday date, so a refresh or re-login reloads it instead of asking again. A "Re-plan Sunday" button in the header lets you reopen the popup and change it.
6. If you dismiss the popup without planning, Sunday shows an empty study day with a "Plan your Sunday" prompt in place of the table body; fixed life rows (wake up, meals, sleep) are not auto-added — you plan the whole day.

## Technical notes

- Add a `dayPlan` concept in `src/routes/index.tsx`: `ROWS` becomes the default source, and an `activeRows` memo returns either `ROWS` (Mon–Sat) or the Sunday plan rows when a saved plan exists for `todayKey()`.
- Sunday rows are generated in the same `Row` shape (`id`, `time`, `startMin`, `dur`, `act`, `focus`, `cat`, `icon`) with ids allocated from a high base (e.g. 100+) so they never collide with weekday ids; `cat` is inferred from the chosen subject so mission badges (GATE/ESE vs SSC) keep working.
- Replace every direct `ROWS` reference used for rendering, session init, focus counts, analytics, extension trade lists and the timer modal with `activeRows`; keep `ROWS` only as the weekday default and as the subject picker source.
- Persist the plan alongside existing daily state: `sundayPlan` on the Firestore `daily/{date}` doc plus the same localStorage mirror used by the rest of the day state, so nothing changes about the sync flow.
- New popup component styled with the existing `.tt-glass*` classes and `ttPopIn` animation; no layout/grid changes elsewhere, so the single-page no-scroll fit is untouched.
- Session records are initialised from `activeRows` so the timer, ring and checklist keys line up with the planned Sunday rows.
