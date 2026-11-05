// "เดือนที่ n" — the month's tick table (big items + sub-items, weeks in yellow, week count)
// and the daily log (Mon–Sat: work given that day, knew it ✓, sent it ✓) for one intern, with the work he wrote
// down himself (บันทึกเอง) under the day he did it. Printable.
import { html, useState } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { formRows, monthWeeks, canAssign, displayName, fmtRange, fmtDate, toLocalDate, dateKey, addDays, stateOf, isLate,
  woNumber, TH_DAYS_SHORT, TH_MONTHS, weekOf, planLabel, compareLogs, slotLabel } from '../model.js';
import { Icon, Empty } from '../ui.js';

// Mon–Sat; a Sunday only when the intern logged work on it
const daysOf = (w, sunday = () => false) => {
  const out = [];
  for (let d = new Date(w.from); d <= w.to; d = addDays(d, 1)) if (d.getDay() !== 0 || sunday(d)) out.push(new Date(d));
  const next = addDays(w.to, 1);
  if (next.getDay() === 0 && sunday(next)) out.push(next);
  return out;
};

function SendMark({ s }) {
  if (s === 'approved') return html`<span class="tick is-on">✓</span><small class="tick-note">ผ่าน</small>`;
  if (s === 'submitted') return html`<span class="tick is-on">✓</span><small class="tick-note">รอตรวจ</small>`;
  if (s === 'changes') return html`<span class="tick"></span><small class="tick-note tick-note--stop">ให้แก้</small>`;
  return html`<span class="tick"></span>`;
}

export function MonthView({ m, onEdit }) {
  const { db, me, now, cal, students, store, openTask } = useApp();
  const staff = canAssign(me, now);
  const [pick, setPick] = useState(null);
  const uid = staff ? (pick || (students[0] || me).uid) : me.uid;
  const student = db.users[uid] || me;
  const nums = monthWeeks(m);
  const weeks = nums.map((n) => cal.weeks[n - 1]);
  const mo = cal.months[m - 1];
  const nowWeek = weekOf(cal, now);
  const todayKey = dateKey(now);
  const rows = formRows(Object.values(db.plans), student.uid).filter((r) => r.weeks.some((n) => nums.includes(n)));

  // work orders given to this intern, filed under the day they were given (a Sunday counts as the Monday after)
  const byDay = {};
  for (const t of Object.values(db.tasks)) {
    if (!t.assignees.includes(student.uid)) continue;
    const c = toLocalDate(t.created);
    if (!c) continue;
    const k = dateKey(c.getDay() === 0 ? addDays(c, 1) : c);
    (byDay[k] = byDay[k] || []).push(t);
  }
  Object.values(byDay).forEach((list) => list.sort((a, b) => (a.created < b.created ? -1 : 1)));
  // work he wrote down himself, under the day he did it
  const logsByDay = {};
  for (const l of Object.values(db.logs || {})) if (l.by === student.uid) (logsByDay[l.day] = logsByDay[l.day] || []).push(l);
  Object.values(logsByDay).forEach((list) => list.sort(compareLogs)); // one day: morning, afternoon, whole day
  const sunday = (d) => !!logsByDay[dateKey(d)];
  const sum = (pick) => nums.reduce((n, wn) => n + daysOf(cal.weeks[wn - 1], sunday).reduce((x, d) => x + (pick[dateKey(d)] || []).length, 0), 0);
  const given = sum(byDay);
  const selfN = sum(logsByDay);
  const canPrint = store.mode !== 'demo';

  return html`<div class="month">
    <div class="no-print form-tools">
      ${staff ? html`<div class="chips" role="group" aria-label="เลือกนักศึกษา">${students.map((u) => html`<button type="button"
        class=${`chip${uid === u.uid ? ' is-on' : ''}`} aria-pressed=${uid === u.uid} onClick=${() => setPick(u.uid)}>${displayName(u)}</button>`)}</div>` : ''}
      ${canPrint ? html`<button type="button" class="btn btn--ghost" onClick=${() => window.print()}><${Icon} name="form" size=${18} />พิมพ์หน้านี้</button>` : ''}
    </div>

    <header class="month-head">
      <h2>เดือนที่ ${m} <small>${fmtRange(mo.from, mo.to)} ${mo.to.getFullYear() + 543}</small></h2>
      <p>${student.name || displayName(student)}${student.studentId ? ` · ${student.studentId}` : ''}${db.settings.company ? ` · ${db.settings.company}` : ''}</p>
      ${m >= 3 ? html`<p class="month-note">เดือนที่ 3–4 เป็นงานโปรเจคของนักศึกษา สั่งเป็นงานกลุ่มร่วมกับนักศึกษาฝึกงานคนอื่น หรือสั่งแยกรายคนก็ได้</p>` : ''}
    </header>

    <section class="month-sec">
      <h3>แผนงานเดือนนี้</h3>
      ${rows.length === 0 ? html`<${Empty} title="ยังไม่มีหัวข้องานในเดือนนี้" text=${onEdit ? 'เพิ่มได้ที่ “ภาพรวม” → เพิ่มหัวข้องาน' : 'พี่ผู้ดูแลจะเป็นคนลงแผน'} />` : html`
      <div class="tick-scroll">
        <table class="tick-table">
          <colgroup><col class="c-no" /><col class="c-task" />${nums.map(() => html`<col class="c-week" />`)}<col class="c-sum" /></colgroup>
          <thead><tr>
            <th scope="col" colspan="2">หัวข้องาน</th>
            ${weeks.map((w) => html`<th scope="col" class=${w.n === nowWeek ? 'is-now' : ''}>W${w.n}<small class="wk-long">${fmtRange(w.from, w.to)}</small><small class="wk-short">${w.from.getDate()}–${w.to.getDate()}</small></th>`)}
            <th scope="col">รวม</th>
          </tr></thead>
          <tbody>${rows.map((r) => {
            const inMonth = r.weeks.filter((n) => nums.includes(n)).length;
            return html`<tr key=${r.key} class=${r.main ? 'is-main' : 'is-step'}>
              <td class="c-no">${r.no || ''}</td>
              <th scope="row" class="c-task">${r.main && onEdit ? html`<button type="button" class="link-btn" onClick=${() => onEdit(r.plan)}>${r.title}</button>` : r.title}</th>
              ${nums.map((n) => html`<td class=${`c-week${r.weeks.includes(n) ? ' is-on' : ''}${n === nowWeek ? ' is-now' : ''}`}>${r.weeks.includes(n) ? html`<span class="sr-only">ทำ</span>` : ''}</td>`)}
              <td class="c-sum">${inMonth} <small>สัปดาห์</small></td>
            </tr>`;
          })}</tbody>
        </table>
      </div>`}
    </section>

    <section class="month-sec">
      <h3>บันทึกรายวัน <small>ใบสั่งงาน ${given} งาน${selfN ? ` · บันทึกเอง ${selfN} รายการ` : ''}</small></h3>
      <div class="tick-scroll">
        <table class="day-table">
          <colgroup><col class="c-day" /><col class="c-work" /><col class="c-chk" /><col class="c-chk" /></colgroup>
          <thead><tr><th scope="col">วันที่</th><th scope="col">งานที่ได้รับ / ที่ทำ</th><th scope="col">รู้งานแล้ว</th><th scope="col">ส่งงานแล้ว</th></tr></thead>
          ${weeks.map((w) => html`<tbody key=${w.n}>
            <tr class="day-week"><th colspan="4" scope="rowgroup">สัปดาห์ที่ ${w.n} <small>${fmtRange(w.from, w.to)}</small></th></tr>
            ${daysOf(w, sunday).map((d) => {
              const k = dateKey(d);
              const list = byDay[k] || [];
              const mine = logsByDay[k] || [];
              const dayCell = html`<th scope="row" class=${`c-day${k === todayKey ? ' is-today' : ''}`} rowspan=${Math.max(1, list.length + mine.length)}>${TH_DAYS_SHORT[d.getDay()]} ${d.getDate()}<span class="d-mon"> ${TH_MONTHS[d.getMonth()]}</span></th>`;
              if (!list.length && !mine.length) return html`<tr key=${k} class="is-empty">${dayCell}<td class="c-work">—</td><td class="c-chk"></td><td class="c-chk"></td></tr>`;
              const selfRows = mine.map((l, j) => html`<tr key=${`${k}-${l.id}`} class="is-self">
                  ${!list.length && j === 0 ? dayCell : ''}
                  <td class="c-work">
                    <span class="day-log">${l.title}</span> <span class="self-tag">บันทึกเอง</span>
                    <small class="day-wo-meta">${[`${slotLabel(l.slot)}${l.time ? ` ${l.time}` : ''}`, l.from ? `สั่งโดย ${l.from}` : '', l.planId && db.plans[l.planId] ? db.plans[l.planId].title : ''].filter(Boolean).join(' · ')}</small>
                  </td>
                  <td class="c-chk"><span class="tick is-on">✓</span></td>
                  <td class="c-chk"><span class=${`tick${l.status === 'done' ? ' is-on' : ''}`}>${l.status === 'done' ? '✓' : ''}</span>
                    <small class=${`tick-note${l.okBy ? '' : ' tick-note--wait'}`}>${l.status === 'doing' ? 'ยังไม่เสร็จ · ' : ''}${l.okBy ? 'พี่รับรอง' : 'รอรับรอง'}</small></td>
                </tr>`);
              return [...list.map((t, i) => {
                const s = stateOf(t, student.uid);
                const late = isLate(t, student.uid, now);
                return html`<tr key=${`${k}-${t.id}`}>
                  ${i === 0 ? dayCell : ''}
                  <td class="c-work">
                    <button type="button" class="day-wo" onClick=${() => openTask(t.no)}>
                      <span class="day-wo-no">${woNumber(t)}</span> ${t.title}</button>
                    <small class="day-wo-meta">มอบโดย ${t.assignerName || '—'} · ส่ง ${fmtDate(toLocalDate(t.due))}${t.planId && db.plans[t.planId] ? ` · ${planLabel(db.plans[t.planId], t.stepId)}` : ''}${late ? ' · ' : ''}${late ? html`<b class="txt-stop">เลยกำหนด</b>` : ''}</small>
                  </td>
                  <td class="c-chk"><span class=${`tick${s !== 'assigned' ? ' is-on' : ''}`}>${s !== 'assigned' ? '✓' : ''}</span></td>
                  <td class="c-chk"><${SendMark} s=${s} /></td>
                </tr>`;
              }), ...selfRows];
            })}
          </tbody>`)}
        </table>
      </div>
    </section>
  </div>`;
}
