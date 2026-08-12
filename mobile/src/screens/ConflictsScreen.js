import React from 'react';
import { ScrollView } from 'react-native';

import { space } from '../theme';
import { Card, CardHead, Note, Message, Issue } from '../ui';

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
  const sorted = errors.concat(warnings);

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }}>
      <Card>
        <CardHead title="Conflict check" />
        <Note>
          Checked against the timetable as it stands, including any exam you reassigned by hand.
        </Note>

        {!conflicts.length ? (
          <Message
            tone="ok"
            text="No conflicts found. Every exam has a room, a slot, enough seats, and no student sits two papers at once."
          />
        ) : (
          <>
            <Message
              tone={errors.length ? 'bad' : 'warn'}
              text={errors.length + ' hard conflict(s) and ' + warnings.length + ' warning(s).'}
            />
            {sorted.map((c, i) => (
              <Issue
                key={i}
                severity={c.severity}
                kind={LABELS[c.type] || c.type}
                text={c.message}
              />
            ))}
          </>
        )}
      </Card>
    </ScrollView>
  );
}
