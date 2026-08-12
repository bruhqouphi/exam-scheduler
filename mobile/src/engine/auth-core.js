/* ------------------------------------------------------------------
 auth-core.js — account rules shared by the web and mobile apps.

 Pure functions only: no storage, no DOM, no platform APIs. The mobile
 copy at mobile/src/engine/auth-core.js is this file with the wrapper
 swapped for ES module exports and is otherwise identical.

 SECURITY NOTE. Accounts live on the device, so this is a front door,
 not a vault. Passwords are salted and stretched rather than stored in
 the clear, which protects a reused password if someone reads the
 stored data — but anyone who can edit that storage can still forge a
 session. Real protection needs a server that holds the accounts.
------------------------------------------------------------------- */

/* ================= SHA-256 ================= */

export const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

export function rotr(x, n) {
  return (x >>> n) | (x << (32 - n));
}

// JavaScript strings are UTF-16; SHA-256 hashes bytes, so encode first.
export function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const c2 = str.charCodeAt(i + 1);
      if (c2 >= 0xdc00 && c2 <= 0xdfff) {
        const cp = ((c - 0xd800) << 10) + (c2 - 0xdc00) + 0x10000;
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f),
                 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        i++;
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

export function sha256(message) {
  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
           0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const bytes = utf8Bytes(message);
  const bitLength = bytes.length * 8;

  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);

  const high = Math.floor(bitLength / 0x100000000);
  bytes.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
  bytes.push((bitLength >>> 24) & 0xff, (bitLength >>> 16) & 0xff,
             (bitLength >>> 8) & 0xff, bitLength & 0xff);

  const w = new Array(64);

  for (let block = 0; block < bytes.length; block += 64) {
    for (let t = 0; t < 16; t++) {
      const i = block + t * 4;
      w[t] = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) | 0;
    }
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15], y = w[t - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[t] = (((w[t - 16] + s0) | 0) + ((w[t - 7] + s1) | 0)) | 0;
    }

    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (((h + S1) | 0) + ((ch + K[t]) | 0) + w[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;

      h = g; g = f; f = e;
      e = (d + t1) | 0;
      d = c; c = b; b = a;
      a = (t1 + t2) | 0;
    }

    H = [(H[0] + a) | 0, (H[1] + b) | 0, (H[2] + c) | 0, (H[3] + d) | 0,
         (H[4] + e) | 0, (H[5] + f) | 0, (H[6] + g) | 0, (H[7] + h) | 0];
  }

  let hex = '';
  for (let i = 0; i < H.length; i++) {
    hex += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
  }
  return hex;
}

/* ================= passwords ================= */

export const ROUNDS = 4000;

// Stretching makes each guess cost the attacker ~4000 hashes instead of
// one. It is far weaker than bcrypt/argon2, but it is what can be done
// without a native dependency.
export function hashPassword(password, salt, rounds) {
  const n = rounds || ROUNDS;
  let digest = sha256(salt + '|' + password);
  for (let i = 1; i < n; i++) digest = sha256(digest + salt);
  return digest;
}

export function makeSalt(random) {
  const rnd = random || Math.random;
  let salt = '';
  while (salt.length < 24) salt += Math.floor(rnd() * 0xffffffff).toString(16);
  return salt.slice(0, 24);
}

// Compares in constant time so a timing signal cannot leak the hash.
export function safeEqual(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/* ================= accounts ================= */

export function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normaliseEmail(email));
}

export const MIN_PASSWORD = 6;

// Returns an error message, or null when the details are usable.
export function validateSignUp(data, existingEmails) {
  const name = String(data.name || '').trim();
  const email = normaliseEmail(data.email);
  const password = String(data.password || '');
  const confirm = String(data.confirm === undefined ? password : data.confirm);

  if (!name) return 'Enter your full name.';
  if (name.length < 2) return 'That name looks too short.';
  if (!email) return 'Enter your email address.';
  if (!isEmail(email)) return 'That email address does not look right.';
  if ((existingEmails || []).indexOf(email) > -1) return 'An account already uses that email. Sign in instead.';
  if (!password) return 'Choose a password.';
  if (password.length < MIN_PASSWORD) return 'Use at least ' + MIN_PASSWORD + ' characters for the password.';
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}

export function validateSignIn(data) {
  if (!normaliseEmail(data.email)) return 'Enter your email address.';
  if (!String(data.password || '')) return 'Enter your password.';
  return null;
}

// Rough strength read used to colour the meter on the sign-up form.
export function passwordStrength(password) {
  const value = String(password || '');
  if (!value) return { score: 0, label: 'Empty', tone: 'off' };
  let score = 0;
  if (value.length >= MIN_PASSWORD) score++;
  if (value.length >= 10) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  if (value.length < MIN_PASSWORD) return { score: 1, label: 'Too short', tone: 'bad' };
  if (score <= 2) return { score: 2, label: 'Weak', tone: 'bad' };
  if (score === 3) return { score: 3, label: 'Fair', tone: 'warn' };
  if (score === 4) return { score: 4, label: 'Good', tone: 'ok' };
  return { score: 5, label: 'Strong', tone: 'ok' };
}

export function makeUser(data, idSeed) {
  const salt = makeSalt();
  return {
    id: 'u-' + (idSeed || Date.now().toString(36)) + Math.random().toString(36).slice(2, 6),
    name: String(data.name || '').trim(),
    email: normaliseEmail(data.email),
    salt: salt,
    hash: hashPassword(String(data.password || ''), salt),
    createdAt: new Date().toISOString()
  };
}

export function verifyPassword(user, password) {
  if (!user) return false;
  return safeEqual(user.hash, hashPassword(String(password || ''), user.salt));
}

export function findByEmail(users, email) {
  const target = normaliseEmail(email);
  return (users || []).find(u => u.email === target) || null;
}

// Never let a password hash reach the UI layer.
export function publicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

