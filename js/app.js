/* ------------------------------------------------------------------
   app.js — UI wiring: tabs, CRUD forms, generation, timetable, conflicts
------------------------------------------------------------------- */

(function () {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.prototype.slice.call(document.querySelectorAll(sel));

  const esc = s => String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let state = Store.load();
  let filters = { courses: '', rooms: '', complaints: 'all' };
  let view = 'list';
  let conflicts = [];

  /* ================= formatting ================= */

  function fmtDate(iso) {
    const parts = String(iso || '').split('-');
    if (parts.length !== 3) return iso || '—';
    const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDuration(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return (h ? h + 'h' : '') + (m ? (h ? ' ' : '') + m + 'm' : (h ? '' : '0m'));
  }

  function slotLabel(slot) {
    return slot ? fmtDate(slot.date) + ', ' + slot.start + '–' + slot.end : 'Unassigned';
  }

  /* ================= options ================= */

  function readOptions() {
    return {
      weightSpread: +$('#opt-spread').value,
      weightBackToBack: +$('#opt-b2b').value,
      weightSameDay: +$('#opt-sameday').value,
      weightRoomWaste: +$('#opt-waste').value / 20,
      gapMinutes: Math.max(0, +$('#opt-gap').value || 0)
    };
  }

  function bindOptionOutputs() {
    const pairs = [['#opt-spread', '#out-spread', 1], ['#opt-b2b', '#out-b2b', 1],
                   ['#opt-sameday', '#out-sameday', 1], ['#opt-waste', '#out-waste', 1 / 20]];
    pairs.forEach(p => {
      const input = $(p[0]), out = $(p[1]), scale = p[2];
      const sync = () => { out.textContent = (input.value * scale).toFixed(scale === 1 ? 0 : 2); };
      input.addEventListener('input', sync);
      sync();
    });
  }

  /* ================= tabs ================= */

  function initTabs() {
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach(t => t.classList.remove('active'));
        $$('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        $('#panel-' + tab.dataset.tab).classList.add('active');
      });
    });
  }

  /* ================= courses ================= */

  function renderCourses() {
    const q = filters.courses.toLowerCase();
    const rows = state.courses.filter(c =>
      !q || (c.code + ' ' + c.name).toLowerCase().indexOf(q) > -1);
    const body = $('#table-courses tbody');

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty">' +
        (state.courses.length ? 'No courses match that search.' : 'No courses yet — add one on the left.') +
        '</td></tr>';
    } else {
      body.innerHTML = rows.map(c => {
        const ids = c.students && c.students.length
          ? c.students.length + ' listed'
          : '<span class="tag off">headcount only</span>';
        return '<tr>' +
          '<td class="mono"><strong>' + esc(c.code) + '</strong></td>' +
          '<td>' + esc(c.name) + '</td>' +
          '<td class="mono">' + Store.headcount(c) + '</td>' +
          '<td class="mono">' + fmtDuration(c.duration) + '</td>' +
          '<td>' + ids + '</td>' +
          '<td class="actions">' +
            '<button class="btn link" data-edit-course="' + c.id + '">Edit</button>' +
            '<button class="btn link danger" data-del-course="' + c.id + '">Delete</button>' +
          '</td></tr>';
      }).join('');
    }

    body.querySelectorAll('[data-edit-course]').forEach(b =>
      b.addEventListener('click', () => editCourse(b.dataset.editCourse)));
    body.querySelectorAll('[data-del-course]').forEach(b =>
      b.addEventListener('click', () => {
        const c = Store.byId(state.courses, b.dataset.delCourse);
        if (confirm('Delete ' + c.code + '?')) { Store.removeCourse(c.id); refresh(); }
      }));
  }

  function editCourse(id) {
    const c = Store.byId(state.courses, id);
    if (!c) return;
    $('#course-id').value = c.id;
    $('#course-code').value = c.code;
    $('#course-name').value = c.name;
    $('#course-duration').value = c.duration;
    $('#course-count').value = Store.headcount(c);
    $('#course-students').value = (c.students || []).join(', ');
    $('#course-form-title').textContent = 'Edit course';
    $('#course-cancel').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetCourseForm() {
    $('#form-course').reset();
    $('#course-id').value = '';
    $('#course-duration').value = 120;
    $('#course-count').value = 0;
    $('#course-form-title').textContent = 'Add a course';
    $('#course-cancel').hidden = true;
  }

  function initCourses() {
    $('#form-course').addEventListener('submit', e => {
      e.preventDefault();
      const data = {
        code: $('#course-code').value,
        name: $('#course-name').value,
        duration: $('#course-duration').value,
        studentCount: $('#course-count').value,
        studentsText: $('#course-students').value
      };
      const id = $('#course-id').value;
      if (id) Store.updateCourse(id, data); else Store.addCourse(data);
      resetCourseForm();
      refresh();
    });
    $('#course-cancel').addEventListener('click', resetCourseForm);
    $('#search-courses').addEventListener('input', e => {
      filters.courses = e.target.value; renderCourses();
    });
  }

  /* ================= rooms ================= */

  function renderRooms() {
    const q = filters.rooms.toLowerCase();
    const rows = state.rooms.filter(r =>
      !q || (r.name + ' ' + (r.building || '')).toLowerCase().indexOf(q) > -1);
    const body = $('#table-rooms tbody');

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty">' +
        (state.rooms.length ? 'No rooms match that search.' : 'No rooms yet — add one on the left.') +
        '</td></tr>';
    } else {
      body.innerHTML = rows.map(r =>
        '<tr>' +
          '<td><strong>' + esc(r.name) + '</strong></td>' +
          '<td class="mono">' + r.capacity + '</td>' +
          '<td>' + (esc(r.building) || '—') + '</td>' +
          '<td>' + (r.available !== false
            ? '<span class="tag ok">Available</span>'
            : '<span class="tag off">Unavailable</span>') + '</td>' +
          '<td class="actions">' +
            '<button class="btn link" data-toggle-room="' + r.id + '">' +
              (r.available !== false ? 'Mark unavailable' : 'Mark available') + '</button>' +
            '<button class="btn link" data-edit-room="' + r.id + '">Edit</button>' +
            '<button class="btn link danger" data-del-room="' + r.id + '">Delete</button>' +
          '</td></tr>').join('');
    }

    body.querySelectorAll('[data-edit-room]').forEach(b =>
      b.addEventListener('click', () => editRoom(b.dataset.editRoom)));
    body.querySelectorAll('[data-toggle-room]').forEach(b =>
      b.addEventListener('click', () => {
        const r = Store.byId(state.rooms, b.dataset.toggleRoom);
        Store.updateRoom(r.id, { available: r.available === false });
        refresh();
      }));
    body.querySelectorAll('[data-del-room]').forEach(b =>
      b.addEventListener('click', () => {
        const r = Store.byId(state.rooms, b.dataset.delRoom);
        if (confirm('Delete ' + r.name + '?')) { Store.removeRoom(r.id); refresh(); }
      }));
  }

  function editRoom(id) {
    const r = Store.byId(state.rooms, id);
    if (!r) return;
    $('#room-id').value = r.id;
    $('#room-name').value = r.name;
    $('#room-capacity').value = r.capacity;
    $('#room-building').value = r.building || '';
    $('#room-available').checked = r.available !== false;
    $('#room-form-title').textContent = 'Edit room';
    $('#room-cancel').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetRoomForm() {
    $('#form-room').reset();
    $('#room-id').value = '';
    $('#room-capacity').value = 100;
    $('#room-available').checked = true;
    $('#room-form-title').textContent = 'Add a room';
    $('#room-cancel').hidden = true;
  }

  function initRooms() {
    $('#form-room').addEventListener('submit', e => {
      e.preventDefault();
      const data = {
        name: $('#room-name').value,
        capacity: $('#room-capacity').value,
        building: $('#room-building').value,
        available: $('#room-available').checked
      };
      const id = $('#room-id').value;
      if (id) Store.updateRoom(id, data); else Store.addRoom(data);
      resetRoomForm();
      refresh();
    });
    $('#room-cancel').addEventListener('click', resetRoomForm);
    $('#search-rooms').addEventListener('input', e => {
      filters.rooms = e.target.value; renderRooms();
    });
  }

  /* ================= time slots ================= */

  function renderSlots() {
    const body = $('#table-slots tbody');
    if (!state.slots.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty">No time slots yet — add one or use bulk create.</td></tr>';
      return;
    }
    body.innerHTML = state.slots.map(s => {
      const len = Store.slotLength(s);
      return '<tr>' +
        '<td>' + fmtDate(s.date) + '</td>' +
        '<td class="mono">' + esc(s.start) + '</td>' +
        '<td class="mono">' + esc(s.end) + '</td>' +
        '<td class="mono">' + (len > 0 ? fmtDuration(len) : '<span class="tag bad">invalid</span>') + '</td>' +
        '<td>' + (s.available !== false
          ? '<span class="tag ok">Available</span>'
          : '<span class="tag off">Unavailable</span>') + '</td>' +
        '<td class="actions">' +
          '<button class="btn link" data-toggle-slot="' + s.id + '">' +
            (s.available !== false ? 'Block' : 'Unblock') + '</button>' +
          '<button class="btn link" data-edit-slot="' + s.id + '">Edit</button>' +
          '<button class="btn link danger" data-del-slot="' + s.id + '">Delete</button>' +
        '</td></tr>';
    }).join('');

    body.querySelectorAll('[data-toggle-slot]').forEach(b =>
      b.addEventListener('click', () => {
        const s = Store.byId(state.slots, b.dataset.toggleSlot);
        Store.updateSlot(s.id, { available: s.available === false });
        refresh();
      }));
    body.querySelectorAll('[data-edit-slot]').forEach(b =>
      b.addEventListener('click', () => editSlot(b.dataset.editSlot)));
    body.querySelectorAll('[data-del-slot]').forEach(b =>
      b.addEventListener('click', () => { Store.removeSlot(b.dataset.delSlot); refresh(); }));
  }

  function editSlot(id) {
    const s = Store.byId(state.slots, id);
    if (!s) return;
    $('#slot-id').value = s.id;
    $('#slot-date').value = s.date;
    $('#slot-start').value = s.start;
    $('#slot-end').value = s.end;
    $('#slot-available').checked = s.available !== false;
    $('#slot-form-title').textContent = 'Edit time slot';
    $('#slot-cancel').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetSlotForm() {
    $('#form-slot').reset();
    $('#slot-id').value = '';
    $('#slot-start').value = '08:00';
    $('#slot-end').value = '10:00';
    $('#slot-available').checked = true;
    $('#slot-form-title').textContent = 'Add a time slot';
    $('#slot-cancel').hidden = true;
  }

  function initSlots() {
    $('#form-slot').addEventListener('submit', e => {
      e.preventDefault();
      const data = {
        date: $('#slot-date').value,
        start: $('#slot-start').value,
        end: $('#slot-end').value,
        available: $('#slot-available').checked
      };
      if (Store.toMinutes(data.end) <= Store.toMinutes(data.start)) {
        alert('The end time must be after the start time.');
        return;
      }
      const id = $('#slot-id').value;
      if (id) Store.updateSlot(id, data); else Store.addSlot(data);
      resetSlotForm();
      refresh();
    });
    $('#slot-cancel').addEventListener('click', resetSlotForm);

    $('#btn-bulk-slots').addEventListener('click', () => {
      const from = $('#bulk-from').value, to = $('#bulk-to').value;
      if (!from || !to) { alert('Pick a start and end date for the range.'); return; }
      if (to < from) { alert('The "to" date must not be before the "from" date.'); return; }

      const sessions = $('#bulk-sessions').value.split('\n')
        .map(line => line.trim()).filter(Boolean)
        .map(line => line.split(/\s*-\s*/))
        .filter(p => p.length === 2 && Store.toMinutes(p[1]) > Store.toMinutes(p[0]));
      if (!sessions.length) { alert('Add at least one valid session, e.g. 08:00-10:00'); return; }

      const skipWeekends = $('#bulk-skip-weekends').checked;
      const pad = n => String(n).padStart(2, '0');
      const cursor = new Date(from + 'T00:00:00');
      const last = new Date(to + 'T00:00:00');
      let made = 0;

      while (cursor <= last && made < 400) {
        const weekend = cursor.getDay() === 0 || cursor.getDay() === 6;
        if (!(skipWeekends && weekend)) {
          const iso = cursor.getFullYear() + '-' + pad(cursor.getMonth() + 1) + '-' + pad(cursor.getDate());
          sessions.forEach(s => {
            const exists = state.slots.some(x => x.date === iso && x.start === s[0] && x.end === s[1]);
            if (!exists) { Store.addSlot({ date: iso, start: s[0], end: s[1], available: true }); made++; }
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      refresh();
      alert(made + ' time slot(s) created.');
    });

    $('#btn-clear-slots').addEventListener('click', () => {
      if (!state.slots.length) return;
      if (confirm('Remove all ' + state.slots.length + ' time slots?')) {
        state.slots.slice().forEach(s => Store.removeSlot(s.id));
        refresh();
      }
    });
  }

  /* ================= generate + timetable ================= */

  function initSchedule() {
    $('#btn-generate').addEventListener('click', () => {
      const btn = $('#btn-generate');
      btn.disabled = true;
      btn.textContent = 'Solving...';
      // Yield once so the button state paints before the solver blocks.
      setTimeout(() => {
        try {
          const result = Scheduler.generate(state, readOptions());
          Store.setTimetable(result.entries, result.unscheduled, result.stats);
          showMessage(result.message, result.entries.length === state.courses.length ? 'ok' : 'warn');
        } catch (err) {
          console.error(err);
          showMessage('Generation failed: ' + err.message, 'bad');
        }
        btn.disabled = false;
        btn.textContent = 'Generate Schedule';
        refresh();
      }, 20);
    });

    $('#btn-clear-timetable').addEventListener('click', () => {
      Store.clearTimetable();
      $('#generate-message').hidden = true;
      refresh();
    });

    $('#btn-print').addEventListener('click', () => window.print());
    $('#btn-csv').addEventListener('click', exportCsv);

    $$('input[name=view]').forEach(radio =>
      radio.addEventListener('change', e => { view = e.target.value; renderTimetable(); }));
  }

  function showMessage(text, kind) {
    const box = $('#generate-message');
    box.textContent = text;
    box.className = 'message' + (kind === 'ok' ? '' : ' ' + kind);
    box.hidden = !text;
  }

  function renderStats() {
    const box = $('#stats');
    const s = state.stats;
    if (!s) { box.hidden = true; return; }
    box.hidden = false;

    const errors = conflicts.filter(c => c.severity === 'error').length;
    const cards = [
      { label: 'Exams scheduled', value: s.scheduled + ' / ' + (s.total || s.scheduled), good: !s.unscheduled },
      { label: 'Hard conflicts', value: errors, good: errors === 0, bad: errors > 0 },
      { label: 'Days used', value: s.daysUsed + ' / ' + s.daysAvailable },
      { label: 'Back-to-back sittings', value: s.backToBack, bad: s.backToBack > 0 },
      { label: 'Same-day sittings', value: s.sameDayDoubles },
      { label: 'Room utilisation', value: s.roomUtilisation + '%' },
      { label: 'Search nodes', value: s.nodes },
      { label: 'Solve time', value: s.elapsedMs + ' ms' }
    ];

    box.innerHTML = cards.map(c =>
      '<div class="stat' + (c.bad ? ' bad' : (c.good ? ' good' : '')) + '">' +
        '<div class="value">' + esc(c.value) + '</div>' +
        '<div class="label">' + esc(c.label) + '</div>' +
      '</div>').join('');
  }

  // Course ids caught up in a hard conflict — used to highlight rows.
  function conflictedCourseIds() {
    const set = new Set();
    conflicts.forEach(c => {
      if (c.severity === 'error') (c.courses || []).forEach(id => set.add(id));
    });
    return set;
  }

  function slotOptions(selectedId) {
    return '<option value="">— unassigned —</option>' + state.slots.map(s =>
      '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' +
        esc(s.date + ' ' + s.start + '–' + s.end) + (s.available === false ? ' (blocked)' : '') +
      '</option>').join('');
  }

  function roomOptions(selectedId) {
    return '<option value="">— unassigned —</option>' + state.rooms.map(r =>
      '<option value="' + r.id + '"' + (r.id === selectedId ? ' selected' : '') + '>' +
        esc(r.name + ' (' + r.capacity + ')') + (r.available === false ? ' (blocked)' : '') +
      '</option>').join('');
  }

  function renderTimetable() {
    const host = $('#timetable-view');
    const entries = state.timetable || [];

    if (!entries.length) {
      host.innerHTML = '<div class="empty">No timetable yet. Add courses, rooms and time slots, ' +
                       'then click <strong>Generate Schedule</strong>.</div>';
      renderUnscheduled();
      return;
    }

    const flagged = conflictedCourseIds();
    const rows = entries.map(e => ({
      entry: e,
      course: Store.byId(state.courses, e.courseId),
      slot: Store.byId(state.slots, e.slotId),
      room: Store.byId(state.rooms, e.roomId)
    })).filter(r => r.course);

    rows.sort((a, b) => {
      if (!a.slot || !b.slot) return a.slot ? -1 : 1;
      return a.slot.date === b.slot.date
        ? Store.toMinutes(a.slot.start) - Store.toMinutes(b.slot.start)
        : (a.slot.date < b.slot.date ? -1 : 1);
    });

    host.innerHTML = view === 'calendar' ? calendarHtml(rows, flagged) : listHtml(rows, flagged);

    host.querySelectorAll('[data-slot-for]').forEach(sel =>
      sel.addEventListener('change', () => {
        const courseId = sel.dataset.slotFor;
        const entry = state.timetable.find(e => e.courseId === courseId);
        Store.setAssignment(courseId, sel.value, entry ? entry.roomId : '');
        refresh();
      }));
    host.querySelectorAll('[data-room-for]').forEach(sel =>
      sel.addEventListener('change', () => {
        const courseId = sel.dataset.roomFor;
        const entry = state.timetable.find(e => e.courseId === courseId);
        Store.setAssignment(courseId, entry ? entry.slotId : '', sel.value);
        refresh();
      }));

    renderUnscheduled();
  }

  function listHtml(rows, flagged) {
    return '<div class="table-wrap"><table><thead><tr>' +
      '<th>Course</th><th>Date</th><th>Time</th><th>Room</th><th>Seats</th><th>Reassign</th>' +
      '</tr></thead><tbody>' +
      rows.map(r => {
        const size = Store.headcount(r.course);
        const cap = r.room ? r.room.capacity : 0;
        const seatTag = r.room
          ? (size > cap ? '<span class="tag bad">' + size + ' / ' + cap + '</span>'
                        : '<span class="tag ok">' + size + ' / ' + cap + '</span>')
          : '<span class="tag warn">' + size + ' / —</span>';
        return '<tr' + (flagged.has(r.course.id) ? ' class="conflict-row"' : '') + '>' +
          '<td><strong class="mono">' + esc(r.course.code) + '</strong><br><span class="sub">' +
            esc(r.course.name) + '</span></td>' +
          '<td>' + (r.slot ? fmtDate(r.slot.date) : '—') + '</td>' +
          '<td class="mono slot-time">' + (r.slot ? esc(r.slot.start + '–' + r.slot.end) : '—') + '</td>' +
          '<td>' + (r.room ? esc(r.room.name) + (r.room.building ? '<br><span class="sub">' +
            esc(r.room.building) + '</span>' : '') : '—') + '</td>' +
          '<td>' + seatTag + '</td>' +
          '<td>' +
            '<select class="inline-select" data-slot-for="' + r.course.id + '">' +
              slotOptions(r.slot ? r.slot.id : '') + '</select> ' +
            '<select class="inline-select" data-room-for="' + r.course.id + '">' +
              roomOptions(r.room ? r.room.id : '') + '</select>' +
          '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function calendarHtml(rows, flagged) {
    const days = {};
    rows.forEach(r => {
      const key = r.slot ? r.slot.date : 'unassigned';
      (days[key] = days[key] || []).push(r);
    });

    return Object.keys(days).sort().map(date => {
      const list = days[date];
      return '<div class="day-block">' +
        '<div class="day-head"><h3>' + (date === 'unassigned' ? 'Unassigned' : fmtDate(date)) + '</h3>' +
          '<span>' + list.length + ' exam(s)</span></div>' +
        '<div class="table-wrap"><table><thead><tr>' +
          '<th>Time</th><th>Course</th><th>Room</th><th>Students</th>' +
        '</tr></thead><tbody>' +
        list.map(r =>
          '<tr' + (flagged.has(r.course.id) ? ' class="conflict-row"' : '') + '>' +
            '<td class="mono slot-time">' + (r.slot ? esc(r.slot.start + '–' + r.slot.end) : '—') + '</td>' +
            '<td><strong class="mono">' + esc(r.course.code) + '</strong> — ' + esc(r.course.name) + '</td>' +
            '<td>' + (r.room ? esc(r.room.name) + (r.room.building ? ' · ' + esc(r.room.building) : '') : '—') + '</td>' +
            '<td class="mono">' + Store.headcount(r.course) + '</td>' +
          '</tr>').join('') +
        '</tbody></table></div></div>';
    }).join('');
  }

  function renderUnscheduled() {
    const host = $('#unscheduled-view');
    const list = state.unscheduled || [];
    if (!list.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="divider"></div><h3>Could not be scheduled</h3>' +
      list.map(u => {
        const c = Store.byId(state.courses, u.courseId);
        return '<div class="issue error"><span class="dot"></span><div>' +
          '<div class="kind">Unscheduled</div>' +
          '<strong>' + esc(c ? c.code + ' — ' + c.name : 'Course') + '</strong><br>' + esc(u.reason) +
        '</div></div>';
      }).join('');
  }

  /* ================= conflicts ================= */

  function renderConflicts() {
    conflicts = Scheduler.detectConflicts(state, readOptions());
    const errors = conflicts.filter(c => c.severity === 'error');
    const host = $('#conflict-list');

    const pill = $('#count-conflicts');
    pill.textContent = errors.length;
    pill.className = 'pill' + (errors.length ? ' alert' : '');

    if (!conflicts.length) {
      host.innerHTML = '<div class="message">No conflicts found. Every exam has a room, a slot, ' +
                       'enough seats, and no student sits two papers at once.</div>';
      return;
    }

    const labels = {
      student: 'Student clash', room: 'Room double-booked', capacity: 'Room too small',
      availability: 'Outside available period', duration: 'Slot too short',
      backToBack: 'Back-to-back exam', sameDay: 'Two exams in one day',
      unscheduled: 'Not scheduled', missing: 'Broken reference'
    };

    const order = { error: 0, warning: 1 };
    const sorted = conflicts.slice().sort((a, b) => order[a.severity] - order[b.severity]);

    host.innerHTML =
      '<div class="message' + (errors.length ? ' bad' : ' warn') + '">' +
        errors.length + ' hard conflict(s) and ' + (conflicts.length - errors.length) +
        ' warning(s).</div>' +
      sorted.map(c =>
        '<div class="issue ' + c.severity + '"><span class="dot"></span><div>' +
          '<div class="kind">' + esc(labels[c.type] || c.type) + '</div>' +
          esc(c.message) +
        '</div></div>').join('');
  }

  /* ================= complaints ================= */

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

  const STATUS_LABELS = { new: 'New', reviewing: 'Reviewing', resolved: 'Resolved' };

  function fmtWhen(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
           ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function populateComplaintCourses() {
    const select = $('#complaint-course');
    const current = select.value;
    select.innerHTML = '<option value="">— not about one specific exam —</option>' +
      state.courses.map(c =>
        '<option value="' + c.id + '">' + esc(c.code + ' — ' + c.name) + '</option>').join('');
    if (current) select.value = current;
  }

  // A single student's personal timetable, with their own clashes called out.
  function renderLookup(studentId) {
    const host = $('#lookup-result');
    const id = String(studentId || '').trim();
    if (!id) { host.innerHTML = ''; return; }

    const courses = Store.coursesForStudent(id);
    if (!courses.length) {
      host.innerHTML = '<div class="message warn">No courses are registered under student ID ' +
        esc(id) + '. Check the ID, or raise a complaint below if your registration is wrong.</div>';
      return;
    }

    const rows = courses.map(c => {
      const entry = (state.timetable || []).find(e => e.courseId === c.id);
      return {
        course: c,
        slot: entry ? Store.byId(state.slots, entry.slotId) : null,
        room: entry ? Store.byId(state.rooms, entry.roomId) : null
      };
    }).sort((a, b) => {
      if (!a.slot || !b.slot) return a.slot ? -1 : 1;
      return a.slot.date === b.slot.date
        ? Store.toMinutes(a.slot.start) - Store.toMinutes(b.slot.start)
        : (a.slot.date < b.slot.date ? -1 : 1);
    });

    // Warn this student about their own clashes and tight turnarounds.
    const warnings = [];
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i], b = rows[j];
        if (!a.slot || !b.slot) continue;
        if (Store.slotsOverlap(a.slot, b.slot) || a.slot.id === b.slot.id) {
          warnings.push({ bad: true, text: a.course.code + ' and ' + b.course.code +
            ' are at the same time on ' + fmtDate(a.slot.date) + '.' });
        } else if (Store.slotsAdjacent(a.slot, b.slot, readOptions().gapMinutes)) {
          warnings.push({ bad: false, text: a.course.code + ' and ' + b.course.code +
            ' are back-to-back on ' + fmtDate(a.slot.date) + '.' });
        }
      }
    }

    const unplaced = rows.filter(r => !r.slot).length;
    if (unplaced) {
      warnings.push({ bad: true, text: unplaced + ' of your exams have not been scheduled yet.' });
    }

    host.innerHTML =
      '<div class="table-wrap"><table><thead><tr>' +
        '<th>Course</th><th>Date</th><th>Time</th><th>Room</th>' +
      '</tr></thead><tbody>' +
      rows.map(r =>
        '<tr>' +
          '<td><strong class="mono">' + esc(r.course.code) + '</strong></td>' +
          '<td>' + (r.slot ? fmtDate(r.slot.date) : '<span class="tag warn">not scheduled</span>') + '</td>' +
          '<td class="mono">' + (r.slot ? esc(r.slot.start + '–' + r.slot.end) : '—') + '</td>' +
          '<td>' + (r.room ? esc(r.room.name) : '—') + '</td>' +
        '</tr>').join('') +
      '</tbody></table></div>' +
      warnings.map(w =>
        '<div class="issue ' + (w.bad ? 'error' : 'warning') + '"><span class="dot"></span><div>' +
          esc(w.text) + '</div></div>').join('');
  }

  function renderComplaints() {
    const host = $('#complaint-list');
    const all = state.complaints || [];
    const filter = filters.complaints;
    const list = filter === 'all' ? all : all.filter(c => c.status === filter);

    const open = all.filter(c => c.status !== 'resolved').length;
    const pill = $('#count-complaints');
    pill.textContent = open;
    pill.className = 'pill' + (open ? ' alert' : '');

    $$('#complaint-filters .chip').forEach(chip =>
      chip.classList.toggle('active', chip.dataset.status === filter));

    if (!list.length) {
      host.innerHTML = '<div class="empty">' +
        (all.length ? 'No ' + filter + ' complaints.' : 'No complaints have been submitted yet.') +
        '</div>';
      return;
    }

    host.innerHTML = list.map(c => {
      const course = c.courseId ? Store.byId(state.courses, c.courseId) : null;
      const tagClass = c.status === 'resolved' ? 'ok' : (c.status === 'reviewing' ? 'warn' : 'bad');
      return '<div class="complaint">' +
        '<div class="complaint-head">' +
          '<strong class="mono">' + esc(c.studentId) + '</strong>' +
          (c.studentName ? ' <span class="sub">' + esc(c.studentName) + '</span>' : '') +
          '<span class="tag ' + tagClass + '">' + esc(STATUS_LABELS[c.status] || c.status) + '</span>' +
          '<span class="sub push-right">' + esc(fmtWhen(c.createdAt)) + '</span>' +
        '</div>' +
        '<div class="sub">' + esc(CATEGORY_LABELS[c.category] || c.category) +
          (course ? ' · ' + esc(course.code + ' — ' + course.name) : '') + '</div>' +
        '<p class="complaint-body">' + esc(c.message) + '</p>' +
        (c.response
          ? '<div class="complaint-response"><strong>Response:</strong> ' + esc(c.response) + '</div>'
          : '') +
        '<div class="complaint-actions">' +
          (c.status !== 'reviewing' && c.status !== 'resolved'
            ? '<button class="btn link" data-status-set="reviewing" data-id="' + c.id + '">Mark reviewing</button>' : '') +
          (c.status !== 'resolved'
            ? '<button class="btn link" data-status-set="resolved" data-id="' + c.id + '">Mark resolved</button>'
            : '<button class="btn link" data-status-set="new" data-id="' + c.id + '">Reopen</button>') +
          '<button class="btn link" data-reply="' + c.id + '">' +
            (c.response ? 'Edit response' : 'Respond') + '</button>' +
          '<button class="btn link danger" data-del-complaint="' + c.id + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');

    host.querySelectorAll('[data-status-set]').forEach(b =>
      b.addEventListener('click', () => {
        Store.updateComplaint(b.dataset.id, { status: b.dataset.statusSet });
        refresh();
      }));
    host.querySelectorAll('[data-reply]').forEach(b =>
      b.addEventListener('click', () => {
        const c = Store.byId(state.complaints, b.dataset.reply);
        const text = prompt('Response to student ' + c.studentId + ':', c.response || '');
        if (text === null) return;
        Store.updateComplaint(c.id, { response: text });
        refresh();
      }));
    host.querySelectorAll('[data-del-complaint]').forEach(b =>
      b.addEventListener('click', () => {
        if (confirm('Delete this complaint permanently?')) {
          Store.removeComplaint(b.dataset.delComplaint);
          refresh();
        }
      }));
  }

  function initComplaints() {
    $('#form-complaint').addEventListener('submit', e => {
      e.preventDefault();
      const saved = Store.addComplaint({
        studentId: $('#complaint-student').value,
        studentName: $('#complaint-name').value,
        courseId: $('#complaint-course').value,
        category: $('#complaint-category').value,
        message: $('#complaint-message').value
      });

      const box = $('#complaint-feedback');
      if (!saved) {
        box.textContent = 'Please give your student ID and describe the problem.';
        box.className = 'message bad';
      } else {
        box.textContent = 'Complaint submitted. The exams office can now see it under "Complaints received".';
        box.className = 'message';
        $('#form-complaint').reset();
      }
      box.hidden = false;
      refresh();
    });

    $('#btn-lookup').addEventListener('click', () => renderLookup($('#lookup-student').value));
    $('#lookup-student').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); renderLookup($('#lookup-student').value); }
    });

    $$('#complaint-filters .chip').forEach(chip =>
      chip.addEventListener('click', () => {
        filters.complaints = chip.dataset.status;
        renderComplaints();
      }));

    $('#btn-complaints-csv').addEventListener('click', () => {
      const all = state.complaints || [];
      if (!all.length) { alert('There are no complaints to export.'); return; }
      const lines = [['Submitted', 'Student ID', 'Name', 'Course', 'Category', 'Status', 'Complaint', 'Response']];
      all.forEach(c => {
        const course = c.courseId ? Store.byId(state.courses, c.courseId) : null;
        lines.push([
          fmtWhen(c.createdAt), c.studentId, c.studentName,
          course ? course.code : '', CATEGORY_LABELS[c.category] || c.category,
          STATUS_LABELS[c.status] || c.status, c.message, c.response
        ]);
      });
      const csv = lines.map(row =>
        row.map(v => '"' + String(v === undefined ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
      download(csv, 'exam-complaints.csv', 'text/csv');
    });
  }

  /* ================= data in / out ================= */

  function exportCsv() {
    if (!(state.timetable || []).length) { alert('Generate a timetable first.'); return; }
    const lines = [['Course Code', 'Course Name', 'Date', 'Start', 'End', 'Room', 'Location', 'Students']];
    state.timetable.forEach(e => {
      const c = Store.byId(state.courses, e.courseId);
      const s = Store.byId(state.slots, e.slotId);
      const r = Store.byId(state.rooms, e.roomId);
      if (!c) return;
      lines.push([
        c.code, c.name,
        s ? s.date : '', s ? s.start : '', s ? s.end : '',
        r ? r.name : '', r ? (r.building || '') : '',
        Store.headcount(c)
      ]);
    });
    const csv = lines.map(row =>
      row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    download(csv, 'exam-timetable.csv', 'text/csv');
  }

  function download(text, filename, mime) {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function initData() {
    $('#btn-demo').addEventListener('click', () => {
      if (state.courses.length || state.rooms.length || state.slots.length) {
        if (!confirm('This replaces the data currently in the app. Continue?')) return;
      }
      Store.clearAll();
      state = Store.getState();
      const demo = DemoData.build();
      demo.rooms.forEach(Store.addRoom);
      demo.slots.forEach(Store.addSlot);
      demo.courses.forEach(Store.addCourse);
      refresh();
      alert('Sample data loaded: ' + demo.courses.length + ' courses, ' + demo.rooms.length +
            ' rooms, ' + demo.slots.length + ' time slots.\nOpen the Timetable tab and click Generate Schedule.');
    });

    $('#btn-export').addEventListener('click', () => {
      download(JSON.stringify(Store.getState(), null, 2), 'exam-scheduler-data.json', 'application/json');
    });

    $('#file-import').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.courses)) throw new Error('Not an exam scheduler file.');
          Store.replaceState(data);
          state = Store.getState();
          refresh();
          alert('Data imported.');
        } catch (err) {
          alert('Could not import that file: ' + err.message);
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });

    $('#btn-reset').addEventListener('click', () => {
      if (confirm('Delete all courses, rooms, time slots, the timetable and every complaint?')) {
        Store.clearAll();
        state = Store.getState();
        $('#generate-message').hidden = true;
        refresh();
      }
    });

    $('#btn-recheck').addEventListener('click', refresh);
  }

  /* ================= refresh ================= */

  function refresh() {
    state = Store.getState();
    renderConflicts();           // conflicts first — the timetable highlights depend on it
    renderCourses();
    renderRooms();
    renderSlots();
    renderTimetable();
    renderStats();
    populateComplaintCourses();
    renderComplaints();
    $('#count-courses').textContent = state.courses.length;
    $('#count-rooms').textContent = state.rooms.length;
    $('#count-slots').textContent = state.slots.length;
  }

  /* ================= boot ================= */

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    bindOptionOutputs();
    initCourses();
    initRooms();
    initSlots();
    initSchedule();
    initComplaints();
    initData();
    refresh();
  });
})();
