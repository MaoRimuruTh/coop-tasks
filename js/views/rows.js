// Work-order rows used by "งานของฉัน", "งานทั้งหมด" and the overview queues.
import { html } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { stateOf, isLate, woNumber, displayName, STATES, worstState, dueInfo } from '../model.js';
import { Lamp, DueChip, PrioChip, StateTag } from '../ui.js';

export function planTitle(db, planId) {
  const p = db.plans[planId];
  return p ? p.title : 'ยังไม่ผูกกับหัวข้องาน';
}

/** Row as an intern sees it: one lamp for "my" state, quick "รับทราบ". */
export function MyRow({ task, uid }) {
  const { now, openTask, store, toast } = useApp();
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
        <span class="wo-meta"><span class="mono">${woNumber(task)}</span><span>มอบโดย ${task.assignerName}</span>${task.mode === 'group' ? html`<span>งานกลุ่ม</span>` : ''}</span>
        ${s === 'changes' && note ? html`<span class="wo-note">ให้แก้: ${note}</span>` : ''}
      </span>
      <span class="wo-side">
        <${DueChip} due=${task.due} now=${now} done=${s === 'approved' || s === 'submitted'} />
        <span class="wo-side-row">${s !== 'assigned' ? html`<${StateTag} state=${s} late=${late} />` : ''}<${PrioChip} value=${task.priority} /></span>
      </span>
    </button>
    ${s === 'assigned' ? html`<button type="button" class="btn btn--ack" onClick=${ack}>รับทราบ</button>` : ''}
  </li>`;
}

/** Row as staff sees it: one lamp for whoever needs attention first, then each intern by name. */
export function StaffRow({ task }) {
  const { db, now, openTask } = useApp();
  const worst = worstState(task, now);
  const allDone = task.assignees.every((u) => stateOf(task, u) === 'approved');
  const anyLate = task.assignees.some((u) => isLate(task, u, now));
  const pastDue = dueInfo(task.due, now).tone === 'late';
  return html`<li class=${`wo wo--staff${allDone ? ' is-done' : ''}`}>
    <button type="button" class="wo-open" onClick=${() => openTask(task.no)}>
      <${Lamp} state=${worst.state} late=${worst.late} />
      <span class="wo-main">
        <span class="wo-title">${task.order != null ? html`<b class="wo-order">#${task.order}</b>` : ''}${task.title}</span>
        <span class="wo-meta"><span class="mono">${woNumber(task)}</span>${task.mode === 'group' ? html`<span>งานกลุ่ม</span>` : ''}</span>
        <span class="wo-people">${task.assignees.map((u) => {
          const s = stateOf(task, u);
          const late = isLate(task, u, now);
          return html`<span class="person" title=${late ? 'เลยกำหนด' : STATES[s].label}><${Lamp} state=${s} late=${late} size="sm" />${displayName(db.users[u])}<small>${late ? 'เลยกำหนด' : STATES[s].label}</small></span>`;
        })}</span>
      </span>
      <span class="wo-side">
        <${DueChip} due=${task.due} now=${now} done=${allDone || (pastDue && !anyLate)} />
        <${PrioChip} value=${task.priority} />
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
