import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, Share, ActivityIndicator } from 'react-native';

import * as Store from '../engine/store';
import { generate } from '../engine/scheduler';
import { byId, headcount, compareSlots } from '../engine/model';
import { fmtDate, fmtLongDate } from '../format';
import { colors, space, type } from '../theme';
import {
  Card, CardHead, Btn, Row, Tag, Note, EmptyState, ListRow, StatTile, Message, Select, Chip, Divider
} from '../ui';

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
      const s = byId(state.slots, e.slotId);
      const r = byId(state.rooms, e.roomId);
      if (!c) return;
      lines.push([c.code, c.name, s ? s.date : '', s ? s.start : '', s ? s.end : '',
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
    state.slots.map(s => ({
      value: s.id,
      label: s.date + '  ' + s.start + '–' + s.end + (s.available === false ? '  (blocked)' : '')
    })));

  const roomOptions = [{ value: '', label: '— unassigned —' }].concat(
    state.rooms.map(r => ({
      value: r.id,
      label: r.name + ' (' + r.capacity + ')' + (r.available === false ? '  (blocked)' : '')
    })));

  const errors = conflicts.filter(c => c.severity === 'error').length;
  const stats = state.stats;

  /* ---------- day grouping ---------- */

  const days = {};
  rows.forEach(r => {
    const key = r.slot ? r.slot.date : 'unassigned';
    (days[key] = days[key] || []).push(r);
  });

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <CardHead title="Generate schedule" />
        <Btn
          title={busy ? 'Solving…' : 'Generate Schedule'}
          onPress={run}
          disabled={busy}
        />
        {busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={type.sub}>Searching for a conflict-free timetable…</Text>
          </View>
        ) : null}

        <Row style={{ marginTop: space.sm }}>
          <Btn title="Clear" variant="ghost" size="sm" onPress={clear} style={{ flex: 1 }} />
          <Btn title="Export CSV" variant="ghost" size="sm" onPress={exportCsv} style={{ flex: 1 }} />
          <Btn
            title={showOptions ? 'Hide settings' : 'Settings'}
            variant="ghost"
            size="sm"
            onPress={() => setShowOptions(v => !v)}
            style={{ flex: 1 }}
          />
        </Row>

        {showOptions ? (
          <View style={{ marginTop: space.md }}>
            <Divider />
            <Text style={[type.h3, { marginBottom: space.sm }]}>Optimisation settings</Text>
            <Note>Higher numbers push the solver harder on that goal.</Note>
            <Stepper2 label="Spread across days" value={options.weightSpread}
              onChange={v => setOpt('weightSpread', v)} max={20} />
            <Stepper2 label="Avoid back-to-back" value={options.weightBackToBack}
              onChange={v => setOpt('weightBackToBack', v)} max={30} />
            <Stepper2 label="Avoid same-day exams" value={options.weightSameDay}
              onChange={v => setOpt('weightSameDay', v)} max={30} />
            <Stepper2 label="Back-to-back gap (min)" value={options.gapMinutes}
              onChange={v => setOpt('gapMinutes', v)} step={15} max={240} />
          </View>
        ) : null}

        {result ? (
          <View style={{ marginTop: space.md }}>
            <Message text={result.text} tone={result.ok ? 'ok' : 'warn'} />
          </View>
        ) : null}

        {stats ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs }}>
            <StatTile label="Exams scheduled" value={stats.scheduled + '/' + (stats.total || stats.scheduled)}
              tone={stats.unscheduled ? undefined : 'good'} />
            <StatTile label="Hard conflicts" value={errors} tone={errors ? 'bad' : 'good'} />
            <StatTile label="Days used" value={stats.daysUsed + '/' + stats.daysAvailable} />
            <StatTile label="Back-to-back" value={stats.backToBack} tone={stats.backToBack ? 'bad' : undefined} />
            <StatTile label="Same-day sittings" value={stats.sameDayDoubles} />
            <StatTile label="Room use" value={stats.roomUtilisation + '%'} />
            <StatTile label="Search nodes" value={stats.nodes} />
            <StatTile label="Solve time" value={stats.elapsedMs + ' ms'} />
          </View>
        ) : null}
      </Card>

      {state.unscheduled && state.unscheduled.length ? (
        <Card>
          <CardHead title="Could not be scheduled" />
          {state.unscheduled.map((u, i) => {
            const c = byId(state.courses, u.courseId);
            return (
              <View key={u.courseId + i} style={{ marginBottom: space.sm }}>
                <Text style={type.h3}>{c ? c.code + ' — ' + c.name : 'Course'}</Text>
                <Text style={type.sub}>{u.reason}</Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card>
        <CardHead title="Timetable">
          <Chip label="List" active={view === 'list'} onPress={() => setView('list')} />
          <Chip label="By day" active={view === 'day'} onPress={() => setView('day')} />
        </CardHead>

        {!rows.length ? (
          <EmptyState>
            No timetable yet. Add courses, rooms and time slots, then tap Generate Schedule.
          </EmptyState>
        ) : view === 'day' ? (
          Object.keys(days).sort().map(date => (
            <View key={date} style={{ marginBottom: space.md }}>
              <Text style={[type.h3, { color: colors.accent, marginTop: space.sm }]}>
                {date === 'unassigned' ? 'Unassigned' : fmtLongDate(date)}
              </Text>
              <Text style={type.sub}>{days[date].length} exam(s)</Text>
              {days[date].map(r => (
                <ListRow
                  key={r.course.id}
                  title={r.course.code + '  ' + (r.slot ? r.slot.start + '–' + r.slot.end : '')}
                  subtitle={r.course.name + (r.room ? '  ·  ' + r.room.name : '')}
                  tone={flagged.has(r.course.id) ? 'bad' : undefined}
                  right={<Tag text={String(headcount(r.course))} tone="accent" />}
                />
              ))}
            </View>
          ))
        ) : (
          rows.map(r => {
            const size = headcount(r.course);
            const cap = r.room ? r.room.capacity : 0;
            return (
              <ListRow
                key={r.course.id}
                title={r.course.code}
                subtitle={r.course.name}
                tone={flagged.has(r.course.id) ? 'bad' : undefined}
                right={
                  <Tag
                    text={size + ' / ' + (r.room ? cap : '—')}
                    tone={!r.room ? 'warn' : size > cap ? 'bad' : 'ok'}
                  />
                }
              >
                <Text style={[type.sub, { marginTop: 4 }]}>
                  {r.slot ? fmtDate(r.slot.date) + '  ·  ' + r.slot.start + '–' + r.slot.end : 'No slot'}
                  {r.room ? '  ·  ' + r.room.name : ''}
                </Text>
                <Row style={{ marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Select
                      compact
                      value={r.slot ? r.slot.id : ''}
                      options={slotOptions}
                      placeholder="Slot"
                      onChange={v => Store.setAssignment(r.course.id, v, r.room ? r.room.id : '')}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Select
                      compact
                      value={r.room ? r.room.id : ''}
                      options={roomOptions}
                      placeholder="Room"
                      onChange={v => Store.setAssignment(r.course.id, r.slot ? r.slot.id : '', v)}
                    />
                  </View>
                </Row>
              </ListRow>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

/* Local stepper — keeps the settings block self-contained. */
function Stepper2({ label, value, onChange, step = 1, min = 0, max = 100 }) {
  const clamp = v => Math.min(max, Math.max(min, v));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, gap: space.sm }}>
      <Text style={[type.label, { flex: 1 }]}>{label}</Text>
      <Btn title="−" variant="ghost" size="sm" onPress={() => onChange(clamp(value - step))} />
      <Text style={{ minWidth: 38, textAlign: 'center', fontWeight: '600', color: colors.accent }}>
        {value}
      </Text>
      <Btn title="+" variant="ghost" size="sm" onPress={() => onChange(clamp(value + step))} />
    </View>
  );
}
