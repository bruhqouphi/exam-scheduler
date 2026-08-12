import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, Share, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as Store from '../engine/store';
import { generate } from '../engine/scheduler';
import { byId, headcount, compareSlots } from '../engine/model';
import { fmtDate, fmtLongDate } from '../format';
import { colors, space, type, radius, elevation } from '../theme';
import {
  Card, CardHead, Btn, Row, Tag, Note, EmptyState, ListRow, StatTile,
  Message, Select, Chip, Divider, Stepper, Meter, Overline
} from '../ui';
import { FadeIn, Reveal, Pulse } from '../anim';

export default function TimetableScreen({ state, conflicts, options, setOptions }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [view, setView] = useState('list');
  const [showOptions, setShowOptions] = useState(false);

  const setOpt = (key, value) => setOptions(o => ({ ...o, [key]: value }));

  function run() {
    if (!state.courses.length) {
      Alert.alert('Nothing to schedule', 'Add at least one course first.');
      return;
    }
    setBusy(true);
    // Let the spinner paint before the solver takes the thread.
    setTimeout(() => {
      try {
        const out = generate(state, options);
        Store.setTimetable(out.entries, out.unscheduled, out.stats);
        setResult({ text: out.message, ok: out.entries.length === state.courses.length });
      } catch (err) {
        setResult({ text: 'Generation failed: ' + err.message, ok: false });
      }
      setBusy(false);
    }, 40);
  }

  function clear() {
    Alert.alert('Clear timetable', 'Remove every scheduled exam?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { Store.clearTimetable(); setResult(null); } }
    ]);
  }

  async function exportCsv() {
    if (!state.timetable.length) {
      Alert.alert('Nothing to export', 'Generate a timetable first.');
      return;
    }
    const lines = [['Course Code', 'Course Name', 'Date', 'Start', 'End', 'Room', 'Location', 'Students']];
    state.timetable.forEach(e => {
      const c = byId(state.courses, e.courseId);
      const sl = byId(state.slots, e.slotId);
      const r = byId(state.rooms, e.roomId);
      if (!c) return;
      lines.push([c.code, c.name, sl ? sl.date : '', sl ? sl.start : '', sl ? sl.end : '',
                  r ? r.name : '', r ? (r.building || '') : '', headcount(c)]);
    });
    const csv = lines.map(row =>
      row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    try {
      await Share.share({ message: csv, title: 'Exam timetable (CSV)' });
    } catch (err) {
      Alert.alert('Could not share', err.message);
    }
  }

  /* ---------- derived ---------- */

  const flagged = new Set();
  conflicts.forEach(c => {
    if (c.severity === 'error') (c.courses || []).forEach(id => flagged.add(id));
  });

  const rows = state.timetable
    .map(e => ({
      entry: e,
      course: byId(state.courses, e.courseId),
      slot: byId(state.slots, e.slotId),
      room: byId(state.rooms, e.roomId)
    }))
    .filter(r => r.course)
    .sort((a, b) => compareSlots(a.slot, b.slot));

  const slotOptions = [{ value: '', label: '— unassigned —' }].concat(
    state.slots.map(sl => ({
      value: sl.id,
      label: sl.date + '  ' + sl.start + '–' + sl.end + (sl.available === false ? '  (blocked)' : '')
    })));

  const roomOptions = [{ value: '', label: '— unassigned —' }].concat(
    state.rooms.map(r => ({
      value: r.id,
      label: r.name + ' (' + r.capacity + ')' + (r.available === false ? '  (blocked)' : '')
    })));

  const errors = conflicts.filter(c => c.severity === 'error').length;
  const stats = state.stats;

  const days = {};
  rows.forEach(r => {
    const key = r.slot ? r.slot.date : 'unassigned';
    (days[key] = days[key] || []).push(r);
  });

  const ready = state.courses.length && state.rooms.length && state.slots.length;

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">

      {/* ---- the solver ---- */}
      <Card style={styles.hero} padded={false}>
        <View style={{ padding: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={styles.heroIcon}>
              <Ionicons name="git-network-outline" size={17} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.h2, { color: colors.white }]}>Generate schedule</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5 }}>
                {ready
                  ? state.courses.length + ' exams · ' + state.rooms.length + ' rooms · ' +
                    state.slots.length + ' slots'
                  : 'Add courses, rooms and slots first'}
              </Text>
            </View>
          </View>

          <Btn
            title={busy ? 'Solving…' : 'Generate Schedule'}
            icon={busy ? undefined : 'flash'}
            onPress={run}
            disabled={busy || !ready}
            style={styles.heroBtn}
            variant="ghost"
          />

          {busy ? (
            <Pulse style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md }}>
              <ActivityIndicator color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 12.5 }}>
                Searching for a conflict-free timetable…
              </Text>
            </Pulse>
          ) : null}
        </View>
      </Card>

      <Card>
        <Row>
          <Btn title="Settings" icon="options-outline" variant="ghost" size="sm"
            onPress={() => setShowOptions(v => !v)} style={{ flex: 1 }} />
          <Btn title="Export" icon="share-outline" variant="ghost" size="sm"
            onPress={exportCsv} style={{ flex: 1 }} />
          <Btn title="Clear" icon="trash-outline" variant="danger" size="sm"
            onPress={clear} style={{ flex: 1 }} />
        </Row>

        <Reveal open={showOptions}>
          <View style={{ marginTop: space.md }}>
            <Divider style={{ marginTop: 0 }} />
            <Overline>Optimisation</Overline>
            <Note icon="information-circle-outline">
              Higher numbers push the solver harder on that goal. Hard rules — clashes, capacity,
              availability — are never traded away.
            </Note>
            <Stepper label="Spread across days" hint="use the whole exam week"
              value={options.weightSpread} onChange={v => setOpt('weightSpread', v)} max={20} />
            <Stepper label="Avoid back-to-back" hint="no two papers in a row"
              value={options.weightBackToBack} onChange={v => setOpt('weightBackToBack', v)} max={30} />
            <Stepper label="Avoid same-day exams" hint="one paper per student per day"
              value={options.weightSameDay} onChange={v => setOpt('weightSameDay', v)} max={30} />
            <Stepper label="Back-to-back gap" hint="minutes that still count as adjacent"
              value={options.gapMinutes} onChange={v => setOpt('gapMinutes', v)} step={15} max={240} />
          </View>
        </Reveal>

        {result ? (
          <View style={{ marginTop: space.md }}>
            <Message text={result.text} tone={result.ok ? 'ok' : 'warn'} />
          </View>
        ) : null}

        {stats ? (
          <View style={styles.statGrid}>
            <StatTile delay={0} icon="checkmark-done" label="Scheduled"
              value={stats.scheduled + '/' + (stats.total || stats.scheduled)}
              tone={stats.unscheduled ? undefined : 'good'} />
            <StatTile delay={50} icon="warning" label="Conflicts" value={errors}
              tone={errors ? 'bad' : 'good'} />
            <StatTile delay={100} icon="calendar" label="Days used"
              value={stats.daysUsed + '/' + stats.daysAvailable} />
            <StatTile delay={150} icon="swap-horizontal" label="Back-to-back"
              value={stats.backToBack} tone={stats.backToBack ? 'bad' : 'good'} />
            <StatTile delay={200} icon="today" label="Same-day" value={stats.sameDayDoubles} />
            <StatTile delay={250} icon="albums" label="Room use" value={stats.roomUtilisation + '%'} />
            <StatTile delay={300} icon="git-branch" label="Nodes" value={stats.nodes} />
            <StatTile delay={350} icon="timer" label="Solve time" value={stats.elapsedMs + ' ms'} />
          </View>
        ) : null}
      </Card>

      {/* ---- anything that could not be placed ---- */}
      {state.unscheduled && state.unscheduled.length ? (
        <Card>
          <CardHead title="Could not be scheduled" icon="alert-circle-outline"
            subtitle={state.unscheduled.length + ' exam(s)'} />
          {state.unscheduled.map((u, i) => {
            const c = byId(state.courses, u.courseId);
            return (
              <FadeIn key={u.courseId + i} delay={i * 50}>
                <View style={styles.blocked}>
                  <Text style={type.h3}>{c ? c.code + ' — ' + c.name : 'Course'}</Text>
                  <Text style={[type.sub, { marginTop: 2 }]}>{u.reason}</Text>
                </View>
              </FadeIn>
            );
          })}
        </Card>
      ) : null}

      {/* ---- the timetable ---- */}
      <Card>
        <CardHead title="Timetable" icon="calendar-outline"
          subtitle={rows.length + ' exam(s) placed'}>
          <Chip label="List" active={view === 'list'} onPress={() => setView('list')} />
          <Chip label="By day" active={view === 'day'} onPress={() => setView('day')} />
        </CardHead>

        {!rows.length ? (
          <EmptyState icon="calendar-outline">
            No timetable yet. Add courses, rooms and time slots, then tap Generate Schedule.
          </EmptyState>
        ) : view === 'day' ? (
          Object.keys(days).sort().map((date, di) => (
            <FadeIn key={date} delay={di * 60} from={14}>
              <View style={{ marginBottom: space.md }}>
                <View style={styles.dayHead}>
                  <Text style={[type.h3, { color: colors.accent, flex: 1 }]}>
                    {date === 'unassigned' ? 'Unassigned' : fmtLongDate(date)}
                  </Text>
                  <Tag text={days[date].length + ' exam(s)'} tone="accent" />
                </View>

                {days[date].map((r, i) => (
                  <View key={r.course.id} style={styles.timelineRow}>
                    <View style={styles.timelineGutter}>
                      <Text style={styles.timeText}>{r.slot ? r.slot.start : '--:--'}</Text>
                      <View style={styles.timelineLine} />
                    </View>
                    <View style={[
                      styles.timelineCard,
                      flagged.has(r.course.id) && {
                        borderColor: colors.dangerLine, backgroundColor: colors.dangerSoft
                      }
                    ]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <Text style={[type.h3, { flex: 1 }]}>{r.course.code}</Text>
                        <Tag text={String(headcount(r.course))} tone="accent" icon="people" />
                      </View>
                      <Text style={type.sub} numberOfLines={1}>{r.course.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="location-outline" size={12} color={colors.muted} />
                        <Text style={type.tiny}>
                          {r.room ? r.room.name + (r.room.building ? ' · ' + r.room.building : '') : 'No room'}
                          {r.slot ? '  ·  ends ' + r.slot.end : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </FadeIn>
          ))
        ) : (
          rows.map((r, i) => {
            const size = headcount(r.course);
            const cap = r.room ? r.room.capacity : 0;
            const over = r.room && size > cap;
            return (
              <FadeIn key={r.course.id} delay={i * 35} from={12}>
                <ListRow
                  first={i === 0}
                  accent={flagged.has(r.course.id) ? 'bad' : 'ok'}
                  title={r.course.code}
                  subtitle={r.course.name}
                  right={
                    <Tag
                      text={size + ' / ' + (r.room ? cap : '—')}
                      tone={!r.room ? 'warn' : over ? 'bad' : 'ok'}
                      icon="people"
                    />
                  }
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                    <Text style={type.tiny}>
                      {r.slot ? fmtDate(r.slot.date) + '  ·  ' + r.slot.start + '–' + r.slot.end : 'No slot'}
                      {r.room ? '  ·  ' + r.room.name : ''}
                    </Text>
                  </View>

                  {r.room ? <Meter value={size} max={cap} tone={over ? 'bad' : 'ok'} /> : null}

                  <Row style={{ marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Select
                        compact icon="time-outline"
                        value={r.slot ? r.slot.id : ''}
                        options={slotOptions}
                        placeholder="Slot"
                        onChange={v => Store.setAssignment(r.course.id, v, r.room ? r.room.id : '')}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Select
                        compact icon="business-outline"
                        value={r.room ? r.room.id : ''}
                        options={roomOptions}
                        placeholder="Room"
                        onChange={v => Store.setAssignment(r.course.id, r.slot ? r.slot.id : '', v)}
                      />
                    </View>
                  </Row>
                </ListRow>
              </FadeIn>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

const styles = {
  hero: { backgroundColor: colors.accent, borderColor: colors.accentDeep, ...elevation.mid },
  heroIcon: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center'
  },
  heroBtn: { marginTop: space.lg },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },

  blocked: {
    backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerLine,
    borderRadius: radius.md, padding: space.md, marginBottom: space.sm
  },

  dayHead: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingBottom: space.sm, marginTop: space.sm,
    borderBottomWidth: 2, borderBottomColor: colors.accentSoft
  },
  timelineRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  timelineGutter: { width: 46, alignItems: 'center' },
  timeText: {
    fontSize: 12, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums']
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.accentSoft, marginTop: 4, borderRadius: 1 },
  timelineCard: {
    flex: 1, backgroundColor: colors.tint, borderWidth: 1, borderColor: colors.lineSoft,
    borderRadius: radius.md, padding: space.md
  }
};
