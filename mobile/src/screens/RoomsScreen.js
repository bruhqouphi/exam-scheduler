import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as Store from '../engine/store';
import { headcount } from '../engine/model';
import { colors, space, type, radius } from '../theme';
import {
  Card, CardHead, Field, Btn, LinkBtn, Row, Tag, EmptyState, ListRow, SwitchRow, Meter, Note
} from '../ui';
import { FadeIn, Reveal } from '../anim';

const BLANK = { name: '', capacity: '100', building: '', available: true };

export default function RoomsScreen({ state }) {
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  function reset() {
    setForm(BLANK);
    setEditing(null);
    setOpen(false);
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
    setOpen(true);
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

  const openRooms = state.rooms.filter(r => r.available !== false);
  const seats = openRooms.reduce((sum, r) => sum + r.capacity, 0);
  const biggestClass = state.courses.reduce((m, c) => Math.max(m, headcount(c)), 0);
  const biggestRoom = openRooms.reduce((m, r) => Math.max(m, r.capacity), 0);
  const tooSmall = biggestClass > biggestRoom && state.courses.length > 0;

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <CardHead
          title={editing ? 'Edit room' : 'Add a room'}
          icon="business-outline"
          subtitle={editing ? 'Change the details and save' : 'Where exams can be held'}
        >
          <Btn
            title={open ? 'Close' : 'New'}
            icon={open ? 'close' : 'add'}
            variant={open ? 'ghost' : 'soft'}
            size="sm"
            onPress={() => (open ? reset() : setOpen(true))}
          />
        </CardHead>

        <Reveal open={open}>
          <View>
            <Field
              label="Room name / number"
              value={form.name}
              onChangeText={v => set('name', v)}
              placeholder="PB 010"
            />
            <Row>
              <Field
                label="Capacity"
                hint="seats"
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
              icon="checkmark-circle-outline"
              value={form.available}
              onValueChange={v => set('available', v)}
            />
            <Row>
              <Btn
                title={editing ? 'Save changes' : 'Add room'}
                icon="checkmark"
                onPress={submit}
                style={{ flex: 1 }}
              />
              {editing ? (
                <Btn title="Cancel" variant="ghost" onPress={reset} style={{ flex: 1 }} />
              ) : null}
            </Row>
          </View>
        </Reveal>

        {!open ? (
          <View style={{
            backgroundColor: colors.tint, borderRadius: radius.md, padding: space.md
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Ionicons name="albums-outline" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={type.h2}>{seats} seats available</Text>
                <Text style={type.tiny}>
                  across {openRooms.length} room(s) · largest holds {biggestRoom || 0}
                </Text>
              </View>
            </View>
            {biggestClass > 0 ? (
              <View style={{ marginTop: space.sm }}>
                <Meter value={biggestClass} max={biggestRoom || biggestClass} tone={tooSmall ? 'bad' : 'ok'} />
                <Text style={[type.tiny, { marginTop: 4, color: tooSmall ? colors.danger : colors.muted }]}>
                  {tooSmall
                    ? 'Largest class (' + biggestClass + ') will not fit in any available room.'
                    : 'Largest class is ' + biggestClass + ' students — fits.'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card>
        <CardHead title="Rooms" icon="list-outline" subtitle={state.rooms.length + ' total'} />

        {state.rooms.length > 3 ? (
          <Field value={search} onChangeText={setSearch} placeholder="Search rooms…" />
        ) : null}

        {!rows.length ? (
          <EmptyState icon="business-outline">
            {state.rooms.length
              ? 'No rooms match that search.'
              : 'No rooms yet. Tap New above to add a venue.'}
          </EmptyState>
        ) : (
          rows.map((r, i) => {
            const isOpen = r.available !== false;
            return (
              <FadeIn key={r.id} delay={i * 40} from={12}>
                <ListRow
                  first={i === 0}
                  accent={isOpen ? 'ok' : 'off'}
                  title={r.name}
                  subtitle={r.building || 'No location set'}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Tag text={String(r.capacity)} tone="accent" icon="people" />
                      <Tag
                        text={isOpen ? 'Open' : 'Blocked'}
                        tone={isOpen ? 'ok' : 'off'}
                      />
                    </View>
                  }
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                    <LinkBtn
                      title={isOpen ? 'Block' : 'Unblock'}
                      icon={isOpen ? 'lock-closed-outline' : 'lock-open-outline'}
                      onPress={() => Store.updateRoom(r.id, { available: !isOpen })}
                    />
                    <LinkBtn title="Edit" icon="create-outline" onPress={() => edit(r)} />
                    <LinkBtn title="Delete" icon="trash-outline" danger onPress={() => remove(r)} />
                  </View>
                </ListRow>
              </FadeIn>
            );
          })
        )}

        {state.rooms.length && !openRooms.length ? (
          <Note icon="warning-outline">
            Every room is blocked, so nothing can be scheduled. Unblock at least one.
          </Note>
        ) : null}
      </Card>
    </ScrollView>
  );
}
