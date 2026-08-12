/* ------------------------------------------------------------------
   ui.js — the shared building blocks every screen is made of.
   React Native has no <select> or window.prompt, so those are modals.
------------------------------------------------------------------- */

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet, Switch as RNSwitch
} from 'react-native';

import { colors, radius, space, type, shadow } from './theme';

/* ---------- containers ---------- */

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function CardHead({ title, children }) {
  return (
    <View style={s.cardHead}>
      <Text style={type.h2}>{title}</Text>
      <View style={s.headActions}>{children}</View>
    </View>
  );
}

export function Divider() {
  return <View style={s.divider} />;
}

export function Note({ children }) {
  return <Text style={s.note}>{children}</Text>;
}

export function EmptyState({ children }) {
  return <Text style={s.empty}>{children}</Text>;
}

export function Row({ children, style }) {
  return <View style={[s.row, style]}>{children}</View>;
}

/* ---------- buttons ---------- */

export function Btn({ title, onPress, variant = 'primary', size = 'md', disabled, style }) {
  const tone = {
    primary: { bg: colors.accent, fg: '#fff', border: colors.accent },
    soft: { bg: colors.accentSoft, fg: colors.accent, border: colors.accentSoft },
    ghost: { bg: '#fff', fg: colors.text, border: colors.line },
    danger: { bg: '#fff', fg: colors.danger, border: colors.line }
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        size === 'sm' && s.btnSm,
        { backgroundColor: tone.bg, borderColor: tone.border },
        (pressed || disabled) && { opacity: 0.6 },
        style
      ]}
    >
      <Text style={[s.btnText, size === 'sm' && { fontSize: 12.5 }, { color: tone.fg }]}>
        {title}
      </Text>
    </Pressable>
  );
}

// Borderless text action, used inside list rows.
export function LinkBtn({ title, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.linkBtn, pressed && { opacity: 0.5 }]}>
      <Text style={[s.linkText, danger && { color: colors.danger }]}>{title}</Text>
    </Pressable>
  );
}

/* ---------- indicators ---------- */

export function Tag({ text, tone = 'off' }) {
  const map = {
    ok: [colors.okSoft, colors.ok],
    warn: [colors.warnSoft, colors.warn],
    bad: [colors.dangerSoft, colors.danger],
    off: ['#f0f1f5', colors.muted],
    accent: [colors.accentSoft, colors.accent]
  }[tone];
  return (
    <View style={[s.tag, { backgroundColor: map[0] }]}>
      <Text style={[s.tagText, { color: map[1] }]}>{text}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Message({ text, tone = 'ok' }) {
  const map = {
    ok: [colors.okSoft, colors.ok],
    warn: [colors.warnSoft, colors.warn],
    bad: [colors.dangerSoft, colors.danger]
  }[tone];
  return (
    <View style={[s.message, { backgroundColor: map[0] }]}>
      <Text style={{ color: map[1], fontSize: 13.5, fontWeight: '500' }}>{text}</Text>
    </View>
  );
}

export function Issue({ severity, kind, text }) {
  const bad = severity === 'error';
  return (
    <View style={[s.issue, {
      backgroundColor: bad ? colors.dangerSoft : colors.warnSoft,
      borderColor: bad ? '#f3c9cf' : '#f0dcbb'
    }]}>
      <View style={[s.dot, { backgroundColor: bad ? colors.danger : colors.warn }]} />
      <View style={{ flex: 1 }}>
        {kind ? <Text style={s.issueKind}>{kind.toUpperCase()}</Text> : null}
        <Text style={{ fontSize: 13.5, color: colors.text }}>{text}</Text>
      </View>
    </View>
  );
}

export function StatTile({ label, value, tone }) {
  const fg = tone === 'good' ? colors.ok : tone === 'bad' ? colors.danger : colors.text;
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, { color: fg }]}>{String(value)}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

/* ---------- form fields ---------- */

export function Field({ label, hint, style, ...props }) {
  return (
    <View style={[{ marginBottom: space.md }, style]}>
      {label ? (
        <Text style={s.fieldLabel}>
          {label}
          {hint ? <Text style={s.fieldHint}>  {hint}</Text> : null}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[s.input, props.multiline && { minHeight: 84, textAlignVertical: 'top' }]}
        {...props}
      />
    </View>
  );
}

export function SwitchRow({ label, value, onValueChange }) {
  return (
    <View style={s.switchRow}>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: '#cfd3de' }}
        thumbColor="#fff"
      />
    </View>
  );
}

// Replacement for <select>: a tappable row that opens a modal list.
export function Select({ label, value, options, onChange, placeholder = 'Choose…', compact }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);

  return (
    <View style={compact ? null : { marginBottom: space.md }}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={[s.input, s.selectBox, compact && s.selectCompact]}>
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: current ? colors.text : colors.muted, fontSize: compact ? 12.5 : 14.5 }}
        >
          {current ? current.label : placeholder}
        </Text>
        <Text style={{ color: colors.muted, marginLeft: 6 }}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={[type.h3, { marginBottom: space.sm }]}>{label || 'Select'}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {options.map(o => (
                <Pressable
                  key={String(o.value)}
                  onPress={() => { onChange(o.value); setOpen(false); }}
                  style={[s.option, o.value === value && { backgroundColor: colors.accentSoft }]}
                >
                  <Text style={{
                    color: o.value === value ? colors.accent : colors.text,
                    fontWeight: o.value === value ? '600' : '400'
                  }}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Btn title="Cancel" variant="ghost" onPress={() => setOpen(false)} style={{ marginTop: space.sm }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// Replacement for window.prompt (Alert.prompt is iOS-only).
export function PromptModal({ visible, title, label, initialValue = '', multiline, onCancel, onSubmit }) {
  const [text, setText] = useState(initialValue);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      onShow={() => setText(initialValue)}
    >
      <Pressable style={s.backdrop} onPress={onCancel}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={[type.h3, { marginBottom: space.sm }]}>{title}</Text>
          <Field label={label} value={text} onChangeText={setText} multiline={multiline} autoFocus />
          <Row>
            <Btn title="Cancel" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
            <Btn title="Save" onPress={() => onSubmit(text)} style={{ flex: 1 }} />
          </Row>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Numeric setting with −/+ steppers, standing in for <input type="range">.
export function Stepper({ label, value, onChange, step = 1, min = 0, max = 100, format }) {
  const clamp = v => Math.min(max, Math.max(min, v));
  return (
    <View style={s.stepper}>
      <Text style={[s.fieldLabel, { flex: 1, marginBottom: 0 }]}>{label}</Text>
      <Pressable onPress={() => onChange(clamp(value - step))} style={s.stepBtn}>
        <Text style={s.stepBtnText}>−</Text>
      </Pressable>
      <Text style={s.stepValue}>{format ? format(value) : value}</Text>
      <Pressable onPress={() => onChange(clamp(value + step))} style={s.stepBtn}>
        <Text style={s.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

/* ---------- list rows ---------- */

export function ListRow({ title, subtitle, right, children, tone }) {
  return (
    <View style={[s.listRow, tone === 'bad' && { backgroundColor: colors.dangerSoft }]}>
      <View style={s.listRowTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.listTitle}>{title}</Text>
          {subtitle ? <Text style={s.listSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    marginBottom: space.md,
    ...shadow
  },
  cardHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: space.sm, marginBottom: space.md
  },
  headActions: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space.lg },
  note: { fontSize: 12.5, color: colors.muted, marginBottom: space.md, lineHeight: 18 },
  empty: { textAlign: 'center', color: colors.muted, fontSize: 13.5, paddingVertical: space.xl },
  row: { flexDirection: 'row', gap: space.sm },

  btn: {
    borderRadius: radius.md, borderWidth: 1,
    paddingVertical: 11, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center'
  },
  btnSm: { paddingVertical: 7, paddingHorizontal: 11 },
  btnText: { fontSize: 14, fontWeight: '600' },
  linkBtn: { paddingVertical: 5, paddingHorizontal: 7 },
  linkText: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  tag: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 11.5, fontWeight: '700' },
  chip: {
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line,
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 7
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.muted },

  message: { borderRadius: radius.md, padding: 12, marginBottom: space.md },
  issue: {
    flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: radius.md,
    padding: 12, marginBottom: space.sm
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  issueKind: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5, color: colors.muted, marginBottom: 2 },

  stat: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.tint, padding: 12, flexGrow: 1, flexBasis: '30%', minWidth: 96
  },
  statValue: { fontSize: 21, fontWeight: '600' },
  statLabel: { fontSize: 11.5, color: colors.muted },

  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: colors.muted, marginBottom: 5 },
  fieldHint: { fontWeight: '400', fontSize: 12 },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14.5, color: colors.text, backgroundColor: '#fff'
  },
  selectBox: { flexDirection: 'row', alignItems: 'center' },
  selectCompact: { paddingVertical: 7, paddingHorizontal: 9 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md, gap: space.sm },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(20,26,48,0.45)',
    justifyContent: 'center', padding: space.xl
  },
  sheet: { backgroundColor: '#fff', borderRadius: radius.lg, padding: space.lg },
  option: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.sm },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  stepBtn: {
    width: 34, height: 34, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff'
  },
  stepBtnText: { fontSize: 18, color: colors.accent, fontWeight: '600', lineHeight: 21 },
  stepValue: { minWidth: 44, textAlign: 'center', fontWeight: '600', color: colors.accent, fontSize: 13.5 },

  listRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: space.md },
  listRowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  listTitle: { fontSize: 14.5, fontWeight: '600', color: colors.text },
  listSub: { fontSize: 12.5, color: colors.muted, marginTop: 1 }
});
