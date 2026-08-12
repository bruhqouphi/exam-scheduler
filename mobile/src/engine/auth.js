/* ------------------------------------------------------------------
   auth.js — accounts and the signed-in session for the mobile app.

   Storage only; the rules live in auth-core.js. Accounts sit under their
   own AsyncStorage key so clearing or importing timetable data never
   touches them.
------------------------------------------------------------------- */

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  validateSignUp, validateSignIn, makeUser, verifyPassword,
  findByEmail, publicUser
} from './auth-core.js';

const KEY = 'exam-scheduler-auth-v1';

function emptyAuth() {
  return { users: [], sessionId: null, ready: false };
}

let state = emptyAuth();
const listeners = new Set();

/* ---------- subscription ---------- */

export function getAuth() {
  return state;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(patch) {
  state = Object.assign({}, state, patch);
  listeners.forEach(l => l());
  persist();
  return state;
}

export function useAuth() {
  return useSyncExternalStore(subscribe, getAuth);
}

/* ---------- persistence ---------- */

async function persist() {
  if (!state.ready) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({
      users: state.users,
      sessionId: state.sessionId
    }));
  } catch (err) {
    console.warn('Could not save accounts.', err);
  }
}

export async function hydrateAuth() {
  let loaded = emptyAuth();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      loaded.users = Array.isArray(parsed.users) ? parsed.users : [];
      loaded.sessionId = parsed.sessionId || null;
    }
  } catch (err) {
    console.warn('Could not read accounts, starting fresh.', err);
    loaded = emptyAuth();
  }
  loaded.ready = true;
  state = loaded;
  listeners.forEach(l => l());
  return state;
}

/* ---------- queries ---------- */

export function currentUser(s = state) {
  if (!s.sessionId) return null;
  return publicUser(s.users.find(u => u.id === s.sessionId));
}

export function isSignedIn(s = state) {
  return !!currentUser(s);
}

export function userCount(s = state) {
  return s.users.length;
}

/* ---------- actions ---------- */

// Each returns { ok: true, user } or { ok: false, error }.

export function signUp(form) {
  const problem = validateSignUp(form, state.users.map(u => u.email));
  if (problem) return { ok: false, error: problem };

  const user = makeUser(form);
  commit({ users: state.users.concat([user]), sessionId: user.id });
  return { ok: true, user: publicUser(user) };
}

export function signIn(form) {
  const problem = validateSignIn(form);
  if (problem) return { ok: false, error: problem };

  const user = findByEmail(state.users, form.email);
  // Same message either way, so the form cannot be used to discover which
  // email addresses have accounts.
  if (!user || !verifyPassword(user, form.password)) {
    return { ok: false, error: 'That email and password do not match an account.' };
  }

  commit({ sessionId: user.id });
  return { ok: true, user: publicUser(user) };
}

export function signOut() {
  commit({ sessionId: null });
}
