# Exam Scheduler

A constraint-satisfaction (CSP) exam timetable generator. Add your courses, rooms and exam
periods, press **Generate Schedule**, and the solver assigns every exam a date, a time and a
room without clashes — then tries to make the result comfortable for students.

No build step, no dependencies, no server. Open `index.html` in a browser.

```
git clone <this repo>
cd ExamScheduler
start index.html          # Windows  (macOS: open index.html)
```

Click **Load sample data** in the top bar to try it immediately with 10 courses, 6 rooms,
15 exam sessions and 140 students who each sit 4 papers.

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
index.html          markup and page structure
css/style.css       styling
js/store.js         data model (courses, rooms, slots, timetable, complaints),
                    localStorage persistence and time helpers
js/scheduler.js     the CSP engine: domains, constraints, search, cost, conflict detection
js/demo.js          sample dataset
js/app.js           UI wiring: tabs, forms, tables, timetable, conflicts,
                    complaints, import/export
test/run.js         headless test harness (Node, no dependencies)
```

## Tests

```
node test/run.js
```

30 checks covering: the hard constraints hold on the sample dataset; each conflict type is
detected on a hand-broken timetable; the complaint lifecycle (submit, validate, respond,
change status, delete, and loading data saved before complaints existed); impossible courses
are explained rather than dropped; a fully saturated instance (8 exams into exactly 8
openings) still solves; and an over-subscribed instance reports the overflow instead of
forcing a clash.
