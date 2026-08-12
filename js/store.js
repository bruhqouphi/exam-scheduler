/* ------------------------------------------------------------------
   store.js — application data (courses, rooms, time slots, timetable)
   Persists to localStorage. No dependencies.
------------------------------------------------------------------- */

const Store = (function () {
  const KEY = 'exam-scheduler-v1';

  let state = emptyState();

  function emptyState() {
    return {
      courses: [],
      rooms: [],
      slots: [],
      timetable: [],   // [{ courseId, slotId, roomId }]
      unscheduled: [], // [{ courseId, reason }]
      stats: null,
      seq: 1
    };
  }

  function uid(prefix) {
    return prefix + '-' + (state.seq++).toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------- persistence ---------- */

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(emptyState(), parsed);
      }
    } catch (err) {
      console.warn('Could not read saved data, starting fresh.', err);
      state = emptyState();
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Could not save data.', err);
    }
  }

  function getState() {
    return state;
  }

  function replaceState(next) {
    state = Object.assign(emptyState(), next);
    save();
  }

  function clearAll() {
    state = emptyState();
    save();
  }

  /* ---------- helpers ---------- */

  // "HH:MM" -> minutes since midnight
  function toMinutes(hhmm) {
    const parts = String(hhmm || '').split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return NaN;
    return h * 60 + m;
  }

  function slotLength(slot) {
    return toMinutes(slot.end) - toMinutes(slot.start);
  }

  // Two slots clash when they are on the same date and their times intersect.
  function slotsOverlap(a, b) {
    if (a.date !== b.date) return false;
    return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
  }

  // Back-to-back: same day, one ends within `gapMinutes` of the other starting.
  function slotsAdjacent(a, b, gapMinutes) {
    if (a.date !== b.date) return false;
    if (slotsOverlap(a, b)) return false;
    const gap = toMinutes(b.start) >= toMinutes(a.end)
      ? toMinutes(b.start) - toMinutes(a.end)
      : toMinutes(a.start) - toMinutes(b.end);
    return gap <= gapMinutes;
  }

  function parseStudents(text) {
    return String(text || '')
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  // Courses may register real student IDs, or just a headcount. When only a
  // headcount is given we mint IDs private to the course so the number of
  // students is still enforced without inventing cross-course clashes.
  function studentsOf(course) {
    if (course.students && course.students.length) return course.students;
    const n = Math.max(0, parseInt(course.studentCount, 10) || 0);
    const list = [];
    for (let i = 1; i <= n; i++) list.push('~' + course.id + '#' + i);
    return list;
  }

  function headcount(course) {
    if (course.students && course.students.length) return course.students.length;
    return Math.max(0, parseInt(course.studentCount, 10) || 0);
  }

  function byId(list, id) {
    return list.find(x => x.id === id) || null;
  }

  /* ---------- courses ---------- */

  function addCourse(data) {
    const course = {
      id: uid('c'),
      code: (data.code || '').trim().toUpperCase(),
      name: (data.name || '').trim(),
      duration: Math.max(1, parseInt(data.duration, 10) || 120),
      students: parseStudents(data.studentsText),
      studentCount: Math.max(0, parseInt(data.studentCount, 10) || 0)
    };
    if (course.students.length) course.studentCount = course.students.length;
    state.courses.push(course);
    save();
    return course;
  }

  function updateCourse(id, data) {
    const course = byId(state.courses, id);
    if (!course) return null;
    if (data.code !== undefined) course.code = data.code.trim().toUpperCase();
    if (data.name !== undefined) course.name = data.name.trim();
    if (data.duration !== undefined) course.duration = Math.max(1, parseInt(data.duration, 10) || 120);
    if (data.studentsText !== undefined) course.students = parseStudents(data.studentsText);
    if (data.studentCount !== undefined) course.studentCount = Math.max(0, parseInt(data.studentCount, 10) || 0);
    if (course.students.length) course.studentCount = course.students.length;
    save();
    return course;
  }

  function removeCourse(id) {
    state.courses = state.courses.filter(c => c.id !== id);
    state.timetable = state.timetable.filter(e => e.courseId !== id);
    state.unscheduled = state.unscheduled.filter(u => u.courseId !== id);
    save();
  }

  /* ---------- rooms ---------- */

  function addRoom(data) {
    const room = {
      id: uid('r'),
      name: (data.name || '').trim(),
      capacity: Math.max(1, parseInt(data.capacity, 10) || 1),
      building: (data.building || '').trim(),
      available: data.available !== false
    };
    state.rooms.push(room);
    save();
    return room;
  }

  function updateRoom(id, data) {
    const room = byId(state.rooms, id);
    if (!room) return null;
    if (data.name !== undefined) room.name = data.name.trim();
    if (data.capacity !== undefined) room.capacity = Math.max(1, parseInt(data.capacity, 10) || 1);
    if (data.building !== undefined) room.building = data.building.trim();
    if (data.available !== undefined) room.available = !!data.available;
    save();
    return room;
  }

  function removeRoom(id) {
    state.rooms = state.rooms.filter(r => r.id !== id);
    state.timetable = state.timetable.filter(e => e.roomId !== id);
    save();
  }

  /* ---------- time slots ---------- */

  function addSlot(data) {
    const slot = {
      id: uid('s'),
      date: data.date,
      start: data.start,
      end: data.end,
      available: data.available !== false
    };
    state.slots.push(slot);
    sortSlots();
    save();
    return slot;
  }

  function updateSlot(id, data) {
    const slot = byId(state.slots, id);
    if (!slot) return null;
    if (data.date !== undefined) slot.date = data.date;
    if (data.start !== undefined) slot.start = data.start;
    if (data.end !== undefined) slot.end = data.end;
    if (data.available !== undefined) slot.available = !!data.available;
    sortSlots();
    save();
    return slot;
  }

  function removeSlot(id) {
    state.slots = state.slots.filter(s => s.id !== id);
    state.timetable = state.timetable.filter(e => e.slotId !== id);
    save();
  }

  function sortSlots() {
    state.slots.sort((a, b) =>
      a.date === b.date ? toMinutes(a.start) - toMinutes(b.start) : (a.date < b.date ? -1 : 1)
    );
  }

  /* ---------- timetable ---------- */

  function setTimetable(entries, unscheduled, stats) {
    state.timetable = entries || [];
    state.unscheduled = unscheduled || [];
    state.stats = stats || null;
    save();
  }

  function setAssignment(courseId, slotId, roomId) {
    const entry = state.timetable.find(e => e.courseId === courseId);
    if (!slotId || !roomId) {
      state.timetable = state.timetable.filter(e => e.courseId !== courseId);
    } else if (entry) {
      entry.slotId = slotId;
      entry.roomId = roomId;
    } else {
      state.timetable.push({ courseId, slotId, roomId });
    }
    save();
  }

  function clearTimetable() {
    state.timetable = [];
    state.unscheduled = [];
    state.stats = null;
    save();
  }

  return {
    load, save, getState, replaceState, clearAll,
    addCourse, updateCourse, removeCourse,
    addRoom, updateRoom, removeRoom,
    addSlot, updateSlot, removeSlot,
    setTimetable, setAssignment, clearTimetable,
    toMinutes, slotLength, slotsOverlap, slotsAdjacent,
    parseStudents, studentsOf, headcount, byId
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Store;
