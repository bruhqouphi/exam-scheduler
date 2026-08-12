/* ------------------------------------------------------------------
   store.js — app state for React Native.

   Same data model and the same action names as the web version; the two
   differences are that persistence goes through AsyncStorage (which is
   async, unlike localStorage) and that state is replaced immutably so
   React re-renders on every change.
------------------------------------------------------------------- */

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  makeCourse, makeRoom, makeSlot, makeComplaint,
  parseStudents, sortSlots, byId, COMPLAINT_STATUSES
} from './model.js';

const KEY = 'exam-scheduler-v1';

function emptyState() {
  return {
    courses: [],
    rooms: [],
    slots: [],
    timetable: [],   // [{ courseId, slotId, roomId }]
    unscheduled: [], // [{ courseId, reason }]
    complaints: [],
    stats: null,
    ready: false     // true once AsyncStorage has been read
  };
}

let state = emptyState();
const listeners = new Set();

/* ---------- subscription ---------- */

export function getState() {
  return state;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Every mutation goes through here: new object identity, notify, persist.
function commit(patch) {
  state = Object.assign({}, state, patch);
  listeners.forEach(l => l());
  persist();
  return state;
}

export function useStore() {
  return useSyncExternalStore(subscribe, getState);
}

/* ---------- persistence ---------- */

let saveTimer = null;

function persist() {
  if (!state.ready) return; // never overwrite saved data before it is read
  if (saveTimer) clearTimeout(saveTimer);
  // Writes are batched: typing in a form should not hit storage per keystroke.
  saveTimer = setTimeout(async () => {
    try {
      const { ready, ...rest } = state;
      await AsyncStorage.setItem(KEY, JSON.stringify(rest));
    } catch (err) {
      console.warn('Could not save data.', err);
    }
  }, 250);
}

export async function hydrate() {
  let loaded = emptyState();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      loaded = Object.assign(emptyState(), parsed);
      // Data saved before a field existed comes back without it.
      if (!Array.isArray(loaded.complaints)) loaded.complaints = [];
    }
  } catch (err) {
    console.warn('Could not read saved data, starting fresh.', err);
    loaded = emptyState();
  }
  loaded.ready = true;
  state = loaded;
  listeners.forEach(l => l());
  return state;
}

export function replaceState(next) {
  const merged = Object.assign(emptyState(), next, { ready: true });
  if (!Array.isArray(merged.complaints)) merged.complaints = [];
  commit(merged);
}

export function clearAll() {
  commit(Object.assign(emptyState(), { ready: true }));
}

/* ---------- courses ---------- */

export function addCourse(data) {
  const course = makeCourse(data);
  commit({ courses: state.courses.concat([course]) });
  return course;
}

export function updateCourse(id, data) {
  const courses = state.courses.map(c => {
    if (c.id !== id) return c;
    const next = Object.assign({}, c);
    if (data.code !== undefined) next.code = data.code.trim().toUpperCase();
    if (data.name !== undefined) next.name = data.name.trim();
    if (data.duration !== undefined) next.duration = Math.max(1, parseInt(data.duration, 10) || 120);
    if (data.studentsText !== undefined) next.students = parseStudents(data.studentsText);
    if (data.studentCount !== undefined) next.studentCount = Math.max(0, parseInt(data.studentCount, 10) || 0);
    if (next.students.length) next.studentCount = next.students.length;
    return next;
  });
  commit({ courses });
  return byId(courses, id);
}

export function removeCourse(id) {
  commit({
    courses: state.courses.filter(c => c.id !== id),
    timetable: state.timetable.filter(e => e.courseId !== id),
    unscheduled: state.unscheduled.filter(u => u.courseId !== id)
  });
}

/* ---------- rooms ---------- */

export function addRoom(data) {
  const room = makeRoom(data);
  commit({ rooms: state.rooms.concat([room]) });
  return room;
}

export function updateRoom(id, data) {
  const rooms = state.rooms.map(r => {
    if (r.id !== id) return r;
    const next = Object.assign({}, r);
    if (data.name !== undefined) next.name = data.name.trim();
    if (data.capacity !== undefined) next.capacity = Math.max(1, parseInt(data.capacity, 10) || 1);
    if (data.building !== undefined) next.building = data.building.trim();
    if (data.available !== undefined) next.available = !!data.available;
    return next;
  });
  commit({ rooms });
  return byId(rooms, id);
}

export function removeRoom(id) {
  commit({
    rooms: state.rooms.filter(r => r.id !== id),
    timetable: state.timetable.filter(e => e.roomId !== id)
  });
}

/* ---------- time slots ---------- */

export function addSlot(data) {
  const slot = makeSlot(data);
  commit({ slots: sortSlots(state.slots.concat([slot])) });
  return slot;
}

export function updateSlot(id, data) {
  const slots = state.slots.map(s => {
    if (s.id !== id) return s;
    const next = Object.assign({}, s);
    if (data.date !== undefined) next.date = data.date;
    if (data.start !== undefined) next.start = data.start;
    if (data.end !== undefined) next.end = data.end;
    if (data.available !== undefined) next.available = !!data.available;
    return next;
  });
  commit({ slots: sortSlots(slots) });
  return byId(slots, id);
}

export function removeSlot(id) {
  commit({
    slots: state.slots.filter(s => s.id !== id),
    timetable: state.timetable.filter(e => e.slotId !== id)
  });
}

export function removeAllSlots() {
  commit({ slots: [], timetable: [] });
}

/* ---------- timetable ---------- */

export function setTimetable(entries, unscheduled, stats) {
  commit({ timetable: entries || [], unscheduled: unscheduled || [], stats: stats || null });
}

export function setAssignment(courseId, slotId, roomId) {
  let timetable;
  if (!slotId || !roomId) {
    timetable = state.timetable.filter(e => e.courseId !== courseId);
  } else if (state.timetable.some(e => e.courseId === courseId)) {
    timetable = state.timetable.map(e =>
      e.courseId === courseId ? { courseId, slotId, roomId } : e);
  } else {
    timetable = state.timetable.concat([{ courseId, slotId, roomId }]);
  }
  commit({ timetable });
}

export function clearTimetable() {
  commit({ timetable: [], unscheduled: [], stats: null });
}

/* ---------- complaints ---------- */

export function addComplaint(data) {
  const complaint = makeComplaint(data);
  if (!complaint) return null; // needs a student ID and a message
  commit({ complaints: [complaint].concat(state.complaints) }); // newest first
  return complaint;
}

export function updateComplaint(id, data) {
  const complaints = state.complaints.map(c => {
    if (c.id !== id) return c;
    const next = Object.assign({}, c);
    if (data.status !== undefined && COMPLAINT_STATUSES.indexOf(data.status) > -1) {
      next.status = data.status;
    }
    if (data.response !== undefined) next.response = String(data.response).trim();
    next.updatedAt = new Date().toISOString();
    return next;
  });
  commit({ complaints });
  return byId(complaints, id);
}

export function removeComplaint(id) {
  commit({ complaints: state.complaints.filter(c => c.id !== id) });
}

export function openComplaints(s = state) {
  return s.complaints.filter(c => c.status !== 'resolved');
}

// Every course a given student ID is registered for.
export function coursesForStudent(studentId, s = state) {
  const id = String(studentId || '').trim();
  if (!id) return [];
  return s.courses.filter(c => (c.students || []).indexOf(id) > -1);
}
