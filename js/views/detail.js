// Work order detail: acknowledge, submit with photos, review (pass / send back).
import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { stateOf, isLate, woNumber, displayName, toLocalDate, fmtDateYear, fmtTime, fmtDay, canAssign, STATES, priorityOf } from '../model.js';
import { Sheet, Icon, StateTag, DueChip, Prio, Avatar, Field, ConfirmButton } from '../ui.js';
import { compressImage } from '../image.js';
import { planTitle } from './rows.js';

const when = (s) => { const d = toLocalDate(s); return d ? `${fmtDay(d)} ${fmtTime(d)}` : ''; };

function useFiles(store, ids) {
  const [files, setFiles] = useState({});
  useEffect(() => {
    let alive = true;
    ids.filter((id) => !files[id]).forEach(async (id) => {
      const f = await store.file(id);
      if (alive && f) setFiles((x) => ({ ...x, [id]: f }));
    });
    return () => { alive = false; };
  }, [ids.join(',')]);
  return files;
}

function Thumbs({ ids, files, onOpen }) {
  if (!ids || !ids.length) return null;
  return html`<div class="thumbs">${ids.map((id) => files[id]
    ? html`<button type="button" class="thumb" onClick=${() => onOpen(files[id])} aria-label="ดูรูปขนาดใหญ่"><img src=${files[id].data} alt=${files[id].name} loading="lazy" /></button>`
    : html`<span class="thumb thumb--loading" aria-label="กำลังโหลดรูป"></span>`)}</div>`;
}

function SubmitBox({ task, me, state }) {
  const { store, toast } = useApp();
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    setErr('');
    for (const f of files) {
      try {
        const img = await compressImage(f);
        setImages((x) => [...x, img].slice(0, 6));
      } catch (ex) { setErr(ex.message); }
    }
  };
  const send = async () => {
    if (link && !/^https?:\/\//.test(link)) { setErr('ลิงก์ต้องขึ้นต้นด้วย https://'); return; }
    setBusy(true);
    try {
      await store.submit(task.id, { note: note.trim(), link: link.trim(), images });
      toast(task.needsReview === false ? 'บันทึกว่าทำเสร็จแล้ว' : 'ส่งงานแล้ว รอพี่ตรวจ', 'ok');
      setNote(''); setLink(''); setImages([]);
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };
  const label = task.needsReview === false ? 'บันทึกว่าทำเสร็จแล้ว' : state === 'changes' ? 'ส่งงานที่แก้แล้ว' : 'ส่งงาน';
  return html`<div class="submit-box">
    ${task.mode === 'group' ? html`<p class="hint-line">งานกลุ่ม: ส่งครั้งเดียวแทนทุกคนในกลุ่ม</p>` : ''}
    <${Field} id="sub-note" label="ข้อความถึงพี่ (ไม่บังคับ)">
      <textarea id="sub-note" rows="3" value=${note} onInput=${(e) => setNote(e.target.value)} placeholder="เช่น วัดครบ 20 ชิ้น ไม่ผ่าน 2 ชิ้น แนบรูปไว้แล้ว"></textarea>
    <//>
    <div class="attach-row">
      <label class="btn btn--ghost attach-btn" for="sub-photo"><${Icon} name="camera" size=${18} />ถ่ายรูป / เลือกรูป</label>
      <input id="sub-photo" class="sr-only" type="file" accept="image/*" multiple onChange=${pick} />
      <span class="attach-hint">ย่อรูปให้อัตโนมัติ สูงสุด 6 รูป</span>
    </div>
    ${images.length ? html`<div class="thumbs">${images.map((img, i) => html`<span class="thumb thumb--new">
      <img src=${img.data} alt=${img.name} />
      <button type="button" class="thumb-x" aria-label="เอารูปนี้ออก" onClick=${() => setImages((x) => x.filter((_, j) => j !== i))}><${Icon} name="close" size=${14} /></button>
    </span>`)}</div>` : ''}
    <${Field} id="sub-link" label="ลิงก์ไฟล์ (เช่น Google Drive)" hint="ไฟล์ PDF หรือไฟล์ใหญ่ ให้อัปโหลดขึ้น Drive แล้วแปะลิงก์">
      <input id="sub-link" type="url" inputmode="url" value=${link} onInput=${(e) => setLink(e.target.value)} placeholder="https://" />
    <//>
    ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
    <button type="button" class="btn btn--primary btn--block" disabled=${busy} onClick=${send}><${Icon} name="send" size=${18} />${busy ? 'กำลังส่ง…' : label}</button>
  </div>`;
}

const QUICK_REASONS = ['รูปไม่ชัด ถ่ายใหม่', 'ค่าไม่ตรงตามแบบ', 'ทำยังไม่ครบ', 'เขียนรายละเอียดเพิ่ม'];

function ReviewBox({ sub }) {
  const { store, toast } = useApp();
  const [mode, setMode] = useState(null); // null | 'changes'
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const pass = async () => {
    try { await store.review(sub.id, 'approved', note.trim()); toast('ตรวจผ่านแล้ว', 'ok'); } catch (ex) { setErr(ex.message); }
  };
  const back = async () => {
    if (!note.trim()) { setErr('บอกนักศึกษาสั้นๆ ว่าต้องแก้ตรงไหน'); return; }
    try { await store.review(sub.id, 'changes', note.trim()); toast('ส่งกลับให้แก้แล้ว', 'warn'); } catch (ex) { setErr(ex.message); }
  };
  return html`<div class="review-box">
    ${mode === 'changes' ? html`<${Field} id=${`rv-${sub.id}`} label="ต้องแก้ตรงไหน" error=${err}>
        <div class="chips chips--quick">${QUICK_REASONS.map((r) => html`<button type="button" class="chip chip--sm"
          onClick=${() => { setNote((n) => (n ? `${n} ${r}` : r)); setErr(''); }}>${r}</button>`)}</div>
        <textarea id=${`rv-${sub.id}`} rows="3" value=${note} onInput=${(e) => { setNote(e.target.value); setErr(''); }} placeholder="เช่น ใส่ค่าเผื่อตามแบบด้วย"></textarea>
      <//>
      <div class="btn-row">
        <button type="button" class="btn btn--ghost" onClick=${() => { setMode(null); setErr(''); }}>ยกเลิก</button>
        <button type="button" class="btn btn--stop" onClick=${back}>ส่งกลับให้แก้</button>
      </div>`
    : html`<div class="btn-row">
        <button type="button" class="btn btn--stop-ghost" onClick=${() => setMode('changes')}>ให้แก้</button>
        <button type="button" class="btn btn--ok" onClick=${pass}><${Icon} name="check" size=${18} />ตรวจผ่าน</button>
      </div>${err ? html`<p class="form-error">${err}</p>` : ''}`}
  </div>`;
}

export function TaskDetail({ task, onClose }) {
  const { db, me, now, store, toast, editTask } = useApp();
  const [subs, setSubs] = useState(null);
  const [big, setBig] = useState(null);
  useEffect(() => { let on = true; store.subsFor(task.id).then((s) => on && setSubs(s)); return () => { on = false; }; }, [db]);
  const fileIds = (subs || []).flatMap((s) => s.files || []);
  const files = useFiles(store, fileIds);
  const staff = canAssign(me);
  const mineState = task.assignees.includes(me.uid) ? stateOf(task, me.uid) : null;
  const myNote = mineState && task.state[me.uid] && task.state[me.uid].note;
  const plan = db.plans[task.planId];

  const ack = async () => {
    try { await store.ack(task.id); toast('รับทราบแล้ว', 'ok'); } catch (ex) { toast(ex.message, 'bad'); }
  };
  const unsubmit = async (s) => {
    try { await store.unsubmit(s.id); toast('ยกเลิกการส่งแล้ว แก้แล้วส่งใหม่ได้'); } catch (ex) { toast(ex.message, 'bad'); }
  };
  const roundOf = (s) => (subs || []).filter((x) => x.for.join() === s.for.join() && x.at <= s.at).length;
  const undo = async (s) => {
    try { await store.unreview(s.id); toast('ยกเลิกผลตรวจแล้ว ตรวจใหม่ได้เลย'); } catch (ex) { toast(ex.message, 'bad'); }
  };
  const remove = async () => {
    try { await store.deleteTask(task.id); toast(`ลบ ${woNumber(task)} แล้ว`); onClose(); } catch (ex) { toast(ex.message, 'bad'); }
  };

  return html`<${Sheet} title=${woNumber(task)} onClose=${onClose} wide>
    <article class="ticket">
      <header class="ticket-head">
        <p class="ticket-no mono">${woNumber(task)}<span>ใบสั่งงาน</span></p>
        <h3 class="ticket-title">${task.order != null ? html`<b class="wo-order">#${task.order}</b>` : ''}${task.title}</h3>
        <div class="ticket-tags">
          <${Prio} value=${task.priority} withLabel />
          <span class="pill">${task.mode === 'group' ? 'งานกลุ่ม · ส่งครั้งเดียว' : task.assignees.length > 1 ? 'แยกรายคน' : 'งานเดี่ยว'}</span>
          <span class="pill">${task.needsReview === false ? 'ไม่ต้องให้พี่ตรวจ' : 'พี่ตรวจก่อนปิดงาน'}</span>
        </div>
      </header>
      <dl class="ticket-grid">
        <div><dt>กำหนดส่ง</dt><dd>${(() => { const d = toLocalDate(task.due); return d ? `${fmtDay(d)} ${fmtTime(d)}` : '—'; })()}
          ${mineState && mineState !== 'approved' ? html` <${DueChip} due=${task.due} now=${now} />` : ''}</dd></div>
        <div><dt>มอบหมายโดย</dt><dd>${task.assignerName}</dd></div>
        <div><dt>สั่งเมื่อ</dt><dd>${(() => { const d = toLocalDate(task.created); return d ? fmtDateYear(d) : '—'; })()}</dd></div>
        <div><dt>อยู่ใต้งานในแผน</dt><dd>${plan ? html`${plan.title} <span class="mono soft">W${Math.min(...plan.weeks)}–${Math.max(...plan.weeks)}</span>` : planTitle(db, task.planId)}</dd></div>
      </dl>
      ${task.details ? html`<p class="ticket-details">${task.details}</p>` : ''}
    </article>

    ${mineState ? html`<section class=${`my-action my-action--${mineState}`}>
      <h4>สถานะของฉัน <${StateTag} state=${mineState} late=${isLate(task, me.uid, now)} /></h4>
      ${mineState === 'assigned' ? html`<p class="hint-line">กดรับทราบเพื่อบอกพี่ว่าเห็นงานนี้แล้ว</p>
        <button type="button" class="btn btn--ack btn--block" onClick=${ack}><${Icon} name="check" size=${18} />รับทราบงานนี้</button>` : ''}
      ${mineState === 'changes' && myNote ? html`<p class="callout callout--stop"><b>พี่ให้แก้:</b> ${myNote}</p>` : ''}
      ${mineState === 'ack' || mineState === 'changes' ? html`<${SubmitBox} task=${task} me=${me} state=${mineState} />` : ''}
      ${mineState === 'submitted' ? html`<p class="hint-line">ส่งแล้ว รอพี่ตรวจ ถ้าพี่ให้แก้ จะขึ้นในหน้างานของฉัน</p>` : ''}
      ${mineState === 'approved' ? html`<p class="hint-line">งานนี้ผ่านแล้ว</p>` : ''}
    </section>` : ''}

    <section class="people">
      <h4>ผู้รับงาน ${task.assignees.length} คน</h4>
      <ul class="people-list">${task.assignees.map((u) => {
        const s = stateOf(task, u);
        const st = task.state[u] || {};
        return html`<li><${Avatar} user=${db.users[u]} state=${s} late=${isLate(task, u, now)} />
          <span class="people-name">${displayName(db.users[u])}<small>${STATES[s].label}${st.at ? ` · ${when(st.at)}` : ''}</small></span>
          <${StateTag} state=${s} late=${isLate(task, u, now)} compact /></li>`;
      })}</ul>
    </section>

    <section class="history">
      <h4>การส่งงานและผลตรวจ</h4>
      ${subs === null ? html`<p class="quiet">กำลังโหลด…</p>` : subs.length === 0 ? html`<p class="quiet">ยังไม่มีใครส่งงานนี้</p>`
        : html`<ol class="subs">${subs.map((s, i) => html`<li class=${`sub${s.review ? ` sub--${s.review.decision}` : ' sub--open'}`} key=${s.id}>
          <p class="sub-head"><span class="sub-round">ครั้งที่ ${roundOf(s)}</span><b>${displayName(db.users[s.by])}</b>${s.for.length > 1 ? ' (ในนามกลุ่ม)' : ''} ส่งเมื่อ <span class="num">${when(s.at)}</span>
            ${task.due && s.at > task.due ? html` <span class="late-stamp">ส่งช้า</span>` : ''}</p>
          ${s.note ? html`<p class="sub-note">${s.note}</p>` : ''}
          ${s.link ? html`<p class="sub-link"><${Icon} name="link" size=${16} /><a href=${s.link} target="_blank" rel="noopener noreferrer">${s.link}</a></p>` : ''}
          <${Thumbs} ids=${s.files} files=${files} onOpen=${setBig} />
          ${s.review ? html`<p class=${`sub-review sub-review--${s.review.decision}`}>
              <b>${s.review.decision === 'approved' ? 'ผ่าน' : 'ให้แก้'}</b> โดย ${displayName(db.users[s.review.by])} · <span class="num">${when(s.review.at)}</span>
              ${s.review.note ? html`<br />${s.review.note}` : ''}</p>
              ${staff && i === 0 && s.review.by === me.uid ? html`<button type="button" class="link-btn" onClick=${() => undo(s)}>กดผิด? ยกเลิกผลตรวจนี้</button>` : ''}`
            : staff ? html`<${ReviewBox} sub=${s} />` : html`<p class="quiet">รอพี่ตรวจ</p>
              ${s.for.includes(me.uid) ? html`<button type="button" class="link-btn" onClick=${() => unsubmit(s)}>ส่งผิด? ยกเลิกการส่งครั้งนี้</button>` : ''}`}
        </li>`)}</ol>`}
    </section>

    ${staff ? html`<footer class="ticket-actions">
      <${ConfirmButton} label="ลบใบสั่งงาน" confirmLabel="กดอีกครั้งเพื่อลบ" icon="trash" onConfirm=${remove} />
      <button type="button" class="btn btn--ghost" onClick=${() => { onClose(); editTask(task); }}><${Icon} name="edit" size=${18} />แก้ไข</button>
    </footer>` : ''}

    ${big ? html`<div class="lightbox" onClick=${() => setBig(null)} role="dialog" aria-label="รูปขนาดใหญ่">
      <img src=${big.data} alt=${big.name} /><button type="button" class="icon-btn lightbox-x" aria-label="ปิดรูป"><${Icon} name="close" /></button></div>` : ''}
  <//>`;
}
