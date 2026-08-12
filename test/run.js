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

const AuthCore = global.AuthCore = require('../js/auth-core.js');
const Auth = global.Auth = require('../js/auth.js');
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

/* ---------- 3. accounts ---------- */

console.log('\n=== ACCOUNTS ===');

// SHA-256 against the official NIST vectors — everything else rests on this.
check('sha256("") matches the NIST vector',
      AuthCore.sha256('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
check('sha256("abc") matches the NIST vector',
      AuthCore.sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
check('sha256 handles multi-byte characters',
      AuthCore.sha256('héllo 😀').length === 64);

const salt = AuthCore.makeSalt();
check('a salt is generated', salt.length === 24);
check('two salts differ', AuthCore.makeSalt() !== AuthCore.makeSalt());
check('the same password and salt hash the same',
      AuthCore.hashPassword('pw', salt) === AuthCore.hashPassword('pw', salt));
check('a different salt gives a different hash',
      AuthCore.hashPassword('pw', salt) !== AuthCore.hashPassword('pw', AuthCore.makeSalt()));

Auth.load();
check('no accounts on a fresh install', Auth.userCount() === 0);
check('nobody is signed in yet', Auth.isSignedIn() === false);

// validation
check('sign-up needs a name',
      Auth.signUp({ name: '', email: 'a@b.com', password: 'secret1', confirm: 'secret1' }).ok === false);
check('sign-up rejects a malformed email',
      Auth.signUp({ name: 'A B', email: 'not-an-email', password: 'secret1', confirm: 'secret1' }).ok === false);
check('sign-up rejects a short password',
      Auth.signUp({ name: 'A B', email: 'a@b.com', password: 'abc', confirm: 'abc' }).ok === false);
check('sign-up rejects mismatched passwords',
      Auth.signUp({ name: 'A B', email: 'a@b.com', password: 'secret1', confirm: 'secret2' }).ok === false);
check('nothing was saved by the rejected attempts', Auth.userCount() === 0);

const created = Auth.signUp({
  name: 'Joshua Kissi', email: '  Joshua@ST.knust.edu.gh ',
  password: 'secret123', confirm: 'secret123'
});
check('a valid sign-up succeeds', created.ok === true);
check('the email is normalised', created.user.email === 'joshua@st.knust.edu.gh');
check('signing up signs you in', Auth.isSignedIn() === true);
check('the session exposes no password hash',
      created.user.hash === undefined && created.user.salt === undefined);

check('a duplicate email is refused',
      Auth.signUp({ name: 'Someone', email: 'JOSHUA@st.knust.edu.gh',
                    password: 'other123', confirm: 'other123' }).ok === false);
check('the duplicate did not create a second account', Auth.userCount() === 1);

Auth.signOut();
check('signing out ends the session', Auth.isSignedIn() === false);
check('signing out keeps the account', Auth.userCount() === 1);

check('the wrong password is refused',
      Auth.signIn({ email: 'joshua@st.knust.edu.gh', password: 'wrong' }).ok === false);
check('an unknown email is refused',
      Auth.signIn({ email: 'nobody@example.com', password: 'secret123' }).ok === false);
check('wrong password and unknown email give the same message',
      Auth.signIn({ email: 'joshua@st.knust.edu.gh', password: 'wrong' }).error ===
      Auth.signIn({ email: 'nobody@example.com', password: 'secret123' }).error);
check('a failed sign-in leaves you signed out', Auth.isSignedIn() === false);

const back = Auth.signIn({ email: ' JOSHUA@st.knust.edu.gh ', password: 'secret123' });
check('the right password signs you in', back.ok === true);
check('sign-in is case- and space-insensitive on email', back.user.name === 'Joshua Kissi');

// stored shape
const stored = JSON.parse(localStorage.getItem('exam-scheduler-auth-v1'));
check('the password is never stored in the clear',
      JSON.stringify(stored).indexOf('secret123') === -1);
check('a salt and hash are stored instead',
      stored.users[0].salt.length === 24 && stored.users[0].hash.length === 64);
check('accounts are kept out of the timetable data',
      localStorage.getItem('exam-scheduler-v1').indexOf('joshua@st.knust.edu.gh') === -1);

check('password strength is graded', AuthCore.passwordStrength('abc').tone === 'bad' &&
      AuthCore.passwordStrength('Str0ng!Passw0rd').tone === 'ok');
check('initials are derived from the name', AuthCore.initials('Joshua Kissi') === 'JK');

Auth.signOut();

/* ---------- 4. student complaints ---------- */

console.log('\n=== COMPLAINTS ===');
const someStudent = state.courses[0].students[0];
const mine = Store.coursesForStudent(someStudent);
check('a student ID resolves to their registered courses', mine.length > 0,
      someStudent + ' -> ' + mine.map(c => c.code).join(', '));
check('an unknown student ID resolves to nothing',
      Store.coursesForStudent('does-not-exist').length === 0);

const filed = Store.addComplaint({
  studentId: someStudent,
  studentName: 'Test Student',
  courseId: state.courses[0].id,
  category: 'clash',
  message: 'My two exams are on the same morning.'
});
check('a complaint is accepted and starts as new', filed && filed.status === 'new');
check('complaints carry a submission timestamp', filed && !isNaN(new Date(filed.createdAt).getTime()));
check('a complaint with no student ID is rejected',
      Store.addComplaint({ studentId: '', message: 'anonymous' }) === null);
check('a complaint with no message is rejected',
      Store.addComplaint({ studentId: someStudent, message: '   ' }) === null);
check('it shows up in the open queue', Store.openComplaints().length === 1);

Store.updateComplaint(filed.id, { status: 'reviewing', response: 'We are looking into it.' });
let reloaded = Store.byId(Store.getState().complaints, filed.id);
check('status and response are saved', reloaded.status === 'reviewing' &&
      reloaded.response === 'We are looking into it.');
check('an invalid status is ignored',
      Store.updateComplaint(filed.id, { status: 'nonsense' }).status === 'reviewing');

Store.updateComplaint(filed.id, { status: 'resolved' });
check('resolved complaints leave the open queue', Store.openComplaints().length === 0);

Store.removeComplaint(filed.id);
check('a complaint can be deleted', Store.getState().complaints.length === 0);

// Old saved files predate the complaints field — loading must not break.
Store.replaceState({ courses: [], rooms: [], slots: [], timetable: [] });
check('data saved before complaints existed still loads',
      Array.isArray(Store.getState().complaints) && Store.getState().complaints.length === 0);

/* ---------- 5. impossible courses are explained, not silently dropped ---------- */

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

/* ---------- 6. saturated instance: 8 exams into exactly 8 openings ---------- */

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
