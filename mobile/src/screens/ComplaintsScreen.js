import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import * as Store from '../engine/store';
import { byId, slotsOverlap, slotsAdjacent, compareSlots } from '../engine/model';
import { fmtDate, fmtWhen } from '../format';
import { colors, space, type, radius } from '../theme';
import {
  Card, CardHead, Field, Btn, LinkBtn, Row, Tag, Note, EmptyState, ListRow,
  Select, Message, Issue, Chip, PromptModal, Overline
} from '../ui';
import { FadeIn, Reveal } from '../anim';

const CATEGORIES = [
  { value: 'clash', label: 'Two of my exams clash' },
  { value: 'backToBack', label: 'Too many exams close together' },
  { value: 'room', label: 'Room or venue problem' },
  { value: 'time', label: 'Date or time problem' },
  { value: 'missing', label: 'My exam is missing from the timetable' },
  { value: 'registration', label: 'I am registered for the wrong course' },
  { value: 'accessibility', label: 'Special needs / accessibility' },
  { value: 'other', label: 'Something else' }
];

const CATEGORY_LABELS = {
  clash: 'Exam clash',
  backToBack: 'Exams too close together',
  room: 'Room / venue problem',
  time: 'Date or time problem',
  missing: 'Exam missing from timetable',
  registration: 'Wrong course registration',
  accessibility: 'Special needs / accessibility',
  other: 'Other'
};

const CATEGORY_ICONS = {
  clash: 'flash-outline',
  backToBack: 'swap-horizontal-outline',
  room: 'business-outline',
  time: 'time-outline',
  missing: 'help-circle-outline',
  registration: 'person-outline',
  accessibility: 'accessibility-outline',
  other: 'ellipsis-horizontal-circle-outline'
};

const STATUS_LABELS = { new: 'New', reviewing: 'Reviewing', resolved: 'Resolved' };
const STATUS_TONES = { new: 'bad', reviewing: 'warn', resolved: 'ok' };
const BLANK = { studentId: '', studentName: '', courseId: '', category: 'clash', message: '' };

export default function ComplaintsScreen({ state, options }) {
  const [form, setForm] = useState(BLANK);
  const [formOpen, setFormOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [lookupId, setLookupId] = useState('');
  const [lookup, setLookup] = useState(null);
  const [filter, setFilter] = useState('all');
  const [replyTo, setReplyTo] = useState(null);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  /* ---------- student self-service ---------- */

  function runLookup() {
    const id = lookupId.trim();
    if (!id) { setLookup(null); return; }

    const courses = Store.coursesForStudent(id, state);
    if (!courses.length) {
      setLookup({ empty: true, id });
      return;
    }

    const rows = courses.map(c => {
      const entry = state.timetable.find(e => e.courseId === c.id);
      return {
        course: c,
        slot: entry ? byId(state.slots, entry.slotId) : null,
        room: entry ? byId(state.rooms, entry.roomId) : null
      };
    }).sort((a, b) => compareSlots(a.slot, b.slot));

    // Flag this student's own clashes and tight turnarounds.
    const warnings = [];
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i], b = rows[j];
        if (!a.slot || !b.slot) continue;
        if (a.slot.id === b.slot.id || slotsOverlap(a.slot, b.slot)) {
          warnings.push({ bad: true, text: a.course.code + ' and ' + b.course.code +
            ' are at the same time on ' + fmtDate(a.slot.date) + '.' });
        } else if (slotsAdjacent(a.slot, b.slot, options.gapMinutes)) {
          warnings.push({ bad: false, text: a.course.code + ' and ' + b.course.code +
            ' are back-to-back on ' + fmtDate(a.slot.date) + '.' });
        }
      }
    }
    const unplaced = rows.filter(r => !r.slot).length;
    if (unplaced) warnings.push({ bad: true, text: unplaced + ' of your exams have not been scheduled yet.' });

    setLookup({ id, rows, warnings });
    setForm(f => ({ ...f, studentId: id }));
  }

  /* ---------- submitting ---------- */

  function submit() {
    const saved = Store.addComplaint(form);
    if (!saved) {
      setFeedback({ tone: 'bad', text: 'Please give your student ID and describe the problem.' });
      return;
    }
    setFeedback({ tone: 'ok', text: 'Complaint submitted. The exams office can now see it below.' });
    setForm(BLANK);
    setFormOpen(false);
  }

  /* ---------- admin side ---------- */

  function remove(id) {
    Alert.alert('Delete complaint', 'Delete this complaint permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => Store.removeComplaint(id) }
    ]);
  }

  async function exportCsv() {
    if (!state.complaints.length) {
      Alert.alert('Nothing to export', 'There are no complaints yet.');
      return;
    }
    const lines = [['Submitted', 'Student ID', 'Name', 'Course', 'Category', 'Status', 'Complaint', 'Response']];
    state.complaints.forEach(c => {
      const course = c.courseId ? byId(state.courses, c.courseId) : null;
      lines.push([fmtWhen(c.createdAt), c.studentId, c.studentName, course ? course.code : '',
                  CATEGORY_LABELS[c.category] || c.category, STATUS_LABELS[c.status] || c.status,
                  c.message, c.response]);
    });
    const csv = lines.map(row =>
      row.map(v => '"' + String(v === undefined ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
    try {
      await Share.share({ message: csv, title: 'Exam complaints (CSV)' });
    } catch (err) {
      Alert.alert('Could not share', err.message);
    }
  }

  const courseOptions = [{ value: '', label: '— not about one specific exam —' }].concat(
    state.courses.map(c => ({ value: c.id, label: c.code + ' — ' + c.name })));

  const visible = filter === 'all'
    ? state.complaints
    : state.complaints.filter(c => c.status === filter);

  const countFor = f => f === 'all'
    ? state.complaints.length
    : state.complaints.filter(c => c.status === f).length;

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">

      {/* ---- student: find my exams ---- */}
      <Card>
        <CardHead
          title="Find my exams" icon="search-outline"
          subtitle="Check your personal timetable first"
        />
        <Row>
          <Field
            value={lookupId}
            onChangeText={setLookupId}
            placeholder="Your student ID, e.g. 20700001"
            style={{ flex: 1, marginBottom: 0 }}
            onSubmitEditing={runLookup}
            returnKeyType="search"
          />
          <Btn title="Look up" icon="arrow-forward" onPress={runLookup} />
        </Row>

        {lookup && lookup.empty ? (
          <View style={{ marginTop: space.md }}>
            <Message
              tone="warn"
              text={'No courses are registered under student ID ' + lookup.id +
                    '. Check the ID, or raise a complaint below if your registration is wrong.'}
            />
          </View>
        ) : null}

        {lookup && lookup.rows ? (
          <FadeIn style={{ marginTop: space.md }}>
            <Overline>{lookup.rows.length + ' exam(s) for ' + lookup.id}</Overline>
            {lookup.rows.map((r, i) => (
              <ListRow
                key={r.course.id}
                first={i === 0}
                accent={r.slot ? 'ok' : 'warn'}
                title={r.course.code}
                subtitle={r.course.name}
                right={
                  r.slot
                    ? <Tag text={r.slot.start + '–' + r.slot.end} tone="accent" icon="time" />
                    : <Tag text="not scheduled" tone="warn" />
                }
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                  <Text style={type.tiny}>
                    {r.slot ? fmtDate(r.slot.date) : 'No date yet'}
                    {r.room ? '  ·  ' + r.room.name : ''}
                  </Text>
                </View>
              </ListRow>
            ))}
            {lookup.warnings.length ? (
              <View style={{ marginTop: space.md }}>
                {lookup.warnings.map((w, i) => (
                  <Issue
                    key={i}
                    severity={w.bad ? 'error' : 'warning'}
                    kind={w.bad ? 'Clash' : 'Tight turnaround'}
                    text={w.text}
                  />
                ))}
              </View>
            ) : (
              <Message tone="ok" text="No clashes found in your personal timetable." />
            )}
          </FadeIn>
        ) : null}
      </Card>

      {/* ---- student: send a complaint ---- */}
      <Card>
        <CardHead
          title="Send a complaint" icon="create-outline"
          subtitle="Tell the exams office what is wrong"
        >
          <Btn
            title={formOpen ? 'Close' : 'Write'}
            icon={formOpen ? 'close' : 'add'}
            variant={formOpen ? 'ghost' : 'soft'}
            size="sm"
            onPress={() => setFormOpen(v => !v)}
          />
        </CardHead>

        <Reveal open={formOpen}>
          <View>
            <Row>
              <Field
                label="Student ID" value={form.studentId}
                onChangeText={v => set('studentId', v)}
                placeholder="20700001" style={{ flex: 1 }}
              />
              <Field
                label="Your name" hint="optional" value={form.studentName}
                onChangeText={v => set('studentName', v)}
                placeholder="Ama Mensah" style={{ flex: 1 }}
              />
            </Row>
            <Select
              label="Which exam is this about?" icon="book-outline"
              value={form.courseId} options={courseOptions}
              onChange={v => set('courseId', v)}
              placeholder="— not about one specific exam —"
            />
            <Select
              label="What is the problem?" icon="help-circle-outline"
              value={form.category} options={CATEGORIES}
              onChange={v => set('category', v)}
            />
            <Field
              label="Details" value={form.message}
              onChangeText={v => set('message', v)}
              placeholder="Explain the problem, including dates and course codes where you can."
              multiline
            />
            <Btn title="Submit complaint" icon="send" onPress={submit} />
          </View>
        </Reveal>

        {feedback ? (
          <View style={{ marginTop: formOpen ? space.md : 0 }}>
            <Message tone={feedback.tone} text={feedback.text} />
          </View>
        ) : null}

        {!formOpen && !feedback ? (
          <Note icon="information-circle-outline">
            Complaints go to the exams office queue below, where they can be answered and tracked.
          </Note>
        ) : null}
      </Card>

      {/* ---- exams office: the queue ---- */}
      <Card>
        <CardHead
          title="Complaints received" icon="file-tray-full-outline"
          subtitle={state.complaints.length + ' total'}
        >
          <Btn title="Export" variant="ghost" size="sm" icon="share-outline" onPress={exportCsv} />
        </CardHead>

        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: space.md }}>
          {['all', 'new', 'reviewing', 'resolved'].map(f => (
            <Chip
              key={f}
              label={f === 'all' ? 'All' : STATUS_LABELS[f]}
              count={countFor(f)}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </View>

        {!visible.length ? (
          <EmptyState icon="chatbubble-ellipses-outline">
            {state.complaints.length
              ? 'No ' + filter + ' complaints.'
              : 'No complaints have been submitted yet.'}
          </EmptyState>
        ) : (
          visible.map((c, i) => {
            const course = c.courseId ? byId(state.courses, c.courseId) : null;
            return (
              <FadeIn key={c.id} delay={i * 40} from={12}>
                <ListRow
                  first={i === 0}
                  accent={STATUS_TONES[c.status]}
                  title={c.studentId + (c.studentName ? '  ·  ' + c.studentName : '')}
                  subtitle={fmtWhen(c.createdAt)}
                  right={<Tag text={STATUS_LABELS[c.status]} tone={STATUS_TONES[c.status]} />}
                >
                  <View style={styles.catRow}>
                    <Ionicons
                      name={CATEGORY_ICONS[c.category] || 'ellipse-outline'}
                      size={12} color={colors.accent}
                    />
                    <Text style={[type.tiny, { color: colors.accent, fontWeight: '700' }]}>
                      {CATEGORY_LABELS[c.category] || c.category}
                      {course ? '  ·  ' + course.code : ''}
                    </Text>
                  </View>

                  <Text style={[type.body, { marginTop: 6 }]}>{c.message}</Text>

                  {c.response ? (
                    <View style={styles.response}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <Ionicons name="return-down-forward" size={12} color={colors.accent} />
                        <Text style={[type.overline, { color: colors.accent }]}>RESPONSE</Text>
                      </View>
                      <Text style={{ fontSize: 13.5, color: colors.text, lineHeight: 19 }}>
                        {c.response}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.actions}>
                    {c.status === 'new' ? (
                      <LinkBtn
                        title="Reviewing" icon="eye-outline"
                        onPress={() => Store.updateComplaint(c.id, { status: 'reviewing' })}
                      />
                    ) : null}
                    {c.status !== 'resolved' ? (
                      <LinkBtn
                        title="Resolve" icon="checkmark-circle-outline"
                        onPress={() => Store.updateComplaint(c.id, { status: 'resolved' })}
                      />
                    ) : (
                      <LinkBtn
                        title="Reopen" icon="refresh-outline"
                        onPress={() => Store.updateComplaint(c.id, { status: 'new' })}
                      />
                    )}
                    <LinkBtn
                      title={c.response ? 'Edit reply' : 'Reply'} icon="chatbox-outline"
                      onPress={() => setReplyTo(c)}
                    />
                    <LinkBtn title="Delete" icon="trash-outline" danger onPress={() => remove(c.id)} />
                  </View>
                </ListRow>
              </FadeIn>
            );
          })
        )}
      </Card>

      <PromptModal
        visible={!!replyTo}
        title={replyTo ? 'Response to ' + replyTo.studentId : ''}
        label="Your response"
        initialValue={replyTo ? replyTo.response : ''}
        multiline
        onCancel={() => setReplyTo(null)}
        onSubmit={text => { Store.updateComplaint(replyTo.id, { response: text }); setReplyTo(null); }}
      />
    </ScrollView>
  );
}

const styles = {
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  response: {
    marginTop: 8, padding: 10, borderRadius: radius.sm,
    backgroundColor: colors.accentSoft, borderLeftWidth: 3, borderLeftColor: colors.accent
  },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end',
    marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.lineSoft
  }
};
