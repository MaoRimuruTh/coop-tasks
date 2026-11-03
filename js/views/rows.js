// Work-order rows used by "งานของฉัน", "งานทั้งหมด" and the overview queues.
import { html } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { stateOf, isLate, tally, woNumber, displayName, STATES, dueInfo } from '../model.js';
import { Lamp, DueChip, Prio, Avatar, StateTag } from '../ui.js';

export function planTitle(db, planId) {
  const p = db.plans[planId];
  return p ? p.title : 'ยังไม่ผูกกับแผน';
}

/** Row as an intern sees it: one lamp for "my" state, quick "รับทราบ". */
export function MyRow({ task, uid }) {
  const { db, now, openTask, store, toast } = useApp();
  const s = stateOf(task, uid);
  const late = isLate(task, uid, now);
  const note = task.state[uid] && task.state[uid].note;
  const ack = async (e) => {
    e.stopPropagation();
    try { await store.ack(task.id); toast(`รับทราบ ${woNumber(task)} แล้ว`, 'ok'); } catch (err) { toast(err.message, 'bad'); }
  };
  return html`<li class=${`wo wo--${s}${late ? ' is-late' : ''}`}>
    <button type="button" class="wo-open" onClick=${() => openTask(task.no)}>
      <${Lamp} state=${s} late=${late} />
      <span class="wo-main">
        <span class="wo-title">${task.order != null ? html`<b class="wo-order">#${task.order}</b>` : ''}${task.title}</span>
        <span class="wo-meta"><span class="mono">${woNumber(task)}</span><span>${planTitle(db, task.planId)}</span><span>มอบโดย ${task.assignerName}</span></span>
        ${s === 'changes' && note ? html`<span class="wo-note">ให้แก้: ${note}</span>` : ''}
      </span>
      <span class="wo-side">
        <${DueChip} due=${task.due} now=${now} done=${s === 'approved'} />
        <span class="wo-side-row">${s !== 'assigned' ? html`<${StateTag} state=${s} late=${late} compact />` : ''}<${Prio} value=${task.priority} /></span>
      </span>
    </button>
    ${s === 'assigned' ? html`<button type="button" class="btn btn--ack" onClick=${ack}>รับทราบ</button>` : ''}
  </li>`;
}

/** Row as staff sees it: every assignee as a lamp-ringed avatar. */
export function StaffRow({ task, highlight }) {
  const { db, now, openTask } = useApp();
  const t = tally(task, now);
  const done = t.approved === t.total;
  const summary = [
    t.late ? `${t.late} เลยกำหนด` : '',
    t.submitted ? `${t.submitted} รอตรวจ` : '',
    t.changes ? `${t.changes} ให้แก้` : '',
    t.assigned ? `${t.assigned} ยังไม่รับทราบ` : '',
  ].filter(Boolean).join(' · ') || (done ? 'ผ่านครบทุกคน' : 'รับทราบแล้วทุกคน');
  return html`<li class=${`wo wo--staff${done ? ' is-done' : ''}${highlight ? ' is-hl' : ''}`}>
    <button type="button" class="wo-open" onClick=${() => openTask(task.no)}>
      <span class="wo-people">
        ${task.assignees.map((u) => html`<${Avatar} user=${db.users[u]} state=${stateOf(task, u)} late=${isLate(task, u, now)} size="sm" />`)}
      </span>
      <span class="wo-main">
        <span class="wo-title">${task.order != null ? html`<b class="wo-order">#${task.order}</b>` : ''}${task.title}</span>
        <span class="wo-meta"><span class="mono">${woNumber(task)}</span><span>${task.mode === 'group' ? 'งานกลุ่ม' : task.assignees.length > 1 ? 'แยกรายคน' : displayName(db.users[task.assignees[0]])}</span><span>${summary}</span></span>
      </span>
      <span class="wo-side">
        <${DueChip} due=${task.due} now=${now} done=${done || (t.late === 0 && dueInfo(task.due, now).tone === 'late')} />
        <${Prio} value=${task.priority} />
      </span>
    </button>
  </li>`;
}

export function StateLegend() {
  const items = [['idle', STATES.assigned.label], ['run', STATES.ack.label], ['wait', STATES.submitted.label],
    ['stop', `${STATES.changes.label} / เลยกำหนด`], ['ok', STATES.approved.label]];
  return html`<ul class="legend" aria-label="ความหมายของไฟสถานะ">
    ${items.map(([lamp, label]) => html`<li><span class=${`lamp lamp--${lamp}`}></span>${label}</li>`)}
  </ul>`;
}
