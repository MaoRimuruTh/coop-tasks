// Work order detail: the one action that matters for the viewer sits in the sticky footer.
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { stateOf, isLate, woNumber, displayName, toLocalDate, fmtDate, fmtTime, fmtDay, canEditTask, canReview as canReviewAny, weeksLabel, planLabel, stepOf } from '../model.js';
import { Sheet, Icon, StateTag, DueChip, PrioLabel, Lamp, Field } from '../ui.js';
import { compressImage } from '../image.js';
import { planTitle } from './rows.js';

const when = (s) => { const d = toLocalDate(s); return d ? `${fmtDay(d)} ${fmtTime(d)}` : ''; };
const QUICK_REASONS = ['รูปไม่ชัด ถ่ายใหม่', 'ค่าไม่ตรงตามแบบ', 'ทำยังไม่ครบ', 'เขียนรายละเอียดเพิ่ม'];

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

/** Note / photos / link. The send button lives in the sheet footer and calls back through `sendRef`. */
function SubmitBox({ task, sendRef, setBusy }) {
  const { store, toast } = useApp();
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [images, setImages] = useState([]);
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
  sendRef.current = async () => {
    if (link && !/^https?:\/\//.test(link)) { setErr('ลิงก์ต้องขึ้นต้นด้วย https://'); return; }
    setBusy(true);
    try {
      await store.submit(task.id, { note: note.trim(), link: link.trim(), images });
      toast(task.needsReview === false ? 'บันทึกว่าทำเสร็จแล้ว' : 'ส่งงานแล้ว รอพี่ตรวจ', 'ok');
      setNote(''); setLink(''); setImages([]);
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };
  return html`<div class="submit-box">
    ${task.mode === 'group' ? html`<p class="hint-line">งานกลุ่ม: ส่งครั้งเดียวแทนทุกคนในกลุ่ม</p>` : ''}
    <div class="attach-row">
      <label class="btn btn--ghost attach-btn" for="sub-photo"><${Icon} name="camera" size=${18} />ถ่ายรูป / เลือกรูป</label>
      <input id="sub-photo" class="sr-only" type="file" accept="image/*" multiple onChange=${pick} />
      <span class="attach-hint">ย่อรูปให้อัตโนมัติ ได้สูงสุด 6 รูป</span>
    </div>
    ${images.length ? html`<div class="thumbs">${images.map((img, i) => html`<span class="thumb thumb--new">
      <img src=${img.data} alt=${img.name} />
      <button type="button" class="thumb-x" aria-label="เอารูปนี้ออก" onClick=${() => setImages((x) => x.filter((_, j) => j !== i))}><${Icon} name="close" size=${14} /></button>
    </span>`)}</div>` : ''}
    <${Field} id="sub-note" label="ข้อความถึงพี่ (ไม่บังคับ)">
      <textarea id="sub-note" rows="3" value=${note} onInput=${(e) => setNote(e.target.value)} placeholder="เช่น วัดครบ 20 ชิ้น ไม่ผ่าน 2 ชิ้น แนบรูปไว้แล้ว"></textarea>
    <//>
    <${Field} id="sub-link" label="ลิงก์ไฟล์ (เช่น Google Drive)" hint="ไฟล์ PDF หรือไฟล์ใหญ่ ให้อัปโหลดขึ้น Drive แล้วแปะลิงก์">
      <input id="sub-link" type="url" inputmode="url" value=${link} onInput=${(e) => setLink(e.target.value)} placeholder="https://" />
    <//>
    ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
  </div>`;
}

/** Send-back form for one submission; opened from the footer or the submission card. */
function ChangesBox({ sub, onDone, onCancel }) {
  const { store, toast } = useApp();
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const send = async () => {
    if (!note.trim()) { setErr('บอกน้องสั้นๆ ว่าต้องแก้ตรงไหน'); return; }
    try { await store.review(sub.id, 'changes', note.trim()); toast('ส่งกลับให้แก้แล้ว', 'warn'); onDone(); } catch (ex) { setErr(ex.message); }
  };
  return html`<div class="review-box" id=${`rv-box-${sub.id}`}>
    <${Field} id=${`rv-${sub.id}`} label="ต้องแก้ตรงไหน" error=${err}>
      <div class="chips chips--quick">${QUICK_REASONS.map((r) => html`<button type="button" class="chip chip--sm"
        onClick=${() => { setNote((n) => (n ? `${n} ${r}` : r)); setErr(''); }}>${r}</button>`)}</div>
      <textarea id=${`rv-${sub.id}`} rows="3" value=${note} onInput=${(e) => { setNote(e.target.value); setErr(''); }} placeholder="เช่น ใส่ค่าเผื่อตามแบบด้วย"></textarea>
    <//>
    <div class="btn-row">
      <button type="button" class="btn btn--ghost" onClick=${onCancel}>ยกเลิก</button>
      <button type="button" class="btn btn--stop" onClick=${send}>ส่งกลับให้แก้</button>
    </div>
  </div>`;
}

export function TaskDetail({ task, onClose }) {
  const { db, me, now, store, toast, editTask } = useApp();
  const [subs, setSubs] = useState(null);
  const [big, setBig] = useState(null);
  const [changesFor, setChangesFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const sendRef = useRef(null);
  useEffect(() => { let on = true; store.subsFor(task.id).then((s) => on && setSubs(s)); return () => { on = false; }; }, [db]);
  const files = useFiles(store, (subs || []).flatMap((s) => s.files || []));
  const reviewer = canReviewAny(me); // interns never review, even an admin who is also an intern
  const editable = canEditTask(me, task, now);
  const mine = task.assignees.includes(me.uid) ? stateOf(task, me.uid) : null;
  const myNote = mine && task.state[me.uid] && task.state[me.uid].note;
  const plan = db.plans[task.planId];
  const due = toLocalDate(task.due);
  const created = toLocalDate(task.created);
  // nobody reviews their own work
  const canReview = (s) => reviewer && !s.review && !s.for.includes(me.uid);
  const pending = (subs || []).filter(canReview);
  const roundOf = (s) => (subs || []).filter((x) => x.for.join() === s.for.join() && x.at <= s.at).length;

  const run = async (fn, okText, tone = 'ok') => {
    setBusy(true);
    try { await fn(); if (okText) toast(okText, tone); } catch (ex) { toast(ex.message, 'bad'); }
    setBusy(false);
  };
  const ack = () => run(() => store.ack(task.id), 'รับทราบแล้ว');
  const approve = (s) => run(() => store.review(s.id, 'approved', ''), `ตรวจผ่าน · ${s.for.map((u) => displayName(db.users[u])).join(', ')}`);
  const openChanges = (s) => {
    setChangesFor(s.id);
    setTimeout(() => { const el = document.getElementById(`rv-box-${s.id}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
  };

  // the single primary action for this viewer
  let footer = null;
  if (reviewer && pending.length && !changesFor) {
    const s = pending[pending.length - 1]; // the oldest waiting submission first
    const who = s.for.map((u) => displayName(db.users[u])).join(', ');
    footer = html`<button type="button" class="btn btn--stop-ghost" disabled=${busy} onClick=${() => openChanges(s)}>ให้แก้</button>
      <span class="foot-space"></span>
      <button type="button" class="btn btn--ok" disabled=${busy} onClick=${() => approve(s)}><${Icon} name="check" size=${18} />ตรวจผ่าน · ${who}</button>`;
  } else if (mine === 'assigned') {
    footer = html`<button type="button" class="btn btn--ack btn--block" disabled=${busy} onClick=${ack}><${Icon} name="check" size=${18} />รับทราบงานนี้</button>`;
  } else if (mine === 'ack' || mine === 'changes') {
    const label = task.needsReview === false ? 'บันทึกว่าทำเสร็จแล้ว' : mine === 'changes' ? 'ส่งงานที่แก้แล้ว' : 'ส่งงาน';
    footer = html`<button type="button" class="btn btn--primary btn--block" disabled=${busy} onClick=${() => sendRef.current && sendRef.current()}>
      <${Icon} name="send" size=${18} />${busy ? 'กำลังส่ง…' : label}</button>`;
  }

  const head = editable ? html`<button type="button" class="icon-btn" onClick=${() => { onClose(); editTask(task); }} aria-label="แก้ไขใบสั่งงาน"><${Icon} name="edit" /></button>` : null;

  return html`<${Sheet} title=${woNumber(task)} onClose=${onClose} wide footer=${footer} headActions=${head}>
    <article class="ticket">
      <header class="ticket-head">
        <h3 class="ticket-title">${task.order != null ? html`<b class="wo-order">#${task.order}</b>` : ''}${task.title}</h3>
        <div class="ticket-tags">
          <${PrioLabel} value=${task.priority} />
          <span class="pill">${task.mode === 'group' ? 'งานกลุ่ม · ส่งครั้งเดียว' : task.assignees.length > 1 ? 'แยกรายคน' : 'งานเดี่ยว'}</span>
          ${task.needsReview === false ? html`<span class="pill">ไม่ต้องให้พี่ตรวจ</span>` : ''}
        </div>
      </header>
      <dl class="ticket-grid">
        <div><dt>กำหนดส่ง</dt><dd>${due ? `${fmtDay(due)} ${fmtTime(due)}` : '—'}
          ${mine && mine !== 'approved' && mine !== 'submitted' ? html` <${DueChip} due=${task.due} now=${now} />` : ''}</dd></div>
        <div><dt>มอบหมาย</dt><dd>${task.assignerName}${created ? ` · ${fmtDate(created)}` : ''}</dd></div>
        <div class="span-2"><dt>หัวข้องาน</dt><dd>${plan ? html`${planLabel(plan, task.stepId)} <span class="soft">${weeksLabel((stepOf(plan, task.stepId) || plan).weeks)}</span>` : planTitle(db, task.planId)}</dd></div>
      </dl>
      ${task.details ? html`<p class="ticket-details">${task.details}</p>` : ''}
    </article>

    ${mine ? html`<section class=${`my-action my-action--${mine}`}>
      <h4>สถานะของฉัน <${StateTag} state=${mine} late=${isLate(task, me.uid, now)} /></h4>
      ${mine === 'assigned' ? html`<p class="hint-line">กดรับทราบด้านล่าง เพื่อบอกพี่ว่าเห็นงานนี้แล้ว</p>` : ''}
      ${mine === 'changes' && myNote ? html`<p class="callout callout--stop"><b>พี่ให้แก้:</b> ${myNote}</p>` : ''}
      ${mine === 'ack' || mine === 'changes' ? html`<${SubmitBox} task=${task} sendRef=${sendRef} setBusy=${setBusy} />` : ''}
      ${mine === 'submitted' ? html`<p class="hint-line">ส่งแล้ว รอพี่ตรวจ ถ้าพี่ให้แก้ จะขึ้นในหน้างานของฉัน</p>` : ''}
      ${mine === 'approved' ? html`<p class="hint-line">งานนี้ผ่านแล้ว</p>` : ''}
    </section>` : ''}

    <section class="history">
      <h4>การส่งงานและผลตรวจ</h4>
      ${subs === null ? html`<p class="quiet">กำลังโหลด…</p>` : subs.length === 0 ? html`<p class="quiet">ยังไม่มีใครส่งงานนี้</p>`
        : html`<ol class="subs">${subs.map((s, i) => html`<li class=${`sub${s.review ? ` sub--${s.review.decision}` : ' sub--open'}`} key=${s.id}>
          <p class="sub-head"><span class="sub-round">ครั้งที่ ${roundOf(s)}</span><b>${displayName(db.users[s.by])}</b>${s.for.length > 1 ? ' (ในนามกลุ่ม)' : ''}
            <span class="num">${when(s.at)}</span>${task.due && s.at > task.due ? html`<span class="late-stamp">ส่งช้า</span>` : ''}</p>
          ${s.note ? html`<p class="sub-note">${s.note}</p>` : ''}
          ${s.link ? html`<p class="sub-link"><${Icon} name="link" size=${16} /><a href=${s.link} target="_blank" rel="noopener noreferrer">${s.link}</a></p>` : ''}
          <${Thumbs} ids=${s.files} files=${files} onOpen=${setBig} />
          ${s.review ? html`<p class=${`sub-review sub-review--${s.review.decision}`}>
              <b>${s.review.decision === 'approved' ? 'ผ่าน' : 'ให้แก้'}</b> โดย ${displayName(db.users[s.review.by])} · <span class="num">${when(s.review.at)}</span>
              ${s.review.note ? html`<br />${s.review.note}` : ''}</p>
              ${reviewer && i === 0 && s.review.by === me.uid ? html`<button type="button" class="link-btn" onClick=${() => run(() => store.unreview(s.id), 'ยกเลิกผลตรวจแล้ว ตรวจใหม่ได้เลย', 'info')}>กดผิด? ยกเลิกผลตรวจนี้</button>` : ''}`
            : changesFor === s.id ? html`<${ChangesBox} sub=${s} onDone=${() => setChangesFor(null)} onCancel=${() => setChangesFor(null)} />`
            : canReview(s) ? html`<div class="btn-row"><button type="button" class="btn btn--stop-ghost" onClick=${() => openChanges(s)}>ให้แก้</button>
                <button type="button" class="btn btn--ok" onClick=${() => approve(s)}><${Icon} name="check" size=${18} />ตรวจผ่าน</button></div>`
            : html`<p class="quiet">รอพี่ตรวจ</p>
              ${s.for.includes(me.uid) ? html`<button type="button" class="link-btn" onClick=${() => run(() => store.unsubmit(s.id), 'ยกเลิกการส่งแล้ว แก้แล้วส่งใหม่ได้', 'info')}>ส่งผิด? ยกเลิกการส่งครั้งนี้</button>` : ''}`}
        </li>`)}</ol>`}
    </section>

    <section class="people">
      <h4>ผู้รับงาน ${task.assignees.length} คน</h4>
      <ul class="people-list">${task.assignees.map((u) => {
        const s = stateOf(task, u);
        const late = isLate(task, u, now);
        const st = task.state[u] || {};
        return html`<li><${Lamp} state=${s} late=${late} />
          <span class="people-name">${displayName(db.users[u])}<small>${st.at ? when(st.at) : ''}</small></span>
          <${StateTag} state=${s} late=${late} /></li>`;
      })}</ul>
    </section>

    ${big ? html`<div class="lightbox" onClick=${() => setBig(null)} role="dialog" aria-label="รูปขนาดใหญ่">
      <img src=${big.data} alt=${big.name} /><button type="button" class="icon-btn lightbox-x" aria-label="ปิดรูป"><${Icon} name="close" /></button></div>` : ''}
  <//>`;
}
