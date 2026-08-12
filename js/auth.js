/* ------------------------------------------------------------------
   auth.js — accounts and the signed-in session for the web app.

   Storage only; the rules live in auth-core.js. Accounts are kept under
   their own localStorage key so exporting or clearing the timetable data
   never touches them.
------------------------------------------------------------------- */

const Auth = (function () {
  const KEY = 'exam-scheduler-auth-v1';

  let data = { users: [], sessionId: null };

  /* ---------- persistence ---------- */

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          sessionId: parsed.sessionId || null
        };
      }
    } catch (err) {
      console.warn('Could not read accounts, starting fresh.', err);
      data = { users: [], sessionId: null };
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Could not save accounts.', err);
    }
  }

  /* ---------- queries ---------- */

  function currentUser() {
    if (!data.sessionId) return null;
    const user = data.users.find(u => u.id === data.sessionId);
    return AuthCore.publicUser(user);
  }

  function isSignedIn() {
    return !!currentUser();
  }

  function userCount() {
    return data.users.length;
  }

  function emails() {
    return data.users.map(u => u.email);
  }

  /* ---------- actions ---------- */

  // Each returns { ok: true, user } or { ok: false, error }.

  function signUp(form) {
    const problem = AuthCore.validateSignUp(form, emails());
    if (problem) return { ok: false, error: problem };

    const user = AuthCore.makeUser(form);
    data.users.push(user);
    data.sessionId = user.id;
    save();
    return { ok: true, user: AuthCore.publicUser(user) };
  }

  function signIn(form) {
    const problem = AuthCore.validateSignIn(form);
    if (problem) return { ok: false, error: problem };

    const user = AuthCore.findByEmail(data.users, form.email);
    // Same message either way, so the form cannot be used to discover
    // which email addresses have accounts.
    if (!user || !AuthCore.verifyPassword(user, form.password)) {
      return { ok: false, error: 'That email and password do not match an account.' };
    }

    data.sessionId = user.id;
    save();
    return { ok: true, user: AuthCore.publicUser(user) };
  }

  function signOut() {
    data.sessionId = null;
    save();
  }

  return {
    load, save, currentUser, isSignedIn, userCount, emails,
    signUp, signIn, signOut
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Auth;
