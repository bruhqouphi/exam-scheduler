/* ------------------------------------------------------------------
 demo.js — sample dataset so the scheduler can be tried immediately.
 Students are shared between courses on purpose, so clash detection
 and the back-to-back optimisation have something real to work with.
------------------------------------------------------------------- */

// Small deterministic PRNG so "sample data" is the same every time.
function rng(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const COURSES = [
  { code: 'CSM 157', name: 'Discrete Mathematics',        duration: 120 },
  { code: 'CSM 165', name: 'Introduction to Programming', duration: 180 },
  { code: 'CSM 183', name: 'Digital Logic Design',        duration: 120 },
  { code: 'MATH 161', name: 'Calculus I',                 duration: 180 },
  { code: 'CSM 265', name: 'Data Structures',             duration: 120 },
  { code: 'CSM 279', name: 'Database Systems',            duration: 120 },
  { code: 'CSM 283', name: 'Operating Systems',           duration: 120 },
  { code: 'CSM 367', name: 'Software Engineering',        duration: 120 },
  { code: 'CSM 381', name: 'Computer Networks',           duration: 120 },
  { code: 'STAT 265', name: 'Probability & Statistics',   duration: 120 }
];

const ROOMS = [
  { name: 'PB 010',        capacity: 220, building: 'Petroleum Block',   available: true },
  { name: 'PB 011',        capacity: 180, building: 'Petroleum Block',   available: true },
  { name: 'CCB Hall A',    capacity: 150, building: 'Caesar Building',   available: true },
  { name: 'CCB Hall B',    capacity: 120, building: 'Caesar Building',   available: true },
  { name: 'SF 24',         capacity: 80,  building: 'Science Faculty',   available: true },
  { name: 'Great Hall',    capacity: 400, building: 'Main Campus',       available: false }
];

// Local-time ISO date (toISOString() would shift the day across time zones).
function isoDate(d) {
  const pad = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// The next `count` weekdays, starting tomorrow.
function weekdays(count) {
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (out.length < count) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(isoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function build() {
  const rand = rng(20260812);

  // 140 students, each registered for 4 of the 10 courses.
  const registrations = {};
  COURSES.forEach(c => { registrations[c.code] = []; });

  for (let i = 1; i <= 140; i++) {
    const id = '20' + String(700000 + i);
    const picked = {};
    let taken = 0;
    while (taken < 4) {
      const idx = Math.floor(rand() * COURSES.length);
      if (picked[idx]) continue;
      picked[idx] = true;
      registrations[COURSES[idx].code].push(id);
      taken++;
    }
  }

  const courses = COURSES.map(c => ({
    code: c.code,
    name: c.name,
    duration: c.duration,
    studentsText: registrations[c.code].join(', '),
    studentCount: registrations[c.code].length
  }));

  // Five exam days, three sessions a day.
  const slots = [];
  const sessions = [['08:00', '11:00'], ['12:00', '15:00'], ['16:00', '19:00']];
  weekdays(5).forEach(date => {
    sessions.forEach(s => slots.push({ date: date, start: s[0], end: s[1], available: true }));
  });

  return { courses: courses, rooms: ROOMS.slice(), slots: slots };
}

