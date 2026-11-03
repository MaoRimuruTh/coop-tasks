// Domain logic shared by every screen: Thai dates, the 16-week calendar,
// task status per intern, and sorting. No DOM code in this file.

export const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม',
  'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const TH_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

// 4 = most urgent. Stored as a number so it sorts.
export const PRIORITIES = [
  { value: 4, label: 'ด่วนมาก', key: 'p4' },
  { value: 3, label: 'สูง', key: 'p3' },
  { value: 2, label: 'ปกติ', key: 'p2' },
  { value: 1, label: 'ต่ำ', key: 'p1' },
];
export const priorityOf = (v) => PRIORITIES.find((p) => p.value === v) || PRIORITIES[2];

// Per-intern task state. "late" is not a state: it is shown on top of
// assigned / ack / changes when the due time has passed.
export const STATES = {
  assigned: { label: 'ยังไม่รับทราบ', short: 'ยังไม่รับทราบ', lamp: 'idle' },
  ack: { label: 'รับทราบแล้ว', short: 'รับทราบแล้ว', lamp: 'run' },
  submitted: { label: 'รอตรวจ', short: 'รอตรวจ', lamp: 'wait' },
  changes: { label: 'ให้แก้', short: 'ให้แก้', lamp: 'stop' },
  approved: { label: 'ผ่าน', short: 'ผ่าน', lamp: 'ok' },
};
export const OPEN_STATES = ['assigned', 'ack', 'changes'];

export const pad = (n) => String(n).padStart(2, '0');

// Dates travel as local "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" strings (everyone is in Thailand).
export function toLocalDate(s) {
  if (!s) return null;
  const [d, t = '00:00'] = s.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return new Date(y, m - 1, day, hh || 0, mm || 0);
}
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const stamp = (d) => `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const stampS = (d) => `${stamp(d)}:${pad(d.getSeconds())}`;
export const ROLE_TH = { admin: 'แอดมิน', supervisor: 'พนักงานผู้ดูแล', student: 'นักศึกษา', pending: 'รออนุมัติ', blocked: 'ไม่อนุมัติ' };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);

export const beYear = (d) => d.getFullYear() + 543;
export const fmtDay = (d) => `${TH_DAYS_SHORT[d.getDay()]} ${d.getDate()} ${TH_MONTHS[d.getMonth()]}`;
export const fmtDate = (d) => `${d.getDate()} ${TH_MONTHS[d.getMonth()]}`;
export const fmtDateYear = (d) => `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${String(beYear(d)).slice(2)}`;
export const fmtDateLong = (d) => `${d.getDate()} ${TH_MONTHS_FULL[d.getMonth()]} ${beYear(d)}`;
export const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Human due label + tone: late | today | soon | later. */
export function dueInfo(due, now = new Date()) {
  const d = toLocalDate(due);
  if (!d) return { text: 'ไม่กำหนดส่ง', tone: 'later', date: null };
  const diff = dayDiff(d, now);
  const time = fmtTime(d);
  if (d < now) {
    const hours = Math.floor((now - d) / 3600000);
    const text = hours < 24 ? `เลยกำหนด ${Math.max(hours, 1)} ชม.` : `เลยกำหนด ${dayDiff(now, d)} วัน`;
    return { text, tone: 'late', date: d };
  }
  if (diff === 0) return { text: `วันนี้ ${time}`, tone: 'today', date: d };
  if (diff === 1) return { text: `พรุ่งนี้ ${time}`, tone: 'soon', date: d };
  if (diff < 7) return { text: `${fmtDay(d)} ${time}`, tone: 'soon', date: d };
  return { text: `${fmtDay(d)}`, tone: 'later', date: d };
}

// ---------- the internship calendar ----------
// Week 1 starts on the Monday of the start date; "เดือนที่ m" = weeks 4m-3 … 4m.
export function calendar(settings) {
  const start = toLocalDate(settings.startDate);
  const end = toLocalDate(settings.endDate);
  const monday = addDays(start, -((start.getDay() + 6) % 7));
  const weeks = [];
  for (let n = 1; n <= 16; n++) {
    const from = addDays(monday, 7 * (n - 1));
    const sat = addDays(from, 5);
    weeks.push({ n, month: Math.ceil(n / 4), from: from < start ? start : from, to: sat > end ? end : sat });
  }
  const months = [1, 2, 3, 4].map((m) => ({ m, from: weeks[4 * m - 4].from, to: weeks[4 * m - 1].to }));
  return { start, end, monday, weeks, months };
}

export function weekOf(cal, date) {
  const d = startOfDay(date);
  if (d < startOfDay(cal.start) || d > cal.end) return null;
  return Math.floor(dayDiff(d, cal.monday) / 7) + 1;
}

export const fmtRange = (a, b) => (a.getMonth() === b.getMonth()
  ? `${a.getDate()}–${b.getDate()} ${TH_MONTHS[b.getMonth()]}`
  : `${fmtDate(a)} – ${fmtDate(b)}`);

// ---------- people ----------
export const isStudent = (u) => !!u && (u.role === 'student' || u.isStudent) && u.role !== 'pending';
export const canAssign = (u) => !!u && (u.role === 'supervisor' || u.role === 'admin');
export const displayName = (u) => (u ? (u.nickname ? u.nickname : (u.name || '').split(' ')[0]) : '—');

// ---------- tasks ----------
export const stateOf = (task, uid) => (task.state && task.state[uid] && task.state[uid].s) || 'assigned';
export const isLate = (task, uid, now = new Date()) => {
  const s = stateOf(task, uid);
  const d = toLocalDate(task.due);
  return !!d && d < now && OPEN_STATES.includes(s);
};

/** Count of each state across all assignees of a task. */
export function tally(task, now = new Date()) {
  const t = { assigned: 0, ack: 0, submitted: 0, changes: 0, approved: 0, late: 0, total: task.assignees.length };
  for (const uid of task.assignees) {
    t[stateOf(task, uid)] += 1;
    if (isLate(task, uid, now)) t.late += 1;
  }
  return t;
}

/** Manual order (when set) wins; otherwise due time, then priority, then age. */
export function compareTasks(a, b) {
  const ao = a.order ?? null; const bo = b.order ?? null;
  if (ao !== null || bo !== null) {
    if (ao === null) return 1;
    if (bo === null) return -1;
    if (ao !== bo) return ao - bo;
  }
  const ad = a.due || '9999'; const bd = b.due || '9999';
  if (ad.slice(0, 10) !== bd.slice(0, 10)) return ad < bd ? -1 : 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (a.created || '') < (b.created || '') ? -1 : 1;
}

/** Group an intern's open tasks by what to do next: late, sent back, due today, new, then by date. */
export function bucketsFor(tasks, uid, now = new Date()) {
  const g = { late: [], changes: [], today: [], fresh: [], tomorrow: [], week: [], later: [] };
  for (const t of tasks) {
    const s = stateOf(t, uid);
    const d = toLocalDate(t.due);
    const diff = d ? dayDiff(d, now) : 99;
    if (isLate(t, uid, now)) g.late.push(t);
    else if (s === 'changes') g.changes.push(t);
    else if (diff <= 0) g.today.push(t);
    else if (s === 'assigned') g.fresh.push(t);
    else if (diff === 1) g.tomorrow.push(t);
    else if (diff < 7) g.week.push(t);
    else g.later.push(t);
  }
  for (const k of Object.keys(g)) g[k].sort(compareTasks);
  return [
    { key: 'late', title: 'เลยกำหนด', items: g.late },
    { key: 'changes', title: 'ให้แก้', items: g.changes },
    { key: 'today', title: 'ครบกำหนดวันนี้', items: g.today },
    { key: 'fresh', title: 'งานใหม่ ยังไม่รับทราบ', items: g.fresh },
    { key: 'tomorrow', title: 'พรุ่งนี้', items: g.tomorrow },
    { key: 'week', title: '7 วันข้างหน้า', items: g.week },
    { key: 'later', title: 'หลังจากนั้น', items: g.later },
  ].filter((x) => x.items.length);
}

/** The state that needs attention first across a task's interns (for one lamp per row). */
export function worstState(task, now = new Date()) {
  const rank = { stop: 0, wait: 1, idle: 2, run: 3, ok: 4 };
  let best = { state: 'approved', late: false, r: 9 };
  for (const u of task.assignees) {
    const s = stateOf(task, u);
    const late = isLate(task, u, now);
    const r = late ? 0 : rank[STATES[s].lamp];
    if (r < best.r) best = { state: s, late, r };
  }
  return best;
}

export const weeksLabel = (weeks) => (weeks.length ? `สัปดาห์ ${Math.min(...weeks)}–${Math.max(...weeks)}` : '');
export const shortTitle = (t, n = 34) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export const woNumber = (t) => `WO-${String(t.no).padStart(3, '0')}`;

/** Plan rows for one intern's university form (max 14 on the paper form). */
export function formRows(plans, uid) {
  return plans
    .filter((p) => !p.assignees || p.assignees.length === 0 || p.assignees.includes(uid))
    .filter((p) => p.weeks && p.weeks.length)
    .sort((a, b) => (Math.min(...a.weeks) - Math.min(...b.weeks)) || ((a.order ?? 99) - (b.order ?? 99)));
}
