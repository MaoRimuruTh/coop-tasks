// "ความเห็น" under a work order: the พี่, the admin and the interns on it talk about this one job,
// apart from the chat. Your own comment can be fixed or taken back for 15 minutes.
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { canComment, canEditMsg, talkUnread, displayName, isStaff, fmtDay, fmtTime, dateKey, EDIT_MINUTES } from '../model.js';
import { Avatar, TwoTap, Icon } from '../ui.js';

const LINK = /(https?:\/\/[^\s<>"']+)/g;
const withLinks = (text) => text.split(LINK).map((part, i) => (i % 2
  ? html`<a href=${part} target="_blank" rel="noopener noreferrer">${part}</a>` : part));

export function Talk({ task }) {
  const { db, me, now, store, toast } = useApp();
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null); // the comment being fixed
  const box = useRef();
  const seenFor = useRef(0);
  const can = canComment(me, task);
  const talk = (db.talk || {})[task.id];

  useEffect(() => store.subscribeComments(task.id, (l, e) => { if (e) setErr(e.message); else { setErr(''); setList(l); } }), [task.id]);
  // reading the comments marks them seen (once per new comment)
  useEffect(() => {
    if (list && talk && talkUnread(db, task, me.uid) && seenFor.current !== talk.lastAt) {
      seenFor.current = talk.lastAt;
      store.markCommentsSeen(task.id);
    }
  });

  const grow = (el) => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; };
  const reset = () => { setText(''); setEditing(null); if (box.current) { box.current.value = ''; grow(box.current); } };
  const send = () => {
    const body = text.trim();
    if (!body) return;
    try {
      const isLast = editing && list && list[list.length - 1] && list[list.length - 1].id === editing.id;
      const p = editing ? store.editComment(task.id, editing.id, body, isLast) : store.addComment(task.id, body);
      const was = editing;
      reset();
      p.then(() => { if (was) toast('แก้ความเห็นแล้ว', 'ok'); }, (ex) => { toast(ex.message, 'bad'); setText((t) => t || body); if (was) setEditing(was); });
    } catch (ex) { toast(ex.message, 'bad'); }
  };
  const startEdit = (c) => {
    setEditing(c); setText(c.text);
    setTimeout(() => { if (box.current) { grow(box.current); box.current.focus(); } }, 30);
  };
  const unsend = (c) => {
    const isLast = list && list[list.length - 1] && list[list.length - 1].id === c.id;
    store.unsendComment(task.id, c.id, isLast).catch((ex) => toast(ex.message, 'bad'));
    if (editing && editing.id === c.id) reset();
  };

  const shown = (list || []).filter((c) => !c.deleted).length;
  const nowMs = now.getTime();
  return html`<section class="talk" aria-labelledby=${`talk-${task.id}`}>
    <h4 id=${`talk-${task.id}`}>ความเห็น${shown ? html` <span class="pill">${shown}</span>` : ''}</h4>
    ${err ? html`<p class="callout callout--stop">${err}</p>` : ''}
    ${list === null && !err ? html`<p class="quiet">กำลังโหลด…</p>` : ''}
    ${list && list.length === 0 ? html`<p class="quiet">${can ? 'ยังไม่มีความเห็น ถามหรือบอกอะไรเกี่ยวกับงานนี้ได้เลย' : 'ยังไม่มีความเห็น'}</p>` : ''}
    ${list && list.length ? html`<ol class="talk-list">${list.map((c) => {
      const u = db.users[c.by];
      const d = c.at ? new Date(c.at) : now;
      const mine = c.by === me.uid;
      const fixable = canEditMsg(c, me.uid, nowMs);
      return html`<li key=${c.id} class=${`talk-item${mine ? ' talk-item--me' : ''}${editing && editing.id === c.id ? ' is-editing' : ''}`}>
        ${u ? html`<${Avatar} user=${u} size="sm" />` : html`<span class="avatar avatar--sm">?</span>`}
        <div class="talk-body">
          <p class="talk-head"><b>${mine ? 'คุณ' : displayName(u)}</b>${u && isStaff(u) ? html`<span class="talk-role">พี่ผู้ดูแล</span>` : ''}
            <span class="num">${dateKey(d) === dateKey(now) ? fmtTime(d) : `${fmtDay(d)} ${fmtTime(d)}`}</span>
            ${c.pending ? html`<span class="quiet">กำลังส่ง…</span>` : ''}${c.editedAt && !c.deleted ? html`<span class="quiet">แก้ไขแล้ว</span>` : ''}</p>
          ${c.deleted ? html`<p class="talk-text talk-text--gone">${mine ? 'คุณยกเลิกความเห็นนี้แล้ว' : 'ยกเลิกความเห็นแล้ว'}</p>`
            : html`<p class="talk-text">${withLinks(c.text || '')}</p>`}
          ${fixable ? html`<p class="talk-actions">
            <button type="button" class="link-btn link-btn--inline" onClick=${() => startEdit(c)}>แก้ไข</button>
            <${TwoTap} label="ยกเลิกความเห็น" confirmLabel="แตะอีกครั้งเพื่อยกเลิก" onConfirm=${() => unsend(c)} /></p>` : ''}
        </div>
      </li>`;
    })}</ol>` : ''}
    ${can ? html`<div class="talk-compose">
      ${editing ? html`<p class="edit-band"><${Icon} name="edit" size=${16} />กำลังแก้ความเห็น
        <button type="button" class="link-btn link-btn--inline" onClick=${reset}>เลิกแก้</button></p>` : ''}
      <div class="talk-row">
        <label class="sr-only" for=${`talk-in-${task.id}`}>${editing ? 'แก้ความเห็น' : 'เขียนความเห็น'}</label>
        <textarea id=${`talk-in-${task.id}`} ref=${box} rows="1" maxlength="2000" placeholder=${editing ? 'แก้ความเห็น' : 'เขียนความเห็นเกี่ยวกับงานนี้'}
          value=${text} onInput=${(e) => { setText(e.target.value); grow(e.target); }}></textarea>
        <button type="button" class="btn btn--primary talk-send" disabled=${!text.trim()} onClick=${send}
          aria-label=${editing ? 'บันทึกการแก้' : 'ส่งความเห็น'}><${Icon} name=${editing ? 'check' : 'send'} size=${18} /></button>
      </div>
      <p class="hint-line">ความเห็นของเราแก้หรือยกเลิกได้ภายใน ${EDIT_MINUTES} นาทีหลังส่ง</p>
    </div>` : html`<p class="quiet">เฉพาะพี่ผู้ดูแลและน้องที่ได้งานนี้แสดงความเห็นได้</p>`}
  </section>`;
}
