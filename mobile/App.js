/* ------------------------------------------------------------------
   App.js — shell: loads saved data, owns the tab bar and the data menu.
------------------------------------------------------------------- */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, Alert, Share,
  Modal, ScrollView, Animated
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import * as Store from './src/engine/store';
import * as Auth from './src/engine/auth';
import { initials } from './src/engine/auth-core.js';
import { detectConflicts, DEFAULTS } from './src/engine/scheduler';
import { build as buildDemo } from './src/engine/demo';
import { colors, radius, space, type, elevation } from './src/theme';
import { Btn, PromptModal } from './src/ui';
import { FadeSwap, FadeIn, Pop, PressScale, useSheetAnimation, EASE, DUR } from './src/anim';

import AuthScreen from './src/screens/AuthScreen';
import CoursesScreen from './src/screens/CoursesScreen';
import RoomsScreen from './src/screens/RoomsScreen';
import SlotsScreen from './src/screens/SlotsScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import ConflictsScreen from './src/screens/ConflictsScreen';
import ComplaintsScreen from './src/screens/ComplaintsScreen';

const TABS = [
  { key: 'courses', label: 'Courses', icon: 'book' },
  { key: 'rooms', label: 'Rooms', icon: 'business' },
  { key: 'slots', label: 'Slots', icon: 'time' },
  { key: 'timetable', label: 'Table', icon: 'calendar' },
  { key: 'conflicts', label: 'Issues', icon: 'warning' },
  { key: 'complaints', label: 'Inbox', icon: 'chatbubble-ellipses' }
];

export default function App() {
  const state = Store.useStore();
  const auth = Auth.useAuth();
  const [tab, setTab] = useState('courses');
  const [menuOpen, setMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [options, setOptions] = useState({
    weightSpread: DEFAULTS.weightSpread,
    weightBackToBack: DEFAULTS.weightBackToBack,
    weightSameDay: DEFAULTS.weightSameDay,
    gapMinutes: DEFAULTS.gapMinutes
  });

  useEffect(() => { Store.hydrate(); Auth.hydrateAuth(); }, []);

  // Recomputed whenever the data or the gap setting changes; the Timetable
  // screen uses it for row highlighting and the Issues screen lists it.
  const conflicts = useMemo(
    () => (state.ready ? detectConflicts(state, options) : []),
    [state, options]
  );

  const errorCount = conflicts.filter(c => c.severity === 'error').length;
  const openComplaints = state.complaints.filter(c => c.status !== 'resolved').length;

  const badges = {
    courses: state.courses.length,
    rooms: state.rooms.length,
    slots: state.slots.length,
    timetable: state.timetable.length,
    conflicts: errorCount,
    complaints: openComplaints
  };

  /* ---------- data menu ---------- */

  function loadDemo() {
    const apply = () => {
      Store.clearAll();
      const demo = buildDemo();
      demo.rooms.forEach(r => Store.addRoom(r));
      demo.slots.forEach(s => Store.addSlot(s));
      demo.courses.forEach(c => Store.addCourse(c));
      setMenuOpen(false);
      setTab('timetable');
      Alert.alert('Sample data loaded',
        demo.courses.length + ' courses, ' + demo.rooms.length + ' rooms and ' +
        demo.slots.length + ' time slots.\n\nTap Generate Schedule.');
    };

    if (state.courses.length || state.rooms.length || state.slots.length) {
      Alert.alert('Load sample data', 'This replaces the data currently in the app. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: apply }
      ]);
    } else {
      apply();
    }
  }

  async function exportData() {
    setMenuOpen(false);
    const { ready, ...data } = Store.getState();
    try {
      await Share.share({ message: JSON.stringify(data), title: 'Exam scheduler data' });
    } catch (err) {
      Alert.alert('Could not share', err.message);
    }
  }

  function importData(text) {
    setImportOpen(false);
    try {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.courses)) throw new Error('Not an exam scheduler file.');
      Store.replaceState(data);
      Alert.alert('Data imported', data.courses.length + ' courses loaded.');
    } catch (err) {
      Alert.alert('Could not import', err.message);
    }
  }

  function clearAll() {
    setMenuOpen(false);
    Alert.alert('Clear everything',
      'Delete all courses, rooms, time slots, the timetable and every complaint?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => Store.clearAll() }
      ]);
  }

  function signOut() {
    setMenuOpen(false);
    Alert.alert('Sign out',
      'Your courses, rooms and timetable stay on this phone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', onPress: () => { Auth.signOut(); setTab('courses'); } }
      ]);
  }

  const menuAnim = useSheetAnimation(menuOpen);

  /* ---------- render ---------- */

  // Both stores must finish reading before deciding what to show — otherwise
  // the sign-in screen flashes for a moment on every launch.
  if (!state.ready || !auth.ready) {
    return (
      <SafeAreaProvider>
        <View style={[s.center, { backgroundColor: colors.bg }]}>
          <FadeIn>
            <View style={s.splashMark}>
              <Text style={s.splashMarkText}>AE</Text>
            </View>
          </FadeIn>
          <FadeIn delay={120}>
            <Text style={[type.h2, { marginTop: space.lg, textAlign: 'center' }]}>
              Automated Exam{'\n'}Timetable Scheduler
            </Text>
          </FadeIn>
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.md }} />
        </View>
      </SafeAreaProvider>
    );
  }

  const user = Auth.currentUser(auth);

  if (!user) {
    return (
      <SafeAreaProvider>
        {/* Accent behind the status bar so the cover runs to the top edge,
            which is also why the status bar switches to light here. */}
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.accent }}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <AuthScreen startMode={Auth.userCount(auth) ? 'signin' : 'signup'} />
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    );
  }

  const screens = {
    courses: <CoursesScreen state={state} />,
    rooms: <RoomsScreen state={state} />,
    slots: <SlotsScreen state={state} />,
    timetable: (
      <TimetableScreen
        state={state}
        conflicts={conflicts}
        options={options}
        setOptions={setOptions}
      />
    ),
    conflicts: <ConflictsScreen conflicts={conflicts} />,
    complaints: <ComplaintsScreen state={state} options={options} />
  };

  const active = TABS.find(t => t.key === tab);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>

        <View style={s.header}>
          <View style={s.brandMark}>
            <Text style={s.brandMarkText}>AE</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h1} numberOfLines={1}>Exam Timetable</Text>
            <Text style={type.sub} numberOfLines={1}>
              {active ? active.label : ''} · {subtitleFor(tab, badges)}
            </Text>
          </View>
          <PressScale onPress={() => setMenuOpen(true)} scaleTo={0.9} style={s.avatar}>
            <Text style={s.avatarText}>{initials(user.name)}</Text>
          </PressScale>
        </View>

        <FadeSwap swapKey={tab} style={s.body}>
          {screens[tab]}
        </FadeSwap>

        <TabBar tab={tab} setTab={setTab} badges={badges} />

        <Modal visible={menuOpen} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={{ flex: 1 }} onPress={() => setMenuOpen(false)}>
            <Animated.View style={[s.backdrop, menuAnim.backdrop]}>
              <Animated.View style={[s.sheet, menuAnim.sheet]}>
                <Pressable onPress={() => {}}>
                  <View style={s.sheetHandle} />

                  <View style={s.account}>
                    <View style={s.accountAvatar}>
                      <Text style={s.accountAvatarText}>{initials(user.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={type.h3} numberOfLines={1}>{user.name}</Text>
                      <Text style={type.tiny} numberOfLines={1}>{user.email}</Text>
                    </View>
                    <Btn title="Sign out" variant="ghost" size="sm" icon="log-out-outline"
                      onPress={signOut} />
                  </View>

                  <Text style={[type.h2, { marginBottom: space.md }]}>Data</Text>
                  <ScrollView>
                    <MenuItem
                      icon="sparkles" title="Load sample data"
                      subtitle="10 courses, 6 rooms, 15 sessions" onPress={loadDemo}
                    />
                    <MenuItem
                      icon="share-outline" title="Export / share data"
                      subtitle="Send the whole dataset as JSON" onPress={exportData}
                    />
                    <MenuItem
                      icon="download-outline" title="Import data"
                      subtitle="Paste a previously exported file"
                      onPress={() => { setMenuOpen(false); setImportOpen(true); }}
                    />
                    <MenuItem
                      icon="trash-outline" title="Clear everything"
                      subtitle="Delete all data on this phone" danger onPress={clearAll}
                    />
                  </ScrollView>
                  <Text style={[type.tiny, { marginTop: space.md, textAlign: 'center' }]}>
                    Data is stored on this phone only. Export to keep a backup.
                  </Text>
                  <Btn
                    title="Close" variant="ghost"
                    onPress={() => setMenuOpen(false)} style={{ marginTop: space.md }}
                  />
                </Pressable>
              </Animated.View>
            </Animated.View>
          </Pressable>
        </Modal>

        <PromptModal
          visible={importOpen}
          title="Import data"
          label="Paste the exported JSON"
          multiline
          onCancel={() => setImportOpen(false)}
          onSubmit={importData}
        />

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

/* ---------- tab bar ---------- */

// Six tabs with a pill that slides to the selected one. The pill is a
// single animated view rather than a per-tab background, so the movement
// reads as one object travelling instead of six lights blinking.
function TabBar({ tab, setTab, badges }) {
  const [width, setWidth] = useState(0);
  const index = TABS.findIndex(t => t.key === tab);
  const slide = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: index,
      duration: DUR.base,
      easing: EASE,
      useNativeDriver: true
    }).start();
  }, [index, slide]);

  const tabWidth = width / TABS.length;

  return (
    <View style={s.tabBar} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Animated.View
          style={[
            s.tabPill,
            {
              width: tabWidth - 10,
              transform: [{
                translateX: slide.interpolate({
                  inputRange: TABS.map((_, i) => i),
                  outputRange: TABS.map((_, i) => i * tabWidth + 5)
                })
              }]
            }
          ]}
        />
      ) : null}

      {TABS.map(t => {
        const isActive = tab === t.key;
        const count = badges[t.key] || 0;
        const alert = (t.key === 'conflicts' || t.key === 'complaints') && count > 0;
        return (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={s.tab}>
            <View>
              <Ionicons
                name={isActive ? t.icon : t.icon + '-outline'}
                size={19}
                color={isActive ? colors.accent : colors.faint}
              />
              {count > 0 ? (
                <Pop value={count} style={[s.badge, alert && { backgroundColor: colors.danger }]}>
                  <Text style={s.badgeText}>{count > 99 ? '99+' : count}</Text>
                </Pop>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={[s.tabLabel, isActive && { color: colors.accent, fontWeight: '800' }]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- data menu row ---------- */

function MenuItem({ icon, title, subtitle, onPress, danger }) {
  return (
    <PressScale onPress={onPress} scaleTo={0.98} style={s.menuItem}>
      <View style={[s.menuIcon, danger && { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name={icon} size={17} color={danger ? colors.danger : colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.h3, danger && { color: colors.danger }]}>{title}</Text>
        <Text style={type.tiny}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.faint} />
    </PressScale>
  );
}

// One-line summary under the app title, so the header earns its space.
function subtitleFor(tab, badges) {
  switch (tab) {
    case 'courses': return badges.courses + ' course(s)';
    case 'rooms': return badges.rooms + ' room(s)';
    case 'slots': return badges.slots + ' slot(s)';
    case 'timetable': return badges.timetable + ' scheduled';
    case 'conflicts': return badges.conflicts ? badges.conflicts + ' to fix' : 'all clear';
    case 'complaints': return badges.complaints ? badges.complaints + ' open' : 'none open';
    default: return '';
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  splashMark: {
    width: 62, height: 62, borderRadius: radius.xl, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', ...elevation.mid
  },
  splashMarkText: { color: colors.white, fontWeight: '800', fontSize: 20, letterSpacing: -0.5 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.lineSoft
  },
  brandMark: {
    width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', ...elevation.low
  },
  brandMarkText: { color: colors.white, fontWeight: '800', fontSize: 13.5, letterSpacing: -0.3 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center'
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accentSoft,
    borderWidth: 1.5, borderColor: colors.accentLine,
    alignItems: 'center', justifyContent: 'center'
  },
  avatarText: { color: colors.accent, fontWeight: '800', fontSize: 13 },

  account: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.tint, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.lineSoft,
    padding: space.md, marginBottom: space.lg
  },
  accountAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center'
  },
  accountAvatarText: { color: colors.white, fontWeight: '800', fontSize: 14 },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.lineSoft,
    paddingTop: 8, paddingBottom: 6, ...elevation.mid
  },
  tabPill: {
    position: 'absolute', top: 4, bottom: 4,
    backgroundColor: colors.accentSoft, borderRadius: radius.md
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  tabLabel: { fontSize: 10, color: colors.faint, fontWeight: '700' },
  badge: {
    position: 'absolute', top: -5, right: -11, minWidth: 16, paddingHorizontal: 4,
    height: 16, borderRadius: 8, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center'
  },
  badgeText: { color: colors.white, fontSize: 9.5, fontWeight: '800' },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(13,18,38,0.5)', justifyContent: 'flex-end', padding: space.md
  },
  sheet: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: space.lg, maxHeight: '82%', ...elevation.high
  },
  sheetHandle: {
    width: 34, height: 4, borderRadius: 2, backgroundColor: colors.line,
    alignSelf: 'center', marginBottom: space.md
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingVertical: 11, paddingHorizontal: 4
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center'
  }
});
