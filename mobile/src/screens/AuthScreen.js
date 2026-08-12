/* ------------------------------------------------------------------
   AuthScreen.js — sign in and create account.

   Laid out as an accent cover with the form card lifted over it, so the
   screen has a foreground and a background instead of one flat panel.

   Password hashing is deliberately slow (4000 SHA-256 rounds), so submit
   runs after a frame with a spinner rather than freezing the tap.
------------------------------------------------------------------- */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform,
  Animated, ActivityIndicator, Pressable, useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as Auth from '../engine/auth';
import { passwordStrength, MIN_PASSWORD } from '../engine/auth-core.js';
import { colors, space, type, radius, elevation, tones } from '../theme';
import { Btn } from '../ui';
import { FadeIn, PressScale, EASE, DUR } from '../anim';

const BLANK_IN = { email: '', password: '' };
const BLANK_UP = { name: '', email: '', password: '', confirm: '' };

export default function AuthScreen({ startMode }) {
  const [mode, setMode] = useState(startMode || 'signin');
  const [signin, setSignin] = useState(BLANK_IN);
  const [signup, setSignup] = useState(BLANK_UP);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { height } = useWindowDimensions();
  const compact = height < 700;
  const shake = useRef(new Animated.Value(0)).current;

  // Nudge the card sideways when credentials are rejected.
  useEffect(() => {
    if (!error) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.5, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 70, easing: EASE, useNativeDriver: true })
    ]).start();
  }, [error, shake]);

  function switchTo(next) {
    if (next === mode) return;
    setMode(next);
    setError(null);
  }

  // Let the spinner paint before the stretched hash blocks the thread.
  function run(action) {
    setBusy(true);
    setError(null);
    setTimeout(() => {
      const result = action();
      if (!result.ok) setError(result.error);
      setBusy(false);
    }, 30);
  }

  const submitSignIn = () => run(() => Auth.signIn(signin));
  const submitSignUp = () => run(() => Auth.signUp(signup));

  const isSignIn = mode === 'signin';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* accent cover sits behind everything and scrolls away with the form */}
      <View style={[styles.cover, compact && { height: 210 }]}>
        <View style={styles.blobOne} />
        <View style={styles.blobTwo} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn from={16} duration={DUR.slow}>
            <View style={[styles.brand, compact && { paddingTop: space.lg }]}>
              <View style={styles.mark}>
                <Ionicons name="calendar" size={22} color={colors.accent} />
              </View>
              <Text style={styles.title}>Automated Exam{'\n'}Timetable Scheduler</Text>
              <Text style={styles.tagline}>
                Clash-free exam timetables, generated in one tap.
              </Text>
            </View>
          </FadeIn>

          <FadeIn delay={80} from={20}>
            <Animated.View
              style={[
                styles.card,
                { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) }] }
              ]}
            >
              <Segmented mode={mode} onChange={switchTo} />

              <View style={styles.formHead}>
                <Text style={styles.formTitle}>
                  {isSignIn ? 'Welcome back' : 'Create your account'}
                </Text>
                <Text style={styles.formSub}>
                  {isSignIn
                    ? 'Sign in to reach your timetable.'
                    : 'It takes a moment and stays on this phone.'}
                </Text>
              </View>

              {isSignIn ? (
                <SignInForm
                  key="signin"
                  value={signin}
                  onChange={setSignin}
                  onSubmit={submitSignIn}
                  error={error}
                  busy={busy}
                  onSwitch={() => switchTo('signup')}
                />
              ) : (
                <SignUpForm
                  key="signup"
                  value={signup}
                  onChange={setSignup}
                  onSubmit={submitSignUp}
                  error={error}
                  busy={busy}
                  onSwitch={() => switchTo('signin')}
                />
              )}
            </Animated.View>
          </FadeIn>

          <FadeIn delay={200}>
            <View style={styles.note}>
              <Ionicons name="lock-closed" size={12} color={colors.faint} />
              <Text style={styles.noteText}>
                Accounts are stored on this phone only. Passwords are salted and hashed, but
                this guards against casual access rather than acting as real security.
              </Text>
            </View>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ================= forms ================= */

function SignInForm({ value, onChange, onSubmit, error, busy, onSwitch }) {
  const set = (k, v) => onChange(f => ({ ...f, [k]: v }));
  return (
    <FadeIn from={8} duration={DUR.base}>
      <View>
        <AuthField
          icon="mail-outline" label="Email address" value={value.email}
          onChangeText={v => set('email', v)}
          placeholder="you@st.knust.edu.gh"
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          textContentType="username" delay={0}
        />
        <AuthField
          icon="key-outline" label="Password" value={value.password}
          onChangeText={v => set('password', v)}
          placeholder="Your password" secure
          autoCapitalize="none" textContentType="password"
          onSubmitEditing={onSubmit} returnKeyType="go" delay={60}
        />
        {error ? <ErrorBox text={error} /> : null}
        <SubmitBtn title="Sign in" icon="arrow-forward" busy={busy} onPress={onSubmit} />
        <Alt text="New here?" action="Create an account" onPress={onSwitch} />
      </View>
    </FadeIn>
  );
}

function SignUpForm({ value, onChange, onSubmit, error, busy, onSwitch }) {
  const set = (k, v) => onChange(f => ({ ...f, [k]: v }));
  const strength = value.password ? passwordStrength(value.password) : null;
  const matches = value.confirm.length > 0 && value.confirm === value.password;

  return (
    <FadeIn from={8} duration={DUR.base}>
      <View>
        <AuthField
          icon="person-outline" label="Full name" value={value.name}
          onChangeText={v => set('name', v)}
          placeholder="Joshua Kissi" autoCapitalize="words"
          textContentType="name" delay={0}
        />
        <AuthField
          icon="mail-outline" label="Email address" value={value.email}
          onChangeText={v => set('email', v)}
          placeholder="you@st.knust.edu.gh"
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          textContentType="username" delay={50}
        />
        <AuthField
          icon="key-outline" label="Password" value={value.password}
          onChangeText={v => set('password', v)}
          placeholder="Choose a password" secure
          autoCapitalize="none" textContentType="newPassword"
          delay={100} tight={!!strength}
        />

        {strength ? <StrengthMeter password={value.password} strength={strength} /> : null}

        <AuthField
          icon="checkmark-done-outline" label="Confirm password" value={value.confirm}
          onChangeText={v => set('confirm', v)}
          placeholder="Type it again" secure
          autoCapitalize="none" textContentType="newPassword"
          onSubmitEditing={onSubmit} returnKeyType="go" delay={150}
          status={value.confirm.length === 0 ? null : matches ? 'ok' : 'bad'}
          statusText={value.confirm.length === 0 ? null : matches ? 'Matches' : 'Does not match'}
        />

        {error ? <ErrorBox text={error} /> : null}
        <SubmitBtn title="Create account" icon="arrow-forward" busy={busy} onPress={onSubmit} />
        <Alt text="Already registered?" action="Sign in instead" onPress={onSwitch} />
      </View>
    </FadeIn>
  );
}

/* ================= pieces ================= */

// Segmented control with a pill that slides between the two options.
function Segmented({ mode, onChange }) {
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(mode === 'signin' ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: mode === 'signin' ? 0 : 1,
      duration: DUR.base,
      easing: EASE,
      useNativeDriver: true
    }).start();
  }, [mode, slide]);

  const half = width / 2;

  return (
    <View style={styles.segTrack} onLayout={e => setWidth(e.nativeEvent.layout.width - 8)}>
      {width > 0 ? (
        <Animated.View
          style={[
            styles.segPill,
            {
              width: half,
              transform: [{
                translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, half] })
              }]
            }
          ]}
        />
      ) : null}
      {[['signin', 'Sign in'], ['signup', 'Create account']].map(([key, label]) => (
        <Pressable key={key} onPress={() => onChange(key)} style={styles.segBtn}>
          <Text style={[styles.segText, mode === key && { color: colors.accent }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Text field with a leading icon, focus ring, and an eye toggle on
// password fields — a plain masked box gives no way to fix a typo.
function AuthField({
  icon, label, secure, delay = 0, tight, status, statusText, ...props
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const tone = status ? tones[status] : null;

  return (
    <FadeIn delay={delay} from={8}>
      <View style={{ marginBottom: tight ? space.sm : space.md }}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {statusText ? (
            <Text style={[styles.statusText, { color: tone[1] }]}>{statusText}</Text>
          ) : null}
        </View>

        <View
          style={[
            styles.inputWrap,
            focused && styles.inputWrapFocused,
            tone && { borderColor: tone[2] }
          ]}
        >
          <Ionicons
            name={icon}
            size={17}
            color={focused ? colors.accent : colors.faint}
          />
          <TextInput
            style={styles.input}
            placeholderTextColor={colors.faint}
            secureTextEntry={secure && hidden}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...props}
          />
          {secure ? (
            <Pressable onPress={() => setHidden(h => !h)} hitSlop={10} style={styles.eye}>
              <Ionicons
                name={hidden ? 'eye-outline' : 'eye-off-outline'}
                size={17}
                color={colors.muted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </FadeIn>
  );
}

// Five segments plus the live rule checklist, so "weak" says why.
function StrengthMeter({ password, strength }) {
  const colour = (tones[strength.tone] || tones.off)[1];
  const rules = [
    { met: password.length >= MIN_PASSWORD, text: MIN_PASSWORD + '+ characters' },
    { met: /\d/.test(password), text: 'a number' },
    { met: /[a-z]/.test(password) && /[A-Z]/.test(password), text: 'upper and lower case' }
  ];

  return (
    <View style={styles.strength}>
      <View style={styles.segRow}>
        {[1, 2, 3, 4, 5].map(i => (
          <View
            key={i}
            style={[
              styles.strengthSeg,
              { backgroundColor: i <= strength.score ? colour : colors.bgDeep }
            ]}
          />
        ))}
        <Text style={[styles.strengthLabel, { color: colour }]}>{strength.label}</Text>
      </View>
      <View style={styles.rules}>
        {rules.map(r => (
          <View key={r.text} style={styles.rule}>
            <Ionicons
              name={r.met ? 'checkmark-circle' : 'ellipse-outline'}
              size={12}
              color={r.met ? colors.ok : colors.faint}
            />
            <Text style={[styles.ruleText, r.met && { color: colors.ok }]}>{r.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ErrorBox({ text }) {
  return (
    <FadeIn from={4}>
      <View style={styles.error}>
        <Ionicons name="alert-circle" size={16} color={colors.danger} />
        <Text style={styles.errorText}>{text}</Text>
      </View>
    </FadeIn>
  );
}

function SubmitBtn({ title, icon, busy, onPress }) {
  if (busy) {
    return (
      <View style={styles.busyBtn}>
        <ActivityIndicator color={colors.white} />
        <Text style={styles.busyText}>Checking…</Text>
      </View>
    );
  }
  return <Btn title={title} icon={icon} onPress={onPress} full style={styles.submit} />;
}

function Alt({ text, action, onPress }) {
  return (
    <View style={styles.altWrap}>
      <View style={styles.altRule} />
      <PressScale onPress={onPress} scaleTo={0.97} style={styles.altBtn}>
        <Text style={styles.altText}>{text} </Text>
        <Text style={styles.altAction}>{action}</Text>
      </PressScale>
    </View>
  );
}

/* ================= styles ================= */

const styles = {
  cover: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 270,
    backgroundColor: colors.accent,
    borderBottomLeftRadius: 34, borderBottomRightRadius: 34,
    overflow: 'hidden'
  },
  // Soft translucent circles give the flat accent block some depth
  // without needing a gradient dependency.
  blobOne: {
    position: 'absolute', top: -70, right: -50,
    width: 210, height: 210, borderRadius: 105,
    backgroundColor: 'rgba(255,255,255,0.10)'
  },
  blobTwo: {
    position: 'absolute', bottom: -90, left: -60,
    width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.07)'
  },

  scroll: { flexGrow: 1, paddingHorizontal: space.lg, paddingBottom: space.xxl },

  brand: { alignItems: 'center', paddingTop: space.xxl, paddingBottom: space.xl },
  mark: {
    width: 58, height: 58, borderRadius: 18, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', ...elevation.mid
  },
  title: {
    fontSize: 21, fontWeight: '800', color: colors.white, letterSpacing: -0.5,
    textAlign: 'center', lineHeight: 27, marginTop: space.md
  },
  tagline: {
    fontSize: 12.5, color: 'rgba(255,255,255,0.82)', textAlign: 'center',
    marginTop: 6, lineHeight: 18
  },

  card: {
    backgroundColor: colors.surface, borderRadius: 22,
    padding: space.lg, ...elevation.high
  },

  segTrack: {
    flexDirection: 'row', padding: 4, marginBottom: space.lg,
    backgroundColor: colors.bg, borderRadius: radius.md
  },
  segPill: {
    position: 'absolute', top: 4, bottom: 4, left: 4,
    backgroundColor: colors.surface, borderRadius: radius.sm, ...elevation.low
  },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segText: { fontSize: 13, fontWeight: '700', color: colors.muted },

  formHead: { marginBottom: space.lg },
  formTitle: { fontSize: 19, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  formSub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },

  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  label: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.muted },
  statusText: { fontSize: 11, fontWeight: '800' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.tint, paddingHorizontal: 13, height: 50
  },
  inputWrapFocused: {
    borderColor: colors.accent, backgroundColor: colors.white,
    shadowColor: colors.accent, shadowOpacity: 0.14, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2
  },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  eye: { padding: 2 },

  strength: { marginBottom: space.md },
  segRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strengthSeg: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '800', minWidth: 58, textAlign: 'right' },
  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ruleText: { fontSize: 11, color: colors.faint },

  error: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerLine,
    borderRadius: radius.sm, padding: 11, marginBottom: space.md
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  submit: { height: 52, borderRadius: radius.md },
  busyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.md, height: 52
  },
  busyText: { color: colors.white, fontWeight: '700', fontSize: 14.5 },

  altWrap: { marginTop: space.lg },
  altRule: { height: 1, backgroundColor: colors.lineSoft, marginBottom: space.md },
  altBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 4 },
  altText: { fontSize: 13, color: colors.muted },
  altAction: { fontSize: 13, color: colors.accent, fontWeight: '800' },

  note: {
    flexDirection: 'row', gap: 7, alignItems: 'flex-start',
    marginTop: space.lg, paddingHorizontal: space.sm
  },
  noteText: { flex: 1, fontSize: 11, color: colors.faint, lineHeight: 16 }
};
