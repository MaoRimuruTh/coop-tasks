// "ภาพรวม" — the supervisor's andon board: who is stuck, what waits for review.
import { html } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { stateOf, isLate, tally, toLocalDate, startOfDay, TH_DAYS, fmtDate, weekOf, displayName, fmtTime, fmtDay } from '../model.js';
import { Avatar, Empty } from '../ui.js';
import { StaffRow, StateLegend } from './rows.js';

const CELLS = [
  { key: 'late', label: 'เลยกำหนด', lamp: 'stop' },
  { key: 'changes', label: 'ให้แก้', lamp: 'stop' },
  { key: 'submitted', label: 'รอตรวจ', lamp: 'wait' },
  { key: 'assigned', label: 'ยังไม่รับทราบ', lamp: 'idle' },
  { key: 'ack', label: 'รับทราบแล้ว', lamp: 'run' },
  { key: 'approved', label: 'ผ่าน', lamp: 'ok' },
];

export function Board() {
  const { db, now, cal, students, go, setTaskFilter } = useApp();
  const tasks = Object.values(db.tasks);
  const today = startOfDay(now).getTime();
  const counts = Object.fromEntries(students.map((u) => [u.uid, { late: 0, changes: 0, submitted: 0, assigned: 0, ack: 0, approved: 0 }]));
  for (const t of tasks) {
    for (const u of t.assignees) {
      if (!counts[u]) continue;
      const s = stateOf(t, u);
      if (isLate(t, u, now)) counts[u].late += 1;
      else counts[u][s] += 1;
    }
  }
  const withTally = tasks.map((t) => ({ t, k: tally(t, now) }));
  const review = withTally.filter((x) => x.k.submitted).map((x) => x.t).sort((a, b) => (a.due < b.due ? -1 : 1));
  const late = withTally.filter((x) => x.k.late).map((x) => x.t).sort((a, b) => (a.due < b.due ? -1 : 1));
  const unseen = withTally.filter((x) => x.k.assigned && !x.k.late).map((x) => x.t).sort((a, b) => (a.due < b.due ? -1 : 1));
  const dueToday = withTally.filter((x) => {
    const d = toLocalDate(x.t.due);
    return d && startOfDay(d).getTime() === today && x.k.approved < x.k.total;
  }).length;
  const week = weekOf(cal, now);
  const recent = (db.activity || []).slice(0, 6);

  const openStudent = (uid, status) => { setTaskFilter({ uid, status }); go('tasks'); };

  return html`<section class="page page--wide">
    <header class="page-head">
      <div>
        <p class="eyebrow">${TH_DAYS[now.getDay()]} ${fmtDate(now)}${week ? ` · สัปดาห์ ${week} เดือนที่ ${Math.ceil(week / 4)}` : ''}</p>
        <h1>ภาพรวมวันนี้</h1>
      </div>
      <p class="brief">ครบกำหนดวันนี้ <b>${dueToday}</b> งาน · รอตรวจ <b>${review.length}</b> · เลยกำหนด <b class=${late.length ? 'is-bad' : ''}>${late.length}</b> · ยังไม่รับทราบ <b>${unseen.length}</b></p>
    </header>

    <section class="andon" aria-labelledby="andon-title">
      <div class="section-head"><h2 id="andon-title">สถานะนักศึกษา</h2><${StateLegend} /></div>
      ${students.length ? html`<div class="andon-grid">
        ${students.map((u) => html`<article class="andon-card" key=${u.uid}>
          <button type="button" class="andon-who" onClick=${() => openStudent(u.uid, 'open')}>
            <${Avatar} user=${u} size="lg" /><span><b>${displayName(u)}</b><small>${u.name}</small></span>
          </button>
          <div class="andon-cells">
            ${CELLS.map((c) => {
              const n = counts[u.uid][c.key];
              return html`<button type="button" class=${`andon-cell andon-cell--${c.lamp}${n ? ' is-lit' : ''}`}
                onClick=${() => openStudent(u.uid, c.key)} aria-label=${`${displayName(u)} ${c.label} ${n} งาน`}>
                <span class="andon-n">${n}</span><span class="andon-l">${c.label}</span></button>`;
            })}
          </div>
        </article>`)}
      </div>` : html`<${Empty} title="ยังไม่มีนักศึกษาในระบบ" text="แอดมินเพิ่มนักศึกษาได้ที่เมนูจัดการระบบ" />`}
    </section>

    <div class="board-cols">
      <section class="queue">
        <div class="section-head"><h2>รอตรวจ <span class="count">${review.length}</span></h2></div>
        ${review.length ? html`<ul class="wo-list">${review.map((t) => html`<${StaffRow} task=${t} key=${t.id} />`)}</ul>`
          : html`<p class="quiet">ไม่มีงานรอตรวจ</p>`}
      </section>
      <section class="queue">
        <div class="section-head"><h2>เลยกำหนด <span class="count count--bad">${late.length}</span></h2></div>
        ${late.length ? html`<ul class="wo-list">${late.map((t) => html`<${StaffRow} task=${t} key=${t.id} />`)}</ul>`
          : html`<p class="quiet">ไม่มีงานเลยกำหนด</p>`}
      </section>
      <section class="queue">
        <div class="section-head"><h2>ยังไม่รับทราบ <span class="count">${unseen.length}</span></h2></div>
        ${unseen.length ? html`<ul class="wo-list">${unseen.map((t) => html`<${StaffRow} task=${t} key=${t.id} />`)}</ul>`
          : html`<p class="quiet">ทุกคนรับทราบงานแล้ว</p>`}
      </section>
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
