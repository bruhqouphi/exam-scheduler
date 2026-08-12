/* ------------------------------------------------------------------
   Headless test harness — run with:  node test/run.js
   Exercises the store, the CSP solver and the conflict detector
   without a browser (localStorage is stubbed in memory).
------------------------------------------------------------------- */

const mem = {};
global.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = v; },
  removeItem: k => { delete mem[k]; }
};

const Store = global.Store = require('../js/store.js');
const Scheduler = global.Scheduler = require('../js/scheduler.js');
const DemoData = require('../js/demo.js');

let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) failures++;
}

/* ---------- 1. sample dataset ---------- */

Store.load();
const demo = DemoData.build();
demo.rooms.forEach(r => Store.addRoom(r));
demo.slots.forEach(s => Store.addSlot(s));
demo.courses.forEach(c => Store.addCourse(c));

const state = Store.getState();
console.log('=== SAMPLE DATASET ===');
console.log('courses: ' + state.courses.length +
            ' | rooms: ' + state.rooms.length + ' (' + state.rooms.filter(r => r.available !== false).length + ' available)' +
            ' | slots: ' + state.slots.length);

const result = Scheduler.generate(state, {});
console.log(result.message);
console.log('days used: ' + result.stats.daysUsed + '/' + result.stats.daysAvailable +
            ' | back-to-back: ' + result.stats.backToBack +
            ' | room use: ' + result.stats.roomUtilisation + '%' +
            ' | ' + result.stats.elapsedMs + 'ms');

Store.setTimetable(result.entries, result.unscheduled, result.stats);
const errors = Scheduler.detectConflicts(Store.getState(), {}).filter(i => i.severity === 'error');

console.log('\n=== HARD CONSTRAINTS ===');
check('every exam is scheduled', result.entries.length === state.courses.length,
      result.entries.length + '/' + state.courses.length);
check('no hard conflicts reported', errors.length === 0, errors.length + ' errors');
check('no student sits two exams at once', result.stats.studentClashes === 0);
check('rooms are large enough', result.entries.every(e => {
  const c = Store.byId(state.courses, e.courseId), r = Store.byId(state.rooms, e.roomId);
  return r.capacity >= Store.headcount(c);
}));
check('slots are long enough', result.entries.every(e => {
  const c = Store.byId(state.courses, e.courseId), s = Store.byId(state.slots, e.slotId);
  return Store.slotLength(s) >= c.duration;
}));
check('unavailable rooms are never used',
      result.entries.every(e => Store.byId(state.rooms, e.roomId).available !== false));
check('unavailable slots are never used',
      result.entries.every(e => Store.byId(state.slots, e.slotId).available !== false));

console.log('\n=== OPTIMISATION ===');
check('exams are spread across days', result.stats.daysUsed >= 3, 'days=' + result.stats.daysUsed);
check('solve finishes quickly', result.stats.elapsedMs < 15000, result.stats.elapsedMs + 'ms');

/* ---------- 2. conflict detection on hand-edited timetables ---------- */

console.log('\n=== CONFLICT DETECTION ===');
const slot0 = state.slots[0].id;
const room0 = state.rooms.find(r => r.available !== false).id;
Store.setAssignment(state.courses[0].id, slot0, room0);
Store.setAssignment(state.courses[1].id, slot0, room0);
let types = Scheduler.detectConflicts(Store.getState(), {})
  .filter(i => i.severity === 'error').map(i => i.type);
check('detects a double-booked room', types.indexOf('room') > -1);
check('detects a student sitting two exams at once', types.indexOf('student') > -1);

const tiny = Store.addRoom({ name: 'TINY', capacity: 1, available: false });
const short = Store.addSlot({ date: state.slots[0].date, start: '06:00', end: '06:30', available: false });
Store.setAssignment(state.courses[2].id, short.id, tiny.id);
types = Scheduler.detectConflicts(Store.getState(), {})
  .filter(i => i.severity === 'error').map(i => i.type);
check('detects too many students for a room', types.indexOf('capacity') > -1);
check('detects scheduling outside available periods', types.indexOf('availability') > -1);
check('detects a slot shorter than the exam', types.indexOf('duration') > -1);

/* ---------- 3. impossible courses are explained, not silently dropped ---------- */

console.log('\n=== INFEASIBLE INPUT ===');
Store.clearAll();
Store.addRoom({ name: 'Small', capacity: 10, available: true });
Store.addSlot({ date: '2026-09-01', start: '08:00', end: '10:00', available: true });
Store.addCourse({ code: 'BIG 101', name: 'Huge Class', duration: 120, studentCount: 500 });
Store.addCourse({ code: 'LONG 101', name: 'Long Exam', duration: 600, studentCount: 5 });
const infeasible = Scheduler.generate(Store.getState(), {});
infeasible.unscheduled.forEach(u => console.log('   reason: ' + u.reason));
check('explains a class too big for every room',
      infeasible.unscheduled.some(u => /large enough/.test(u.reason)));
check('explains an exam longer than every slot',
      infeasible.unscheduled.some(u => /long enough/.test(u.reason)));

/* ---------- 4. saturated instance: 8 exams into exactly 8 openings ---------- */

console.log('\n=== SATURATED INSTANCE ===');
Store.clearAll();
for (let i = 0; i < 2; i++) Store.addRoom({ name: 'R' + i, capacity: 50, available: true });
['2026-09-01', '2026-09-02'].forEach(d => {
  Store.addSlot({ date: d, start: '08:00', end: '10:00', available: true });
  Store.addSlot({ date: d, start: '12:00', end: '14:00', available: true });
});
for (let i = 1; i <= 8; i++) {
  Store.addCourse({ code: 'X' + i, name: 'Course ' + i, duration: 120, studentCount: 40 });
}
const tight = Scheduler.generate(Store.getState(), {});
check('fills every available opening', tight.entries.length === 8, tight.entries.length + '/8');
Store.setTimetable(tight.entries, tight.unscheduled, tight.stats);
check('saturated timetable is still conflict-free',
      Scheduler.detectConflicts(Store.getState(), {}).filter(i => i.severity === 'error').length === 0);

Store.addCourse({ code: 'X9', name: 'One too many', duration: 120, studentCount: 40 });
const over = Scheduler.generate(Store.getState(), {});
check('reports the overflow instead of forcing a clash',
      over.entries.length === 8 && over.unscheduled.length === 1,
      'scheduled=' + over.entries.length + ', unscheduled=' + over.unscheduled.length);

console.log('\n' + (failures ? failures + ' CHECK(S) FAILED' : 'ALL CHECKS PASSED'));
process.exit(failures ? 1 : 0);
