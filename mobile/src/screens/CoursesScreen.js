import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';

import * as Store from '../engine/store';
import { headcount } from '../engine/model';
import { fmtDuration } from '../format';
import { colors, space, type } from '../theme';
import { Card, CardHead, Field, Btn, LinkBtn, Row, Tag, Note, EmptyState, ListRow } from '../ui';

const BLANK = { code: '', name: '', duration: '120', studentCount: '0', studentsText: '' };

export default function CoursesScreen({ state }) {
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  function reset() {
    setForm(BLANK);
    setEditing(null);
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

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={[type.h2, { marginBottom: space.md }]}>
          {editing ? 'Edit course' : 'Add a course'}
        </Text>

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
            label="Duration (minutes)"
            value={form.duration}
            onChangeText={v => set('duration', v)}
            keyboardType="number-pad"
            style={{ flex: 1 }}
          />
          <Field
            label="Number of students"
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
        <Note>
          List real student IDs when you want clash detection across courses. A headcount alone
          still enforces room capacity, but the app cannot know who overlaps.
        </Note>

        <Row>
          <Btn title={editing ? 'Save changes' : 'Add course'} onPress={submit} style={{ flex: 1 }} />
          {editing ? <Btn title="Cancel" variant="ghost" onPress={reset} style={{ flex: 1 }} /> : null}
        </Row>
      </Card>

      <Card>
        <CardHead title={'Courses (' + state.courses.length + ')'} />
        {state.courses.length > 2 ? (
          <Field value={search} onChangeText={setSearch} placeholder="Search courses…" />
        ) : null}

        {!rows.length ? (
          <EmptyState>
            {state.courses.length ? 'No courses match that search.' : 'No courses yet — add one above.'}
          </EmptyState>
        ) : (
          rows.map(c => (
            <ListRow
              key={c.id}
              title={c.code}
              subtitle={c.name}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Tag text={headcount(c) + ' students'} tone="accent" />
                  <Text style={type.sub}>{fmtDuration(c.duration)}</Text>
                </View>
              }
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                {c.students && c.students.length ? (
                  <Text style={type.sub}>{c.students.length} student IDs listed</Text>
                ) : (
                  <Text style={[type.sub, { color: colors.warn }]}>headcount only</Text>
                )}
                <View style={{ flex: 1 }} />
                <LinkBtn title="Edit" onPress={() => edit(c)} />
                <LinkBtn title="Delete" danger onPress={() => remove(c)} />
              </View>
            </ListRow>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
