/* ------------------------------------------------------------------
   Headless test harness for the mobile engine — run with: npm test

   Covers model.js, scheduler.js and demo.js, which are pure JavaScript
   and identical in behaviour to the web version. store.js is not covered
   here because it needs React and AsyncStorage; the logic it wraps is.
------------------------------------------------------------------- */

import * as M from '../src/engine/model.js';
import * as S from '../src/engine/scheduler.js';
import { build } from '../src/engine/demo.js';

let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) failures++;
}

/* ---------- build state the way the store would ---------- */

const demo = build();
const state = {
  courses: demo.courses.map(M.makeCourse),
  rooms: demo.rooms.map(M.makeRoom),
  slots: M.sortSlots(demo.slots.map(M.makeSlot)),
  timetable: [], unscheduled: [], complaints: [], stats: null
};

console.log('=== SAMPLE DATASET ===');
console.log('courses: ' + state.courses.length +
            ' | rooms: ' + state.rooms.length +
            ' (' + state.rooms.filter(r => r.available !== false).length + ' available)' +
            ' | slots: ' + state.slots.length);

const result = S.generate(state, {});
console.log(result.message);
console.log('days used: ' + result.stats.daysUsed + '/' + result.stats.daysAvailable +
            ' | back-to-back: ' + result.stats.backToBack +
            ' | room use: ' + result.stats.roomUtilisation + '%' +
            ' | ' + result.stats.elapsedMs + 'ms');

/* ---------- hard constraints ---------- */

console.log('\n=== HARD CONSTRAINTS ===');
check('every exam is scheduled', result.entries.length === state.courses.length,
      result.entries.length + '/' + state.courses.length);
check('no student sits two exams at once', result.stats.studentClashes === 0);
check('rooms are large enough', result.entries.every(e =>
  M.byId(state.rooms, e.roomId).capacity >= M.headcount(M.byId(state.courses, e.courseId))));
check('slots are long enough', result.entries.every(e =>
  M.slotLength(M.byId(state.slots, e.slotId)) >= M.byId(state.courses, e.courseId).duration));
check('unavailable rooms are never used',
      result.entries.every(e => M.byId(state.rooms, e.roomId).available !== false));
check('unavailable slots are never used',
      result.entries.every(e => M.byId(state.slots, e.slotId).available !== false));

state.timetable = result.entries;
check('no hard conflicts reported',
      S.detectConflicts(state, {}).filter(i => i.severity === 'error').length === 0);

console.log('\n=== OPTIMISATION ===');
check('exams are spread across days', result.stats.daysUsed >= 3, 'days=' + result.stats.daysUsed);
check('solve finishes quickly', result.stats.elapsedMs < 15000, result.stats.elapsedMs + 'ms');

/* ---------- conflict detection ---------- */

console.log('\n=== CONFLICT DETECTION ===');
const slot0 = state.slots[0].id;
const room0 = state.rooms.find(r => r.available !== false).id;
state.timetable = [
  { courseId: state.courses[0].id, slotId: slot0, roomId: room0 },
  { courseId: state.courses[1].id, slotId: slot0, roomId: room0 }
];
let types = S.detectConflicts(state, {}).filter(i => i.severity === 'error').map(i => i.type);
check('detects a double-booked room', types.includes('room'));
check('detects a student sitting two exams at once', types.includes('student'));

const tiny = M.makeRoom({ name: 'TINY', capacity: 1, available: false });
const short = M.makeSlot({ date: state.slots[0].date, start: '06:00', end: '06:30', available: false });
state.rooms.push(tiny);
state.slots.push(short);
state.timetable = [{ courseId: state.courses[2].id, slotId: short.id, roomId: tiny.id }];
types = S.detectConflicts(state, {}).filter(i => i.severity === 'error').map(i => i.type);
check('detects too many students for a room', types.includes('capacity'));
check('detects scheduling outside available periods', types.includes('availability'));
check('detects a slot shorter than the exam', types.includes('duration'));

/* ---------- model helpers ---------- */

console.log('\n=== MODEL HELPERS ===');
check('toMinutes parses HH:MM', M.toMinutes('08:30') === 510);
check('slotsOverlap detects an intersection',
  M.slotsOverlap({ date: 'd', start: '08:00', end: '10:00' }, { date: 'd', start: '09:00', end: '11:00' }));
check('slotsOverlap ignores different days',
  !M.slotsOverlap({ date: 'a', start: '08:00', end: '10:00' }, { date: 'b', start: '09:00', end: '11:00' }));
check('slotsAdjacent detects back-to-back',
  M.slotsAdjacent({ date: 'd', start: '08:00', end: '10:00' }, { date: 'd', start: '10:30', end: '12:00' }, 60));
check('headcount uses the registered list',
  M.headcount(state.courses[0]) === state.courses[0].students.length);
check('a course with only a headcount gets private student ids',
  M.studentsOf(M.makeCourse({ code: 'X', name: 'X', studentCount: 3 })).length === 3);

/* ---------- complaints ---------- */

console.log('\n=== COMPLAINTS ===');
check('a complaint with no student ID is rejected',
      M.makeComplaint({ studentId: '', message: 'anonymous' }) === null);
check('a complaint with no message is rejected',
      M.makeComplaint({ studentId: '20700001', message: '   ' }) === null);
const filed = M.makeComplaint({ studentId: '20700001', message: 'My exams clash.', category: 'clash' });
check('a valid complaint starts as new', filed.status === 'new');
check('complaints carry a submission timestamp', !isNaN(new Date(filed.createdAt).getTime()));

/* ---------- infeasible input ---------- */

console.log('\n=== INFEASIBLE INPUT ===');
const impossible = {
  courses: [
    M.makeCourse({ code: 'BIG 101', name: 'Huge Class', duration: 120, studentCount: 500 }),
    M.makeCourse({ code: 'LONG 101', name: 'Long Exam', duration: 600, studentCount: 5 })
  ],
  rooms: [M.makeRoom({ name: 'Small', capacity: 10, available: true })],
  slots: [M.makeSlot({ date: '2026-09-01', start: '08:00', end: '10:00', available: true })],
  timetable: [], unscheduled: [], complaints: [], stats: null
};
const out = S.generate(impossible, {});
out.unscheduled.forEach(u => console.log('   reason: ' + u.reason));
check('explains a class too big for every room',
      out.unscheduled.some(u => /large enough/.test(u.reason)));
check('explains an exam longer than every slot',
      out.unscheduled.some(u => /long enough/.test(u.reason)));

console.log('\n' + (failures ? failures + ' CHECK(S) FAILED' : 'ALL CHECKS PASSED'));
process.exit(failures ? 1 : 0);
