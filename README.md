# Exam Scheduler

A constraint-satisfaction (CSP) exam timetable generator. Add your courses, rooms and exam
periods, press **Generate Schedule**, and the solver assigns every exam a date, a time and a
room without clashes — then tries to make the result comfortable for students.

It comes in two versions with the same features and the same scheduling engine:

| | Where it lives | How to run it |
|---|---|---|
| **Mobile app** (Expo / React Native) | [`mobile/`](mobile/) | `cd mobile && npm install && npx expo start`, then scan the QR code with Expo Go |
| **Web app** (no build step, no dependencies) | repo root | open `index.html` in a browser |

Click **Load sample data** to try either one immediately with 10 courses, 6 rooms,
15 exam sessions and 140 students who each sit 4 papers.

## Running the mobile app on your phone

```
cd mobile
npm install
npx expo start
```

Install **Expo Go** from the Play Store / App Store, then scan the QR code that appears in the
terminal. The phone and the computer must be on the same Wi-Fi; if your network blocks that
(many campus networks isolate clients from each other), run `npx expo start --tunnel` instead.

> **On Windows PowerShell**, `npm` and `npx` may fail with *"npm.ps1 cannot be loaded because
> running scripts is disabled on this system"*. That is PowerShell's execution policy blocking
> the `.ps1` launcher. Use the batch launcher instead — `npm.cmd install`, `npx.cmd expo start`
> — or allow local scripts once with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Built on **Expo SDK 54** / React Native 0.81 / React 19.1, to match the version of Expo Go
installed on the phone. Expo Go only supports one SDK at a time, so the project and the app
have to agree — if you upgrade Expo Go later, run `npx expo install --fix` after bumping the
`expo` version in `mobile/package.json`.

Data is stored on the phone with `AsyncStorage`.

## Running the web app

```
start index.html          # Windows  (macOS: open index.html)
```

---

## Features

### 1. Add courses / exams
Course code, course name, exam duration and either a headcount or the actual list of
registered student IDs. Listing IDs is what lets the app tell that two courses share students
and must not clash.

### 2. Manage rooms
Room name/number, capacity, building or location, and an available/unavailable flag. Blocked
rooms are excluded from the search but still flagged if something is manually assigned to them.

### 3. Manage time slots
Exam date, start time, end time, and an available/unavailable flag. **Bulk create** generates
the same daily sessions across a date range and can skip weekends.

### 4. Generate the timetable automatically
One click runs the CSP solver, which gives each exam a date, a time and a room.

### 5. Conflict prevention and detection
The solver never produces these, and the **Conflicts** tab re-checks the timetable after any
manual change:

| Checked | Severity |
|---|---|
| A student sitting two exams at the same time | error |
| A room used by two exams at overlapping times | error |
| More students than the room seats | error |
| An exam placed outside the available periods (blocked slot/room) | error |
| A slot shorter than the exam duration | error |
| A student sitting exams back-to-back | warning |
| A student sitting two exams on the same day | warning |
| A course that has not been scheduled | warning |

### 6. Student complaints
A **Complaints** tab where students can raise problems the solver cannot know about.

- **Find my exams** — a student types their ID and gets their personal timetable, with their
  own clashes and back-to-back sittings flagged automatically.
- **Send a complaint** — student ID, name, the exam it concerns, a category (exam clash, exams
  too close together, room problem, date/time problem, exam missing, wrong registration,
  special needs, other) and the details.
- **Complaints received** — the exams office side: filter by New / Reviewing / Resolved, write
  a response, change status, reopen or delete, and export the lot to CSV. The tab badge counts
  complaints that are still open.

### 7. Optimisation
Beyond staying legal, the solver minimises a cost function covering:

- spreading exams evenly across the available days
- avoiding back-to-back exams for the same student (configurable gap)
- avoiding two exams in one day for the same student
- using rooms that fit — fewer wasted seats

Each weight is adjustable under **Optimisation settings** on the Timetable tab.

### Also included
- Timetable in list view or grouped by day
- Reassign any exam's slot or room by hand; conflicts re-check instantly and clashing rows
  turn red
- Statistics: exams scheduled, hard conflicts, days used, back-to-back sittings, room
  utilisation, search nodes explored, solve time
- Export CSV, print, export/import the whole dataset as JSON
- Everything persists in browser `localStorage`

---

## How the CSP works

| CSP concept | Here |
|---|---|
| **Variables** | each exam that needs scheduling |
| **Domain** | every `(time slot, room)` pair that exam could legally take |
| **Constraints** | the five hard rules in the table above |
| **Objective** | the weighted soft-constraint cost |

The search in [`js/scheduler.js`](js/scheduler.js) is:

1. **Domain construction** — pairs that already break room capacity, slot length or
   availability are removed up front. An exam left with an empty domain is reported as
   impossible, with the reason, instead of being silently dropped.
2. **Backtracking search** with:
   - **MRV** (minimum remaining values) — always branch on the exam with the fewest legal
     options left, breaking ties on the largest class, which is hardest to place later.
   - **Forward checking** — after each placement, if any other exam has zero options left,
     back out immediately.
   - **Least-cost value ordering** — try the option that hurts the soft goals least first.
   - A node budget so the browser never hangs; the best partial assignment is kept.
3. **Greedy fill** — anything the search could not place is fitted wherever it still legally
   can, or reported with a reason.
4. **Local-search polish** — each exam is tentatively moved to every other legal
   `(slot, room)`; moves that lower the total cost are kept, repeated until no improvement.

---

## Project layout

```
Web app (repo root)
  index.html          markup and page structure
  css/style.css       styling
  js/store.js         data model (courses, rooms, slots, timetable, complaints),
                      localStorage persistence and time helpers
  js/scheduler.js     the CSP engine: domains, constraints, search, cost, conflict detection
  js/demo.js          sample dataset
  js/app.js           UI wiring: tabs, forms, tables, timetable, conflicts,
                      complaints, import/export
  test/run.js         headless test harness (Node, no dependencies)

Mobile app (mobile/)
  App.js                    shell: hydration, tab bar, data menu
  src/engine/model.js       shared helpers and record factories
  src/engine/scheduler.js   the same CSP engine, as an ES module
  src/engine/store.js       state container, AsyncStorage persistence
  src/engine/demo.js        sample dataset
  src/theme.js              design tokens matching the web palette
  src/ui.js                 shared components (Select and prompt are modals —
                            React Native has no <select> or window.prompt)
  src/format.js             date/time formatting and input validation
  src/screens/*.js          one screen per tab
  test/run.mjs              headless test harness (Node)
```

The two versions share one algorithm: `mobile/src/engine/scheduler.js` is
`js/scheduler.js` with the IIFE wrapper swapped for ES module imports. Everything between
those lines — domain construction, backtracking, cost function, conflict detection — is
character-for-character identical.

## Tests

```
node test/run.js          # web version   — 30 checks
cd mobile && npm test     # mobile engine — 24 checks
```

Covering: the hard constraints hold on the sample dataset; each conflict type is
detected on a hand-broken timetable; the complaint lifecycle (submit, validate, respond,
change status, delete, and loading data saved before complaints existed); impossible courses
are explained rather than dropped; a fully saturated instance (8 exams into exactly 8
openings) still solves; and an over-subscribed instance reports the overflow instead of
forcing a clash.
