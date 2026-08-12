/* ------------------------------------------------------------------
   model.js — shared data helpers.

   Pure functions only: no React, no storage, no platform APIs. These are
   the same helpers the web version keeps in js/store.js, split out so the
   CSP engine can import them directly.
------------------------------------------------------------------- */

let seq = 1;

export function uid(prefix) {
  return prefix + '-' + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------- time ---------- */

// "HH:MM" -> minutes since midnight
export function toMinutes(hhmm) {
  const parts = String(hhmm || '').split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return NaN;
  return h * 60 + m;
}

export function slotLength(slot) {
  return toMinutes(slot.end) - toMinutes(slot.start);
}

// Two slots clash when they are on the same date and their times intersect.
export function slotsOverlap(a, b) {
  if (a.date !== b.date) return false;
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

// Back-to-back: same day, one ends within `gapMinutes` of the other starting.
export function slotsAdjacent(a, b, gapMinutes) {
  if (a.date !== b.date) return false;
  if (slotsOverlap(a, b)) return false;
  const gap = toMinutes(b.start) >= toMinutes(a.end)
    ? toMinutes(b.start) - toMinutes(a.end)
    : toMinutes(a.start) - toMinutes(b.end);
  return gap <= gapMinutes;
}

/* ---------- students ---------- */

export function parseStudents(text) {
  return String(text || '')
    .split(/[\s,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Courses may register real student IDs, or just a headcount. When only a
// headcount is given we mint IDs private to the course so the number of
// students is still enforced without inventing cross-course clashes.
export function studentsOf(course) {
  if (course.students && course.students.length) return course.students;
  const n = Math.max(0, parseInt(course.studentCount, 10) || 0);
  const list = [];
  for (let i = 1; i <= n; i++) list.push('~' + course.id + '#' + i);
  return list;
}

export function headcount(course) {
  if (course.students && course.students.length) return course.students.length;
  return Math.max(0, parseInt(course.studentCount, 10) || 0);
}

export function byId(list, id) {
  return (list || []).find(x => x.id === id) || null;
}

/* ---------- record factories ---------- */

export function makeCourse(data) {
  const course = {
    id: uid('c'),
    code: (data.code || '').trim().toUpperCase(),
    name: (data.name || '').trim(),
    duration: Math.max(1, parseInt(data.duration, 10) || 120),
    students: parseStudents(data.studentsText),
    studentCount: Math.max(0, parseInt(data.studentCount, 10) || 0)
  };
  if (course.students.length) course.studentCount = course.students.length;
  return course;
}

export function makeRoom(data) {
  return {
    id: uid('r'),
    name: (data.name || '').trim(),
    capacity: Math.max(1, parseInt(data.capacity, 10) || 1),
    building: (data.building || '').trim(),
    available: data.available !== false
  };
}

export function makeSlot(data) {
  return {
    id: uid('s'),
    date: data.date,
    start: data.start,
    end: data.end,
    available: data.available !== false
  };
}

export const COMPLAINT_STATUSES = ['new', 'reviewing', 'resolved'];

export function makeComplaint(data) {
  const now = new Date().toISOString();
  const complaint = {
    id: uid('q'),
    studentId: (data.studentId || '').trim(),
    studentName: (data.studentName || '').trim(),
    courseId: data.courseId || '',
    category: data.category || 'other',
    message: (data.message || '').trim(),
    status: 'new',
    response: '',
    createdAt: now,
    updatedAt: now
  };
  if (!complaint.studentId || !complaint.message) return null;
  return complaint;
}

/* ---------- sorting ---------- */

export function compareSlots(a, b) {
  if (!a || !b) return a ? -1 : 1;
  return a.date === b.date ? toMinutes(a.start) - toMinutes(b.start) : (a.date < b.date ? -1 : 1);
}

export function sortSlots(slots) {
  return slots.slice().sort(compareSlots);
}
