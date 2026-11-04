// "แชท" — like the chat apps everyone uses: one-to-one chats between a พี่ and a น้อง, plus groups that anyone
// can start (a group always has at least one พี่ in it). Only the people in a chat can read it; the admin cannot.
import { html, useState, useEffect, useRef, useLayoutEffect } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { chatPeople, groupPeople, groupHasStaff, groupAutoName, pairId, isUnread, isStaff, isStudent, mentorsOf,
  displayName, fmtDay, fmtTime, dateKey, addDays, MAX_GROUP, canEditMsg, EDIT_MINUTES } from '../model.js';
import { Icon, Avatar, Empty, Sheet, Field, ConfirmButton, TwoTap } from '../ui.js';

export function ChatView() {
  const { route } = useApp();
  const g = /^chatg-(.+)$/.exec(route || '');
  if (g) return html`<${Conversation} key=${`g-${g[1]}`} groupId=${g[1]} />`;
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

/** How the other person relates to me: one of my พี่ที่ดูแล, or an intern I look after. */
function relation(me, other) {
  if (isStudent(me) && mentorsOf(me).includes(other.uid)) return 'พี่ที่ดูแลเรา';
  if (isStaff(me) && mentorsOf(other).includes(me.uid)) return 'น้องที่เราดูแล';
  return '';
}
const subline = (u) => (isStaff(u) ? (u.position || 'พี่ผู้ดูแล') : `นักศึกษาฝึกงาน${u.studentId ? ` · ${u.studentId}` : ''}`);
const who = (users, id, meId) => (id === meId ? 'คุณ' : displayName(users[id]));
const GroupMark = ({ size = 'md' }) => html`<span class=${`avatar avatar--${size} avatar--group`} aria-hidden="true"><${Icon} name="users" size=${size === 'md' ? 18 : 16} /></span>`;

function ChatList() {
  const { db, me, now, go } = useApp();
  const [making, setMaking] = useState(false);
  const chats = db.chats || {};
  const groups = Object.values(chats).filter((c) => c.kind === 'group' && (c.members || []).includes(me.uid))
    .map((c) => ({ key: `g-${c.id}`, group: c, at: c.lastAt || 0, unread: isUnread(c, me.uid) }));
  const people = chatPeople(db.users, me).map((u) => {
    const c = chats[pairId(me.uid, u.uid)];
    return { key: u.uid, u, c, at: (c && c.lastAt) || 0, rel: relation(me, u), unread: isUnread(c, me.uid) };
  });
  const recent = [...groups, ...people.filter((p) => p.at)].sort((a, b) => b.at - a.at);
  const fresh = people.filter((p) => !p.at)
    .sort((a, b) => Number(!!b.rel) - Number(!!a.rel) || displayName(a.u).localeCompare(displayName(b.u), 'th'));
  const canGroup = groupPeople(db.users, me).length > 0;

  const row = (x) => (x.group ? html`<li key=${x.key}>
      <button type="button" class=${`chat-row${x.unread ? ' is-unread' : ''}`} onClick=${() => go(`chatg-${x.group.id}`)}>
        <${GroupMark} />
        <span class="chat-row-main">
          <span class="chat-row-name"><b>${x.group.name}</b><span class="chat-count">${x.group.members.length} คน</span></span>
          <span class="chat-row-last">${x.group.lastText ? `${who(db.users, x.group.lastBy, me.uid)}: ${x.group.lastText}` : ''}</span>
        </span>
        <span class="chat-row-meta">${x.at ? html`<time>${shortWhen(x.at, now)}</time>` : ''}${x.unread ? html`<i class="chat-dot" aria-label="มีข้อความใหม่"></i>` : ''}</span>
      </button></li>`
    : html`<li key=${x.key}>
      <button type="button" class=${`chat-row${x.unread ? ' is-unread' : ''}`} onClick=${() => go(`chat-${x.u.uid}`)}>
        <${Avatar} user=${x.u} />
        <span class="chat-row-main">
          <span class="chat-row-name"><b>${displayName(x.u)}</b>${x.rel ? html`<span class="chat-rel">${x.rel}</span>` : ''}</span>
          <span class="chat-row-last">${x.c && x.c.lastText ? `${x.c.lastBy === me.uid ? 'คุณ: ' : ''}${x.c.lastText}` : subline(x.u)}</span>
        </span>
        <span class="chat-row-meta">${x.at ? html`<time>${shortWhen(x.at, now)}</time>` : ''}${x.unread ? html`<i class="chat-dot" aria-label="มีข้อความใหม่"></i>` : ''}</span>
      </button></li>`);

  return html`<section class="page page--chat">
    <header class="page-head"><div><h1>แชท</h1>
      <p class="page-sub">คุยทีละคนหรือเป็นกลุ่ม ในเว็บเห็นเฉพาะคนในแชท แอดมินก็เปิดอ่านไม่ได้</p></div>
      ${canGroup ? html`<button type="button" class="btn btn--ghost head-action" onClick=${() => setMaking(true)}><${Icon} name="plus" size=${18} />สร้างกลุ่ม</button>` : ''}</header>
    ${db.chatOff ? html`<p class="callout callout--stop">ระบบแชทยังไม่พร้อม (กฎสิทธิ์ใน Firebase ยังไม่ได้อัปเดต) แจ้งแอดมินให้อัปเดตกฎ</p>` : ''}
    ${recent.length === 0 && fresh.length === 0 ? html`<${Empty} title=${isStudent(me) ? 'ยังไม่มีพี่ผู้ดูแลในระบบ' : 'ยังไม่มีน้องฝึกงานในระบบ'}
        text="เมื่อมีคนสมัครเข้าทีมด้วยลิงก์ชวน จะขึ้นชื่อให้แชทได้ที่นี่" />` : ''}
    ${recent.length ? html`<ul class="chat-list">${recent.map(row)}</ul>` : ''}
    ${fresh.length ? html`<section class="chat-start">
      <h2 class="chat-section-title">${recent.length ? 'เริ่มคุยกับ' : 'ทักได้เลย'}</h2>
      <ul class="chat-list">${fresh.map(row)}</ul></section>` : ''}
    ${making ? html`<${GroupSheet} onClose=${() => setMaking(false)} />` : ''}
  </section>`;
}

/** New group (no `chat`) or the group's settings: staff rename and pick people; everyone can leave. */
function GroupSheet({ chat, onClose }) {
  const { db, me, store, toast, go } = useApp();
  const editing = !!chat;
  const staffMe = isStaff(me);
  const canEdit = !editing || staffMe;
  const byName = (a, b) => Number(isStaff(b)) - Number(isStaff(a)) || displayName(a).localeCompare(displayName(b), 'th');
  const people = groupPeople(db.users, me).sort(byName);
  const preset = () => {
    if (editing) return chat.members.filter((x) => x !== me.uid);
    if (isStudent(me)) return mentorsOf(me).filter((id) => people.some((u) => u.uid === id)); // my พี่ที่ดูแล ticked to start with
    return people.filter((u) => mentorsOf(u).includes(me.uid)).map((u) => u.uid); // the interns I look after
  };
  const [picked, setPicked] = useState(preset);
  const [name, setName] = useState(editing ? chat.name : '');
  const [busy, setBusy] = useState(false);
  const all = [me.uid, ...picked];
  const hasStaff = groupHasStaff(db.users, all);
  const toggle = (id) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length + 1 >= MAX_GROUP ? x : [...x, id]));
  const autoName = groupAutoName(db.users, all);

  const create = () => {
    try {
      const { id, done } = store.createGroup({ name: name.trim(), members: picked });
      onClose();
      go(`chatg-${id}`);
      done.catch((ex) => toast(ex.message, 'bad'));
    } catch (ex) { toast(ex.message, 'bad'); }
  };
  const save = async () => {
    const before = chat.members;
    const added = picked.filter((x) => !before.includes(x)).map((x) => displayName(db.users[x]));
    const removed = before.filter((x) => x !== me.uid && !picked.includes(x)).map((x) => displayName(db.users[x]));
    const nm = name.trim() || chat.name;
    const parts = [];
    if (added.length) parts.push(`เพิ่ม ${added.join(', ')} เข้ากลุ่ม`);
    if (removed.length) parts.push(`เอา ${removed.join(', ')} ออกจากกลุ่ม`);
    if (nm !== chat.name) parts.push(`เปลี่ยนชื่อกลุ่มเป็น “${nm}”`);
    if (!parts.length) { onClose(); return; }
    setBusy(true);
    try { await store.updateGroup(chat.id, { name: nm, members: [me.uid, ...picked] }, parts.join(' · ')); toast('บันทึกกลุ่มแล้ว', 'ok'); onClose(); } catch (ex) { toast(ex.message, 'bad'); }
    setBusy(false);
  };
  const leave = async () => {
    try { await store.leaveGroup(chat.id); toast(`ออกจากกลุ่ม “${chat.name}” แล้ว`); onClose(); go('chat'); } catch (ex) { toast(ex.message, 'bad'); }
  };

  return html`<${Sheet} title=${editing ? 'ข้อมูลกลุ่ม' : 'สร้างกลุ่มแชท'} onClose=${onClose}
    footer=${html`${editing ? html`<${ConfirmButton} label="ออกจากกลุ่ม" confirmLabel="แตะอีกครั้งเพื่อออก" icon="logout" onConfirm=${leave} />`
        : html`<button type="button" class="btn btn--ghost" onClick=${onClose}>ยกเลิก</button>`}
      <span class="foot-space"></span>
      ${canEdit ? html`<button type="button" class="btn btn--primary" disabled=${busy || !picked.length || !hasStaff}
        onClick=${editing ? save : create}>${editing ? 'บันทึก' : 'สร้างกลุ่ม'}</button>` : ''}`}>
    <div class="form">
      ${canEdit ? html`<${Field} id="gr-name" label="ชื่อกลุ่ม" hint=${editing ? '' : 'เว้นว่างได้ จะตั้งจากชื่อคนในกลุ่ม'}>
          <input id="gr-name" type="text" maxlength="60" value=${name} placeholder=${autoName} onInput=${(e) => setName(e.target.value)} /><//>
        <div class="field">
          <span class="field-label">คนในกลุ่ม (${all.length} คน รวมเรา)</span>
          <div class="chips" role="group" aria-label="เลือกคนในกลุ่ม">${people.map((u) => {
            const on = picked.includes(u.uid);
            return html`<button type="button" class=${`chip chip--sm${on ? ' is-on' : ''}`} aria-pressed=${on} onClick=${() => toggle(u.uid)}>
              ${on ? html`<${Icon} name="check" size=${16} />` : ''}${displayName(u)}<small class="chip-note">${isStaff(u) ? (u.position || 'พี่ผู้ดูแล') : 'นักศึกษา'}</small></button>`;
          })}</div>
          <p class=${`hint-line${hasStaff ? '' : ' hint-line--warn'}`}>${hasStaff ? 'ทักในกลุ่มทีเดียว ทุกคนในกลุ่มเห็น เหมาะกับฝากทักหรือฝากบอกต่อ' : 'กลุ่มต้องมีพี่ผู้ดูแลอย่างน้อย 1 คน'}</p>
        </div>`
      : html`<p class="hint-line">เปลี่ยนชื่อกลุ่มหรือเพิ่มคนได้เฉพาะพี่ผู้ดูแลในกลุ่ม</p>
        <ul class="member-list">${chat.members.map((id) => db.users[id] ? html`<li key=${id}><${Avatar} user=${db.users[id]} size="sm" /><span>${id === me.uid ? 'คุณ' : displayName(db.users[id])}</span>
          <small>${isStaff(db.users[id]) ? (db.users[id].position || 'พี่ผู้ดูแล') : 'นักศึกษา'}</small></li>` : '')}</ul>`}
    </div>
  <//>`;
}

// http(s) links in a message become tappable; everything else stays plain text
const LINK = /(https?:\/\/[^\s<>"']+)/g;
const withLinks = (text) => text.split(LINK).map((part, i) => (i % 2
  ? html`<a href=${part} target="_blank" rel="noopener noreferrer">${part}</a>` : part));

function Conversation({ otherId, groupId }) {
  const { db, me, now, store, toast, go } = useApp();
  const chats = db.chats || {};
  const group = groupId ? chats[groupId] : null;
  const other = otherId ? db.users[otherId] : null;
  const cid = groupId || pairId(me.uid, otherId);
  const chat = chats[cid];
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [settings, setSettings] = useState(false);
  const [active, setActive] = useState(null); // my message with its actions open
  const [editing, setEditing] = useState(null); // my message being fixed
  const seenFor = useRef(0);
  const first = useRef(true);
  const box = useRef();
  const allowed = groupId ? !!group && group.members.includes(me.uid) : chatPeople(db.users, me).some((u) => u.uid === otherId);
  // a group made a moment ago is read once it has reached the server (its messages are checked against it);
  // after that the listener stays on, even while my own new message is on its way
  const confirmed = useRef(false);
  if (allowed && !(group && group.pending)) confirmed.current = true;
  const ready = allowed && confirmed.current;

  useEffect(() => {
    if (!ready) return undefined;
    return store.subscribeChat(cid, (list, e) => { if (e) setErr(e.message); else { setErr(''); setMsgs(list); } });
  }, [cid, ready]);

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
  const isLast = (m) => !!msgs && msgs.length > 0 && msgs[msgs.length - 1].id === m.id;
  const clearBox = () => { setText(''); if (box.current) { box.current.value = ''; grow(box.current); } };
  const send = () => {
    const body = text.trim();
    if (!body) return;
    try {
      const was = editing;
      const p = was ? store.editChat(cid, was.id, body, isLast(was))
        : groupId ? store.sendGroup(groupId, body) : store.sendChat(otherId, body);
      clearBox(); setEditing(null);
      if (box.current) box.current.focus();
      p.catch((ex) => { toast(ex.message, 'bad'); setText((t) => t || body); if (was) setEditing(was); });
    } catch (ex) { toast(ex.message, 'bad'); }
  };
  const startEdit = (m) => {
    setActive(null); setEditing(m); setText(m.text);
    setTimeout(() => { if (box.current) { grow(box.current); box.current.focus(); } }, 30);
  };
  const stopEdit = () => { setEditing(null); clearBox(); };
  const unsend = (m) => {
    setActive(null);
    if (editing && editing.id === m.id) stopEdit();
    store.unsendChat(cid, m.id, isLast(m)).catch((ex) => toast(ex.message, 'bad'));
  };
  const onKey = (e) => {
    // Enter sends on a computer; on a phone Enter makes a new line and the button sends
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !window.matchMedia('(pointer: coarse)').matches) { e.preventDefault(); send(); }
  };

  if (groupId && !group && !db.chatsLoaded) return html`<section class="page page--chat"><p class="quiet">กำลังโหลด…</p></section>`;
  if (!allowed) {
    return html`<section class="page page--chat"><${Empty} title="เปิดแชทนี้ไม่ได้"
      text=${groupId ? 'คุณไม่ได้อยู่ในกลุ่มนี้แล้ว' : 'แชทได้เฉพาะระหว่างพี่ผู้ดูแลกับน้องฝึกงาน หรือสร้างกลุ่มที่มีพี่อยู่ด้วย'}>
      <button type="button" class="btn btn--ghost" onClick=${() => go('chat')}>กลับไปหน้าแชท</button><//></section>`;
  }

  const title = group ? group.name : (other.name || displayName(other));
  const sub = group ? group.members.map((id) => who(db.users, id, me.uid)).join(', ') : [relation(me, other), subline(other)].filter(Boolean).join(' · ');
  const placeholder = group ? `พิมพ์ข้อความถึงกลุ่ม ${group.name}` : `พิมพ์ข้อความถึง ${displayName(other)}`;
  let lastDay = '';
  let lastBy = '';
  return html`<section class="page page--chat page--thread">
    <header class="thread-head">
      <button type="button" class="icon-btn" onClick=${() => go('chat')} aria-label="กลับไปรายชื่อแชท"><${Icon} name="back" /></button>
      ${group ? html`<${GroupMark} />` : html`<${Avatar} user=${other} />`}
      <div class="thread-who"><b>${title}</b><small>${sub}</small></div>
      ${group ? html`<button type="button" class="icon-btn thread-more" onClick=${() => setSettings(true)} aria-label="ข้อมูลกลุ่ม"><${Icon} name="users" /></button>` : ''}
    </header>
    <p class="thread-note"><${Icon} name="lock" size=${14} />${`${group ? `เห็นเฉพาะ ${group.members.length} คนในกลุ่มนี้` : 'เห็นกันแค่สองคนในเว็บนี้'} · แตะข้อความของเราเพื่อแก้หรือยกเลิกได้ภายใน ${EDIT_MINUTES} นาที`}</p>
    ${err ? html`<p class="callout callout--stop">${err}</p>` : ''}
    ${msgs === null && !err ? html`<p class="quiet">กำลังโหลด…</p>` : ''}
    ${msgs && msgs.filter((m) => !m.sys).length === 0 ? html`<p class="thread-empty">${group ? 'ยังไม่มีข้อความ ทักกลุ่มก่อนได้เลย' : 'ยังไม่มีข้อความ ทักไปก่อนได้เลย'}</p>` : ''}
    <ol class="thread">${(msgs || []).map((m) => {
      const d = m.at ? new Date(m.at) : now;
      const day = dayLabel(d, now);
      const sep = day !== lastDay;
      lastDay = day;
      if (m.sys) {
        lastBy = '';
        return html`${sep ? html`<li class="thread-day" key=${`d-${day}`}><span>${day}</span></li>` : ''}
          <li key=${m.id} class="thread-sys"><span>${who(db.users, m.by, me.uid)} ${m.text}</span></li>`;
      }
      const mine = m.by === me.uid;
      const showWho = group && !mine && (sep || lastBy !== m.by);
      lastBy = m.by;
      const fixable = canEditMsg(m, me.uid, now.getTime()) && !m.pending;
      const open = fixable && active === m.id;
      const toggle = () => { if (fixable) setActive(open ? null : m.id); };
      return html`${sep ? html`<li class="thread-day" key=${`d-${day}`}><span>${day}</span></li>` : ''}
        <li key=${m.id} class=${`bubble${mine ? ' bubble--me' : ''}${m.deleted ? ' bubble--gone' : ''}${fixable ? ' is-fixable' : ''}${open || (editing && editing.id === m.id) ? ' is-picked' : ''}`}
          role=${fixable ? 'button' : undefined} tabIndex=${fixable ? 0 : undefined} aria-expanded=${fixable ? open : undefined}
          onClick=${toggle} onKeyDown=${(e) => { if (fixable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } }}>
          ${showWho ? html`<span class="bubble-who">${displayName(db.users[m.by])}</span>` : ''}
          ${m.deleted ? html`<p class="bubble-text">${mine ? 'คุณยกเลิกข้อความนี้แล้ว' : 'ยกเลิกข้อความแล้ว'}</p>`
            : html`<p class="bubble-text">${withLinks(m.text || '')}</p>`}
          <span class="bubble-time">${m.pending ? 'กำลังส่ง…' : `${m.editedAt && !m.deleted ? 'แก้ไขแล้ว · ' : ''}${fmtTime(d)}`}</span>
        </li>
        ${open ? html`<li key=${`a-${m.id}`} class="bubble-actions">
          <button type="button" class="link-btn link-btn--inline" onClick=${() => startEdit(m)}>แก้ไข</button>
          <${TwoTap} label="ยกเลิกข้อความ" confirmLabel="แตะอีกครั้งเพื่อยกเลิก" onConfirm=${() => unsend(m)} />
        </li>` : ''}`;
    })}</ol>
    <form class=${`compose${editing ? ' is-editing' : ''}`} onSubmit=${(e) => { e.preventDefault(); send(); }}>
      ${editing ? html`<p class="edit-band"><${Icon} name="edit" size=${16} />กำลังแก้ข้อความ
        <button type="button" class="link-btn link-btn--inline" onClick=${stopEdit}>เลิกแก้</button></p>` : ''}
      <label class="sr-only" for="chat-input">${placeholder}</label>
      <textarea id="chat-input" ref=${box} rows="1" maxlength="2000" placeholder=${placeholder}
        value=${text} onInput=${(e) => { setText(e.target.value); grow(e.target); }} onKeyDown=${onKey}></textarea>
      <button type="submit" class="btn btn--primary compose-send" disabled=${!text.trim()} aria-label=${editing ? 'บันทึกการแก้' : 'ส่งข้อความ'}><${Icon} name=${editing ? 'check' : 'send'} size=${20} /></button>
    </form>
    ${settings && group ? html`<${GroupSheet} chat=${group} onClose=${() => setSettings(false)} />` : ''}
  </section>`;
}
