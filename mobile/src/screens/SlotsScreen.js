import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';

import * as Store from '../engine/store';
import { toMinutes, slotLength } from '../engine/model';
import { fmtDate, fmtDuration, isValidDate, isValidTime, todayIso, addDaysIso } from '../format';
import { space, type } from '../theme';
import { Card, CardHead, Field, Btn, LinkBtn, Row, Tag, Note, EmptyState, ListRow, SwitchRow, Divider } from '../ui';

const BLANK = { date: todayIso(), start: '08:00', end: '10:00', available: true };

export default function SlotsScreen({ state }) {
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState({
    from: todayIso(),
    to: addDaysIso(todayIso(), 6),
    sessions: '08:00-10:00\n12:00-14:00\n16:00-18:00',
    skipWeekends: true
  });

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setB = (key, value) => setBulk(b => ({ ...b, [key]: value }));

  function reset() {
    setForm(BLANK);
    setEditing(null);
  }

  function validate(data) {
    if (!isValidDate(data.date)) return 'Enter the date as YYYY-MM-DD, for example 2026-09-01.';
    if (!isValidTime(data.start) || !isValidTime(data.end)) return 'Enter times as HH:MM, for example 08:00.';
    if (toMinutes(data.end) <= toMinutes(data.start)) return 'The end time must be after the start time.';
    return null;
  }

  function submit() {
    const problem = validate(form);
    if (problem) { Alert.alert('Check the slot', problem); return; }
    if (editing) Store.updateSlot(editing, form);
    else Store.addSlot(form);
    reset();
  }

  function edit(slot) {
    setEditing(slot.id);
    setForm({ date: slot.date, start: slot.start, end: slot.end, available: slot.available !== false });
  }

  function createBulk() {
    if (!isValidDate(bulk.from) || !isValidDate(bulk.to)) {
      Alert.alert('Check the dates', 'Enter both dates as YYYY-MM-DD.');
      return;
    }
    if (bulk.to < bulk.from) {
      Alert.alert('Check the dates', 'The "to" date must not be before the "from" date.');
      return;
    }

    const sessions = bulk.sessions.split('\n')
      .map(line => line.trim()).filter(Boolean)
      .map(line => line.split(/\s*-\s*/))
      .filter(p => p.length === 2 && isValidTime(p[0]) && isValidTime(p[1]) &&
                   toMinutes(p[1]) > toMinutes(p[0]));

    if (!sessions.length) {
      Alert.alert('Check the sessions', 'Add at least one valid session, for example 08:00-10:00.');
      return;
    }

    let cursor = bulk.from;
    let made = 0, guard = 0;
    while (cursor <= bulk.to && guard++ < 400) {
      const [y, m, d] = cursor.split('-').map(Number);
      const day = new Date(y, m - 1, d).getDay();
      if (!(bulk.skipWeekends && (day === 0 || day === 6))) {
        sessions.forEach(sess => {
          const exists = Store.getState().slots
            .some(x => x.date === cursor && x.start === sess[0] && x.end === sess[1]);
          if (!exists) { Store.addSlot({ date: cursor, start: sess[0], end: sess[1], available: true }); made++; }
        });
      }
      cursor = addDaysIso(cursor, 1);
    }
    Alert.alert('Time slots created', made + ' slot(s) added.');
  }

  function removeAll() {
    if (!state.slots.length) return;
    Alert.alert('Remove all slots', 'Remove all ' + state.slots.length + ' time slots?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove all', style: 'destructive', onPress: () => { Store.removeAllSlots(); reset(); } }
    ]);
  }

  // Group by date so a long list stays readable.
  const byDate = {};
  state.slots.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });
  const dates = Object.keys(byDate).sort();

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={[type.h2, { marginBottom: space.md }]}>
          {editing ? 'Edit time slot' : 'Add a time slot'}
        </Text>

        <Field
          label="Exam date"
          hint="YYYY-MM-DD"
          value={form.date}
          onChangeText={v => set('date', v)}
          placeholder="2026-09-01"
          keyboardType="numbers-and-punctuation"
        />
        <Row>
          <Field
            label="Start time"
            hint="HH:MM"
            value={form.start}
            onChangeText={v => set('start', v)}
            placeholder="08:00"
            keyboardType="numbers-and-punctuation"
            style={{ flex: 1 }}
          />
          <Field
            label="End time"
            hint="HH:MM"
            value={form.end}
            onChangeText={v => set('end', v)}
            placeholder="10:00"
            keyboardType="numbers-and-punctuation"
            style={{ flex: 1 }}
          />
        </Row>
        <SwitchRow
          label="Slot is available"
          value={form.available}
          onValueChange={v => set('available', v)}
        />

        <Row>
          <Btn title={editing ? 'Save changes' : 'Add slot'} onPress={submit} style={{ flex: 1 }} />
          {editing ? <Btn title="Cancel" variant="ghost" onPress={reset} style={{ flex: 1 }} /> : null}
        </Row>

        <Divider />

        <Text style={[type.h3, { marginBottom: 6 }]}>Bulk create</Text>
        <Note>Generate the same daily sessions across a date range.</Note>
        <Row>
          <Field label="From" value={bulk.from} onChangeText={v => setB('from', v)} style={{ flex: 1 }} />
          <Field label="To" value={bulk.to} onChangeText={v => setB('to', v)} style={{ flex: 1 }} />
        </Row>
        <Field
          label="Sessions per day"
          hint="one start-end pair per line"
          value={bulk.sessions}
          onChangeText={v => setB('sessions', v)}
          multiline
        />
        <SwitchRow
          label="Skip weekends"
          value={bulk.skipWeekends}
          onValueChange={v => setB('skipWeekends', v)}
        />
        <Btn title="Create slots" onPress={createBulk} />
      </Card>

      <Card>
        <CardHead title={'Time slots (' + state.slots.length + ')'}>
          {state.slots.length ? <Btn title="Remove all" variant="danger" size="sm" onPress={removeAll} /> : null}
        </CardHead>

        {!state.slots.length ? (
          <EmptyState>No time slots yet — add one or use bulk create.</EmptyState>
        ) : (
          dates.map(date => (
            <View key={date}>
              <Text style={[type.h3, { marginTop: space.md, color: '#3f5bd9' }]}>{fmtDate(date)}</Text>
              {byDate[date].map(s => {
                const len = slotLength(s);
                return (
                  <ListRow
                    key={s.id}
                    title={s.start + ' – ' + s.end}
                    subtitle={len > 0 ? fmtDuration(len) : 'invalid times'}
                    right={
                      <Tag
                        text={s.available !== false ? 'Available' : 'Blocked'}
                        tone={s.available !== false ? 'ok' : 'off'}
                      />
                    }
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
                      <LinkBtn
                        title={s.available !== false ? 'Block' : 'Unblock'}
                        onPress={() => Store.updateSlot(s.id, { available: s.available === false })}
                      />
                      <LinkBtn title="Edit" onPress={() => edit(s)} />
                      <LinkBtn
                        title="Delete"
                        danger
                        onPress={() => { Store.removeSlot(s.id); if (editing === s.id) reset(); }}
                      />
                    </View>
                  </ListRow>
                );
              })}
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
