import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as Store from '../engine/store';
import { toMinutes, slotLength } from '../engine/model';
import { fmtDate, fmtDuration, isValidDate, isValidTime, todayIso, addDaysIso } from '../format';
import { colors, space, type, radius } from '../theme';
import {
  Card, CardHead, Field, Btn, LinkBtn, Row, Tag, Note, EmptyState, ListRow, SwitchRow, Divider
} from '../ui';
import { FadeIn, Reveal } from '../anim';

const BLANK = { date: todayIso(), start: '08:00', end: '10:00', available: true };

export default function SlotsScreen({ state }) {
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [mode, setMode] = useState(null); // null | 'single' | 'bulk'
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
    setMode(null);
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
    setMode('single');
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
    setMode(null);
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
  const openCount = state.slots.filter(s => s.available !== false).length;

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <CardHead
          title="Exam periods"
          icon="time-outline"
          subtitle={state.slots.length + ' slot(s) · ' + dates.length + ' day(s)'}
        />

        <Row>
          <Btn
            title={mode === 'single' ? 'Close' : 'Single slot'}
            icon={mode === 'single' ? 'close' : 'add'}
            variant={mode === 'single' ? 'ghost' : 'soft'}
            size="sm"
            onPress={() => setMode(mode === 'single' ? null : 'single')}
            style={{ flex: 1 }}
          />
          <Btn
            title={mode === 'bulk' ? 'Close' : 'Bulk create'}
            icon={mode === 'bulk' ? 'close' : 'copy-outline'}
            variant={mode === 'bulk' ? 'ghost' : 'soft'}
            size="sm"
            onPress={() => setMode(mode === 'bulk' ? null : 'bulk')}
            style={{ flex: 1 }}
          />
        </Row>

        <Reveal open={mode === 'single'}>
          <View style={{ marginTop: space.md }}>
            <Divider style={{ marginTop: 0 }} />
            <Text style={[type.h3, { marginBottom: space.md }]}>
              {editing ? 'Edit time slot' : 'Add a time slot'}
            </Text>
            <Field
              label="Exam date"
              hint="YYYY-MM-DD"
              value={form.date}
              onChangeText={v => set('date', v)}
              placeholder="2026-09-01"
            />
            <Row>
              <Field
                label="Start" hint="HH:MM"
                value={form.start} onChangeText={v => set('start', v)}
                placeholder="08:00" style={{ flex: 1 }}
              />
              <Field
                label="End" hint="HH:MM"
                value={form.end} onChangeText={v => set('end', v)}
                placeholder="10:00" style={{ flex: 1 }}
              />
            </Row>
            <SwitchRow
              label="Slot is available"
              icon="checkmark-circle-outline"
              value={form.available}
              onValueChange={v => set('available', v)}
            />
            <Row>
              <Btn
                title={editing ? 'Save changes' : 'Add slot'}
                icon="checkmark" onPress={submit} style={{ flex: 1 }}
              />
              {editing ? <Btn title="Cancel" variant="ghost" onPress={reset} style={{ flex: 1 }} /> : null}
            </Row>
          </View>
        </Reveal>

        <Reveal open={mode === 'bulk'}>
          <View style={{ marginTop: space.md }}>
            <Divider style={{ marginTop: 0 }} />
            <Text style={[type.h3, { marginBottom: 6 }]}>Bulk create</Text>
            <Note icon="information-circle-outline">
              Generate the same daily sessions across a date range. Existing slots are never duplicated.
            </Note>
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
              icon="calendar-outline"
              value={bulk.skipWeekends}
              onValueChange={v => setB('skipWeekends', v)}
            />
            <Btn title="Create slots" icon="duplicate-outline" onPress={createBulk} />
          </View>
        </Reveal>
      </Card>

      <Card>
        <CardHead
          title="Schedule window"
          icon="calendar-outline"
          subtitle={openCount + ' available · ' + (state.slots.length - openCount) + ' blocked'}
        >
          {state.slots.length ? (
            <Btn title="Clear" variant="danger" size="sm" icon="trash-outline" onPress={removeAll} />
          ) : null}
        </CardHead>

        {!state.slots.length ? (
          <EmptyState icon="time-outline">
            No time slots yet. Use Bulk create to lay out a whole exam week in one go.
          </EmptyState>
        ) : (
          dates.map((date, di) => (
            <FadeIn key={date} delay={di * 50} from={12}>
              <View style={{ marginBottom: space.sm }}>
                <View style={styles.dayHead}>
                  <View style={styles.dayDot} />
                  <Text style={[type.h3, { color: colors.accent }]}>{fmtDate(date)}</Text>
                  <Text style={type.tiny}>{byDate[date].length} session(s)</Text>
                </View>

                {byDate[date].map((slot, i) => {
                  const len = slotLength(slot);
                  const isOpen = slot.available !== false;
                  return (
                    <ListRow
                      key={slot.id}
                      first={i === 0}
                      accent={isOpen ? 'ok' : 'off'}
                      title={slot.start + ' – ' + slot.end}
                      subtitle={len > 0 ? fmtDuration(len) + ' long' : 'invalid times'}
                      right={<Tag text={isOpen ? 'Open' : 'Blocked'} tone={isOpen ? 'ok' : 'off'} />}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
                        <LinkBtn
                          title={isOpen ? 'Block' : 'Unblock'}
                          icon={isOpen ? 'lock-closed-outline' : 'lock-open-outline'}
                          onPress={() => Store.updateSlot(slot.id, { available: !isOpen })}
                        />
                        <LinkBtn title="Edit" icon="create-outline" onPress={() => edit(slot)} />
                        <LinkBtn
                          title="Delete" icon="trash-outline" danger
                          onPress={() => { Store.removeSlot(slot.id); if (editing === slot.id) reset(); }}
                        />
                      </View>
                    </ListRow>
                  );
                })}
              </View>
            </FadeIn>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = {
  dayHead: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingVertical: space.sm, marginTop: space.sm
  },
  dayDot: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent
  }
};
