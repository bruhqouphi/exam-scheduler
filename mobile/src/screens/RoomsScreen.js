import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';

import * as Store from '../engine/store';
import { space, type } from '../theme';
import { Card, CardHead, Field, Btn, LinkBtn, Row, Tag, EmptyState, ListRow, SwitchRow } from '../ui';

const BLANK = { name: '', capacity: '100', building: '', available: true };

export default function RoomsScreen({ state }) {
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  function reset() {
    setForm(BLANK);
    setEditing(null);
  }

  function submit() {
    if (!form.name.trim()) {
      Alert.alert('Missing details', 'A room needs a name or number.');
      return;
    }
    if (editing) Store.updateRoom(editing, form);
    else Store.addRoom(form);
    reset();
  }

  function edit(room) {
    setEditing(room.id);
    setForm({
      name: room.name,
      capacity: String(room.capacity),
      building: room.building || '',
      available: room.available !== false
    });
  }

  function remove(room) {
    Alert.alert('Delete room', 'Delete ' + room.name + '?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { Store.removeRoom(room.id); if (editing === room.id) reset(); }
      }
    ]);
  }

  const q = search.trim().toLowerCase();
  const rows = state.rooms.filter(r => !q || (r.name + ' ' + (r.building || '')).toLowerCase().includes(q));
  const seats = state.rooms
    .filter(r => r.available !== false)
    .reduce((sum, r) => sum + r.capacity, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={[type.h2, { marginBottom: space.md }]}>
          {editing ? 'Edit room' : 'Add a room'}
        </Text>

        <Field
          label="Room name / number"
          value={form.name}
          onChangeText={v => set('name', v)}
          placeholder="PB 010"
        />
        <Row>
          <Field
            label="Capacity"
            value={form.capacity}
            onChangeText={v => set('capacity', v)}
            keyboardType="number-pad"
            style={{ flex: 1 }}
          />
          <Field
            label="Building"
            value={form.building}
            onChangeText={v => set('building', v)}
            placeholder="Petroleum Block"
            style={{ flex: 1.4 }}
          />
        </Row>
        <SwitchRow
          label="Available for exams"
          value={form.available}
          onValueChange={v => set('available', v)}
        />

        <Row>
          <Btn title={editing ? 'Save changes' : 'Add room'} onPress={submit} style={{ flex: 1 }} />
          {editing ? <Btn title="Cancel" variant="ghost" onPress={reset} style={{ flex: 1 }} /> : null}
        </Row>
      </Card>

      <Card>
        <CardHead title={'Rooms (' + state.rooms.length + ')'} />
        <Text style={[type.sub, { marginBottom: space.sm }]}>
          {seats} seats available across {state.rooms.filter(r => r.available !== false).length} rooms
        </Text>
        {state.rooms.length > 2 ? (
          <Field value={search} onChangeText={setSearch} placeholder="Search rooms…" />
        ) : null}

        {!rows.length ? (
          <EmptyState>
            {state.rooms.length ? 'No rooms match that search.' : 'No rooms yet — add one above.'}
          </EmptyState>
        ) : (
          rows.map(r => (
            <ListRow
              key={r.id}
              title={r.name}
              subtitle={r.building || '—'}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Tag text={'seats ' + r.capacity} tone="accent" />
                  <Tag
                    text={r.available !== false ? 'Available' : 'Unavailable'}
                    tone={r.available !== false ? 'ok' : 'off'}
                  />
                </View>
              }
            >
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
                <LinkBtn
                  title={r.available !== false ? 'Mark unavailable' : 'Mark available'}
                  onPress={() => Store.updateRoom(r.id, { available: r.available === false })}
                />
                <LinkBtn title="Edit" onPress={() => edit(r)} />
                <LinkBtn title="Delete" danger onPress={() => remove(r)} />
              </View>
            </ListRow>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
