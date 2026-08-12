import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as Store from '../engine/store';
import { headcount } from '../engine/model';
import { fmtDuration } from '../format';
import { colors, space, type, radius } from '../theme';
import {
  Card, CardHead, Field, Btn, LinkBtn, Row, Tag, Note, EmptyState, ListRow
} from '../ui';
import { FadeIn, Reveal } from '../anim';

const BLANK = { code: '', name: '', duration: '120', studentCount: '0', studentsText: '' };

export default function CoursesScreen({ state }) {
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
    if (!form.code.trim() || !form.name.trim()) {
      Alert.alert('Missing details', 'A course needs both a code and a name.');
      return;
    }
    if (editing) Store.updateCourse(editing, form);
    else Store.addCourse(form);
    reset();
  }

  function edit(course) {
    setEditing(course.id);
    setOpen(true);
    setForm({
      code: course.code,
      name: course.name,
      duration: String(course.duration),
      studentCount: String(headcount(course)),
      studentsText: (course.students || []).join(', ')
    });
  }

  function remove(course) {
    Alert.alert('Delete course', 'Delete ' + course.code + '?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { Store.removeCourse(course.id); if (editing === course.id) reset(); }
      }
    ]);
  }

  const q = search.trim().toLowerCase();
  const rows = state.courses.filter(c => !q || (c.code + ' ' + c.name).toLowerCase().includes(q));
  const totalSittings = state.courses.reduce((n, c) => n + headcount(c), 0);

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <CardHead
          title={editing ? 'Edit course' : 'Add a course'}
          icon="book-outline"
          subtitle={editing ? 'Change the details and save' : 'Course code, size and exam length'}
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
              label="Course code"
              value={form.code}
              onChangeText={v => set('code', v)}
              placeholder="CSM 157"
              autoCapitalize="characters"
            />
            <Field
              label="Course name"
              value={form.name}
              onChangeText={v => set('name', v)}
              placeholder="Discrete Mathematics"
            />
            <Row>
              <Field
                label="Duration"
                hint="minutes"
                value={form.duration}
                onChangeText={v => set('duration', v)}
                keyboardType="number-pad"
                style={{ flex: 1 }}
              />
              <Field
                label="Students"
                hint="headcount"
                value={form.studentCount}
                onChangeText={v => set('studentCount', v)}
                keyboardType="number-pad"
                style={{ flex: 1 }}
              />
            </Row>
            <Field
              label="Registered students"
              hint="optional"
              value={form.studentsText}
              onChangeText={v => set('studentsText', v)}
              placeholder="20700001, 20700002, 20700003"
              multiline
            />
            <Note icon="information-circle-outline">
              List real student IDs when you want clash detection across courses. A headcount alone
              still enforces room capacity, but the app cannot know who overlaps.
            </Note>
            <Row>
              <Btn
                title={editing ? 'Save changes' : 'Add course'}
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
          <Row>
            <Stat icon="library-outline" value={state.courses.length} label="courses" />
            <Stat icon="people-outline" value={totalSittings} label="sittings" />
          </Row>
        ) : null}
      </Card>

      <Card>
        <CardHead title="Courses" icon="list-outline" subtitle={state.courses.length + ' total'} />

        {state.courses.length > 3 ? (
          <Field
            value={search}
            onChangeText={setSearch}
            placeholder="Search by code or name…"
          />
        ) : null}

        {!rows.length ? (
          <EmptyState icon="book-outline">
            {state.courses.length
              ? 'No courses match that search.'
              : 'No courses yet. Tap New above to add your first exam.'}
          </EmptyState>
        ) : (
          rows.map((c, i) => (
            <FadeIn key={c.id} delay={i * 40} from={12}>
              <ListRow
                first={i === 0}
                accent={c.students && c.students.length ? 'ok' : 'warn'}
                title={c.code}
                subtitle={c.name}
                right={
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Tag text={String(headcount(c))} tone="accent" icon="people" />
                    <Text style={type.tiny}>{fmtDuration(c.duration)}</Text>
                  </View>
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  {c.students && c.students.length ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="shield-checkmark" size={12} color={colors.ok} />
                      <Text style={type.tiny}>{c.students.length} IDs — clash detection on</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="alert-circle-outline" size={12} color={colors.warn} />
                      <Text style={[type.tiny, { color: colors.warn }]}>headcount only</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  <LinkBtn title="Edit" icon="create-outline" onPress={() => edit(c)} />
                  <LinkBtn title="Delete" icon="trash-outline" danger onPress={() => remove(c)} />
                </View>
              </ListRow>
            </FadeIn>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

/* Compact summary pill shown while the form is collapsed. */
function Stat({ icon, value, label }) {
  return (
    <View style={{
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm,
      backgroundColor: colors.tint, borderRadius: radius.md, padding: space.md
    }}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <View>
        <Text style={[type.h2, { fontVariant: ['tabular-nums'] }]}>{value}</Text>
        <Text style={type.tiny}>{label}</Text>
      </View>
    </View>
  );
}
