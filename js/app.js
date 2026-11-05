// App shell: data subscription, hash routing, navigation, demo persona switcher, toasts.
import { html, render, useEffect, useMemo, useState, useCallback, useRef } from './vendor/preact-htm.js';
import { calendar, weekOf, displayName, isStudent, isStaff, canAssign, canReview, isInternAdmin, assignerOpen, assignerUntil, fmtDay, fmtTime, fmtRange, TH_DAYS, stateOf, isLate, isUnread, unreadCount, otherOf, talkUnread, woNumber, canLog, logsToConfirm } from './model.js';
import { Icon } from './ui.js';
import { Ctx } from './ctx.js';
import { MyTasks } from './views/my.js';
import { Board } from './views/board.js';
import { AllTasks } from './views/tasks.js';
import { TaskDetail } from './views/detail.js';
import { TaskForm } from './views/taskform.js';
import { PlanView } from './views/plan.js';
import { UniForm } from './views/uniform.js';
import { AdminView } from './views/admin.js';
import { SignIn, Waiting } from './views/signin.js';
import { ProfileSheet } from './views/profile.js';
import { ChatView } from './views/chat.js';
import { LogView } from './views/log.js';

const ROLE_LABEL = { admin: 'แอดมิน', supervisor: 'พนักงานผู้ดูแล', student: 'นักศึกษา', pending: 'รออนุมัติ' };
export const roleLabel = (u) => (u.role === 'admin' && u.isStudent ? 'แอดมิน · นักศึกษา' : ROLE_LABEL[u.role] || u.role);

function tabsFor(me, badges, now) {
  const t = [];
  if (isStudent(me)) t.push({ id: 'my', label: 'งานของฉัน', icon: 'inbox', badge: badges.mine });
  if (canAssign(me, now)) t.push({ id: 'board', label: 'ภาพรวม', icon: 'board', badge: badges.review }, { id: 'tasks', label: 'งานทั้งหมด', icon: 'list' });
  // work the intern did without a work order: he writes it down, a พี่ confirms it
  if (isStaff(me)) t.push({ id: 'log', label: 'บันทึกงานของน้อง', short: 'บันทึก', icon: 'clip', badge: badges.log });
  else if (canLog(me)) t.push({ id: 'log', label: 'บันทึกงานที่ทำ', short: 'บันทึก', icon: 'clip' });
  // private chat: interns with staff, staff with interns
  if (isStudent(me) || isStaff(me)) t.push({ id: 'chat', label: 'แชท', icon: 'chat', badge: badges.chat });
  t.push({ id: 'plan', label: 'แผน 16 สัปดาห์', short: 'แผน', icon: 'plan' });
  // used a few times in the whole internship: on phones it is a button on the plan page
  t.push({ id: 'form', label: 'ฟอร์มส่งมหาลัย', short: 'ฟอร์ม', icon: 'form', deskOnly: true });
  if (me.role === 'admin') t.push({ id: 'admin', label: 'จัดการระบบ', short: 'จัดการ', icon: 'gear' });
  return t;
}

const readHash = () => (location.hash || '').replace(/^#/, '');

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);
  return now;
}

function DemoBar({ store, db }) {
  const people = Object.values(db.users).filter((u) => u.role !== 'pending');
  const order = { supervisor: 0, admin: 1, student: 2 };
  people.sort((a, b) => order[a.role] - order[b.role]);
  return html`<div class="demo-bar" role="region" aria-label="โหมดตัวอย่าง">
    <div class="demo-inner">
      <p class="demo-note"><b>โหมดตัวอย่าง</b><span> ชื่อคนและงานเป็นข้อมูลสมมติ เก็บไว้ในเครื่องนี้เท่านั้น</span></p>
      <div class="demo-who">
        <span class="demo-label">ดูในมุมของ</span>
        ${people.map((u) => html`<button type="button" class=${`demo-person${db.actor === u.uid ? ' is-on' : ''}`}
          aria-pressed=${db.actor === u.uid} onClick=${() => store.setActor(u.uid)}>
          ${displayName(u)}<small>${ROLE_LABEL[u.role]}</small></button>`)}
      </div>
    </div>
  </div>`;
}

function Toasts({ items, onAction }) {
  return html`<div class="toasts" aria-live="polite">${items.map((t) => html`<div class=${`toast toast--${t.tone}${t.action ? ' toast--act' : ''}`} key=${t.id}>
    <span class="toast-text">${t.text}</span>
    ${t.action ? html`<button type="button" class="toast-btn" onClick=${() => onAction(t)}>${t.action.label}</button>` : ''}</div>`)}</div>`;
}

function App({ store }) {
  const [db, setDb] = useState(() => store.snapshot());
  const [route, setRoute] = useState(readHash);
  const [formTask, setFormTask] = useState(null); // null | {} (new) | task (edit)
  const [taskFilter, setTaskFilter] = useState(null); // preset filter handed from the board to "งานทั้งหมด"
  const [toasts, setToasts] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const lastTab = useRef(null);
  const now = useNow();

  useEffect(() => store.subscribe(() => setDb(store.snapshot())), []);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // toast(text, tone, action?) — an action ({ label, run }) keeps the toast up a little longer and makes it tappable
  const toast = useCallback((text, tone = 'info', action = null, key = null) => {
    const id = Math.random();
    // only the newest toast keeps its button, so an older "ยกเลิก" can never be tapped by mistake
    setToasts((x) => [...(action ? x.filter((t) => !t.action) : x), { id, text, tone, action, key }]);
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), action ? 7000 : 3200);
  }, []);
  const toastAction = (t) => { setToasts((x) => x.filter((y) => y.id !== t.id)); t.action.run(); };

  // a new chat message while I am elsewhere in the app: a short toast with a way into the chat
  const chatMarks = useRef(null);
  useEffect(() => {
    if (!db.me || !db.chatsLoaded) return;
    const chats = Object.values(db.chats || {});
    const prev = chatMarks.current;
    chatMarks.current = Object.fromEntries(chats.map((c) => [c.id, c.lastAt || 0]));
    if (!prev) return;
    const here = readHash();
    chats.filter((c) => (c.lastAt || 0) > (prev[c.id] || 0) && isUnread(c, db.me.uid)).forEach((c) => {
      const users = db.users || {};
      const group = c.kind === 'group';
      const where = group ? `chatg-${c.id}` : `chat-${otherOf(c, db.me.uid)}`;
      if (here === 'chat' || here === where) return;
      const text = group ? `${c.name} · ${displayName(users[c.lastBy])}: ${c.lastText}` : `${displayName(users[c.lastBy])}: ${c.lastText}`;
      toast(text, 'info', { label: 'เปิดแชท', run: () => { location.hash = where; } }, where);
    });
  }, [db.chats, db.chatsLoaded]);
  // a new comment on a work order I am part of, while I am elsewhere: a toast with a way in
  const talkMarks = useRef(null);
  useEffect(() => {
    if (!db.me || !db.talkLoaded) return;
    const talk = db.talk || {};
    const prev = talkMarks.current;
    talkMarks.current = Object.fromEntries(Object.entries(talk).map(([k, t]) => [k, t.lastAt || 0]));
    if (!prev) return;
    const here = readHash();
    Object.entries(talk).forEach(([tid, t]) => {
      const task = (db.tasks || {})[tid];
      if (!task || (t.lastAt || 0) <= (prev[tid] || 0) || !talkUnread(db, task, db.me.uid)) return;
      const where = `wo-${task.no}`;
      if (here === where) return;
      toast(`ความเห็นใหม่ ${woNumber(task)} · ${displayName((db.users || {})[t.lastBy])}: ${t.lastText}`, 'info',
        { label: 'เปิดงาน', run: () => { location.hash = where; } }, where);
    });
  }, [db.talk, db.talkLoaded]);
  // opening the chat (or the chat list, or the work order) clears its toast
  useEffect(() => {
    if (route === 'chat' || /^chatg?-/.test(route) || /^wo-/.test(route)) setToasts((x) => x.filter((t) => !t.key || (route !== 'chat' && t.key !== route)));
  }, [route]);

  const me = db.me;
  const cal = useMemo(() => calendar(db.settings), [db.settings]);
  const users = db.users || {};
  const students = useMemo(() => Object.values(users).filter(isStudent)
    .sort((a, b) => displayName(a).localeCompare(displayName(b), 'th')), [users]);

  if (store.mode !== 'demo' && !me) return html`<${SignIn} store=${store} />`;
  if (me && (me.role === 'pending' || me.role === 'blocked')) return html`<${Waiting} store=${store} me=${me} />`;

  const badges = { mine: 0, review: 0, chat: unreadCount(db.chats, me.uid), log: isStaff(me) ? logsToConfirm(db, me.uid).length : 0 };
  for (const t of Object.values(db.tasks)) {
    if (t.assignees.includes(me.uid)) {
      const s = stateOf(t, me.uid);
      if (s === 'assigned' || s === 'changes' || isLate(t, me.uid, now)) badges.mine += 1;
    }
    if (canReview(me)) badges.review += t.assignees.filter((u) => u !== me.uid && stateOf(t, u) === 'submitted').length;
  }
  const tabs = tabsFor(me, badges, now);
  const assignerOn = isInternAdmin(me) && assignerOpen(me, now);
  const lockNow = async () => { try { await store.lockAssigner(); toast('ล็อกโหมดผู้มอบงานแล้ว'); } catch (ex) { toast(ex.message, 'bad'); } };
  const woMatch = /^wo-(\d+)$/.exec(route);
  let tab = woMatch ? (lastTab.current || tabs[0].id) : /^chatg?-./.test(route) ? 'chat' : /^log-./.test(route) ? 'log' : route;
  if (!tabs.some((t) => t.id === tab)) tab = tabs[0].id;
  if (!woMatch) lastTab.current = tab;
  const openTask = (no) => { location.hash = `wo-${no}`; };
  const closeTask = () => { location.hash = lastTab.current || tabs[0].id; };
  const go = (id) => { location.hash = id; };
  const detailTask = woMatch ? Object.values(db.tasks).find((t) => String(t.no) === woMatch[1]) : null;

  const ctx = { store, db, me, now, cal, users, students, toast, go, route, openTask, editTask: setFormTask, taskFilter, setTaskFilter,
    openProfile: () => setProfileOpen(true) };
  const week = weekOf(cal, now);

  const View = { my: MyTasks, board: Board, tasks: AllTasks, log: LogView, chat: ChatView, plan: PlanView, form: UniForm, admin: AdminView }[tab];

  return html`<${Ctx.Provider} value=${ctx}>
    ${store.mode === 'demo' ? html`<${DemoBar} store=${store} db=${db} />` : ''}
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"></span>
          <div class="brand-text"><strong>ใบสั่งงานฝึกงาน</strong><span>${db.settings.company || ''}</span></div>
        </div>
        <div class="weekbox" title="สัปดาห์ของการฝึกงาน">
          ${week ? html`<span class="weekbox-n">W${String(week).padStart(2, '0')}</span>
            <span class="weekbox-text">สัปดาห์ ${week}/16 · เดือนที่ ${Math.ceil(week / 4)}<small>${TH_DAYS[now.getDay()]} ${fmtDay(now).split(' ').slice(1).join(' ')}</small></span>`
          : html`<span class="weekbox-text">นอกช่วงฝึกงาน<small>${fmtRange(cal.start, cal.end)}</small></span>`}
        </div>
        <button type="button" class="me-chip" onClick=${() => setProfileOpen(true)} aria-label="ข้อมูลของฉัน">
          <span class="me-name">${displayName(me)}</span><span class="me-role">${roleLabel(me)}</span><${Icon} name="user" size=${18} />
        </button>
      </header>
      <div class="bands">
        ${db.online === false ? html`<p class="offline-band" role="status">ออฟไลน์อยู่ งานที่กดไว้จะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์</p>` : ''}
        ${assignerOn ? html`<p class="assigner-band" role="status"><span><b>โหมดผู้มอบงานเปิดอยู่</b> ถึง ${fmtTime(assignerUntil(me))} น. ทุกอย่างที่ทำถูกบันทึกให้พี่ผู้ดูแลเห็น</span>
          <button type="button" class="btn btn--sm btn--ghost" onClick=${lockNow}>ล็อกเลย</button></p>` : ''}
      </div>

      <nav class="nav" aria-label="เมนูหลัก">
        ${tabs.map((t) => html`<a href=${`#${t.id}`} class=${`nav-item${t.id === tab ? ' is-on' : ''}${t.deskOnly ? ' nav-item--desk' : ''}`} aria-current=${t.id === tab ? 'page' : undefined}>
          <span class="nav-icon"><${Icon} name=${t.icon} size=${22} />${t.badge ? html`<b class="nav-badge" aria-label=${`${t.badge} รายการ`}>${t.badge}</b>` : ''}</span>
          <span class="nav-long">${t.label}</span><span class="nav-short">${t.short || t.label}</span></a>`)}
      </nav>

      <main class="main" id="main">
        <${View} key=${tab + (me && me.uid)} />
      </main>

      ${canAssign(me, now) && (tab === 'board' || tab === 'tasks') ? html`<button type="button" class="fab" onClick=${() => setFormTask({})}>
        <${Icon} name="plus" size=${22} /><span>สั่งงาน</span></button>` : ''}
    </div>
    ${detailTask ? html`<${TaskDetail} task=${detailTask} onClose=${closeTask} />` : ''}
    ${woMatch && !detailTask && db.loaded !== false ? html`<${MissingTask} onClose=${closeTask} />` : ''}
    ${profileOpen ? html`<${ProfileSheet} onClose=${() => setProfileOpen(false)} />` : ''}
    ${formTask ? html`<${TaskForm} task=${formTask.id ? formTask : null} onClose=${() => setFormTask(null)} />` : ''}
    <${Toasts} items=${toasts} onAction=${toastAction} />
  <//>`;
}

function MissingTask({ onClose }) {
  useEffect(() => { onClose(); }, []);
  return null;
}

export function mount(store, el) {
  render(html`<${App} store=${store} />`, el);
}
