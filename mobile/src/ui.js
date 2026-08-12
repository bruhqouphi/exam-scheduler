/* ------------------------------------------------------------------
   ui.js — the shared building blocks every screen is made of.

   React Native has no <select>, window.prompt or <input type="range">,
   so those become a modal picker, a prompt modal and a stepper.
   Everything tappable gives physical feedback via PressScale.
------------------------------------------------------------------- */

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet,
  Animated, Switch as RNSwitch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type, elevation, tones } from './theme';
import { PressScale, FadeIn, useSheetAnimation, CountUp, Pop } from './anim';

/* ---------- containers ---------- */

export function Card({ children, style, padded = true }) {
  return <View style={[s.card, padded && { padding: space.lg }, style]}>{children}</View>;
}

export function CardHead({ title, icon, children, subtitle }) {
  return (
    <View style={s.cardHead}>
      {icon ? (
        <View style={s.cardHeadIcon}>
          <Ionicons name={icon} size={15} color={colors.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={type.h2}>{title}</Text>
        {subtitle ? <Text style={type.sub}>{subtitle}</Text> : null}
      </View>
      {children ? <View style={s.headActions}>{children}</View> : null}
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[s.divider, style]} />;
}

export function Note({ children, icon }) {
  return (
    <View style={s.note}>
      {icon ? <Ionicons name={icon} size={13} color={colors.faint} style={{ marginTop: 2 }} /> : null}
      <Text style={[type.sub, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ children, icon = 'file-tray-outline' }) {
  return (
    <FadeIn style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.faint} />
      </View>
      <Text style={[type.sub, { textAlign: 'center' }]}>{children}</Text>
    </FadeIn>
  );
}

export function Row({ children, style }) {
  return <View style={[s.row, style]}>{children}</View>;
}

// Small all-caps heading used to break a long screen into sections.
export function Overline({ children }) {
  return <Text style={[type.overline, { marginBottom: space.sm }]}>{String(children).toUpperCase()}</Text>;
}

/* ---------- buttons ---------- */

export function Btn({
  title, onPress, variant = 'primary', size = 'md', icon, disabled, style, full
}) {
  const tone = {
    primary: { bg: colors.accent, fg: colors.white, border: colors.accent, shadow: elevation.low },
    soft: { bg: colors.accentSoft, fg: colors.accent, border: colors.accentSoft, shadow: elevation.flat },
    ghost: { bg: colors.white, fg: colors.textSoft, border: colors.line, shadow: elevation.flat },
    danger: { bg: colors.white, fg: colors.danger, border: colors.dangerLine, shadow: elevation.flat }
  }[variant];

  const small = size === 'sm';

  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.96}
      style={[
        s.btn,
        small && s.btnSm,
        tone.shadow,
        { backgroundColor: tone.bg, borderColor: tone.border },
        disabled && { opacity: 0.45 },
        full && { width: '100%' },
        style
      ]}
    >
      <View style={s.btnInner}>
        {icon ? (
          <Ionicons name={icon} size={small ? 13 : 15} color={tone.fg} style={{ marginRight: 6 }} />
        ) : null}
        <Text style={[s.btnText, small && { fontSize: 12.5 }, { color: tone.fg }]}>{title}</Text>
      </View>
    </PressScale>
  );
}

// Borderless text action, used inside list rows.
export function LinkBtn({ title, onPress, danger, icon }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [s.linkBtn, pressed && { opacity: 0.45 }]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={13}
          color={danger ? colors.danger : colors.accent}
          style={{ marginRight: 4 }}
        />
      ) : null}
      <Text style={[s.linkText, danger && { color: colors.danger }]}>{title}</Text>
    </Pressable>
  );
}

// Circular icon-only button for headers.
export function IconBtn({ icon, onPress, tone = 'soft' }) {
  const [bg, fg] = tone === 'soft' ? [colors.accentSoft, colors.accent] : [colors.white, colors.muted];
  return (
    <PressScale onPress={onPress} scaleTo={0.9} style={[s.iconBtn, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={17} color={fg} />
    </PressScale>
  );
}

/* ---------- indicators ---------- */

export function Tag({ text, tone = 'off', icon }) {
  const [bg, fg] = tones[tone] || tones.off;
  return (
    <View style={[s.tag, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={10} color={fg} style={{ marginRight: 3 }} /> : null}
      <Text style={[s.tagText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress, count }) {
  return (
    <PressScale onPress={onPress} scaleTo={0.94} style={[s.chip, active && s.chipActive]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[s.chipText, active && { color: colors.white }]}>{label}</Text>
        {count !== undefined ? (
          <Text style={[s.chipCount, active && { color: colors.white, opacity: 0.85 }]}>{count}</Text>
        ) : null}
      </View>
    </PressScale>
  );
}

export function Message({ text, tone = 'ok', icon }) {
  const [bg, fg, border] = tones[tone] || tones.ok;
  const fallback = { ok: 'checkmark-circle', warn: 'alert-circle', bad: 'close-circle' }[tone];
  return (
    <FadeIn>
      <View style={[s.message, { backgroundColor: bg, borderColor: border }]}>
        <Ionicons name={icon || fallback} size={16} color={fg} style={{ marginTop: 1 }} />
        <Text style={{ color: fg, fontSize: 13.5, fontWeight: '600', flex: 1, lineHeight: 19 }}>
          {text}
        </Text>
      </View>
    </FadeIn>
  );
}

export function Issue({ severity, kind, text }) {
  const bad = severity === 'error';
  const [bg, fg, border] = bad ? tones.bad : tones.warn;
  return (
    <View style={[s.issue, { backgroundColor: bg, borderColor: border }]}>
      <View style={[s.issueBar, { backgroundColor: fg }]} />
      <View style={{ flex: 1 }}>
        {kind ? <Text style={[type.overline, { color: fg, marginBottom: 2 }]}>{kind}</Text> : null}
        <Text style={{ fontSize: 13.5, color: colors.text, lineHeight: 19 }}>{text}</Text>
      </View>
    </View>
  );
}

// Statistic tile. Numeric values count up so a fresh solve feels alive.
export function StatTile({ label, value, tone, icon, delay = 0 }) {
  const accentFg = tone === 'good' ? colors.ok : tone === 'bad' ? colors.danger : colors.accent;
  const numeric = typeof value === 'number' && isFinite(value);

  return (
    <FadeIn delay={delay} from={14} style={s.stat}>
      <View style={s.statTop}>
        {icon ? <Ionicons name={icon} size={13} color={accentFg} /> : null}
        <Text style={[type.tiny, { flex: 1 }]} numberOfLines={1}>{label}</Text>
      </View>
      {numeric ? (
        <CountUp value={value} style={[s.statValue, { color: accentFg }]} />
      ) : (
        <Text style={[s.statValue, { color: accentFg }]}>{String(value)}</Text>
      )}
    </FadeIn>
  );
}

// Horizontal proportion bar — used for room fill.
export function Meter({ value, max, tone = 'accent' }) {
  const [, fg] = tones[tone] || tones.accent;
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View style={s.meterTrack}>
      <View style={[s.meterFill, { width: pct + '%', backgroundColor: fg }]} />
    </View>
  );
}

/* ---------- form fields ---------- */

export function Field({ label, hint, style, error, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: space.md }, style]}>
      {label ? (
        <Text style={s.fieldLabel}>
          {label}
          {hint ? <Text style={s.fieldHint}>  {hint}</Text> : null}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.faint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          s.input,
          props.multiline && { minHeight: 88, paddingTop: 11, textAlignVertical: 'top' },
          focused && s.inputFocused,
          error && { borderColor: colors.dangerLine, backgroundColor: colors.dangerSoft }
        ]}
        {...props}
      />
    </View>
  );
}

export function SwitchRow({ label, value, onValueChange, icon }) {
  return (
    <Pressable onPress={() => onValueChange(!value)} style={s.switchRow}>
      {icon ? <Ionicons name={icon} size={16} color={colors.muted} /> : null}
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: '#cdd2e0' }}
        thumbColor={colors.white}
      />
    </Pressable>
  );
}

// Replacement for <select>: a tappable row that opens a modal list.
export function Select({ label, value, options, onChange, placeholder = 'Choose…', compact, icon }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  const anim = useSheetAnimation(open);

  return (
    <View style={compact ? null : { marginBottom: space.md }}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <PressScale
        onPress={() => setOpen(true)}
        scaleTo={0.985}
        style={[s.input, s.selectBox, compact && s.selectCompact]}
      >
        {icon ? <Ionicons name={icon} size={14} color={colors.muted} style={{ marginRight: 6 }} /> : null}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: current ? colors.text : colors.faint,
            fontSize: compact ? 12.5 : 14.5
          }}
        >
          {current ? current.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={compact ? 12 : 14} color={colors.muted} />
      </PressScale>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)}>
          <Animated.View style={[s.backdrop, anim.backdrop]}>
            <Animated.View style={[s.sheet, anim.sheet]}>
              <Pressable onPress={() => {}}>
                <View style={s.sheetHandle} />
                <Text style={[type.h2, { marginBottom: space.md }]}>{label || 'Select'}</Text>
                <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                  {options.map(o => {
                    const selected = o.value === value;
                    return (
                      <Pressable
                        key={String(o.value)}
                        onPress={() => { onChange(o.value); setOpen(false); }}
                        style={({ pressed }) => [
                          s.option,
                          selected && { backgroundColor: colors.accentSoft },
                          pressed && !selected && { backgroundColor: colors.tint }
                        ]}
                      >
                        <Text
                          style={{
                            flex: 1,
                            color: selected ? colors.accent : colors.text,
                            fontWeight: selected ? '700' : '400',
                            fontSize: 14
                          }}
                        >
                          {o.label}
                        </Text>
                        {selected ? <Ionicons name="checkmark" size={16} color={colors.accent} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Btn
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setOpen(false)}
                  style={{ marginTop: space.md }}
                />
              </Pressable>
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

// Replacement for window.prompt (Alert.prompt is iOS-only).
export function PromptModal({ visible, title, label, initialValue = '', multiline, onCancel, onSubmit }) {
  const [text, setText] = useState(initialValue);
  const anim = useSheetAnimation(visible);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      onShow={() => setText(initialValue)}
    >
      <Pressable style={{ flex: 1 }} onPress={onCancel}>
        <Animated.View style={[s.backdrop, anim.backdrop]}>
          <Animated.View style={[s.sheet, anim.sheet]}>
            <Pressable onPress={() => {}}>
              <View style={s.sheetHandle} />
              <Text style={[type.h2, { marginBottom: space.md }]}>{title}</Text>
              <Field
                label={label}
                value={text}
                onChangeText={setText}
                multiline={multiline}
                autoFocus
              />
              <Row>
                <Btn title="Cancel" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
                <Btn title="Save" icon="checkmark" onPress={() => onSubmit(text)} style={{ flex: 1 }} />
              </Row>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// Numeric setting with −/+ steppers, standing in for <input type="range">.
export function Stepper({ label, value, onChange, step = 1, min = 0, max = 100, hint }) {
  const clamp = v => Math.min(max, Math.max(min, v));
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <View style={{ marginBottom: space.md }}>
      <View style={s.stepperTop}>
        <View style={{ flex: 1 }}>
          <Text style={type.label}>{label}</Text>
          {hint ? <Text style={type.tiny}>{hint}</Text> : null}
        </View>
        <PressScale onPress={() => onChange(clamp(value - step))} scaleTo={0.86} style={s.stepBtn}>
          <Ionicons name="remove" size={16} color={colors.accent} />
        </PressScale>
        <Pop value={value} style={s.stepValueWrap}>
          <Text style={s.stepValue}>{value}</Text>
        </Pop>
        <PressScale onPress={() => onChange(clamp(value + step))} scaleTo={0.86} style={s.stepBtn}>
          <Ionicons name="add" size={16} color={colors.accent} />
        </PressScale>
      </View>
      <View style={s.meterTrack}>
        <View style={[s.meterFill, { width: pct + '%', backgroundColor: colors.accentLine }]} />
      </View>
    </View>
  );
}

/* ---------- list rows ---------- */

// One record in a list. `accent` paints a status stripe down the left,
// which is what lets a long list be scanned without reading it.
export function ListRow({ title, subtitle, right, children, accent, first }) {
  const stripe = accent ? (tones[accent] || tones.off)[1] : null;
  return (
    <View style={[s.listRow, first && { borderTopWidth: 0 }]}>
      {stripe ? <View style={[s.listStripe, { backgroundColor: stripe }]} /> : null}
      <View style={{ flex: 1 }}>
        <View style={s.listRowTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.listTitle}>{title}</Text>
            {subtitle ? <Text style={s.listSub}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
        {children}
      </View>
    </View>
  );
}

export const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    marginBottom: space.md,
    ...elevation.low
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  cardHeadIcon: {
    width: 28, height: 28, borderRadius: radius.sm,
    backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center'
  },
  headActions: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.lineSoft, marginVertical: space.lg },
  note: { flexDirection: 'row', gap: 6, marginBottom: space.md },
  empty: { alignItems: 'center', paddingVertical: space.xl, gap: space.sm },
  emptyIcon: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.bgDeep,
    alignItems: 'center', justifyContent: 'center'
  },
  row: { flexDirection: 'row', gap: space.sm },

  btn: {
    borderRadius: radius.md, borderWidth: 1,
    paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center'
  },
  btnSm: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 7 },
  linkText: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  tag: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3.5
  },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.1 },
  chip: {
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.white, paddingHorizontal: 13, paddingVertical: 7
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12.5, fontWeight: '700', color: colors.muted },
  chipCount: { fontSize: 11, fontWeight: '800', color: colors.faint, marginLeft: 5 },

  message: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    borderRadius: radius.md, borderWidth: 1, padding: 12, marginBottom: space.md
  },
  issue: {
    flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: radius.md,
    padding: 12, paddingLeft: 10, marginBottom: space.sm, overflow: 'hidden'
  },
  issueBar: { width: 3, borderRadius: 2, alignSelf: 'stretch' },

  stat: {
    borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.md,
    backgroundColor: colors.tint, padding: 11, flexGrow: 1, flexBasis: '29%', minWidth: 96
  },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  statValue: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },

  meterTrack: {
    height: 5, borderRadius: 3, backgroundColor: colors.bgDeep, overflow: 'hidden', marginTop: 4
  },
  meterFill: { height: '100%', borderRadius: 3 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 6, letterSpacing: 0.1 },
  fieldHint: { fontWeight: '500', fontSize: 11.5, color: colors.faint },
  input: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14.5, color: colors.text, backgroundColor: colors.white
  },
  inputFocused: { borderColor: colors.accent, backgroundColor: colors.white },
  selectBox: { flexDirection: 'row', alignItems: 'center' },
  selectCompact: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.xs },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    marginBottom: space.md, paddingVertical: 2
  },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(13,18,38,0.5)',
    justifyContent: 'center', padding: space.lg
  },
  sheet: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: space.lg, ...elevation.high
  },
  sheetHandle: {
    width: 34, height: 4, borderRadius: 2, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: space.md
  },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.sm
  },

  stepperTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 30, height: 30, borderRadius: radius.xs, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white
  },
  stepValueWrap: { minWidth: 34, alignItems: 'center' },
  stepValue: { fontWeight: '800', color: colors.accent, fontSize: 14, fontVariant: ['tabular-nums'] },

  listRow: {
    flexDirection: 'row', gap: space.sm,
    borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingVertical: space.md
  },
  listStripe: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  listRowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  listTitle: { fontSize: 14.5, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  listSub: { fontSize: 12.5, color: colors.muted, marginTop: 1 }
});
