// "บันทึกงานที่ทำ" — work an intern really did that never came as a work order: a พี่ asked by word of mouth,
// the head sent him to a training, he helped another team. He writes it down himself, it carries a "บันทึกเอง" mark,
// and a พี่ confirms it. Any edit by the intern takes the confirmation away; entries written days later say so.
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { canLog, isStaff, displayName, mentorsOf, compareLogs, loggedLate, logsToConfirm, LOG_SLOTS, LOG_STATUS, slotLabel,
  MAX_LOG_PHOTOS, toLocalDate, dateKey, addDays, weekOf, fmtDay, fmtDate, fmtTime, fmtRange, planSort, wLabel } from '../model.js';
import { Sheet, Field, Icon, Empty, Seg, TwoTap, ConfirmButton } from '../ui.js';
import { compressImage } from '../image.js';

const LINK = /(https?:\/\/[^\s<>"']+)/g;
const withLinks = (text) => text.split(LINK).map((part, i) => (i % 2
  ? html`<a href=${part} target="_blank" rel="noopener noreferrer">${part}</a>` : part));

export function LogView() {
  const { me } = useApp();
  return isStaff(me) ? html`<${StaffLogs} />` : html`<${MyLog} />`;
}

/** Photos load only when the entry scrolls near the screen (each one is a separate download). */
function useFiles(ids, on) {
  const { store } = useApp();
  const [files, setFiles] = useState({});
  useEffect(() => {
    if (!on) return undefined;
    let alive = true;
    ids.filter((id) => !files[id]).forEach(async (id) => {
      try { const f = await store.file(id); if (alive && f) setFiles((x) => ({ ...x, [id]: f })); } catch { /* stays a gray box */ }
    });
    return () => { alive = false; };
  }, [on, ids.join(',')]);
  return files;
}

function Lightbox({ file, onClose }) {
  return html`<div class="lightbox" onClick=${onClose} role="dialog" aria-label="รูปขนาดใหญ่">
    <img src=${file.data} alt=${file.name} /><button type="button" class="icon-btn lightbox-x" aria-label="ปิดรูป"><${Icon} name="close" /></button></div>`;
}

function LogPhotos({ ids }) {
  const box = useRef();
  const [near, setNear] = useState(false);
  const [big, setBig] = useState(null);
  useEffect(() => {
    if (near || !box.current) return undefined;
    if (!('IntersectionObserver' in window)) { setNear(true); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [near]);
  const files = useFiles(ids, near);
  return html`<div class="thumbs" ref=${box}>${ids.map((id) => (files[id]
    ? html`<button type="button" class="thumb" key=${id} onClick=${() => setBig(files[id])} aria-label="ดูรูปขนาดใหญ่"><img src=${files[id].data} alt=${files[id].name} loading="lazy" /></button>`
    : html`<span class="thumb thumb--loading" key=${id} aria-label="กำลังโหลดรูป"></span>`))}
    ${big ? html`<${Lightbox} file=${big} onClose=${() => setBig(null)} />` : ''}</div>`;
}

function LogItem({ log, staff, onEdit }) {
  const { db, me, store, toast } = useApp();
  const plan = log.planId && db.plans[log.planId];
  const at = log.at ? new Date(log.at) : null;
  const confirm = (on) => store.confirmLogs([log.id], on)
    .then(() => toast(on ? 'รับรองแล้ว' : 'ยกเลิกการรับรองแล้ว', on ? 'ok' : 'info'), (ex) => toast(ex.message, 'bad'));
  return html`<li class=${`log-item${log.okBy ? ' is-ok' : ''}`}>
    <div class="log-top">
      <span class="log-slot">${slotLabel(log.slot)}${log.time ? ` · ${log.time}` : ''}</span>
      <span class=${`pill${log.status === 'doing' ? ' pill--run' : ''}`}>${LOG_STATUS[log.status]}</span>
    </div>
    <p class="log-title">${log.title}</p>
    ${log.from || plan || loggedLate(log) || log.editedAt ? html`<p class="log-meta">
      ${log.from ? html`<span>สั่งโดย <b>${log.from}</b></span>` : ''}
      ${plan ? html`<span>แผน: ${plan.title}</span>` : ''}
      ${at && loggedLate(log) ? html`<span class="log-late">ลงย้อนหลัง เขียนเมื่อ ${fmtDay(at)} ${fmtTime(at)}</span>` : ''}
      ${log.editedAt ? html`<span>แก้ไขเมื่อ ${fmtDay(new Date(log.editedAt))} ${fmtTime(new Date(log.editedAt))}</span>` : ''}</p>` : ''}
    ${log.detail ? html`<p class="log-detail">${withLinks(log.detail)}</p>` : ''}
    ${log.photos.length ? html`<${LogPhotos} ids=${log.photos} />` : ''}
    ${log.proof ? html`<p class="log-proof"><${Icon} name="link" size=${16} /><span>${withLinks(log.proof)}</span></p>` : ''}
    <div class="log-foot">
      <span class="self-tag">บันทึกเอง</span>
      ${log.okBy ? html`<span class="log-ok"><${Icon} name="check" size=${16} />รับรองโดย ${displayName(db.users[log.okBy])}${log.okAt ? ` · ${fmtDate(new Date(log.okAt))}` : ''}</span>`
        : html`<span class="log-wait">${log.pending ? 'กำลังบันทึก…' : 'รอพี่รับรอง'}</span>`}
      <span class="foot-space"></span>
      ${log.by === me.uid ? html`<button type="button" class="link-btn link-btn--inline" onClick=${() => onEdit(log)}>แก้ไข</button>` : ''}
      ${staff && !log.okBy ? html`<button type="button" class="btn btn--sm btn--ok" onClick=${() => confirm(true)}><${Icon} name="check" size=${18} />รับรอง</button>` : ''}
      ${staff && log.okBy ? html`<${TwoTap} label="ยกเลิกการรับรอง" confirmLabel="แตะอีกครั้งเพื่อยกเลิก" onConfirm=${() => confirm(false)} />` : ''}
    </div>
  </li>`;
}

/** Entries by internship week (newest first), then by day. Older weeks that are fully confirmed start folded. */
function LogWeeks({ logs, staff, onEdit }) {
  const { cal, now, store, toast } = useApp();
  const groups = [];
  for (const l of logs) {
    const w = weekOf(cal, toLocalDate(l.day)) || 0;
    let g = groups[groups.length - 1];
    if (!g || g.w !== w) { g = { w, items: [] }; groups.push(g); }
    g.items.push(l);
  }
  const [shut, setShut] = useState(() => new Set(groups.filter((g, i) => i > 0 && g.items.every((l) => l.okBy)).map((g) => g.w)));
  const toggle = (w) => setShut((s) => { const n = new Set(s); if (n.has(w)) n.delete(w); else n.add(w); return n; });
  const confirmAll = (items) => store.confirmLogs(items.map((l) => l.id), true)
    .then((n) => toast(`รับรอง ${n} รายการแล้ว`, 'ok'), (ex) => toast(ex.message, 'bad'));
  const todayK = dateKey(now);
  const yK = dateKey(addDays(now, -1));
  return html`<div class="log-weeks">${groups.map((g) => {
    const wk = g.w ? cal.weeks[g.w - 1] : null;
    const waiting = g.items.filter((l) => !l.okBy);
    const open = !shut.has(g.w);
    const days = [];
    for (const l of g.items) {
      let d = days[days.length - 1];
      if (!d || d.day !== l.day) { d = { day: l.day, items: [] }; days.push(d); }
      d.items.push(l);
    }
    return html`<section class="log-week" key=${g.w}>
      <div class="log-week-head">
        <button type="button" class="log-week-btn" aria-expanded=${open} onClick=${() => toggle(g.w)}>
          <${Icon} name=${open ? 'down' : 'chevron'} size=${18} />
          <span class="log-week-name">${g.w ? `สัปดาห์ที่ ${g.w}` : 'นอกช่วงฝึกงาน'}${wk ? html`<small>${fmtRange(wk.from, wk.to)}</small>` : ''}</span>
          <span class="log-week-count">${g.items.length} รายการ · ${waiting.length ? html`<b class="txt-wait">รอรับรอง ${waiting.length}</b>` : html`<b class="txt-ok">รับรองครบ</b>`}</span>
        </button>
        ${staff && waiting.length > 1 ? html`<button type="button" class="btn btn--sm btn--ok" onClick=${() => confirmAll(waiting)}>
          <${Icon} name="check" size=${18} />รับรองทั้งสัปดาห์ (${waiting.length})</button>` : ''}
      </div>
      ${open ? days.map((d) => html`<div class="log-day" key=${d.day}>
        <h3 class="log-day-head">${fmtDay(toLocalDate(d.day))}${d.day === todayK ? html`<small>วันนี้</small>` : d.day === yK ? html`<small>เมื่อวาน</small>` : ''}</h3>
        <ul class="log-list">${d.items.map((l) => html`<${LogItem} key=${l.id} log=${l} staff=${staff} onEdit=${onEdit} />`)}</ul>
      </div>`) : ''}
    </section>`;
  })}</div>`;
}

function MyLog() {
  const { db, me, now, cal, openProfile } = useApp();
  const [sheet, setSheet] = useState(null); // null | {} (new) | an entry (edit)
  const mine = Object.values(db.logs || {}).filter((l) => l.by === me.uid).sort(compareLogs);
  const today = dateKey(now);
  const ok = mine.filter((l) => l.okBy).length;
  const workday = now.getDay() !== 0 && !!weekOf(cal, now);
  const mentors = mentorsOf(me).map((id) => db.users[id]).filter((u) => isStaff(u)).map(displayName);
  return html`<section class="page">
    <header class="page-head"><div><h1>บันทึกงานที่ทำ</h1>
      <p class="page-sub">งานที่ทำจริงแต่ไม่ได้มาเป็นใบสั่งงาน เช่น พี่สั่งปากเปล่า หัวหน้าเรียกไปช่วย ไปอบรม ลงไว้เองแล้วให้พี่รับรอง</p></div></header>
    ${mine.length ? html`<p class="log-sum"><span><b>${mine.length}</b> รายการ</span><span class="txt-ok">รับรองแล้ว <b>${ok}</b></span>
      <span class="txt-wait">รอพี่รับรอง <b>${mine.length - ok}</b></span></p>` : ''}
    <p class="hint-line">${mentors.length ? `พี่ที่ดูแลเรา (${mentors.join(', ')}) จะเห็นบันทึกในเมนูของพี่ แล้วกดรับรอง`
      : html`ยังไม่ได้เลือกพี่ที่ดูแล บันทึกจะไปรอที่พี่ทุกคน <button type="button" class="link-btn link-btn--inline" onClick=${openProfile}>เลือกพี่ที่ดูแล</button>`}</p>
    ${workday && mine.length && !mine.some((l) => l.day === today) ? html`<p class="callout callout--wait callout--row"><span>วันนี้ยังไม่ได้บันทึกงาน</span>
      <button type="button" class="btn btn--sm btn--ghost" onClick=${() => setSheet({})}>บันทึกงานวันนี้</button></p>` : ''}
    ${mine.length ? html`<${LogWeeks} logs=${mine} onEdit=${setSheet} />`
      : html`<${Empty} title="ยังไม่มีบันทึก" text="กด “บันทึกงาน” ลงงานที่ทำวันนี้ ลงย้อนหลังก็ได้ ระบบจะบอกพี่ว่าเขียนเมื่อไหร่">
        <button type="button" class="btn btn--primary" onClick=${() => setSheet({})}><${Icon} name="plus" size=${18} />บันทึกงาน</button><//>`}
    ${mine.length ? html`<button type="button" class="fab" onClick=${() => setSheet({})}><${Icon} name="plus" size=${22} /><span>บันทึกงาน</span></button>` : ''}
    ${sheet ? html`<${LogSheet} log=${sheet.id ? sheet : null} onClose=${() => setSheet(null)} />` : ''}
  </section>`;
}

function StaffLogs() {
  const { db, me, route, go, students } = useApp();
  const interns = students.filter(canLog);
  const pend = logsToConfirm(db, me.uid);
  const count = (uid) => pend.filter((l) => l.by === uid).length;
  const minding = (u) => (mentorsOf(u).includes(me.uid) ? 1 : 0);
  const order = [...interns].sort((a, b) => (minding(b) - minding(a)) || (count(b.uid) - count(a.uid)) || displayName(a).localeCompare(displayName(b), 'th'));
  const fromRoute = /^log-(.+)$/.exec(route || '');
  const uid = (fromRoute && db.users[fromRoute[1]] && fromRoute[1]) || (pend[0] && pend[0].by) || (order[0] && order[0].uid);
  const u = uid && db.users[uid];
  const list = Object.values(db.logs || {}).filter((l) => l.by === uid).sort(compareLogs);
  return html`<section class="page">
    <header class="page-head"><div><h1>บันทึกงานของน้อง</h1>
      <p class="page-sub">งานที่น้องทำจริงแต่ไม่ได้มาเป็นใบสั่งงาน น้องลงเองว่าใครสั่ง ทำอะไร ถ้าตรงกับที่ทำจริง กดรับรอง</p></div></header>
    ${order.length ? html`<div class="chips" role="group" aria-label="เลือกน้อง">${order.map((x) => html`<button type="button" key=${x.uid}
      class=${`chip chip--sm${x.uid === uid ? ' is-on' : ''}`} aria-pressed=${x.uid === uid} onClick=${() => go(`log-${x.uid}`)}>
      ${displayName(x)}${count(x.uid) ? html`<b class="chip-count" aria-label=${`รอรับรอง ${count(x.uid)} รายการ`}>${count(x.uid)}</b>` : ''}
      ${minding(x) ? html`<small class="chip-note">น้องที่เราดูแล</small>` : ''}</button>`)}</div>` : ''}
    ${!u ? html`<${Empty} title="ยังไม่มีน้องฝึกงานในระบบ" />`
      : list.length ? html`<${LogWeeks} key=${uid} logs=${list} staff />`
        : html`<${Empty} title=${`${displayName(u)} ยังไม่มีบันทึก`} text="งานที่น้องลงเองจะขึ้นที่นี่ พร้อมปุ่มรับรอง" />`}
  </section>`;
}

/** Add or fix one entry. Photos are shrunk on the phone; files too big for that go to Drive as a link. */
function LogSheet({ log, onClose }) {
  const { db, me, now, cal, store, toast } = useApp();
  const today = dateKey(now);
  const [f, setF] = useState(() => (log
    ? { day: log.day, slot: log.slot, time: log.time, title: log.title, detail: log.detail, from: log.from, status: log.status, planId: log.planId || '', proof: log.proof }
    : { day: today, slot: now.getHours() < 12 ? 'am' : 'pm', time: '', title: '', detail: '', from: '', status: 'done', planId: '', proof: '' }));
  const [keep, setKeep] = useState(log ? log.photos : []);
  const [images, setImages] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const kept = useFiles(keep, true);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const put = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const room = MAX_LOG_PHOTOS - keep.length - images.length;

  const recent = Object.values(db.logs || {}).filter((l) => l.by === me.uid && l.from).sort((a, b) => (b.at || 0) - (a.at || 0)).map((l) => l.from);
  const mentors = mentorsOf(me).map((id) => db.users[id]).filter((u) => isStaff(u)).map(displayName);
  const picks = [...new Set([...recent, ...mentors])].slice(0, 6);
  const plans = Object.values(db.plans).filter((p) => p.weeks && p.weeks.length && (!p.assignees || !p.assignees.length || p.assignees.includes(me.uid))).sort(planSort);

  const pick = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    setErr('');
    for (const file of files) {
      try {
        const img = await compressImage(file, 1280, 0.62);
        setImages((x) => (keep.length + x.length < MAX_LOG_PHOTOS ? [...x, img] : x));
      } catch (ex) { setErr(ex.message); }
    }
  };
  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      await store.saveLog(log ? log.id : null, f, { keep, images });
      toast(log ? (log.okBy ? 'แก้บันทึกแล้ว ต้องให้พี่รับรองใหม่' : 'แก้บันทึกแล้ว') : 'บันทึกงานแล้ว รอพี่รับรอง', 'ok');
      onClose();
    } catch (ex) { setErr(ex.message); setBusy(false); }
  };
  const remove = async () => {
    try { await store.deleteLog(log.id); toast('ลบบันทึกแล้ว'); onClose(); } catch (ex) { setErr(ex.message); }
  };

  return html`<${Sheet} title=${log ? 'แก้บันทึกงาน' : 'บันทึกงานที่ทำ'} onClose=${onClose}
    footer=${html`${log && !log.okBy ? html`<${ConfirmButton} label="ลบบันทึกนี้" confirmLabel="แตะอีกครั้งเพื่อลบ" icon="trash" onConfirm=${remove} />` : ''}
      <span class="foot-space"></span>
      <button type="button" class="btn btn--primary" disabled=${busy} onClick=${save}>${busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>`}>
    <div class="form">
      ${log && log.okBy ? html`<p class="callout callout--wait">พี่รับรองบันทึกนี้แล้ว ถ้าบันทึกการแก้ไข ต้องให้พี่รับรองใหม่</p>` : ''}
      <div class="form-pair">
        <${Field} id="lg-day" label="วันที่ทำ" hint=${f.day && f.day < today ? 'ลงย้อนหลังได้ พี่จะเห็นว่าเขียนวันไหน' : ''}>
          <input id="lg-day" type="date" min=${dateKey(cal.start)} max=${today} value=${f.day} onInput=${set('day')} /><//>
        <div class="field"><span class="field-label">ช่วงเวลา</span>
          <${Seg} label="ช่วงเวลา" value=${f.slot} onChange=${(v) => put('slot', v)} options=${LOG_SLOTS.map((s) => ({ value: s.value, label: s.short }))} /></div>
      </div>
      <${Field} id="lg-title" label="ทำงานอะไร">
        <input id="lg-title" type="text" maxlength="200" value=${f.title} onInput=${set('title')} placeholder="เช่น ทดสอบมอเตอร์ 4 ตัวกับพี่" /><//>
      <${Field} id="lg-from" label="ใครสั่งงานนี้" hint="ไม่มีชื่อในระบบก็พิมพ์ได้ เช่น หัวหน้าแผนก">
        ${picks.length ? html`<div class="chips chips--quick">${picks.map((n) => html`<button type="button" key=${n}
          class=${`chip chip--sm${f.from === n ? ' is-on' : ''}`} aria-pressed=${f.from === n} onClick=${() => put('from', n)}>${n}</button>`)}</div>` : ''}
        <input id="lg-from" type="text" maxlength="80" value=${f.from} onInput=${set('from')} placeholder="ชื่อคนสั่ง" /><//>
      <div class="field"><span class="field-label">งานนี้</span>
        <div class="chips" role="group" aria-label="งานนี้เสร็จหรือยัง">${[['done', 'เสร็จแล้ว'], ['doing', 'ยังไม่เสร็จ ทำต่อ']].map(([v, t]) => html`<button type="button" key=${v}
          class=${`chip chip--sm${f.status === v ? ' is-on' : ''}`} aria-pressed=${f.status === v} onClick=${() => put('status', v)}>${t}</button>`)}</div></div>
      <${Field} id="lg-detail" label="ทำอะไรบ้าง ได้ผลอะไร (ไม่บังคับ)">
        <textarea id="lg-detail" rows="4" maxlength="2000" value=${f.detail} onInput=${set('detail')} placeholder="ขั้นตอนที่ทำ ค่าที่วัดได้ สิ่งที่ได้เรียนรู้"></textarea><//>
      <div class="form-pair">
        <${Field} id="lg-time" label="เวลา (ไม่บังคับ)">
          <input id="lg-time" type="text" maxlength="20" value=${f.time} onInput=${set('time')} placeholder="เช่น 08:30–12:00" /><//>
        <${Field} id="lg-plan" label="หัวข้องานในแผน (ไม่บังคับ)">
          <div class="select-wrap"><select id="lg-plan" value=${f.planId} onChange=${set('planId')}>
            <option value="">ไม่ระบุ</option>
            ${plans.map((p) => html`<option value=${p.id} key=${p.id}>${p.title} (${wLabel(p.weeks)})</option>`)}
          </select></div><//>
      </div>
      <div class="field">
        <span class="field-label">หลักฐาน (ไม่บังคับ)</span>
        <div class="attach-row">
          <label class=${`btn btn--ghost attach-btn${room <= 0 ? ' is-off' : ''}`} for="lg-photo"><${Icon} name="camera" size=${18} />ถ่ายรูป / เลือกรูป</label>
          <input id="lg-photo" class="sr-only" type="file" accept="image/*" multiple disabled=${room <= 0} onChange=${pick} />
          <span class="attach-hint">${room > 0 ? `ย่อรูปให้อัตโนมัติ ได้อีก ${room} รูป` : `ครบ ${MAX_LOG_PHOTOS} รูปแล้ว`}</span>
        </div>
        ${keep.length || images.length ? html`<div class="thumbs">
          ${keep.map((id) => html`<span class="thumb thumb--new" key=${id}>${kept[id] ? html`<img src=${kept[id].data} alt=${kept[id].name} />` : ''}
            <button type="button" class="thumb-x" aria-label="เอารูปนี้ออก" onClick=${() => setKeep((x) => x.filter((y) => y !== id))}><${Icon} name="close" size=${14} /></button></span>`)}
          ${images.map((img, i) => html`<span class="thumb thumb--new" key=${`n${i}`}><img src=${img.data} alt=${img.name} />
            <button type="button" class="thumb-x" aria-label="เอารูปนี้ออก" onClick=${() => setImages((x) => x.filter((_, j) => j !== i))}><${Icon} name="close" size=${14} /></button></span>`)}
        </div>` : ''}
        <label class="sr-only" for="lg-proof">ลิงก์หรือชื่อไฟล์</label>
        <textarea id="lg-proof" rows="2" maxlength="1000" value=${f.proof} onInput=${set('proof')}
          placeholder="ลิงก์ Google Drive หรือชื่อไฟล์ เช่น เทสกระแสมอเตอร์.xlsx"></textarea>
      </div>
      ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
    </div>
  <//>`;
}
