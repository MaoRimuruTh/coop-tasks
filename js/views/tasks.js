// "งานทั้งหมด" — every work order, filtered by intern / status / plan item.
import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { stateOf, isLate, tally, compareTasks, displayName, weeksLabel } from '../model.js';
import { Empty, Icon } from '../ui.js';
import { StaffRow } from './rows.js';

const STATUS_OPTIONS = [
  { value: 'open', label: 'ยังไม่ผ่าน' },
  { value: 'late', label: 'เลยกำหนด' },
  { value: 'submitted', label: 'รอตรวจ' },
  { value: 'changes', label: 'ให้แก้' },
  { value: 'assigned', label: 'ยังไม่รับทราบ' },
  { value: 'ack', label: 'รับทราบแล้ว' },
  { value: 'approved', label: 'ผ่าน' },
  { value: 'all', label: 'ทั้งหมด' },
];

function matches(task, uid, status, now) {
  const people = uid ? [uid] : task.assignees;
  if (uid && !task.assignees.includes(uid)) return false;
  if (status === 'all') return true;
  if (status === 'open') {
    if (uid) return stateOf(task, uid) !== 'approved';
    return tally(task, now).approved < task.assignees.length;
  }
  if (status === 'late') return people.some((u) => isLate(task, u, now));
  // Same counting rule as the andon board: a late task counts under "เลยกำหนด" only.
  return people.some((u) => {
    if (stateOf(task, u) !== status) return false;
    if (status === 'submitted' || status === 'approved') return true;
    return !isLate(task, u, now);
  });
}

export function AllTasks() {
  const { db, now, students, taskFilter, setTaskFilter, editTask } = useApp();
  const [uid, setUid] = useState(taskFilter ? taskFilter.uid : '');
  const [status, setStatus] = useState(taskFilter ? taskFilter.status : 'open');
  const [plan, setPlan] = useState('');
  useEffect(() => { if (taskFilter) setTaskFilter(null); }, []);

  const plans = Object.values(db.plans).sort((a, b) => Math.min(...a.weeks) - Math.min(...b.weeks));
  const list = Object.values(db.tasks)
    .filter((t) => matches(t, uid, status, now))
    .filter((t) => !plan || t.planId === plan)
    .sort(compareTasks);

  return html`<section class="page">
    <header class="page-head">
      <h1>งานทั้งหมด <span class="count">${Object.keys(db.tasks).length}</span></h1>
    </header>

    <div class="filters">
      <div class="chips" role="group" aria-label="เลือกนักศึกษา">
        <button type="button" class=${`chip${uid === '' ? ' is-on' : ''}`} aria-pressed=${uid === ''} onClick=${() => setUid('')}>ทุกคน</button>
        ${students.map((u) => html`<button type="button" class=${`chip${uid === u.uid ? ' is-on' : ''}`} aria-pressed=${uid === u.uid}
          onClick=${() => setUid(u.uid)}>${displayName(u)}</button>`)}
      </div>
      <div class="filter-row">
        <label class="select-wrap"><span class="sr-only">สถานะ</span>
          <select id="f-status" value=${status} onChange=${(e) => setStatus(e.target.value)}>
            ${STATUS_OPTIONS.map((o) => html`<option value=${o.value}>${o.label}</option>`)}
          </select></label>
        <label class="select-wrap select-wrap--grow"><span class="sr-only">หัวข้องาน</span>
          <select id="f-plan" value=${plan} onChange=${(e) => setPlan(e.target.value)}>
            <option value="">ทุกหัวข้องาน</option>
            ${plans.map((p) => html`<option value=${p.id}>${p.title} (${weeksLabel(p.weeks)})</option>`)}
          </select></label>
      </div>
    </div>

    ${list.length ? html`<ul class="wo-list">${list.map((t) => html`<${StaffRow} task=${t} key=${t.id} />`)}</ul>`
      : html`<${Empty} title="ไม่มีงานตรงกับตัวกรองนี้" text="ลองเปลี่ยนสถานะเป็น “ทั้งหมด” หรือเลือก “ทุกคน”" />`}
  </section>`;
}
