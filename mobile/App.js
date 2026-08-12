/* ------------------------------------------------------------------
   App.js — shell: loads saved data, owns the tab bar and the data menu.
------------------------------------------------------------------- */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, Alert, Share, Modal, ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import * as Store from './src/engine/store';
import { detectConflicts, DEFAULTS } from './src/engine/scheduler';
import { build as buildDemo } from './src/engine/demo';
import { colors, radius, space, type, shadow } from './src/theme';
import { Btn, PromptModal } from './src/ui';

import CoursesScreen from './src/screens/CoursesScreen';
import RoomsScreen from './src/screens/RoomsScreen';
import SlotsScreen from './src/screens/SlotsScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import ConflictsScreen from './src/screens/ConflictsScreen';
import ComplaintsScreen from './src/screens/ComplaintsScreen';

const TABS = [
  { key: 'courses', label: 'Courses' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'slots', label: 'Slots' },
  { key: 'timetable', label: 'Timetable' },
  { key: 'conflicts', label: 'Conflicts' },
  { key: 'complaints', label: 'Complaints' }
];

export default function App() {
  const state = Store.useStore();
  const [tab, setTab] = useState('courses');
  const [menuOpen, setMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [options, setOptions] = useState({
    weightSpread: DEFAULTS.weightSpread,
    weightBackToBack: DEFAULTS.weightBackToBack,
    weightSameDay: DEFAULTS.weightSameDay,
    gapMinutes: DEFAULTS.gapMinutes
  });

  useEffect(() => { Store.hydrate(); }, []);

  // Recomputed whenever the data or the gap setting changes; the Timetable
  // screen uses it for row highlighting and the Conflicts screen lists it.
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

  /* ---------- render ---------- */

  if (!state.ready) {
    return (
      <SafeAreaProvider>
        <View style={[s.center, { backgroundColor: colors.bg }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[type.sub, { marginTop: space.md }]}>Loading your data…</Text>
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

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>

        <View style={s.header}>
          <View style={s.brandMark}><Text style={s.brandMarkText}>ES</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={type.h1}>Exam Scheduler</Text>
            <Text style={type.sub}>Constraint-based timetable generator</Text>
          </View>
          <Btn title="Data" variant="ghost" size="sm" onPress={() => setMenuOpen(true)} />
        </View>

        <View style={{ flex: 1 }}>{screens[tab]}</View>

        <View style={s.tabBar}>
          {TABS.map(t => {
            const active = tab === t.key;
            const badge = badges[t.key];
            const alert = (t.key === 'conflicts' || t.key === 'complaints') && badge > 0;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={s.tab}>
                <View style={[s.tabBadge, {
                  backgroundColor: alert ? colors.dangerSoft : active ? colors.accentSoft : 'transparent'
                }]}>
                  <Text style={[s.tabBadgeText, {
                    color: alert ? colors.danger : active ? colors.accent : colors.muted
                  }]}>
                    {badge || 0}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[s.tabLabel, active && { color: colors.accent, fontWeight: '700' }]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={s.backdrop} onPress={() => setMenuOpen(false)}>
            <Pressable style={s.sheet} onPress={() => {}}>
              <Text style={[type.h2, { marginBottom: space.md }]}>Data</Text>
              <ScrollView>
                <Btn title="Load sample data" onPress={loadDemo} style={{ marginBottom: space.sm }} />
                <Btn title="Export / share data" variant="ghost" onPress={exportData}
                  style={{ marginBottom: space.sm }} />
                <Btn title="Import data" variant="ghost"
                  onPress={() => { setMenuOpen(false); setImportOpen(true); }}
                  style={{ marginBottom: space.sm }} />
                <Btn title="Clear everything" variant="danger" onPress={clearAll}
                  style={{ marginBottom: space.sm }} />
              </ScrollView>
              <Text style={[type.sub, { marginTop: space.sm }]}>
                Data is stored on this phone only. Export to keep a backup.
              </Text>
              <Btn title="Close" variant="ghost" onPress={() => setMenuOpen(false)}
                style={{ marginTop: space.md }} />
            </Pressable>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.md, paddingVertical: space.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line
  },
  brandMark: {
    width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center'
  },
  brandMarkText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6, paddingBottom: 4,
    ...shadow
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  tabBadge: {
    minWidth: 24, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: radius.pill, alignItems: 'center', marginBottom: 2
  },
  tabBadgeText: { fontSize: 11, fontWeight: '700' },
  tabLabel: { fontSize: 10.5, color: colors.muted, fontWeight: '600' },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(20,26,48,0.45)', justifyContent: 'center', padding: space.xl
  },
  sheet: { backgroundColor: '#fff', borderRadius: radius.lg, padding: space.lg, maxHeight: '80%' }
});
