/* ------------------------------------------------------------------
   AuthScreen.js — sign in and create account.

   Password hashing is deliberately slow (4000 SHA-256 rounds), so the
   submit runs after a frame with a spinner rather than freezing the tap.
------------------------------------------------------------------- */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, Animated, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as Auth from '../engine/auth';
import { passwordStrength, MIN_PASSWORD } from '../engine/auth-core.js';
import { colors, space, type, radius, elevation, tones } from '../theme';
import { Field, Btn, Row } from '../ui';
import { FadeIn, PressScale, EASE, DUR } from '../anim';

const BLANK_IN = { email: '', password: '' };
const BLANK_UP = { name: '', email: '', password: '', confirm: '' };

export default function AuthScreen({ startMode }) {
  const [mode, setMode] = useState(startMode || 'signin');
  const [signin, setSignin] = useState(BLANK_IN);
  const [signup, setSignup] = useState(BLANK_UP);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const shake = useRef(new Animated.Value(0)).current;

  // Nudge the form sideways when credentials are rejected.
  useEffect(() => {
    if (!error) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, easing: EASE, useNativeDriver: true })
    ]).start();
  }, [error, shake]);

  function switchTo(next) {
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

  const strength = signup.password ? passwordStrength(signup.password) : null;
  const strengthColour = strength ? (tones[strength.tone] || tones.off)[1] : colors.line;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeIn from={18} duration={DUR.slow}>
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markText}>AE</Text>
            </View>
            <Text style={styles.title}>Automated Exam{'\n'}Timetable Scheduler</Text>
            <Text style={styles.tagline}>
              Constraint-based timetabling that keeps every student clash-free.
            </Text>
          </View>
        </FadeIn>

        <FadeIn delay={90} from={14}>
          <Animated.View
            style={[
              styles.card,
              { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] }
            ]}
          >
            <View style={styles.switch}>
              <SwitchTab label="Sign in" active={mode === 'signin'} onPress={() => switchTo('signin')} />
              <SwitchTab label="Create account" active={mode === 'signup'} onPress={() => switchTo('signup')} />
            </View>

            {mode === 'signin' ? (
              <FadeIn from={6} duration={DUR.base}>
                <View>
                  <Field
                    label="Email address"
                    value={signin.email}
                    onChangeText={v => setSignin(f => ({ ...f, email: v }))}
                    placeholder="you@st.knust.edu.gh"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="username"
                  />
                  <Field
                    label="Password"
                    value={signin.password}
                    onChangeText={v => setSignin(f => ({ ...f, password: v }))}
                    placeholder="Your password"
                    secureTextEntry
                    autoCapitalize="none"
                    textContentType="password"
                    onSubmitEditing={submitSignIn}
                    returnKeyType="go"
                  />
                  {error ? <ErrorBox text={error} /> : null}
                  <SubmitBtn title="Sign in" icon="log-in-outline" busy={busy} onPress={submitSignIn} />
                  <AltLine
                    text="New here?" action="Create an account"
                    onPress={() => switchTo('signup')}
                  />
                </View>
              </FadeIn>
            ) : (
              <FadeIn from={6} duration={DUR.base}>
                <View>
                  <Field
                    label="Full name"
                    value={signup.name}
                    onChangeText={v => setSignup(f => ({ ...f, name: v }))}
                    placeholder="Joshua Kissi"
                    autoCapitalize="words"
                    textContentType="name"
                  />
                  <Field
                    label="Email address"
                    value={signup.email}
                    onChangeText={v => setSignup(f => ({ ...f, email: v }))}
                    placeholder="you@st.knust.edu.gh"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="username"
                  />
                  <Field
                    label="Password"
                    hint={'at least ' + MIN_PASSWORD + ' characters'}
                    value={signup.password}
                    onChangeText={v => setSignup(f => ({ ...f, password: v }))}
                    placeholder="Choose a password"
                    secureTextEntry
                    autoCapitalize="none"
                    textContentType="newPassword"
                    style={{ marginBottom: strength ? space.sm : space.md }}
                  />
                  {strength ? (
                    <View style={styles.strengthRow}>
                      <View style={styles.strengthTrack}>
                        <View style={[
                          styles.strengthFill,
                          { width: (strength.score / 5) * 100 + '%', backgroundColor: strengthColour }
                        ]} />
                      </View>
                      <Text style={[styles.strengthLabel, { color: strengthColour }]}>
                        {strength.label}
                      </Text>
                    </View>
                  ) : null}
                  <Field
                    label="Confirm password"
                    value={signup.confirm}
                    onChangeText={v => setSignup(f => ({ ...f, confirm: v }))}
                    placeholder="Type it again"
                    secureTextEntry
                    autoCapitalize="none"
                    textContentType="newPassword"
                    onSubmitEditing={submitSignUp}
                    returnKeyType="go"
                  />
                  {error ? <ErrorBox text={error} /> : null}
                  <SubmitBtn
                    title="Create account" icon="person-add-outline"
                    busy={busy} onPress={submitSignUp}
                  />
                  <AltLine
                    text="Already registered?" action="Sign in"
                    onPress={() => switchTo('signin')}
                  />
                </View>
              </FadeIn>
            )}

            <View style={styles.note}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.faint} />
              <Text style={styles.noteText}>
                Accounts are stored on this phone only, so this protects the app from casual
                access rather than acting as real security.
              </Text>
            </View>
          </Animated.View>
        </FadeIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- pieces ---------- */

function SwitchTab({ label, active, onPress }) {
  return (
    <PressScale onPress={onPress} scaleTo={0.97} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && { color: colors.accent }]}>{label}</Text>
    </PressScale>
  );
}

function ErrorBox({ text }) {
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle" size={15} color={colors.danger} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
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
  return <Btn title={title} icon={icon} onPress={onPress} full />;
}

function AltLine({ text, action, onPress }) {
  return (
    <View style={styles.alt}>
      <Text style={type.sub}>{text} </Text>
      <PressScale onPress={onPress} scaleTo={0.96}>
        <Text style={styles.altAction}>{action}</Text>
      </PressScale>
    </View>
  );
}

const styles = {
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.lg, paddingVertical: space.xxl },

  brand: { alignItems: 'center', marginBottom: space.xl },
  mark: {
    width: 60, height: 60, borderRadius: radius.xl, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', ...elevation.mid
  },
  markText: { color: colors.white, fontWeight: '800', fontSize: 19, letterSpacing: -0.5 },
  title: {
    fontSize: 21, fontWeight: '800', color: colors.text, letterSpacing: -0.5,
    textAlign: 'center', lineHeight: 27, marginTop: space.md
  },
  tagline: {
    fontSize: 12.5, color: colors.muted, textAlign: 'center',
    marginTop: 6, paddingHorizontal: space.lg, lineHeight: 18
  },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.lineSoft,
    padding: space.lg, ...elevation.mid
  },

  switch: {
    flexDirection: 'row', gap: 4, padding: 4, marginBottom: space.lg,
    backgroundColor: colors.bg, borderRadius: radius.md
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface, ...elevation.low },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.muted },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  strengthTrack: {
    flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.bgDeep, overflow: 'hidden'
  },
  strengthFill: { height: '100%', borderRadius: 3 },
  strengthLabel: { fontSize: 11.5, fontWeight: '800', minWidth: 60, textAlign: 'right' },

  error: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerLine,
    borderRadius: radius.sm, padding: 11, marginBottom: space.md
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  busyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12
  },
  busyText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  alt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.md },
  altAction: { color: colors.accent, fontWeight: '700', fontSize: 12.5 },

  note: {
    flexDirection: 'row', gap: 7, alignItems: 'flex-start',
    marginTop: space.lg, paddingTop: space.md,
    borderTopWidth: 1, borderTopColor: colors.lineSoft
  },
  noteText: { flex: 1, fontSize: 11, color: colors.faint, lineHeight: 16 }
};
