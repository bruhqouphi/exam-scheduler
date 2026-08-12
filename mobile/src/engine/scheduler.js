/* ------------------------------------------------------------------
 scheduler.js — the CSP engine.

 Variables : each exam (course) that needs scheduling
 Domains   : every (time slot, room) pair the exam could legally take
 Hard constraints
   H1  a room holds at most one exam at a time
   H2  a student never sits two exams at overlapping times
   H3  a room must be big enough for everyone registered
   H4  an exam only lands on an available slot / available room
   H5  the slot must be long enough for the exam
 Soft constraints (optimisation — lower cost is better)
   S1  spread exams across the available days
   S2  avoid back-to-back exams for the same student
   S3  avoid two exams on the same day for the same student
   S4  use rooms that fit well (don't waste seats)

 Search: backtracking + MRV variable ordering + forward checking,
 with least-cost value ordering, followed by a local-search polish.
------------------------------------------------------------------- */

import {
  toMinutes, slotLength, slotsOverlap, slotsAdjacent,
  studentsOf, headcount, byId
} from './model.js';

export const DEFAULTS = {
  weightSpread: 6,        // S1
  weightBackToBack: 12,   // S2
  weightSameDay: 8,       // S3
  weightRoomWaste: 0.25,  // S4
  gapMinutes: 60,         // what counts as "back-to-back"
  nodeBudget: 60000,      // search node cap, keeps the UI responsive
  polishPasses: 6
};

/* ================= shared context ================= */

export function buildContext(state, options) {
  const opts = Object.assign({}, DEFAULTS, options || {});

  const slots = state.slots.filter(s => s.available !== false)
    .slice()
    .sort((a, b) => a.date === b.date
      ? toMinutes(a.start) - toMinutes(b.start)
      : (a.date < b.date ? -1 : 1));

  const rooms = state.rooms.filter(r => r.available !== false);

  // Pre-compute slot relationships once — the inner loop leans on these.
  const overlaps = {};   // slotId -> Set(slotId) of slots that clash in time
  const adjacent = {};   // slotId -> Set(slotId) of slots that sit back-to-back
  const sameDay = {};    // slotId -> Set(slotId) of slots on the same date

  slots.forEach(a => {
    overlaps[a.id] = new Set();
    adjacent[a.id] = new Set();
    sameDay[a.id] = new Set();
  });
  for (let i = 0; i < slots.length; i++) {
    for (let j = 0; j < slots.length; j++) {
      if (i === j) continue;
      const a = slots[i], b = slots[j];
      if (a.date !== b.date) continue;
      sameDay[a.id].add(b.id);
      if (slotsOverlap(a, b)) overlaps[a.id].add(b.id);
      else if (slotsAdjacent(a, b, opts.gapMinutes)) adjacent[a.id].add(b.id);
    }
  }

  const dates = [];
  slots.forEach(s => { if (dates.indexOf(s.date) === -1) dates.push(s.date); });

  return {
    opts, slots, rooms, overlaps, adjacent, sameDay, dates,
    slotById: id => byId(state.slots, id),
    roomById: id => byId(state.rooms, id)
  };
}

/* ================= domains ================= */

function buildDomains(courses, ctx) {
  const domains = {};
  const blocked = [];

  courses.forEach(course => {
    const size = headcount(course);
    const values = [];
    let roomFits = false, slotFits = false;

    ctx.rooms.forEach(room => {
      if (room.capacity < size) return;
      roomFits = true;
      ctx.slots.forEach(slot => {
        if (slotLength(slot) < course.duration) return;
        slotFits = true;
        values.push({ slotId: slot.id, roomId: room.id, waste: room.capacity - size });
      });
    });

    domains[course.id] = values;
    if (!values.length) {
      let reason;
      if (!ctx.rooms.length) reason = 'No available rooms have been defined.';
      else if (!ctx.slots.length) reason = 'No available time slots have been defined.';
      else if (!roomFits) reason = 'No available room is large enough for ' + size + ' students.';
      else if (!slotFits) reason = 'No available slot is long enough for a ' + course.duration + ' minute exam.';
      else reason = 'No legal date/time/room combination exists.';
      blocked.push({ courseId: course.id, reason: reason });
    }
  });

  return { domains, blocked };
}

/* ================= constraint checks ================= */

// Running picture of the partial assignment, so checks stay cheap.
function newBoard() {
  return {
    roomUse: {},     // roomId  -> [slotId]
    studentUse: {},  // student -> [slotId]
    dayLoad: {},     // date    -> exam count
    assigned: {}     // courseId -> {slotId, roomId}
  };
}

function place(board, course, value, ctx) {
  const slot = ctx.slots.find(s => s.id === value.slotId);
  (board.roomUse[value.roomId] = board.roomUse[value.roomId] || []).push(value.slotId);
  studentsOf(course).forEach(st => {
    (board.studentUse[st] = board.studentUse[st] || []).push(value.slotId);
  });
  board.dayLoad[slot.date] = (board.dayLoad[slot.date] || 0) + 1;
  board.assigned[course.id] = value;
}

function unplace(board, course, value, ctx) {
  const slot = ctx.slots.find(s => s.id === value.slotId);
  const drop = (arr, id) => { const i = arr.indexOf(id); if (i > -1) arr.splice(i, 1); };
  drop(board.roomUse[value.roomId] || [], value.slotId);
  studentsOf(course).forEach(st => drop(board.studentUse[st] || [], value.slotId));
  board.dayLoad[slot.date] = (board.dayLoad[slot.date] || 1) - 1;
  delete board.assigned[course.id];
}

// H1 + H2 — the constraints that make an assignment illegal, not just costly.
function isConsistent(board, course, value, ctx) {
  const clash = ctx.overlaps[value.slotId];

  const inRoom = board.roomUse[value.roomId];
  if (inRoom) {
    for (let i = 0; i < inRoom.length; i++) {
      if (inRoom[i] === value.slotId || clash.has(inRoom[i])) return false; // H1
    }
  }

  const students = studentsOf(course);
  for (let i = 0; i < students.length; i++) {
    const busy = board.studentUse[students[i]];
    if (!busy) continue;
    for (let j = 0; j < busy.length; j++) {
      if (busy[j] === value.slotId || clash.has(busy[j])) return false; // H2
    }
  }
  return true;
}

/* ================= soft cost ================= */

// Cost of adding this exam to the board as it currently stands.
function valueCost(board, course, value, ctx) {
  const opts = ctx.opts;
  const slot = ctx.slots.find(s => s.id === value.slotId);
  let cost = value.waste * opts.weightRoomWaste;                       // S4
  cost += (board.dayLoad[slot.date] || 0) * opts.weightSpread;         // S1

  const sameDaySet = ctx.sameDay[value.slotId];
  const adjSet = ctx.adjacent[value.slotId];
  const students = studentsOf(course);

  for (let i = 0; i < students.length; i++) {
    const busy = board.studentUse[students[i]];
    if (!busy) continue;
    for (let j = 0; j < busy.length; j++) {
      if (adjSet.has(busy[j])) cost += opts.weightBackToBack;          // S2
      else if (sameDaySet.has(busy[j])) cost += opts.weightSameDay;    // S3
    }
  }
  return cost;
}

// Total cost of a finished (or partial) assignment — also drives the polish pass.
export function evaluate(entries, courses, ctx) {
  const opts = ctx.opts;
  const byCourse = {};
  courses.forEach(c => { byCourse[c.id] = c; });

  const dayLoad = {};
  const studentSlots = {};
  let waste = 0, seatsUsed = 0, seatsOffered = 0;

  entries.forEach(e => {
    const course = byCourse[e.courseId];
    const slot = ctx.slots.find(s => s.id === e.slotId);
    const room = ctx.rooms.find(r => r.id === e.roomId);
    if (!course || !slot || !room) return;
    dayLoad[slot.date] = (dayLoad[slot.date] || 0) + 1;
    const size = headcount(course);
    waste += room.capacity - size;
    seatsUsed += size;
    seatsOffered += room.capacity;
    studentsOf(course).forEach(st => {
      (studentSlots[st] = studentSlots[st] || []).push(slot.id);
    });
  });

  let backToBack = 0, sameDayDoubles = 0, clashes = 0;
  Object.keys(studentSlots).forEach(st => {
    const list = studentSlots[st];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i] === list[j] || ctx.overlaps[list[i]].has(list[j])) clashes++;
        else if (ctx.adjacent[list[i]].has(list[j])) backToBack++;
        else if (ctx.sameDay[list[i]].has(list[j])) sameDayDoubles++;
      }
    }
  });

  // Spread: sum of squares per day is minimised when exams are level across days.
  let spread = 0;
  Object.keys(dayLoad).forEach(d => { spread += dayLoad[d] * dayLoad[d]; });

  const total =
    spread * opts.weightSpread +
    backToBack * opts.weightBackToBack +
    sameDayDoubles * opts.weightSameDay +
    waste * opts.weightRoomWaste +
    clashes * 10000;

  return {
    total: total,
    scheduled: entries.length,
    daysUsed: Object.keys(dayLoad).length,
    daysAvailable: ctx.dates.length,
    backToBack: backToBack,
    sameDayDoubles: sameDayDoubles,
    studentClashes: clashes,
    wastedSeats: waste,
    roomUtilisation: seatsOffered ? Math.round((seatsUsed / seatsOffered) * 100) : 0,
    examsPerDay: dayLoad
  };
}

/* ================= backtracking search ================= */

function search(courses, domains, ctx) {
  const board = newBoard();
  const pending = courses.slice();
  let nodes = 0;
  let best = { count: -1, entries: [] };

  function snapshot() {
    return Object.keys(board.assigned).map(cid => ({
      courseId: cid,
      slotId: board.assigned[cid].slotId,
      roomId: board.assigned[cid].roomId
    }));
  }

  function feasibleValues(course) {
    return domains[course.id].filter(v => isConsistent(board, course, v, ctx));
  }

  function recurse(remaining) {
    if (remaining.length > 0 && Object.keys(board.assigned).length > best.count) {
      best = { count: Object.keys(board.assigned).length, entries: snapshot() };
    }
    if (!remaining.length) {
      best = { count: Object.keys(board.assigned).length, entries: snapshot() };
      return true;
    }
    if (nodes > ctx.opts.nodeBudget) return false;

    // MRV: take the exam with the fewest legal options left; break ties on
    // the biggest exam, which is the hardest to place later.
    let pick = null, pickValues = null;
    for (let i = 0; i < remaining.length; i++) {
      const values = feasibleValues(remaining[i]);
      if (!pick || values.length < pickValues.length ||
          (values.length === pickValues.length &&
           headcount(remaining[i]) > headcount(pick))) {
        pick = remaining[i];
        pickValues = values;
      }
      if (values.length === 0) break; // dead end — fail fast
    }
    if (!pickValues.length) return false;

    // Least-cost value ordering: try the option that hurts the soft goals least.
    pickValues.forEach(v => { v._cost = valueCost(board, pick, v, ctx); });
    pickValues.sort((a, b) => a._cost - b._cost);

    const rest = remaining.filter(c => c.id !== pick.id);

    for (let i = 0; i < pickValues.length; i++) {
      nodes++;
      if (nodes > ctx.opts.nodeBudget) return false;
      const value = pickValues[i];
      place(board, pick, value, ctx);

      // Forward checking: if any other exam now has zero options, back out.
      let wipeout = false;
      for (let k = 0; k < rest.length; k++) {
        if (!feasibleValues(rest[k]).length) { wipeout = true; break; }
      }
      if (!wipeout && recurse(rest)) return true;

      unplace(board, pick, value, ctx);
    }
    return false;
  }

  const complete = recurse(pending);
  return { complete: complete, entries: best.entries, nodes: nodes };
}

// Anything the search could not place: drop it in wherever it legally fits.
function greedyFill(entries, courses, domains, ctx) {
  const board = newBoard();
  const byId = {};
  courses.forEach(c => { byId[c.id] = c; });
  entries.forEach(e => {
    const value = { slotId: e.slotId, roomId: e.roomId, waste: 0 };
    place(board, byId[e.courseId], value, ctx);
  });

  const missed = [];
  courses.forEach(course => {
    if (board.assigned[course.id]) return;
    const options = domains[course.id]
      .filter(v => isConsistent(board, course, v, ctx))
      .map(v => { v._cost = valueCost(board, course, v, ctx); return v; })
      .sort((a, b) => a._cost - b._cost);
    if (!options.length) {
      missed.push({
        courseId: course.id,
        reason: 'Every date/time/room option clashes with an already-scheduled exam.'
      });
      return;
    }
    place(board, course, options[0], ctx);
    entries.push({ courseId: course.id, slotId: options[0].slotId, roomId: options[0].roomId });
  });

  return missed;
}

/* ================= local-search polish ================= */

// Try relocating one exam at a time; keep any move that lowers total cost.
function polish(entries, courses, domains, ctx) {
  const byId = {};
  courses.forEach(c => { byId[c.id] = c; });
  let bestCost = evaluate(entries, courses, ctx).total;

  // Each candidate move re-scores the whole timetable, so keep the number of
  // passes in step with the size of the problem.
  const work = entries.length * entries.length * (ctx.slots.length * ctx.rooms.length);
  const passes = work > 4e6 ? 1 : ctx.opts.polishPasses;

  for (let pass = 0; pass < passes; pass++) {
    let improved = false;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const course = byId[entry.courseId];
      if (!course) continue;

      // Rebuild the board without this exam so alternatives can be tested.
      const board = newBoard();
      entries.forEach((e, idx) => {
        if (idx === i) return;
        place(board, byId[e.courseId], { slotId: e.slotId, roomId: e.roomId, waste: 0 }, ctx);
      });

      const original = { slotId: entry.slotId, roomId: entry.roomId };
      let bestValue = null;

      domains[course.id].forEach(v => {
        if (v.slotId === original.slotId && v.roomId === original.roomId) return;
        if (!isConsistent(board, course, v, ctx)) return;
        entry.slotId = v.slotId;
        entry.roomId = v.roomId;
        const cost = evaluate(entries, courses, ctx).total;
        if (cost < bestCost - 1e-9) {
          bestCost = cost;
          bestValue = { slotId: v.slotId, roomId: v.roomId };
        }
      });

      if (bestValue) {
        entry.slotId = bestValue.slotId;
        entry.roomId = bestValue.roomId;
        improved = true;
      } else {
        entry.slotId = original.slotId;
        entry.roomId = original.roomId;
      }
    }

    if (!improved) break;
  }
  return entries;
}

/* ================= public: generate ================= */

export function generate(state, options) {
  const started = Date.now();
  const ctx = buildContext(state, options);

  if (!state.courses.length) {
    return { entries: [], unscheduled: [], stats: null, message: 'Add at least one course first.' };
  }
  if (!ctx.slots.length || !ctx.rooms.length) {
    return {
      entries: [],
      unscheduled: state.courses.map(c => ({
        courseId: c.id,
        reason: !ctx.rooms.length ? 'No available rooms.' : 'No available time slots.'
      })),
      stats: null,
      message: 'You need at least one available room and one available time slot.'
    };
  }

  const built = buildDomains(state.courses, ctx);
  const blockedIds = built.blocked.map(b => b.courseId);
  const schedulable = state.courses.filter(c => blockedIds.indexOf(c.id) === -1);

  const result = search(schedulable, built.domains, ctx);
  let entries = result.entries.slice();
  const missed = greedyFill(entries, schedulable, built.domains, ctx);
  entries = polish(entries, schedulable, built.domains, ctx);

  // Keep the timetable in chronological order for display.
  entries.sort((a, b) => {
    const sa = ctx.slots.find(s => s.id === a.slotId);
    const sb = ctx.slots.find(s => s.id === b.slotId);
    if (!sa || !sb) return 0;
    return sa.date === sb.date
      ? toMinutes(sa.start) - toMinutes(sb.start)
      : (sa.date < sb.date ? -1 : 1);
  });

  const stats = evaluate(entries, state.courses, ctx);
  stats.total = state.courses.length;
  stats.unscheduled = state.courses.length - entries.length;
  stats.nodes = result.nodes;
  stats.elapsedMs = Date.now() - started;
  stats.complete = result.complete;

  return {
    entries: entries,
    unscheduled: built.blocked.concat(missed),
    stats: stats,
    message: entries.length === state.courses.length
      ? 'All ' + entries.length + ' exams scheduled with no clashes.'
      : entries.length + ' of ' + state.courses.length + ' exams scheduled — see the unscheduled list below.'
  };
}

/* ================= public: conflict detection ================= */

// Validates whatever is currently in the timetable, including manual edits.
export function detectConflicts(state, options) {
  const opts = Object.assign({}, DEFAULTS, options || {});
  const issues = [];
  const entries = state.timetable || [];
  const label = c => (c ? c.code + ' — ' + c.name : 'Unknown course');

  const resolved = entries.map(e => ({
    entry: e,
    course: byId(state.courses, e.courseId),
    slot: byId(state.slots, e.slotId),
    room: byId(state.rooms, e.roomId)
  })).filter(x => x.course);

  resolved.forEach(x => {
    if (!x.slot || !x.room) {
      issues.push({
        type: 'missing', severity: 'error',
        message: label(x.course) + ' points at a time slot or room that no longer exists.',
        courses: [x.course.id]
      });
      return;
    }
    // H3 — capacity
    const size = headcount(x.course);
    if (size > x.room.capacity) {
      issues.push({
        type: 'capacity', severity: 'error',
        message: label(x.course) + ' has ' + size + ' students but ' + x.room.name +
                 ' seats only ' + x.room.capacity + ' (' + (size - x.room.capacity) + ' over).',
        courses: [x.course.id]
      });
    }
    // H4 — availability
    if (x.slot.available === false) {
      issues.push({
        type: 'availability', severity: 'error',
        message: label(x.course) + ' is scheduled outside the available exam periods (' +
                 x.slot.date + ' ' + x.slot.start + ' is marked unavailable).',
        courses: [x.course.id]
      });
    }
    if (x.room.available === false) {
      issues.push({
        type: 'availability', severity: 'error',
        message: label(x.course) + ' is assigned to ' + x.room.name + ', which is marked unavailable.',
        courses: [x.course.id]
      });
    }
    // H5 — slot long enough
    if (slotLength(x.slot) < x.course.duration) {
      issues.push({
        type: 'duration', severity: 'error',
        message: label(x.course) + ' needs ' + x.course.duration + ' minutes but the slot is only ' +
                 slotLength(x.slot) + ' minutes long.',
        courses: [x.course.id]
      });
    }
  });

  // H1 / H2 / soft warnings — pairwise over scheduled exams
  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i], b = resolved[j];
      if (!a.slot || !b.slot || !a.room || !b.room) continue;

      const sameSlot = a.slot.id === b.slot.id;
      const overlap = sameSlot || slotsOverlap(a.slot, b.slot);

      if (overlap && a.room.id === b.room.id) {
        issues.push({
          type: 'room', severity: 'error',
          message: a.room.name + ' is double-booked: ' + a.course.code + ' and ' + b.course.code +
                   ' both run on ' + a.slot.date + ' at overlapping times.',
          courses: [a.course.id, b.course.id]
        });
      }

      const shared = sharedStudents(a.course, b.course);
      if (!shared.length) continue;

      if (overlap) {
        issues.push({
          type: 'student', severity: 'error',
          message: shared.length + ' student(s) are registered for both ' + a.course.code + ' and ' +
                   b.course.code + ', which clash on ' + a.slot.date + ' at ' + a.slot.start + '.',
          courses: [a.course.id, b.course.id]
        });
      } else if (slotsAdjacent(a.slot, b.slot, opts.gapMinutes)) {
        issues.push({
          type: 'backToBack', severity: 'warning',
          message: shared.length + ' student(s) sit ' + a.course.code + ' and ' + b.course.code +
                   ' back-to-back on ' + a.slot.date + '.',
          courses: [a.course.id, b.course.id]
        });
      } else if (a.slot.date === b.slot.date) {
        issues.push({
          type: 'sameDay', severity: 'warning',
          message: shared.length + ' student(s) sit both ' + a.course.code + ' and ' + b.course.code +
                   ' on ' + a.slot.date + '.',
          courses: [a.course.id, b.course.id]
        });
      }
    }
  }

  // Unscheduled courses
  const scheduledIds = resolved.map(x => x.course.id);
  state.courses.forEach(c => {
    if (scheduledIds.indexOf(c.id) === -1) {
      issues.push({
        type: 'unscheduled', severity: 'warning',
        message: label(c) + ' has not been scheduled yet.',
        courses: [c.id]
      });
    }
  });

  return issues;
}

export function sharedStudents(a, b) {
  if (!a.students || !b.students || !a.students.length || !b.students.length) return [];
  const set = new Set(a.students);
  return b.students.filter(s => set.has(s));
}

