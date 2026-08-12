import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, space, type, radius } from '../theme';
import { Card, CardHead, Note, Message, Issue, Overline, StatTile } from '../ui';
import { FadeIn } from '../anim';

const LABELS = {
  student: 'Student clash',
  room: 'Room double-booked',
  capacity: 'Room too small',
  availability: 'Outside available period',
  duration: 'Slot too short',
  backToBack: 'Back-to-back exam',
  sameDay: 'Two exams in one day',
  unscheduled: 'Not scheduled',
  missing: 'Broken reference'
};

export default function ConflictsScreen({ conflicts }) {
  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');

  // Count by type so the summary says what kind of trouble it is.
  const counts = {};
  conflicts.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }}>
      <Card>
        <CardHead
          title="Conflict check"
          icon="shield-checkmark-outline"
          subtitle="Re-checked automatically after every change"
        />
        <Note icon="information-circle-outline">
          Checked against the timetable as it stands, including any exam you reassigned by hand.
        </Note>

        {!conflicts.length ? (
          <FadeIn>
            <View style={styles.clear}>
              <View style={styles.clearIcon}>
                <Ionicons name="checkmark-circle" size={30} color={colors.ok} />
              </View>
              <Text style={[type.h2, { color: colors.ok, marginTop: space.sm }]}>All clear</Text>
              <Text style={[type.sub, { textAlign: 'center', marginTop: 4 }]}>
                Every exam has a room, a slot and enough seats, and no student sits two papers
                at once.
              </Text>
            </View>
          </FadeIn>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <StatTile
              icon="close-circle" label="Must fix" value={errors.length}
              tone={errors.length ? 'bad' : 'good'}
            />
            <StatTile icon="alert-circle" label="Warnings" value={warnings.length} />
          </View>
        )}
      </Card>

      {errors.length ? (
        <Card>
          <CardHead
            title="Hard conflicts" icon="close-circle-outline"
            subtitle="These make the timetable unusable"
          />
          {errors.map((c, i) => (
            <FadeIn key={i} delay={i * 40} from={10}>
              <Issue severity="error" kind={LABELS[c.type] || c.type} text={c.message} />
            </FadeIn>
          ))}
        </Card>
      ) : null}

      {warnings.length ? (
        <Card>
          <CardHead
            title="Warnings" icon="alert-circle-outline"
            subtitle="Legal, but harder on students"
          />
          {warnings.map((c, i) => (
            <FadeIn key={i} delay={i * 30} from={10}>
              <Issue severity="warning" kind={LABELS[c.type] || c.type} text={c.message} />
            </FadeIn>
          ))}
        </Card>
      ) : null}

      {conflicts.length ? (
        <Card>
          <Overline>By type</Overline>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {Object.keys(counts).map(t => (
              <View key={t} style={styles.countPill}>
                <Text style={type.tiny}>{LABELS[t] || t}</Text>
                <Text style={styles.countValue}>{counts[t]}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = {
  clear: { alignItems: 'center', paddingVertical: space.lg },
  clearIcon: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.okSoft,
    alignItems: 'center', justifyContent: 'center'
  },
  countPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.tint, borderWidth: 1, borderColor: colors.lineSoft,
    borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6
  },
  countValue: { fontSize: 12, fontWeight: '800', color: colors.accent }
};
