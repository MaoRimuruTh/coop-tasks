// Create / edit a work order. Built for one thumb on a phone: chips over dropdowns.
import { html, useState } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { PRIORITIES, addDays, dateKey, toLocalDate, weekOf, displayName, fmtDay, wLabel, isInternAdmin, planSort } from '../model.js';
import { Sheet, Field, Icon, ConfirmButton } from '../ui.js';

// due times default to the end of the interns' working day (จัดการระบบ → เวลาฝึกงาน)
const quickDates = (now, end) => {
  const fri = addDays(now, (5 - now.getDay() + 7) % 7 || 0);
  return [
    { label: `วันนี้ ${end}`, d: now, t: end },
    { label: `พรุ่งนี้ ${end}`, d: addDays(now, 1), t: end },
    { label: `ศุกร์นี้ (${fmtDay(fri).split(' ').slice(1).join(' ')})`, d: fri, t: end },
    { label: 'อีก 7 วัน', d: addDays(now, 7), t: end },
  ];
};

export function TaskForm({ task, onClose }) {
  const { db, me, now, cal, students, store, toast, openTask } = useApp();
  const editing = !!task;
  const end = (db.settings && db.settings.workEnd) || '17:00';
  // an intern with assigner mode open assigns other interns only
  const pickable = isInternAdmin(me) ? students.filter((u) => u.uid !== me.uid) : students;
  const due0 = task ? task.due : `${dateKey(addDays(now, 1))}T${end}`;
  const [title, setTitle] = useState(task ? task.title : '');
  const [details, setDetails] = useState(task ? task.details : '');
  const [assignees, setAssignees] = useState(task ? task.assignees : []);
  const [mode, setMode] = useState(task ? task.mode : 'individual');
  const [date, setDate] = useState(due0.slice(0, 10));
  const [time, setTime] = useState(due0.slice(11, 16) || end);
  const [priority, setPriority] = useState(task ? task.priority : 2);
  const [order, setOrder] = useState(task && task.order != null ? String(task.order) : '');
  const [assigner, setAssigner] = useState(task ? task.assignerName : displayName(me));
  const [needsReview, setNeedsReview] = useState(task ? task.needsReview !== false : true);
  const plans = Object.values(db.plans).filter((p) => p.weeks && p.weeks.length).sort(planSort);
  // value is "planId" or "planId|stepId": the week of the due date picks the big item and, inside it, the sub-item
  const suggestPlan = (uids, d) => {
    const w = weekOf(cal, toLocalDate(d) || now);
    const fit = plans.filter((p) => p.weeks.includes(w) && (!p.assignees.length || uids.some((u) => p.assignees.includes(u))));
    const p = fit[0] || plans[0];
    if (!p) return '';
    const st = (p.steps || []).find((x) => (x.weeks || []).includes(w));
    return st ? `${p.id}|${st.id}` : p.id;
  };
  const [planId, setPlanId] = useState(task ? (task.stepId ? `${task.planId}|${task.stepId}` : task.planId) : suggestPlan([], `${date}T${time}`));
  const [touchedPlan, setTouchedPlan] = useState(!!task);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const allOn = pickable.length > 0 && pickable.every((u) => assignees.includes(u.uid));
  const toggle = (uid) => {
    const next = assignees.includes(uid) ? assignees.filter((x) => x !== uid) : [...assignees, uid];
    setAssignees(next);
    if (!touchedPlan) setPlanId(suggestPlan(next, `${date}T${time}`));
  };
  const toggleAll = () => {
    const next = allOn ? [] : pickable.map((u) => u.uid);
    setAssignees(next);
    if (!touchedPlan) setPlanId(suggestPlan(next, `${date}T${time}`));
  };
  const setDue = (d, t) => {
    setDate(d); setTime(t);
    if (!touchedPlan) setPlanId(suggestPlan(assignees, `${d}T${t}`));
  };

  const remove = async () => {
    try { await store.deleteTask(task.id); toast('ลบใบสั่งงานแล้ว'); onClose(); } catch (ex) { setErrors({ form: ex.message }); }
  };
  const save = async (again = false) => {
    const e = {};
    if (!title.trim()) e.title = 'ใส่ชื่องาน';
    if (!assignees.length) e.assignees = 'เลือกอย่างน้อย 1 คน';
    if (!date) e.due = 'เลือกวันกำหนดส่ง';
    if (plans.length && !planId) e.plan = 'เลือกหัวข้องาน';
    if (order && !/^\d{1,3}$/.test(order)) e.order = 'ใส่เป็นตัวเลข 1–999';
    if (!assigner.trim()) e.assigner = 'ใส่ชื่อผู้มอบหมาย (ชื่อเล่นได้)';
    setErrors(e);
    if (Object.keys(e).length) return;
    const data = {
      title: title.trim(), details: details.trim(), assignees,
      mode: assignees.length > 1 ? mode : 'individual',
      due: `${date}T${time || end}`, priority, order: order ? Number(order) : null,
      planId: planId.split('|')[0], stepId: planId.split('|')[1] || null, assignerName: assigner.trim(), needsReview,
    };
    setBusy(true);
    try {
      if (editing) { await store.updateTask(task.id, data); toast('บันทึกการแก้ไขแล้ว', 'ok'); onClose(); }
      else {
        const id = await store.createTask(data);
        const no = store.snapshot().tasks[id]?.no;
        toast(`สั่งงานแล้ว${no ? ` WO-${String(no).padStart(3, '0')}` : ''}`, 'ok');
        if (again) {
          // keep people, due date, priority and plan; clear what is specific to the last task
          setTitle(''); setDetails(''); setOrder(order ? String(Number(order) + 1) : '');
          const el = document.getElementById('tf-title');
          if (el) el.focus();
        } else onClose();
      }
    } catch (ex) { setErrors({ form: ex.message }); }
    setBusy(false);
  };

  return html`<${Sheet} title=${editing ? 'แก้ไขใบสั่งงาน' : 'สั่งงานใหม่'} onClose=${onClose}
    footer=${html`${editing ? html`<${ConfirmButton} label="ลบ" confirmLabel="กดอีกครั้งเพื่อลบ" icon="trash" onConfirm=${remove} />`
        : html`<button type="button" class="btn btn--ghost" onClick=${onClose}>ยกเลิก</button>`}
      <span class="foot-space"></span>
      ${editing ? '' : html`<button type="button" class="btn btn--ghost" disabled=${busy} onClick=${() => save(true)}>สั่งแล้วเพิ่มอีก</button>`}
      <button type="button" class="btn btn--primary" disabled=${busy} onClick=${() => save(false)}>${busy ? 'กำลังบันทึก…' : editing ? 'บันทึก' : 'สั่งงาน'}</button>`}>
    <form class="form" onSubmit=${(e) => { e.preventDefault(); save(); }}>
      <${Field} id="tf-title" label="ชื่องาน" error=${errors.title}>
        <input id="tf-title" type="text" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="เช่น ตรวจขนาดชิ้นงานล็อต B ตามแบบ" maxlength="140" />
      <//>
      <${Field} id="tf-details" label="รายละเอียด (ไม่บังคับ)">
        <textarea id="tf-details" rows="3" value=${details} onInput=${(e) => setDetails(e.target.value)} placeholder="ใช้เครื่องมืออะไร ส่งอะไรกลับมา"></textarea>
      <//>

      <${Field} label="มอบหมายให้" error=${errors.assignees}>
        <div class="chips" role="group" aria-label="มอบหมายให้">
          <button type="button" class=${`chip${allOn ? ' is-on' : ''}`} aria-pressed=${allOn} onClick=${toggleAll}>ทุกคน</button>
          ${pickable.map((u) => html`<button type="button" class=${`chip${assignees.includes(u.uid) ? ' is-on' : ''}`}
            aria-pressed=${assignees.includes(u.uid)} onClick=${() => toggle(u.uid)}>${displayName(u)}</button>`)}
        </div>
      <//>
      ${assignees.length > 1 ? html`<${Field} label="แบบงาน">
        <div class="choice">
          <button type="button" class=${`choice-btn${mode === 'individual' ? ' is-on' : ''}`} aria-pressed=${mode === 'individual'} onClick=${() => setMode('individual')}>
            <b>แยกรายคน</b><span>ทุกคนส่งงานของตัวเอง</span></button>
          <button type="button" class=${`choice-btn${mode === 'group' ? ' is-on' : ''}`} aria-pressed=${mode === 'group'} onClick=${() => setMode('group')}>
            <b>งานกลุ่ม</b><span>ส่งครั้งเดียวแทนทั้งกลุ่ม</span></button>
        </div>
      <//>` : ''}

      <${Field} label="กำหนดส่ง" error=${errors.due}>
        <div class="chips chips--quick">${quickDates(now, end).map((q) => {
          const on = date === dateKey(q.d) && time === q.t;
          return html`<button type="button" class=${`chip chip--sm${on ? ' is-on' : ''}`} onClick=${() => setDue(dateKey(q.d), q.t)}>${q.label}</button>`;
        })}</div>
        <div class="due-inputs">
          <input id="tf-date" type="date" aria-label="วันที่กำหนดส่ง" value=${date} onInput=${(e) => setDue(e.target.value, time)} />
          <input id="tf-time" type="time" aria-label="เวลากำหนดส่ง" value=${time} onInput=${(e) => setDue(date, e.target.value)} step="900" />
        </div>
      <//>

      <${Field} label="ความสำคัญ">
        <div class="seg seg--prio" role="radiogroup" aria-label="ความสำคัญ">
          ${PRIORITIES.map((p) => html`<button type="button" role="radio" aria-checked=${priority === p.value}
            class=${`seg-btn seg-btn--${p.key}${priority === p.value ? ' is-on' : ''}`} onClick=${() => setPriority(p.value)}>${p.label}</button>`)}
        </div>
      <//>

      <${Field} id="tf-plan" label="อยู่ใต้หัวข้องาน (แผน)" error=${errors.plan} hint="เลือกให้อัตโนมัติจากสัปดาห์ของวันกำหนดส่ง ทั้งหัวใหญ่และหัวข้อย่อย เปลี่ยนได้">
        <label class="select-wrap select-wrap--grow">
          <select id="tf-plan" value=${planId} onChange=${(e) => { setPlanId(e.target.value); setTouchedPlan(true); }}>
            ${plans.length === 0 ? html`<option value="">ยังไม่มีหัวข้องานในแผน</option>` : ''}
            ${plans.map((p, i) => html`<option value=${p.id}>${i + 1}. ${p.title} (${wLabel(p.weeks)})</option>
              ${(p.steps || []).map((x) => html`<option value=${`${p.id}|${x.id}`}>${'\u00a0\u00a0\u00a0'}› ${x.title} (${wLabel(x.weeks)})</option>`)}`)}
          </select>
        </label>
      <//>

      <div class="form-pair">
        <${Field} id="tf-order" label="ลำดับ (ไม่บังคับ)" error=${errors.order} hint="ใส่เลขถ้าอยากให้ทำตามลำดับ ไม่ใส่จะเรียงตามกำหนดส่งและความสำคัญ">
          <input id="tf-order" type="text" inputmode="numeric" value=${order} onInput=${(e) => setOrder(e.target.value.replace(/[^0-9]/g, ''))} placeholder="เช่น 1" />
        <//>
        <${Field} id="tf-assigner" label="ผู้มอบหมาย" error=${errors.assigner} hint="ชื่อเล่นหรือชื่อจริงก็ได้">
          <input id="tf-assigner" type="text" value=${assigner} onInput=${(e) => setAssigner(e.target.value)} maxlength="40" />
        <//>
      </div>

      <label class="switch">
        <input id="tf-review" type="checkbox" checked=${needsReview} onChange=${(e) => setNeedsReview(e.target.checked)} />
        <span class="switch-ui" aria-hidden="true"></span>
        <span><b>ให้พี่ตรวจก่อนปิดงาน</b><small>${needsReview ? 'นักศึกษาส่งงานแล้วรอพี่กดผ่านหรือให้แก้' : 'นักศึกษากดทำเสร็จแล้วงานปิดเลย'}</small></span>
      </label>
      ${errors.form ? html`<p class="form-error" role="alert">${errors.form}</p>` : ''}
      <button type="submit" class="sr-only" tabindex="-1">บันทึก</button>
    </form>
  <//>`;
}
