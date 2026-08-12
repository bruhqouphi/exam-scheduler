/* ------------------------------------------------------------------
   theme.js — design tokens.

   One indigo accent, a warm-neutral grey ramp, and three status hues
   (green / amber / red) that carry the same meaning everywhere:
   green = fine, amber = worth a look, red = must be fixed.
------------------------------------------------------------------- */

export const colors = {
  // surfaces
  bg: '#f4f6fb',
  bgDeep: '#eceff7',
  surface: '#ffffff',
  tint: '#f9fafd',
  line: '#e3e7f0',
  lineSoft: '#eef1f7',

  // ink
  text: '#171d2e',
  textSoft: '#454d63',
  muted: '#727a90',
  faint: '#a3aabc',

  // accent
  accent: '#4055d4',
  accentDeep: '#2f3fa8',
  accentSoft: '#eaeeff',
  accentLine: '#c9d2fb',

  // status
  ok: '#0f7a51',
  okSoft: '#e4f5ed',
  okLine: '#b6e2cf',
  warn: '#9a5a00',
  warnSoft: '#fdf2e0',
  warnLine: '#f0d7a8',
  danger: '#bb2438',
  dangerSoft: '#fdebee',
  dangerLine: '#f4c4cc',

  white: '#ffffff'
};

export const radius = { xs: 6, sm: 9, md: 12, lg: 16, xl: 22, pill: 999 };

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 30 };

export const type = {
  display: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.6 },
  h1: { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  h2: { fontSize: 15.5, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  h3: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  body: { fontSize: 14.5, color: colors.text, lineHeight: 21 },
  bodySoft: { fontSize: 14, color: colors.textSoft, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.2 },
  sub: { fontSize: 12.5, color: colors.muted, lineHeight: 18 },
  tiny: { fontSize: 11, color: colors.muted },
  overline: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: colors.muted },
  mono: { fontVariant: ['tabular-nums'] }
};

// Three elevation steps. Anything higher reads as clutter on a phone.
export const elevation = {
  flat: {},
  low: {
    shadowColor: '#0f1734',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  mid: {
    shadowColor: '#0f1734',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4
  },
  high: {
    shadowColor: '#0f1734',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12
  }
};

// tone -> [background, foreground, border]
export const tones = {
  ok: [colors.okSoft, colors.ok, colors.okLine],
  warn: [colors.warnSoft, colors.warn, colors.warnLine],
  bad: [colors.dangerSoft, colors.danger, colors.dangerLine],
  accent: [colors.accentSoft, colors.accent, colors.accentLine],
  off: ['#eef0f5', colors.muted, colors.line]
};
