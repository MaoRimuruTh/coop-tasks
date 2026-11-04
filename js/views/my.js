// "งานของฉัน" — what an intern opens every morning: what to do next comes first.
import { html, useState } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { bucketsFor, stateOf, compareTasks, mentorOf, isStaff } from '../model.js';
import { Seg, Empty } from '../ui.js';
import { MyRow } from './rows.js';

export function MyTasks() {
  const { db, me, now, store, toast, openProfile } = useApp();
  // more than one พี่ in the team and none picked yet: the form would leave the mentor's name blank
  const needMentor = !mentorOf(db.users, me) && Object.values(db.users).filter(isStaff).length > 0;
  const [view, setView] = useState('todo');
  const [busy, setBusy] = useState(false);
  const mine = Object.values(db.tasks).filter((t) => t.assignees.includes(me.uid));
  const todo = mine.filter((t) => ['assigned', 'ack', 'changes'].includes(stateOf(t, me.uid)));
  const waiting = mine.filter((t) => stateOf(t, me.uid) === 'submitted').sort(compareTasks);
  const done = mine.filter((t) => stateOf(t, me.uid) === 'approved').sort((a, b) => (a.due < b.due ? 1 : -1));

  const ackAll = async (items) => {
    setBusy(true);
    try {
      for (const t of items) await store.ack(t.id);
      toast(`รับทราบ ${items.length} งานแล้ว`, 'ok');
    } catch (ex) { toast(ex.message, 'bad'); }
    setBusy(false);
  };

  return html`<section class="page">
    <header class="page-head"><h1>งานของฉัน</h1></header>
    ${needMentor ? html`<p class="callout callout--wait callout--row"><span>ยังไม่ได้เลือกพี่ที่ดูแลเรา (พนักงานที่ปรึกษา) ชื่อพี่ใช้ลงฟอร์มส่งมหาลัย</span>
      <button type="button" class="btn btn--sm btn--ghost" onClick=${openProfile}>เลือกพี่ที่ดูแล</button></p>` : ''}

    <${Seg} label="มุมมองงาน" value=${view} onChange=${setView} options=${[
      { value: 'todo', label: 'ต้องทำ', count: todo.length },
      { value: 'wait', label: 'รอตรวจ', count: waiting.length },
      { value: 'done', label: 'ผ่าน', count: done.length },
    ]} />

    ${view === 'todo' && (todo.length
      ? bucketsFor(todo, me.uid, now).map((g) => {
        const fresh = g.items.filter((t) => stateOf(t, me.uid) === 'assigned');
        return html`<section class=${`group group--${g.key}`} key=${g.key}>
          <div class="group-head">
            <h2 class="group-title">${g.title}<span>${g.items.length}</span></h2>
            ${g.key === 'fresh' && fresh.length > 1 ? html`<button type="button" class="btn btn--ghost btn--sm" disabled=${busy}
              onClick=${() => ackAll(fresh)}>รับทราบทั้งหมด (${fresh.length})</button>` : ''}
          </div>
          <ul class="wo-list">${g.items.map((t) => html`<${MyRow} task=${t} uid=${me.uid} key=${t.id} />`)}</ul>
        </section>`;
      })
      : html`<${Empty} title="ไม่มีงานค้าง" text="งานใหม่ที่พี่สั่งจะขึ้นที่นี่ พร้อมปุ่มรับทราบ" />`)}

    ${view === 'wait' && (waiting.length
      ? html`<ul class="wo-list">${waiting.map((t) => html`<${MyRow} task=${t} uid=${me.uid} key=${t.id} />`)}</ul>`
      : html`<${Empty} title="ไม่มีงานรอตรวจ" text="งานที่ส่งแล้วจะอยู่ที่นี่จนกว่าพี่จะตรวจ" />`)}

    ${view === 'done' && (done.length
      ? html`<ul class="wo-list">${done.map((t) => html`<${MyRow} task=${t} uid=${me.uid} key=${t.id} />`)}</ul>`
      : html`<${Empty} title="ยังไม่มีงานที่ผ่าน" text="งานที่พี่ตรวจผ่านแล้วจะเก็บไว้ที่นี่ ใช้ทบทวนตอนเขียนสมุดบันทึกได้" />`)}
  </section>`;
}
