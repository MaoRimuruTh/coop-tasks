// "งานของฉัน" — what an intern opens every morning.
import { html, useState } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { bucketsFor, stateOf, isLate, compareTasks, TH_DAYS, fmtDate, weekOf } from '../model.js';
import { Seg, Empty } from '../ui.js';
import { MyRow } from './rows.js';

export function MyTasks() {
  const { db, me, now, cal } = useApp();
  const [view, setView] = useState('todo');
  const mine = Object.values(db.tasks).filter((t) => t.assignees.includes(me.uid));
  const todo = mine.filter((t) => ['assigned', 'ack', 'changes'].includes(stateOf(t, me.uid)));
  const waiting = mine.filter((t) => stateOf(t, me.uid) === 'submitted').sort(compareTasks);
  const done = mine.filter((t) => stateOf(t, me.uid) === 'approved').sort((a, b) => (a.due < b.due ? 1 : -1));
  const late = todo.filter((t) => isLate(t, me.uid, now)).length;
  const newOnes = todo.filter((t) => stateOf(t, me.uid) === 'assigned').sort(compareTasks);
  const working = todo.filter((t) => stateOf(t, me.uid) !== 'assigned');
  const fresh = newOnes.length;
  const week = weekOf(cal, now);

  return html`<section class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">${TH_DAYS[now.getDay()]} ${fmtDate(now)}${week ? ` · สัปดาห์ ${week}` : ''}</p>
        <h1>งานของฉัน</h1>
      </div>
      <dl class="stat-line">
        <div><dt>ต้องทำ</dt><dd>${todo.length}</dd></div>
        <div class=${late ? 'is-bad' : ''}><dt>เลยกำหนด</dt><dd>${late}</dd></div>
        <div class=${fresh ? 'is-warn' : ''}><dt>ยังไม่รับทราบ</dt><dd>${fresh}</dd></div>
      </dl>
    </header>

    <${Seg} label="มุมมองงาน" value=${view} onChange=${setView} options=${[
      { value: 'todo', label: 'ต้องทำ', count: todo.length },
      { value: 'wait', label: 'รอตรวจ', count: waiting.length },
      { value: 'done', label: 'ผ่านแล้ว', count: done.length },
    ]} />

    ${view === 'todo' && (todo.length
      ? [
        newOnes.length ? html`<section class="group group--new" key="new">
          <h2 class="group-title">งานใหม่ ยังไม่รับทราบ<span>${newOnes.length}</span></h2>
          <ul class="wo-list">${newOnes.map((t) => html`<${MyRow} task=${t} uid=${me.uid} key=${t.id} />`)}</ul>
        </section>` : null,
        ...bucketsFor(working, me.uid, now).map((g) => html`<section class=${`group group--${g.key}`} key=${g.key}>
          <h2 class="group-title">${g.title}<span>${g.items.length}</span></h2>
          <ul class="wo-list">${g.items.map((t) => html`<${MyRow} task=${t} uid=${me.uid} key=${t.id} />`)}</ul>
        </section>`),
      ]
      : html`<${Empty} title="ไม่มีงานค้าง" text="งานใหม่ที่พี่สั่งจะขึ้นที่นี่ พร้อมปุ่มรับทราบ" />`)}

    ${view === 'wait' && (waiting.length
      ? html`<ul class="wo-list">${waiting.map((t) => html`<${MyRow} task=${t} uid=${me.uid} key=${t.id} />`)}</ul>`
      : html`<${Empty} title="ไม่มีงานรอตรวจ" text="งานที่ส่งแล้วจะอยู่ที่นี่จนกว่าพี่จะกดผ่านหรือให้แก้" />`)}

    ${view === 'done' && (done.length
      ? html`<ul class="wo-list">${done.map((t) => html`<${MyRow} task=${t} uid=${me.uid} key=${t.id} />`)}</ul>`
      : html`<${Empty} title="ยังไม่มีงานที่ผ่าน" />`)}
  </section>`;
}
