// "แชท" — private 1:1 chat between a company staff member (พี่) and an intern (น้อง).
// Only the two people in a chat can read it; the admin cannot, and interns cannot chat with each other.
import { html, useState, useEffect, useRef, useLayoutEffect } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { chatPeople, pairId, isUnread, isStaff, isStudent, displayName, fmtDay, fmtTime, dateKey, addDays } from '../model.js';
import { Icon, Avatar, Empty } from '../ui.js';

export function ChatView() {
  const { route } = useApp();
  const m = /^chat-(.+)$/.exec(route || '');
  return m ? html`<${Conversation} key=${m[1]} otherId=${m[1]} />` : html`<${ChatList} />`;
}

const dayLabel = (d, now) => {
  const k = dateKey(d);
  if (k === dateKey(now)) return 'วันนี้';
  if (k === dateKey(addDays(now, -1))) return 'เมื่อวาน';
  return fmtDay(d);
};
const shortWhen = (ms, now) => {
  if (!ms) return '';
  const d = new Date(ms);
  return dateKey(d) === dateKey(now) ? fmtTime(d) : dayLabel(d, now);
};

/** How the other person relates to me: my พี่ที่ปรึกษา, or an intern I look after. */
function relation(me, other) {
  if (isStudent(me) && me.mentor === other.uid) return 'พนักงานที่ปรึกษาของเรา';
  if (isStaff(me) && other.mentor === me.uid) return 'น้องที่เราดูแล';
  return '';
}
const subline = (u) => (isStaff(u) ? (u.position || 'พี่ผู้ดูแล') : `นักศึกษาฝึกงาน${u.studentId ? ` · ${u.studentId}` : ''}`);

function ChatList() {
  const { db, me, now, go } = useApp();
  const chats = db.chats || {};
  const people = chatPeople(db.users, me).map((u) => {
    const c = chats[pairId(me.uid, u.uid)];
    return { u, c, rel: relation(me, u), unread: isUnread(c, me.uid) };
  }).sort((a, b) => ((b.c && b.c.lastAt) || 0) - ((a.c && a.c.lastAt) || 0)
    || Number(!!b.rel) - Number(!!a.rel) || displayName(a.u).localeCompare(displayName(b.u), 'th'));

  return html`<section class="page page--chat">
    <header class="page-head"><div><h1>แชท</h1>
      <p class="page-sub">คุยส่วนตัวระหว่างพี่ผู้ดูแลกับน้องฝึกงาน ในเว็บเห็นกันแค่สองคน แอดมินก็เปิดอ่านไม่ได้</p></div></header>
    ${db.chatOff ? html`<p class="callout callout--stop">ระบบแชทยังไม่พร้อม (กฎสิทธิ์ใน Firebase ยังไม่ได้อัปเดต) แจ้งแอดมินให้อัปเดตกฎ</p>` : ''}
    ${people.length === 0 ? html`<${Empty} title=${isStudent(me) ? 'ยังไม่มีพี่ผู้ดูแลในระบบ' : 'ยังไม่มีน้องฝึกงานในระบบ'}
        text=${isStudent(me) ? 'เมื่อพี่สมัครเข้าทีมด้วยลิงก์ชวน จะขึ้นชื่อให้แชทได้ที่นี่' : 'เมื่อน้องสมัครเข้าทีมด้วยลิงก์ชวน จะขึ้นชื่อให้แชทได้ที่นี่'} />`
      : html`<ul class="chat-list">${people.map(({ u, c, rel, unread }) => html`<li key=${u.uid}>
        <button type="button" class=${`chat-row${unread ? ' is-unread' : ''}`} onClick=${() => go(`chat-${u.uid}`)}>
          <${Avatar} user=${u} />
          <span class="chat-row-main">
            <span class="chat-row-name"><b>${displayName(u)}</b>${rel ? html`<span class="chat-rel">${rel}</span>` : ''}</span>
            <span class="chat-row-last">${c && c.lastText ? `${c.lastBy === me.uid ? 'คุณ: ' : ''}${c.lastText}` : subline(u)}</span>
          </span>
          <span class="chat-row-meta">${c && c.lastAt ? html`<time>${shortWhen(c.lastAt, now)}</time>` : ''}
            ${unread ? html`<i class="chat-dot" aria-label="มีข้อความใหม่"></i>` : ''}</span>
        </button></li>`)}</ul>`}
  </section>`;
}

// http(s) links in a message become tappable; everything else stays plain text
const LINK = /(https?:\/\/[^\s<>"']+)/g;
const withLinks = (text) => text.split(LINK).map((part, i) => (i % 2
  ? html`<a href=${part} target="_blank" rel="noopener noreferrer">${part}</a>` : part));

function Conversation({ otherId }) {
  const { db, me, now, store, toast, go } = useApp();
  const other = db.users[otherId];
  const cid = pairId(me.uid, otherId);
  const chat = (db.chats || {})[cid];
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const seenFor = useRef(0);
  const first = useRef(true);
  const box = useRef();
  const allowed = chatPeople(db.users, me).some((u) => u.uid === otherId);

  useEffect(() => {
    if (!allowed) return undefined;
    return store.subscribeChat(cid, (list, e) => { if (e) setErr(e.message); else { setErr(''); setMsgs(list); } });
  }, [cid, allowed]);

  // reading the chat marks it seen (once per new message)
  useEffect(() => {
    if (chat && isUnread(chat, me.uid) && seenFor.current !== chat.lastAt && document.visibilityState !== 'hidden') {
      seenFor.current = chat.lastAt;
      store.markChatSeen(cid);
    }
  });

  // stay at the newest message: always on first load and after my own message, otherwise only when already near the bottom
  useLayoutEffect(() => {
    if (!msgs) return;
    const doc = document.scrollingElement || document.documentElement;
    const nearBottom = doc.scrollHeight - (doc.scrollTop + window.innerHeight) < 220;
    const last = msgs[msgs.length - 1];
    if (first.current || nearBottom || (last && last.by === me.uid)) window.scrollTo(0, doc.scrollHeight);
    first.current = false;
  }, [msgs && msgs.length]);

  const grow = (el) => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; };
  const send = () => {
    const body = text.trim();
    if (!body) return;
    try {
      const p = store.sendChat(otherId, body);
      setText('');
      if (box.current) { box.current.value = ''; grow(box.current); box.current.focus(); }
      p.catch((ex) => { toast(ex.message, 'bad'); setText((t) => t || body); });
    } catch (ex) { toast(ex.message, 'bad'); }
  };
  const onKey = (e) => {
    // Enter sends on a computer; on a phone Enter makes a new line and the button sends
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !window.matchMedia('(pointer: coarse)').matches) { e.preventDefault(); send(); }
  };

  if (!other || !allowed) {
    return html`<section class="page page--chat"><${Empty} title="เปิดแชทนี้ไม่ได้" text="แชทได้เฉพาะระหว่างพี่ผู้ดูแลกับน้องฝึกงาน">
      <button type="button" class="btn btn--ghost" onClick=${() => go('chat')}>กลับไปหน้าแชท</button><//></section>`;
  }

  let lastDay = '';
  return html`<section class="page page--chat page--thread">
    <header class="thread-head">
      <button type="button" class="icon-btn" onClick=${() => go('chat')} aria-label="กลับไปรายชื่อแชท"><${Icon} name="back" /></button>
      <${Avatar} user=${other} />
      <div class="thread-who"><b>${other.name || displayName(other)}</b><small>${[relation(me, other), subline(other)].filter(Boolean).join(' · ')}</small></div>
    </header>
    <p class="thread-note"><${Icon} name="lock" size=${14} />เห็นกันแค่สองคนในเว็บนี้</p>
    ${err ? html`<p class="callout callout--stop">${err}</p>` : ''}
    ${msgs === null && !err ? html`<p class="quiet">กำลังโหลด…</p>` : ''}
    ${msgs && msgs.length === 0 ? html`<p class="thread-empty">ยังไม่มีข้อความ ทักไปก่อนได้เลย</p>` : ''}
    <ol class="thread">${(msgs || []).map((m) => {
      const d = m.at ? new Date(m.at) : now;
      const day = dayLabel(d, now);
      const sep = day !== lastDay;
      lastDay = day;
      const mine = m.by === me.uid;
      return html`${sep ? html`<li class="thread-day" key=${`d-${day}`}><span>${day}</span></li>` : ''}
        <li key=${m.id} class=${`bubble${mine ? ' bubble--me' : ''}`}>
          <p class="bubble-text">${withLinks(m.text || '')}</p>
          <span class="bubble-time">${m.pending ? 'กำลังส่ง…' : fmtTime(d)}</span>
        </li>`;
    })}</ol>
    <form class="compose" onSubmit=${(e) => { e.preventDefault(); send(); }}>
      <label class="sr-only" for="chat-input">ข้อความถึง ${displayName(other)}</label>
      <textarea id="chat-input" ref=${box} rows="1" maxlength="2000" placeholder=${`พิมพ์ข้อความถึง ${displayName(other)}`}
        value=${text} onInput=${(e) => { setText(e.target.value); grow(e.target); }} onKeyDown=${onKey}></textarea>
      <button type="submit" class="btn btn--primary compose-send" disabled=${!text.trim()} aria-label="ส่งข้อความ"><${Icon} name="send" size=${20} /></button>
    </form>
  </section>`;
}
