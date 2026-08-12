/* ------------------------------------------------------------------
   Headless test harness for the mobile engine — run with: npm test

   Covers model.js, scheduler.js and demo.js, which are pure JavaScript
   and identical in behaviour to the web version. store.js is not covered
   here because it needs React and AsyncStorage; the logic it wraps is.
------------------------------------------------------------------- */

import * as M from '../src/engine/model.js';
import * as S from '../src/engine/scheduler.js';
import * as A from '../src/engine/auth-core.js';
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

/* ---------- accounts ---------- */

console.log('\n=== ACCOUNTS ===');
check('sha256("") matches the NIST vector',
      A.sha256('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
check('sha256("abc") matches the NIST vector',
      A.sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
check('sha256 handles multi-byte characters', A.sha256('héllo 😀').length === 64);

const salt = A.makeSalt();
check('a salt is generated', salt.length === 24);
check('two salts differ', A.makeSalt() !== A.makeSalt());
check('the same password and salt hash the same',
      A.hashPassword('pw', salt) === A.hashPassword('pw', salt));
check('a different salt gives a different hash',
      A.hashPassword('pw', salt) !== A.hashPassword('pw', A.makeSalt()));

check('sign-up needs a name',
      A.validateSignUp({ name: '', email: 'a@b.com', password: 'secret1', confirm: 'secret1' }, []) !== null);
check('sign-up rejects a malformed email',
      A.validateSignUp({ name: 'A B', email: 'nope', password: 'secret1', confirm: 'secret1' }, []) !== null);
check('sign-up rejects a short password',
      A.validateSignUp({ name: 'A B', email: 'a@b.com', password: 'abc', confirm: 'abc' }, []) !== null);
check('sign-up rejects mismatched passwords',
      A.validateSignUp({ name: 'A B', email: 'a@b.com', password: 'secret1', confirm: 'secret2' }, []) !== null);
check('sign-up rejects a duplicate email',
      A.validateSignUp({ name: 'A B', email: 'A@B.com', password: 'secret1', confirm: 'secret1' },
                       ['a@b.com']) !== null);
check('valid details pass validation',
      A.validateSignUp({ name: 'Joshua Kissi', email: 'j@k.com', password: 'secret123',
                         confirm: 'secret123' }, []) === null);

const account = A.makeUser({ name: 'Joshua Kissi', email: '  Joshua@ST.knust.edu.gh ',
                             password: 'secret123' });
check('the email is normalised', account.email === 'joshua@st.knust.edu.gh');
check('the password is never stored in the clear',
      JSON.stringify(account).indexOf('secret123') === -1);
check('a salt and hash are stored instead',
      account.salt.length === 24 && account.hash.length === 64);
check('the right password verifies', A.verifyPassword(account, 'secret123'));
check('a wrong password does not', !A.verifyPassword(account, 'secret124'));
check('an empty password does not', !A.verifyPassword(account, ''));
check('publicUser strips the credentials',
      A.publicUser(account).hash === undefined && A.publicUser(account).salt === undefined);
check('accounts are found by email, case-insensitively',
      A.findByEmail([account], ' JOSHUA@st.knust.edu.gh ') !== null);
check('an unknown email finds nothing', A.findByEmail([account], 'nobody@example.com') === null);
check('password strength is graded',
      A.passwordStrength('abc').tone === 'bad' && A.passwordStrength('Str0ng!Passw0rd').tone === 'ok');
check('initials are derived from the name',
      A.initials('Joshua Kissi') === 'JK' && A.initials('') === '?');

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
