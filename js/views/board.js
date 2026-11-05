// "ภาพรวม" — the supervisor's board: work waiting for him first, then each intern's lamps.
import { html } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { stateOf, isLate, tally, toLocalDate, displayName, fmtTime, fmtDay } from '../model.js';
import { Avatar } from '../ui.js';
import { StaffRow, StateLegend } from './rows.js';

const LAMPS = [
  { key: 'late', label: 'เลยกำหนด', lamp: 'stop' },
  { key: 'changes', label: 'ให้แก้', lamp: 'stop' },
  { key: 'submitted', label: 'รอตรวจ', lamp: 'wait' },
  { key: 'assigned', label: 'ยังไม่รับทราบ', lamp: 'idle' },
  { key: 'ack', label: 'รับทราบแล้ว', lamp: 'run' },
  { key: 'approved', label: 'ผ่าน', lamp: 'ok' },
];

function Queue({ title, items, empty, tone }) {
  return html`<section class="queue">
    <div class="section-head"><h2>${title} <span class=${`count${tone ? ` count--${tone}` : ''}`}>${items.length}</span></h2></div>
    ${items.length ? html`<ul class="wo-list">${items.map((t) => html`<${StaffRow} task=${t} key=${t.id} />`)}</ul>`
      : html`<p class="quiet">${empty}</p>`}
  </section>`;
}

export function Board() {
  const { db, now, students, go, setTaskFilter } = useApp();
  const tasks = Object.values(db.tasks);
  const counts = Object.fromEntries(students.map((u) => [u.uid, { late: 0, changes: 0, submitted: 0, assigned: 0, ack: 0, approved: 0 }]));
  for (const t of tasks) {
    for (const u of t.assignees) {
      if (!counts[u]) continue;
      if (isLate(t, u, now)) counts[u].late += 1;
      else counts[u][stateOf(t, u)] += 1;
    }
  }
  const byDue = (a, b) => (a.due < b.due ? -1 : 1);
  const withTally = tasks.map((t) => ({ t, k: tally(t, now) }));
  const review = withTally.filter((x) => x.k.submitted).map((x) => x.t).sort(byDue);
  const late = withTally.filter((x) => x.k.late).map((x) => x.t).sort(byDue);
  const unseen = withTally.filter((x) => x.k.assigned && !x.k.late).map((x) => x.t).sort(byDue);
  const recent = (db.activity || []).slice(0, 8);
  const openStudent = (uid, status) => { setTaskFilter({ uid, status }); go('tasks'); };

  return html`<section class="page page--wide">
    <header class="page-head"><h1>ภาพรวม</h1></header>

    <div class="board-cols">
      <${Queue} title="รอตรวจ" items=${review} empty="ไม่มีงานรอตรวจ" tone=${review.length ? 'wait' : ''} />
      <${Queue} title="เลยกำหนด" items=${late} empty="ไม่มีงานเลยกำหนด" tone=${late.length ? 'bad' : ''} />
    </div>

    <section class="andon" aria-labelledby="andon-title">
      <div class="section-head"><h2 id="andon-title">สถานะนักศึกษา</h2><${StateLegend} /></div>
      <ul class="andon-list">
        ${students.map((u) => {
          const c = counts[u.uid];
          const lit = LAMPS.filter((l) => c[l.key] > 0);
          return html`<li class="andon-row" key=${u.uid}>
            <button type="button" class="andon-who" onClick=${() => openStudent(u.uid, 'open')}>
              <${Avatar} user=${u} /><span><b>${displayName(u)}</b><small>${u.name}</small></span>
            </button>
            <div class="andon-lamps">
              ${lit.length ? lit.map((l) => html`<button type="button" class=${`andon-chip andon-chip--${l.lamp}`}
                onClick=${() => openStudent(u.uid, l.key)} aria-label=${`${displayName(u)} ${l.label} ${c[l.key]} งาน`}>
                <span class=${`lamp lamp--${l.lamp} lamp--sm`}></span>${l.label}<b>${c[l.key]}</b></button>`)
              : html`<span class="quiet">ยังไม่มีงาน</span>`}
            </div>
          </li>`;
        })}
      </ul>
    </section>

    <div class="board-cols">
      <${Queue} title="ยังไม่รับทราบ" items=${unseen} empty="ทุกคนรับทราบงานแล้ว" />
      <section class="queue">
        <div class="section-head"><h2>ความเคลื่อนไหวล่าสุด</h2></div>
        ${recent.length ? html`<ol class="feed">${recent.map((a) => {
          const d = toLocalDate(a.at);
          return html`<li><span class="feed-time">${fmtDay(d).split(' ')[0]} ${fmtTime(d)}</span><span><b>${displayName(db.users[a.by])}</b> ${a.text}</span></li>`;
        })}</ol>` : html`<p class="quiet">ยังไม่มีความเคลื่อนไหว</p>`}
      </section>
    </div>
  </section>`;
}
