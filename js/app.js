// App shell: data subscription, hash routing, navigation, demo persona switcher, toasts.
import { html, render, useEffect, useMemo, useState, useCallback, useRef } from './vendor/preact-htm.js';
import { calendar, weekOf, displayName, isStudent, canAssign, fmtDay, fmtRange, TH_DAYS, stateOf, isLate } from './model.js';
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

const ROLE_LABEL = { admin: 'แอดมิน', supervisor: 'พนักงานผู้ดูแล', student: 'นักศึกษา', pending: 'รออนุมัติ' };
export const roleLabel = (u) => (u.role === 'admin' && u.isStudent ? 'แอดมิน · นักศึกษา' : ROLE_LABEL[u.role] || u.role);

function tabsFor(me, badges) {
  const t = [];
  if (isStudent(me)) t.push({ id: 'my', label: 'งานของฉัน', icon: 'inbox', badge: badges.mine });
  if (canAssign(me)) t.push({ id: 'board', label: 'ภาพรวม', icon: 'board', badge: badges.review }, { id: 'tasks', label: 'งานทั้งหมด', icon: 'list' });
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

function Toasts({ items }) {
  return html`<div class="toasts" aria-live="polite">${items.map((t) => html`<div class=${`toast toast--${t.tone}`} key=${t.id}>${t.text}</div>`)}</div>`;
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

  const toast = useCallback((text, tone = 'info') => {
    const id = Math.random();
    setToasts((x) => [...x, { id, text, tone }]);
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);

  const me = db.me;
  const cal = useMemo(() => calendar(db.settings), [db.settings]);
  const users = db.users || {};
  const students = useMemo(() => Object.values(users).filter(isStudent)
    .sort((a, b) => displayName(a).localeCompare(displayName(b), 'th')), [users]);

  if (store.mode !== 'demo' && !me) return html`<${SignIn} store=${store} />`;
  if (me && (me.role === 'pending' || me.role === 'blocked')) return html`<${Waiting} store=${store} me=${me} />`;

  const badges = { mine: 0, review: 0 };
  for (const t of Object.values(db.tasks)) {
    if (t.assignees.includes(me.uid)) {
      const s = stateOf(t, me.uid);
      if (s === 'assigned' || s === 'changes' || isLate(t, me.uid, now)) badges.mine += 1;
    }
    if (canAssign(me)) badges.review += t.assignees.filter((u) => u !== me.uid && stateOf(t, u) === 'submitted').length;
  }
  const tabs = tabsFor(me, badges);
  const woMatch = /^wo-(\d+)$/.exec(route);
  let tab = woMatch ? (lastTab.current || tabs[0].id) : route;
  if (!tabs.some((t) => t.id === tab)) tab = tabs[0].id;
  if (!woMatch) lastTab.current = tab;
  const openTask = (no) => { location.hash = `wo-${no}`; };
  const closeTask = () => { location.hash = lastTab.current || tabs[0].id; };
  const go = (id) => { location.hash = id; };
  const detailTask = woMatch ? Object.values(db.tasks).find((t) => String(t.no) === woMatch[1]) : null;

  const ctx = { store, db, me, now, cal, users, students, toast, go, openTask, editTask: setFormTask, taskFilter, setTaskFilter };
  const week = weekOf(cal, now);

  const View = { my: MyTasks, board: Board, tasks: AllTasks, plan: PlanView, form: UniForm, admin: AdminView }[tab];

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
      ${db.online === false ? html`<p class="offline-band" role="status">ออฟไลน์อยู่ งานที่กดไว้จะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์</p>` : ''}

      <nav class="nav" aria-label="เมนูหลัก">
        ${tabs.map((t) => html`<a href=${`#${t.id}`} class=${`nav-item${t.id === tab ? ' is-on' : ''}${t.deskOnly ? ' nav-item--desk' : ''}`} aria-current=${t.id === tab ? 'page' : undefined}>
          <span class="nav-icon"><${Icon} name=${t.icon} size=${22} />${t.badge ? html`<b class="nav-badge" aria-label=${`${t.badge} รายการ`}>${t.badge}</b>` : ''}</span>
          <span class="nav-long">${t.label}</span><span class="nav-short">${t.short || t.label}</span></a>`)}
      </nav>

      <main class="main" id="main">
        <${View} key=${tab + (me && me.uid)} />
      </main>

      ${canAssign(me) && (tab === 'board' || tab === 'tasks') ? html`<button type="button" class="fab" onClick=${() => setFormTask({})}>
        <${Icon} name="plus" size=${22} /><span>สั่งงาน</span></button>` : ''}
    </div>
    ${detailTask ? html`<${TaskDetail} task=${detailTask} onClose=${closeTask} />` : ''}
    ${woMatch && !detailTask && db.loaded !== false ? html`<${MissingTask} onClose=${closeTask} />` : ''}
    ${profileOpen ? html`<${ProfileSheet} onClose=${() => setProfileOpen(false)} />` : ''}
    ${formTask ? html`<${TaskForm} task=${formTask.id ? formTask : null} onClose=${() => setFormTask(null)} />` : ''}
    <${Toasts} items=${toasts} />
  <//>`;
}

function MissingTask({ onClose }) {
  useEffect(() => { onClose(); }, []);
  return null;
}

export function mount(store, el) {
  render(html`<${App} store=${store} />`, el);
}
