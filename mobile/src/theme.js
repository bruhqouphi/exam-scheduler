/* Design tokens — the same light palette as the web version's CSS. */

export const colors = {
  bg: '#f6f7fb',
  surface: '#ffffff',
  line: '#e4e7ee',
  text: '#1c2333',
  muted: '#6b7385',
  accent: '#3f5bd9',
  accentSoft: '#eef1fd',
  ok: '#14875a',
  okSoft: '#e7f6ef',
  warn: '#a86500',
  warnSoft: '#fdf3e2',
  danger: '#c02b3f',
  dangerSoft: '#fdecee',
  tint: '#fafbff'
};

export const radius = { sm: 8, md: 10, lg: 12, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22 };

export const type = {
  h1: { fontSize: 18, fontWeight: '600', color: colors.text },
  h2: { fontSize: 16, fontWeight: '600', color: colors.text },
  h3: { fontSize: 14, fontWeight: '600', color: colors.text },
  body: { fontSize: 14.5, color: colors.text },
  label: { fontSize: 12.5, fontWeight: '600', color: colors.muted },
  sub: { fontSize: 12.5, color: colors.muted },
  mono: { fontVariant: ['tabular-nums'] }
};

export const shadow = {
  shadowColor: '#141a30',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2
};
