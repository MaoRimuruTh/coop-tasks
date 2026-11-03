// Demo store: same interface as the Firebase store, but everything lives in this
// browser (memory + localStorage). Used for the preview before Firebase is set up.
import { addDays, stamp, stampS, dateKey, displayName, woNumber, ROLE_TH, shortTitle, canAssign, canReview, isInternAdmin, normCode, fmtTime } from './model.js';

const KEY = 'coop-demo-v3';

function svgPhoto(label, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<rect width="640" height="480" fill="hsl(${hue} 10% 82%)"/>
<rect x="150" y="150" width="340" height="180" rx="10" fill="hsl(${hue} 8% 62%)"/>
<circle cx="230" cy="240" r="38" fill="hsl(${hue} 8% 82%)"/><circle cx="410" cy="240" r="38" fill="hsl(${hue} 8% 82%)"/>
<rect x="120" y="360" width="400" height="6" fill="hsl(${hue} 10% 45%)"/>
<text x="320" y="420" font-family="sans-serif" font-size="26" text-anchor="middle" fill="hsl(${hue} 15% 25%)">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function seed() {
  const now = new Date();
  const at = (days, hh, mm = 0) => { const d = addDays(now, days); d.setHours(hh, mm, 0, 0); return stamp(d); };
  const users = {
    'u-nat': { uid: 'u-nat', name: 'นพณัฐ พลเพชร', nickname: '', role: 'admin', isStudent: true,
      studentId: '662091037', major: 'วิศวกรรมเมคคาทรอนิกส์', faculty: 'วิศวกรรมศาสตร์', email: '' },
    'u-ton': { uid: 'u-ton', name: 'ศุภกร ใจดี', nickname: 'ต้น', role: 'student', isStudent: true,
      studentId: '662091052', major: 'วิศวกรรมเมคคาทรอนิกส์', faculty: 'วิศวกรรมศาสตร์', email: '', sample: true },
    'u-fah': { uid: 'u-fah', name: 'ณัฐธิดา แก้วมณี', nickname: 'ฟ้า', role: 'student', isStudent: true,
      studentId: '662091088', major: 'วิศวกรรมเมคคาทรอนิกส์', faculty: 'วิศวกรรมศาสตร์', email: '', sample: true },
    'u-ek': { uid: 'u-ek', name: 'เอกชัย ศรีสุข', nickname: 'พี่เอก', role: 'supervisor', isStudent: false,
      position: 'วิศวกรฝ่ายผลิต', email: '', sample: true },
    'u-new': { uid: 'u-new', name: 'วิทยา มั่นคง', nickname: 'วิท', role: 'pending', isStudent: false, email: 'witthaya@example.com', sample: true },
  };
  const plans = {
    p1: { id: 'p1', title: 'สังเกตการณ์การทำงานและกฎความปลอดภัย', weeks: [1, 2], assignees: [], kind: 'normal', note: '', order: 1 },
    p2: { id: 'p2', title: 'อ่านแบบและตรวจสอบชิ้นงาน (QC)', weeks: [3, 4, 5], assignees: [], kind: 'normal', note: '', order: 2, autoWeeks: true,
      steps: [{ id: 's21', title: 'อ่านแบบและสัญลักษณ์', weeks: [3] }, { id: 's22', title: 'วัดชิ้นงานจริงตามแบบ', weeks: [4, 5] }] },
    p3: { id: 'p3', title: 'ฝึกปฏิบัติงานเครื่อง CNC และเครื่องกลึง', weeks: [5, 6, 7, 8], assignees: [], kind: 'normal', note: '', order: 3 },
    p4: { id: 'p4', title: 'งานซ่อมบำรุงระบบนิวเมติกส์', weeks: [6, 7, 8], assignees: ['u-ton'], kind: 'normal', note: '', order: 4 },
    p5: { id: 'p5', title: 'โปรเจค: จิ๊กจับชิ้นงานสำหรับงานเจาะ', weeks: [9, 10, 11, 12, 13, 14, 15, 16], assignees: ['u-nat', 'u-ton'], kind: 'project', note: 'งานกลุ่ม', order: 5, autoWeeks: true,
      steps: [{ id: 's51', title: 'ค้นหาข้อมูล', weeks: [9, 10] }, { id: 's52', title: 'ออกแบบ', weeks: [11, 12] }, { id: 's53', title: 'สร้างและทดสอบ', weeks: [13, 14] },
        { id: 's54', title: 'หาจุดผิดพลาดและแก้ไข', weeks: [15] }, { id: 's55', title: 'สรุปผลและส่งมอบ', weeks: [16] }] },
    p6: { id: 'p6', title: 'โปรเจค: ระบบนับชิ้นงานด้วยเซนเซอร์', weeks: [9, 10, 11, 12, 13, 14, 15, 16], assignees: ['u-fah'], kind: 'project', note: 'งานเดี่ยว', order: 6 },
    p7: { id: 'p7', title: 'สรุปรายงานสหกิจและนำเสนอ', weeks: [15, 16], assignees: [], kind: 'normal', note: '', order: 7 },
  };
  const S = (s, daysAgo = 0, note) => ({ s, at: at(-daysAgo, 9), ...(note ? { note } : {}) });
  const tasks = {
    t1: { id: 't1', no: 1, title: 'อ่านกฎความปลอดภัยในโรงงานและเซ็นรับทราบ', details: 'อ่านคู่มือความปลอดภัยฉบับฝ่ายผลิต แล้วถ่ายรูปหน้าที่เซ็นชื่อแนบมา',
      assignerName: 'พี่เอก', createdBy: 'u-ek', created: at(-2, 8), assignees: ['u-nat', 'u-ton', 'u-fah'], mode: 'individual',
      due: at(-1, 17), priority: 3, order: null, planId: 'p1', needsReview: true,
      state: { 'u-nat': S('approved', 1), 'u-ton': S('approved', 1), 'u-fah': S('submitted', 0) } },
    t2: { id: 't2', no: 2, title: 'ตรวจขนาดชิ้นงานล็อต A ตามแบบ จำนวน 20 ชิ้น', details: 'ใช้เวอร์เนียร์และไมโครมิเตอร์ วัด 4 จุดตามแบบ TC-112 บันทึกค่าลงฟอร์ม QC',
      assignerName: 'พี่เอก', createdBy: 'u-ek', created: at(0, 8), assignees: ['u-nat'], mode: 'individual',
      due: at(0, 16, 30), priority: 4, order: null, planId: 'p1', needsReview: true, state: { 'u-nat': S('ack', 0) } },
    t3: { id: 't3', no: 3, title: 'ถ่ายรูปจุดวัดและทำตารางบันทึกค่าการวัด', details: 'ทำร่วมกัน ส่งไฟล์เดียวในนามกลุ่ม',
      assignerName: 'พี่เอก', createdBy: 'u-ek', created: at(0, 9), assignees: ['u-nat', 'u-ton'], mode: 'group',
      due: at(1, 12), priority: 2, order: null, planId: 'p1', needsReview: true, state: { 'u-nat': S('assigned'), 'u-ton': S('ack', 0) } },
    t4: { id: 't4', no: 4, title: 'สรุปขั้นตอนการเปิด-ปิดเครื่อง CNC (1 หน้า)', details: 'เขียนเป็นขั้นตอนสั้นๆ พร้อมจุดที่ต้องระวัง',
      assignerName: 'พี่โอ๊ต', createdBy: 'u-ek', created: at(-3, 10), assignees: ['u-ton'], mode: 'individual',
      due: at(-1, 17), priority: 2, order: null, planId: 'p1', needsReview: true, state: { 'u-ton': S('ack', 2) } },
    t5: { id: 't5', no: 5, title: 'จัดเก็บและทำความสะอาดเครื่องมือวัด (5ส)', details: '',
      assignerName: 'พี่เอก', createdBy: 'u-ek', created: at(0, 10), assignees: ['u-nat', 'u-ton', 'u-fah'], mode: 'individual',
      due: at(3, 17), priority: 1, order: null, planId: 'p1', needsReview: false, state: { 'u-nat': S('assigned'), 'u-ton': S('assigned'), 'u-fah': S('ack', 0) } },
    t6: { id: 't6', no: 6, title: 'แก้ตารางบันทึกค่าการวัด ให้มีช่องค่าเผื่อ', details: 'เพิ่มคอลัมน์ tolerance และสรุปว่าชิ้นไหนผ่าน/ไม่ผ่าน',
      assignerName: 'พี่เอก', createdBy: 'u-ek', created: at(-1, 13), assignees: ['u-fah'], mode: 'individual',
      due: at(1, 17), priority: 3, order: null, planId: 'p1', needsReview: true,
      state: { 'u-fah': S('changes', 0, 'ใส่ค่าเผื่อ ±0.05 ตามแบบด้วยนะ แล้วไฮไลต์ชิ้นที่ไม่ผ่าน') } },
    t7: { id: 't7', no: 7, title: 'เตรียมหัวข้อโปรเจค คนละ 2 ไอเดีย', details: 'เน้นปัญหาที่เจอจริงในไลน์ผลิต เล่าสั้นๆ ว่าแก้อะไร ใช้อะไรบ้าง',
      assignerName: 'พี่เอก', createdBy: 'u-ek', created: at(0, 11), assignees: ['u-nat', 'u-ton', 'u-fah'], mode: 'individual',
      due: at(6, 17), priority: 2, order: 1, planId: 'p1', needsReview: true, state: { 'u-nat': S('ack', 0), 'u-ton': S('assigned'), 'u-fah': S('assigned') } },
    t8: { id: 't8', no: 8, title: 'อ่านแบบงานเชื่อม Drawing TC-120 แล้วสรุปสัญลักษณ์ที่ไม่รู้จัก', details: '',
      assignerName: 'พี่เอก', createdBy: 'u-ek', created: at(0, 11), assignees: ['u-nat'], mode: 'individual',
      due: at(2, 15), priority: 2, order: 2, planId: 'p1', needsReview: true, state: { 'u-nat': S('assigned') } },
  };
  const subs = {
    s1: { id: 's1', taskId: 't1', by: 'u-nat', for: ['u-nat'], note: 'เซ็นเรียบร้อยครับ', link: '', files: ['f1'], at: at(-2, 15),
      review: { decision: 'approved', note: '', by: 'u-ek', at: at(-1, 9) } },
    s2: { id: 's2', taskId: 't1', by: 'u-ton', for: ['u-ton'], note: '', link: '', files: ['f2'], at: at(-2, 16),
      review: { decision: 'approved', note: '', by: 'u-ek', at: at(-1, 9) } },
    s3: { id: 's3', taskId: 't1', by: 'u-fah', for: ['u-fah'], note: 'ส่งช้าไปหน่อยค่ะ', link: '', files: ['f3'], at: at(0, 8), review: null },
    s4: { id: 's4', taskId: 't6', by: 'u-fah', for: ['u-fah'], note: 'ตารางรอบแรกค่ะ', link: '', files: ['f4'], at: at(-1, 16),
      review: { decision: 'changes', note: 'ใส่ค่าเผื่อ ±0.05 ตามแบบด้วยนะ แล้วไฮไลต์ชิ้นที่ไม่ผ่าน', by: 'u-ek', at: at(0, 8, 40) } },
  };
  const files = {
    f1: { id: 'f1', name: 'safety-sign.jpg', type: 'image/svg+xml', data: svgPhoto('รูปตัวอย่าง · ใบเซ็นรับทราบ', 210) },
    f2: { id: 'f2', name: 'safety-sign.jpg', type: 'image/svg+xml', data: svgPhoto('รูปตัวอย่าง · ใบเซ็นรับทราบ', 30) },
    f3: { id: 'f3', name: 'safety-sign.jpg', type: 'image/svg+xml', data: svgPhoto('รูปตัวอย่าง · ใบเซ็นรับทราบ', 150) },
    f4: { id: 'f4', name: 'qc-table.jpg', type: 'image/svg+xml', data: svgPhoto('รูปตัวอย่าง · ตารางค่าการวัด', 260) },
  };
  return {
    v: 1, actor: 'u-ek', counter: 8,
    settings: { startDate: '2026-11-02', endDate: '2027-02-19', company: 'บริษัท ไทยเซ็นทรัล เมคคานิคส์ จำกัด', university: 'มหาวิทยาลัยทักษิณ',
      companyAddress: '', companyPhone: '', companyFax: '', companyHours: 'จันทร์–ศุกร์ 08:00–17:00, เสาร์ 08:00–17:00',
      workDays: 'จันทร์–เสาร์', workStart: '08:00', workEnd: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    users, plans, tasks, subs, files,
    activity: [
      { at: at(0, 8, 40), by: 'u-ek', text: 'ให้แก้ WO-006', taskId: 't6' },
      { at: at(0, 8), by: 'u-fah', text: 'ส่ง WO-001', taskId: 't1' },
    ],
  };
}

function load() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createDemoStore() {
  let db = load() || seed();
  const listeners = new Set();
  let persistOk = true;

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); persistOk = true; } catch { persistOk = false; }
  };
  const emit = () => { db = { ...db }; save(); listeners.forEach((fn) => fn()); };
  const me = () => db.users[db.actor];
  const log = (text, taskId) => {
    const t = taskId && db.tasks[taskId];
    db.activity = [{ at: stampS(new Date()), by: db.actor, text: t ? `${text} “${shortTitle(t.title)}”` : text, taskId }, ...db.activity].slice(0, 300);
  };
  const must = (ok, msg) => { if (!ok) throw new Error(msg); };
  const LOCKED = 'บัญชีนี้ล็อกโหมดผู้มอบงานอยู่ ขอรหัสจากชิเอลแล้วปลดล็อกที่หน้าจัดการระบบ';
  const mayAssign = () => must(canAssign(me()), isInternAdmin(me()) ? LOCKED : 'เฉพาะพี่ผู้ดูแลหรือแอดมินที่สั่งงานได้');
  const notOwn = (assignees) => must(!(isInternAdmin(me()) && assignees.includes(db.actor)), 'งานที่ตัวเองเป็นผู้รับ ให้พี่ผู้ดูแลเป็นคนสั่งหรือแก้');

  return {
    mode: 'demo',
    ready: Promise.resolve(),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    snapshot() { return { ...db, me: me(), persistOk }; },

    // demo-only helpers
    setActor(id) { db.actor = id; emit(); },
    reset() { db = seed(); emit(); },

    async createTask(input) {
      mayAssign(); notOwn(input.assignees);
      const id = uid('t');
      db.counter += 1;
      const state = Object.fromEntries(input.assignees.map((a) => [a, { s: 'assigned', at: stamp(new Date()) }]));
      db.tasks = { ...db.tasks, [id]: { ...input, id, no: db.counter, createdBy: db.actor, created: stamp(new Date()), state } };
      log(`สั่งงาน ${woNumber(db.tasks[id])}`, id);
      emit();
      return id;
    },
    async updateTask(id, patch) {
      mayAssign();
      const t = db.tasks[id];
      notOwn(t.assignees); notOwn(patch.assignees || []);
      const assignees = patch.assignees || t.assignees;
      const state = Object.fromEntries(assignees.map((a) => [a, t.state[a] || { s: 'assigned', at: stamp(new Date()) }]));
      db.tasks = { ...db.tasks, [id]: { ...t, ...patch, state } };
      log(`แก้ไข ${woNumber(t)}`, id);
      emit();
    },
    async deleteTask(id) {
      mayAssign();
      const t = db.tasks[id];
      notOwn(t.assignees);
      const { [id]: _gone, ...rest } = db.tasks;
      db.tasks = rest;
      db.subs = Object.fromEntries(Object.entries(db.subs).filter(([, s]) => s.taskId !== id));
      log(`ลบ ${woNumber(t)}`, null);
      emit();
    },
    async ack(id) {
      const t = db.tasks[id];
      must(t.assignees.includes(db.actor), 'กดรับทราบได้เฉพาะคนที่ได้รับงาน');
      t.state = { ...t.state, [db.actor]: { s: 'ack', at: stamp(new Date()) } };
      log(`รับทราบ ${woNumber(t)}`, id);
      emit();
    },
    async submit(id, { note = '', link = '', images = [] }) {
      const t = db.tasks[id];
      must(t.assignees.includes(db.actor), 'ส่งงานได้เฉพาะคนที่ได้รับงาน');
      const fileIds = images.map((img) => {
        const fid = uid('f');
        db.files = { ...db.files, [fid]: { id: fid, name: img.name, type: img.type, data: img.data } };
        return fid;
      });
      const forUids = t.mode === 'group' ? t.assignees : [db.actor];
      const sid = uid('s');
      const auto = t.needsReview === false;
      const nowS = stamp(new Date());
      db.subs = { ...db.subs, [sid]: { id: sid, taskId: id, by: db.actor, for: forUids, note, link, files: fileIds, at: nowS,
        review: auto ? { decision: 'approved', note: 'ปิดงานอัตโนมัติ (งานนี้ไม่ต้องตรวจ)', by: db.actor, at: nowS } : null } };
      const s = auto ? 'approved' : 'submitted';
      t.state = { ...t.state, ...Object.fromEntries(forUids.map((u) => [u, { s, at: nowS }])) };
      log(`${auto ? 'ทำเสร็จ' : 'ส่ง'} ${woNumber(t)}${t.mode === 'group' ? ' (ในนามกลุ่ม)' : ''}`, id);
      emit();
    },
    async review(subId, decision, note = '') {
      must(canReview(me()), 'ตรวจงานได้เฉพาะพี่ผู้ดูแล');
      const sub = db.subs[subId];
      must(!sub.for.includes(db.actor), 'ตรวจงานของตัวเองไม่ได้ ให้พี่ผู้ดูแลเป็นคนตรวจ');
      const t = db.tasks[sub.taskId];
      const nowS = stamp(new Date());
      db.subs = { ...db.subs, [subId]: { ...sub, review: { decision, note, by: db.actor, at: nowS } } };
      const s = decision === 'approved' ? 'approved' : 'changes';
      t.state = { ...t.state, ...Object.fromEntries(sub.for.map((u) => [u, { s, at: nowS, ...(note ? { note } : {}) }])) };
      const who = sub.for.map((u) => displayName(db.users[u])).join(', ');
      log(`${decision === 'approved' ? 'ตรวจผ่าน' : 'ให้แก้'} ${woNumber(t)} · ${who}`, t.id);
      emit();
    },
    async unsubmit(subId) {
      const sub = db.subs[subId];
      const t = db.tasks[sub.taskId];
      must(sub.for.includes(db.actor) && !sub.review, 'ยกเลิกได้เฉพาะงานที่ตัวเองส่งและพี่ยังไม่ตรวจ');
      const { [subId]: _x, ...rest } = db.subs;
      db.subs = rest;
      const prev = Object.values(rest).filter((s) => s.taskId === t.id && s.for.join() === sub.for.join() && s.review && s.review.decision === 'changes');
      const back = prev.length ? 'changes' : 'ack';
      t.state = { ...t.state, ...Object.fromEntries(sub.for.map((u) => [u, { s: back, at: stamp(new Date()) }])) };
      log(`ยกเลิกการส่ง ${woNumber(t)}`, t.id);
      emit();
    },
    async unreview(subId) {
      must(canReview(me()), 'ยกเลิกผลตรวจได้เฉพาะพี่ผู้ดูแล');
      const sub = db.subs[subId];
      const t = db.tasks[sub.taskId];
      db.subs = { ...db.subs, [subId]: { ...sub, review: null } };
      t.state = { ...t.state, ...Object.fromEntries(sub.for.map((u) => [u, { s: 'submitted', at: sub.at }])) };
      log(`ยกเลิกผลตรวจ ${woNumber(t)}`, t.id);
      emit();
    },
    async subsFor(taskId) {
      return Object.values(db.subs).filter((s) => s.taskId === taskId).sort((a, b) => (a.at < b.at ? 1 : -1));
    },
    async file(id) { return db.files[id] || null; },

    async savePlan(plan) {
      mayAssign();
      const id = plan.id || uid('p');
      db.plans = { ...db.plans, [id]: { ...plan, id } };
      log(`${plan.id ? 'แก้แผน' : 'เพิ่มงานในแผน'}: ${plan.title}`, null);
      emit();
      return id;
    },
    async deletePlan(id) {
      mayAssign();
      const { [id]: gone, ...rest } = db.plans;
      db.plans = rest;
      log(`ลบงานในแผน: ${gone.title}`, null);
      emit();
    },
    async updateUser(id, patch) {
      must(me()?.role === 'admin' || id === db.actor, 'แก้ข้อมูลผู้ใช้ได้เฉพาะแอดมิน');
      const self = id === db.actor && me();
      must(!self || ((patch.role ?? self.role) === self.role && (patch.isStudent ?? self.isStudent) === self.isStudent),
        'เปลี่ยนบทบาทของตัวเองไม่ได้ ให้คนอื่นที่เป็นแอดมินเปลี่ยนให้');
      db.users = { ...db.users, [id]: { ...db.users[id], ...patch } };
      if (patch.role) log(`ตั้ง ${displayName(db.users[id])} เป็น${ROLE_TH[patch.role] || patch.role}`, null);
      emit();
    },
    // the demo accepts any 12-character code; the real site checks one-time codes in firestore.rules
    async unlockAssigner(code, reason) {
      const why = String(reason || '').trim();
      must(isInternAdmin(me()), 'โหมดนี้มีไว้สำหรับแอดมินที่เป็นนักศึกษาด้วย');
      must(normCode(code).length === 12, 'รหัสมี 12 ตัว เช่น ABCD-EFGH-JKMN');
      must(why.length >= 5, 'บอกเหตุผลสั้นๆ ว่าจะเข้าไปทำอะไร');
      const until = Date.now() + 60 * 60000;
      db.users = { ...db.users, [db.actor]: { ...me(), assignerUntil: until } };
      log(`เปิดโหมดผู้มอบงานถึง ${fmtTime(new Date(until))} น. · เหตุผล: ${why.slice(0, 120)}`, null);
      emit();
    },
    async lockAssigner() {
      db.users = { ...db.users, [db.actor]: { ...me(), assignerUntil: null } };
      log('ล็อกโหมดผู้มอบงาน', null);
      emit();
    },
    async updateSettings(patch) {
      must(me()?.role === 'admin', 'ตั้งค่าได้เฉพาะแอดมิน');
      db.settings = { ...db.settings, ...patch };
      emit();
    },
    exportData() {
      const { actor, ...rest } = db;
      return { exportedAt: stamp(new Date()), today: dateKey(new Date()), ...rest };
    },
  };
}
