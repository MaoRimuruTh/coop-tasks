// "แผน 16 สัปดาห์" — the production-schedule style board of big tasks (หัวข้องาน).
import { html, useState } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { weekOf, fmtRange, fmtDate, canAssign, displayName, tally, weeksLabel } from '../model.js';
import { Sheet, Field, Icon, ConfirmButton, Empty } from '../ui.js';

function PlanEditor({ plan, onClose }) {
  const { store, students, cal, toast } = useApp();
  const [title, setTitle] = useState(plan ? plan.title : '');
  const [weeks, setWeeks] = useState(plan ? plan.weeks : []);
  const [assignees, setAssignees] = useState(plan ? plan.assignees : []);
  const [kind, setKind] = useState(plan ? plan.kind : 'normal');
  const [note, setNote] = useState(plan ? plan.note : '');
  const [err, setErr] = useState({});
  const toggleWeek = (n) => setWeeks((w) => (w.includes(n) ? w.filter((x) => x !== n) : [...w, n].sort((a, b) => a - b)));
  const toggleUser = (uid) => setAssignees((a) => (a.includes(uid) ? a.filter((x) => x !== uid) : [...a, uid]));
  const save = async () => {
    const e = {};
    if (!title.trim()) e.title = 'ใส่ชื่องาน';
    if (!weeks.length) e.weeks = 'เลือกอย่างน้อย 1 สัปดาห์';
    setErr(e);
    if (Object.keys(e).length) return;
    try {
      await store.savePlan({ ...(plan || {}), title: title.trim(), weeks, assignees, kind, note: note.trim(), order: plan ? plan.order : Date.now() % 100000 });
      toast('บันทึกแผนแล้ว', 'ok');
      onClose();
    } catch (ex) { setErr({ form: ex.message }); }
  };
  const remove = async () => {
    try { await store.deletePlan(plan.id); toast('ลบออกจากแผนแล้ว'); onClose(); } catch (ex) { setErr({ form: ex.message }); }
  };
  return html`<${Sheet} title=${plan ? 'แก้ไขหัวข้องาน' : 'เพิ่มหัวข้องาน'} onClose=${onClose}
    footer=${html`${plan ? html`<${ConfirmButton} label="ลบ" confirmLabel="กดอีกครั้งเพื่อลบ" icon="trash" onConfirm=${remove} />` : ''}
      <span class="foot-space"></span>
      <button type="button" class="btn btn--ghost" onClick=${onClose}>ยกเลิก</button>
      <button type="button" class="btn btn--primary" onClick=${save}>บันทึก</button>`}>
    <div class="form">
      <${Field} id="pe-title" label="หัวข้องาน (ชื่อที่จะลงในฟอร์มมหาลัย)" error=${err.title}>
        <input id="pe-title" type="text" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="เช่น อ่านแบบและตรวจสอบชิ้นงาน" maxlength="90" />
      <//>
      <${Field} label="สัปดาห์ที่ทำ" error=${err.weeks} hint="แตะเลือกสัปดาห์ได้หลายช่อง">
        <div class="week-picker">${[1, 2, 3, 4].map((m) => html`<div class=${`wp-month${m >= 3 ? ' is-project' : ''}`}>
          <span class="wp-label">เดือนที่ ${m}<small>${fmtRange(cal.months[m - 1].from, cal.months[m - 1].to)}</small></span>
          <div class="wp-weeks">${[0, 1, 2, 3].map((i) => {
            const n = 4 * (m - 1) + i + 1;
            const w = cal.weeks[n - 1];
            return html`<button type="button" class=${`wp-week${weeks.includes(n) ? ' is-on' : ''}`} aria-pressed=${weeks.includes(n)}
              onClick=${() => toggleWeek(n)}><b>W${n}</b><small>${fmtDate(w.from)}</small></button>`;
          })}</div></div>`)}</div>
      <//>
      <${Field} label="ใครทำ">
        <div class="chips">
          <button type="button" class=${`chip${assignees.length === 0 ? ' is-on' : ''}`} aria-pressed=${assignees.length === 0} onClick=${() => setAssignees([])}>นักศึกษาทุกคน</button>
          ${students.map((u) => html`<button type="button" class=${`chip${assignees.includes(u.uid) ? ' is-on' : ''}`} aria-pressed=${assignees.includes(u.uid)}
            onClick=${() => toggleUser(u.uid)}>${displayName(u)}</button>`)}
        </div>
      <//>
      <${Field} label="ประเภท">
        <div class="choice">
          <button type="button" class=${`choice-btn${kind === 'normal' ? ' is-on' : ''}`} aria-pressed=${kind === 'normal'} onClick=${() => setKind('normal')}><b>งานทั่วไป</b><span>เรียนรู้และฝึกงาน</span></button>
          <button type="button" class=${`choice-btn${kind === 'project' ? ' is-on' : ''}`} aria-pressed=${kind === 'project'} onClick=${() => setKind('project')}><b>งานโปรเจค</b><span>ปกติอยู่ในเดือนที่ 3–4</span></button>
        </div>
      <//>
      <${Field} id="pe-note" label="หมายเหตุ" hint="เช่น งานกลุ่ม ร่วมกับ… หรือ งานเดี่ยว">
        <div class="chips chips--quick">
          ${['งานกลุ่ม', 'งานเดี่ยว'].map((x) => html`<button type="button" class=${`chip chip--sm${note === x ? ' is-on' : ''}`} onClick=${() => setNote(x)}>${x}</button>`)}
        </div>
        <input id="pe-note" type="text" value=${note} onInput=${(e) => setNote(e.target.value)} maxlength="80" />
      <//>
      ${err.form ? html`<p class="form-error" role="alert">${err.form}</p>` : ''}
    </div>
  <//>`;
}

export function PlanView() {
  const { db, me, now, cal, go } = useApp();
  const [editing, setEditing] = useState(null); // null | {} | plan
  const staff = canAssign(me, now);
  const nowWeek = weekOf(cal, now);
  const plans = Object.values(db.plans).sort((a, b) => (Math.min(...a.weeks) - Math.min(...b.weeks)) || ((a.order ?? 0) - (b.order ?? 0)));
  const tasks = Object.values(db.tasks);
  const statsFor = (p) => {
    const linked = tasks.filter((t) => t.planId === p.id);
    const done = linked.filter((t) => { const k = tally(t, now); return k.approved === k.total; }).length;
    return { n: linked.length, done };
  };
  const who = (p) => (p.assignees.length ? p.assignees.map((u) => displayName(db.users[u])).join(', ') : 'ทุกคน');
  const mine = (p) => staff || !p.assignees.length || p.assignees.includes(me.uid);

  return html`<section class="page page--wide">
    <header class="page-head">
      <div><h1>แผน 16 สัปดาห์</h1><p class="page-sub">${fmtRange(cal.start, cal.end)} · ฝึกงาน${db.settings.workDays || 'จันทร์–เสาร์'} ${db.settings.workStart || '08:00'}–${db.settings.workEnd || '17:00'} น.</p></div>
      <div class="head-actions">
        <button type="button" class="btn btn--ghost" onClick=${() => go('form')}><${Icon} name="form" size=${18} />ฟอร์มส่งมหาลัย</button>
        ${staff ? html`<button type="button" class="btn btn--primary" onClick=${() => setEditing({})}><${Icon} name="plus" size=${18} />เพิ่มหัวข้องาน</button>` : ''}
      </div>
    </header>
    <p class="note-band">เดือนที่ 3–4 เป็นงานโปรเจคของนักศึกษา สั่งเป็นงานกลุ่มร่วมกับนักศึกษาฝึกงานคนอื่น หรือสั่งแยกรายคนก็ได้</p>

    ${plans.length === 0 ? html`<${Empty} title="ยังไม่มีหัวข้องานในแผน" text=${staff ? 'กด “เพิ่มหัวข้องาน” แล้วแตะเลือกสัปดาห์ที่ทำ' : 'พี่ผู้ดูแลจะเป็นคนลงแผน'} />` : html`
    <ul class="plan-strips" aria-label="แผนแบบย่อสำหรับมือถือ">
      <li class="ps-head"><div class="strip">${cal.months.map((mo) => html`<span class="strip-label"><b>เดือนที่ ${mo.m}</b><span>${fmtDate(mo.from)} –</span><span>${fmtDate(mo.to)}</span></span>`)}</div></li>
      ${plans.map((p) => {
        const st = statsFor(p);
        return html`<li class=${`ps-item ps-item--${p.kind}${mine(p) ? '' : ' is-other'}`} key=${`s-${p.id}`}>
          <div class="g-label-text">
            ${staff ? html`<button type="button" class="g-title" onClick=${() => setEditing(p)}>${p.title}</button>` : html`<span class="g-title">${p.title}</span>`}
            <small>${weeksLabel(p.weeks)} · ${who(p)}${p.note ? ` · ${p.note}` : ''}${st.n ? ` · งานย่อย ${st.done}/${st.n} เสร็จ` : ''}</small>
          </div>
          <div class="strip" aria-hidden="true">${[1, 2, 3, 4].map((m) => html`<span class="strip-m">${[0, 1, 2, 3].map((i) => {
            const n = 4 * (m - 1) + i + 1;
            return html`<i class=${`${p.weeks.includes(n) ? 'on' : ''}${n === nowWeek ? ' now' : ''}`}></i>`;
          })}</span>`)}</div>
        </li>`;
      })}
    </ul>
    <div class="gantt-scroll" tabindex="0" aria-label="ตารางแผน เลื่อนซ้ายขวาได้">
      <table class="gantt">
        <thead>
          <tr class="g-months">
            <th class="g-label" rowspan="2" scope="col">หัวข้องาน</th>
            ${cal.months.map((mo) => html`<th colspan="4" scope="colgroup" class=${`g-month${mo.m >= 3 ? ' is-project' : ''}`}>
              เดือนที่ ${mo.m}<small>${fmtRange(mo.from, mo.to)}</small></th>`)}
          </tr>
          <tr class="g-weeks">${cal.weeks.map((w) => html`<th scope="col" class=${`g-week${w.n === nowWeek ? ' is-now' : ''}${w.n % 4 === 1 ? ' m-start' : ''}`}
            title=${fmtRange(w.from, w.to)}>W${w.n}<small>${w.from.getDate()}</small></th>`)}</tr>
        </thead>
        <tbody>${plans.map((p) => {
          const st = statsFor(p);
          return html`<tr class=${`g-row g-row--${p.kind}${mine(p) ? '' : ' is-other'}`} key=${p.id}>
            <th scope="row" class="g-label">
              ${staff ? html`<button type="button" class="g-title" onClick=${() => setEditing(p)}>${p.title}</button>` : html`<span class="g-title">${p.title}</span>`}
              <small>${who(p)}${p.note ? ` · ${p.note}` : ''}${st.n ? ` · งานย่อย ${st.done}/${st.n} เสร็จ` : ''}</small>
            </th>
            ${cal.weeks.map((w) => {
              const on = p.weeks.includes(w.n);
              const prev = p.weeks.includes(w.n - 1);
              const next = p.weeks.includes(w.n + 1);
              return html`<td class=${`g-cell${w.n === nowWeek ? ' is-now' : ''}${w.n % 4 === 1 ? ' m-start' : ''}`}>
                ${on ? html`<span class=${`g-bar${prev ? '' : ' g-bar--start'}${next ? '' : ' g-bar--end'}`}></span>` : ''}</td>`;
            })}
          </tr>`;
        })}</tbody>
      </table>
    </div>`}
    ${editing ? html`<${PlanEditor} plan=${editing.id ? editing : null} onClose=${() => setEditing(null)} />` : ''}
  </section>`;
}
