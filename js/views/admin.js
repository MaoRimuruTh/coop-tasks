// "จัดการระบบ" — approve people, set roles, internship dates, export, activity log.
import { html, useState } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { displayName, toLocalDate, fmtDay, fmtTime, isStudent } from '../model.js';
import { Sheet, Field, Icon, Avatar, ConfirmButton } from '../ui.js';

const ROLES = [
  { value: 'student', label: 'นักศึกษา' },
  { value: 'supervisor', label: 'พนักงานผู้ดูแล' },
  { value: 'admin', label: 'แอดมิน' },
];
const roleName = (r) => (ROLES.find((x) => x.value === r) || { label: r }).label;

function UserEditor({ user, onClose }) {
  const { store, toast } = useApp();
  const [f, setF] = useState({ ...user });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async () => {
    try {
      const patch = { name: f.name.trim(), nickname: (f.nickname || '').trim(), role: f.role, isStudent: f.role === 'student' ? true : !!f.isStudent,
        studentId: (f.studentId || '').trim(), major: (f.major || '').trim(), faculty: (f.faculty || '').trim(), position: (f.position || '').trim() };
      await store.updateUser(user.uid, patch);
      toast('บันทึกข้อมูลผู้ใช้แล้ว', 'ok');
      onClose();
    } catch (ex) { toast(ex.message, 'bad'); }
  };
  const showStudent = f.role === 'student' || f.isStudent;
  return html`<${Sheet} title=${`ข้อมูล ${displayName(user)}`} onClose=${onClose}
    footer=${html`<button type="button" class="btn btn--ghost" onClick=${onClose}>ยกเลิก</button><button type="button" class="btn btn--primary" onClick=${save}>บันทึก</button>`}>
    <div class="form">
      <div class="form-pair">
        <${Field} id="ue-name" label="ชื่อ – นามสกุล"><input id="ue-name" type="text" value=${f.name} onInput=${set('name')} /><//>
        <${Field} id="ue-nick" label="ชื่อเล่น (ไม่บังคับ)"><input id="ue-nick" type="text" value=${f.nickname || ''} onInput=${set('nickname')} /><//>
      </div>
      <${Field} id="ue-role" label="บทบาท">
        <label class="select-wrap select-wrap--grow"><select id="ue-role" value=${f.role} onChange=${set('role')}>
          ${ROLES.map((r) => html`<option value=${r.value}>${r.label}</option>`)}</select></label>
      <//>
      ${f.role === 'admin' ? html`<label class="switch"><input id="ue-isstudent" type="checkbox" checked=${!!f.isStudent} onChange=${set('isStudent')} />
        <span class="switch-ui" aria-hidden="true"></span><span><b>เป็นนักศึกษาฝึกงานด้วย</b><small>รับงานได้และมีหน้า “งานของฉัน”</small></span></label>` : ''}
      ${showStudent ? html`<div class="form-pair">
        <${Field} id="ue-sid" label="เลขประจำตัวนิสิต"><input id="ue-sid" type="text" inputmode="numeric" value=${f.studentId || ''} onInput=${set('studentId')} /><//>
        <${Field} id="ue-fac" label="คณะ"><input id="ue-fac" type="text" value=${f.faculty || ''} onInput=${set('faculty')} /><//>
      </div>
      <${Field} id="ue-major" label="สาขาวิชา"><input id="ue-major" type="text" value=${f.major || ''} onInput=${set('major')} /><//>` : ''}
      ${f.role === 'supervisor' ? html`<${Field} id="ue-pos" label="ตำแหน่ง (ลงในฟอร์มมหาลัย)"><input id="ue-pos" type="text" value=${f.position || ''} onInput=${set('position')} /><//>` : ''}
    </div>
  <//>`;
}

export function AdminView() {
  const { db, store, toast } = useApp();
  const [editing, setEditing] = useState(null);
  const [start, setStart] = useState(db.settings.startDate);
  const [end, setEnd] = useState(db.settings.endDate);
  const [company, setCompany] = useState(db.settings.company || '');
  const [exportText, setExportText] = useState('');
  const users = Object.values(db.users);
  const pending = users.filter((u) => u.role === 'pending');
  const active = users.filter((u) => u.role !== 'pending' && u.role !== 'blocked');

  const approve = async (u, role) => {
    try { await store.updateUser(u.uid, { role, isStudent: role === 'student' }); toast(`อนุมัติ ${displayName(u)} เป็น${roleName(role)}แล้ว`, 'ok'); } catch (ex) { toast(ex.message, 'bad'); }
  };
  const reject = async (u) => {
    try { await store.updateUser(u.uid, { role: 'blocked' }); toast(`ปฏิเสธ ${displayName(u)} แล้ว`); } catch (ex) { toast(ex.message, 'bad'); }
  };
  const saveSettings = async () => {
    const s = toLocalDate(start);
    if (!s || s.getDay() !== 1) { toast('วันเริ่มฝึกงานต้องเป็นวันจันทร์', 'bad'); return; }
    if (!end || end <= start) { toast('วันสิ้นสุดต้องอยู่หลังวันเริ่ม', 'bad'); return; }
    try { await store.updateSettings({ startDate: start, endDate: end, company: company.trim() }); toast('บันทึกการตั้งค่าแล้ว', 'ok'); } catch (ex) { toast(ex.message, 'bad'); }
  };
  const doExport = async () => {
    const text = JSON.stringify(store.exportData(), null, 2);
    setExportText(text);
    try { await navigator.clipboard.writeText(text); toast('คัดลอกข้อมูลทั้งหมดแล้ว', 'ok'); } catch { toast('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความด้านล่างแล้วคัดลอกเอง'); }
  };

  return html`<section class="page">
    <header class="page-head"><h1>จัดการระบบ</h1></header>
    ${!db.settings.company ? html`<p class="callout callout--wait">ยังไม่ได้กรอกชื่อสถานประกอบการ กรอกที่ “ช่วงฝึกงาน” ด้านล่าง ชื่อนี้ใช้ลงฟอร์มส่งมหาลัย</p>` : ''}

    <section class="panel">
      <div class="section-head"><h2>คนที่ขอเข้าระบบ <span class="count">${pending.length}</span></h2></div>
      ${pending.length ? html`<ul class="user-list">${pending.map((u) => html`<li class="user-row" key=${u.uid}>
          <${Avatar} user=${u} /><span class="user-main"><b>${u.name}</b><small>${u.email || 'ไม่มีอีเมล'}</small></span>
          <span class="user-actions">
            <button type="button" class="btn btn--ghost btn--sm" onClick=${() => reject(u)}>ปฏิเสธ</button>
            <button type="button" class="btn btn--ghost btn--sm" onClick=${() => approve(u, 'supervisor')}>พนักงานผู้ดูแล</button>
            <button type="button" class="btn btn--primary btn--sm" onClick=${() => approve(u, 'student')}>นักศึกษา</button>
          </span></li>`)}</ul>`
        : html`<p class="quiet">ไม่มีคนรออนุมัติ คนใหม่ที่ล็อกอินด้วย Google จะขึ้นที่นี่</p>`}
    </section>

    <section class="panel">
      <div class="section-head"><h2>ผู้ใช้ทั้งหมด <span class="count">${active.length}</span></h2></div>
      <ul class="user-list">${active.map((u) => html`<li class="user-row" key=${u.uid}>
        <${Avatar} user=${u} /><span class="user-main"><b>${displayName(u)}</b><small>${u.name}${isStudent(u) && u.studentId ? ` · ${u.studentId}` : ''}</small></span>
        <span class="pill">${roleName(u.role)}${u.role === 'admin' && u.isStudent ? ' · นักศึกษา' : ''}</span>
        <button type="button" class="icon-btn" onClick=${() => setEditing(u)} aria-label=${`แก้ไข ${displayName(u)}`}><${Icon} name="edit" /></button>
      </li>`)}</ul>
    </section>

    <section class="panel">
      <div class="section-head"><h2>ช่วงฝึกงาน</h2></div>
      <div class="form">
        <div class="form-pair">
          <${Field} id="st-start" label="วันเริ่ม (ต้องเป็นวันจันทร์)"><input id="st-start" type="date" value=${start} onInput=${(e) => setStart(e.target.value)} /><//>
          <${Field} id="st-end" label="วันสิ้นสุด"><input id="st-end" type="date" value=${end} onInput=${(e) => setEnd(e.target.value)} /><//>
        </div>
        <${Field} id="st-company" label="สถานประกอบการ"><input id="st-company" type="text" value=${company} onInput=${(e) => setCompany(e.target.value)} /><//>
        <div class="btn-row"><button type="button" class="btn btn--primary" onClick=${saveSettings}>บันทึกการตั้งค่า</button></div>
      </div>
    </section>

    <section class="panel">
      <div class="section-head"><h2>สำรองข้อมูล</h2></div>
      <p class="quiet">คัดลอกข้อมูลทั้งหมด (งาน แผน ผลตรวจ) เก็บไว้ เผื่อใช้ทำรายงานตอนจบฝึกงาน</p>
      <div class="btn-row"><button type="button" class="btn btn--ghost" onClick=${doExport}><${Icon} name="copy" size=${18} />คัดลอกข้อมูลทั้งหมด</button>
        ${store.mode === 'demo' ? html`<${ConfirmButton} label="รีเซ็ตข้อมูลตัวอย่าง" confirmLabel="กดอีกครั้งเพื่อรีเซ็ต" icon="refresh" onConfirm=${() => { store.reset(); toast('รีเซ็ตแล้ว'); }} />` : ''}</div>
      ${exportText ? html`<textarea class="export-box" id="export-box" rows="6" readonly value=${exportText} onFocus=${(e) => e.target.select()}></textarea>` : ''}
    </section>

    <section class="panel">
      <div class="section-head"><h2>ประวัติการใช้งาน</h2></div>
      <ol class="feed">${(db.activity || []).slice(0, 40).map((a) => {
        const d = toLocalDate(a.at);
        return html`<li><span class="feed-time">${fmtDay(d)} ${fmtTime(d)}</span><span><b>${displayName(db.users[a.by])}</b> ${a.text}</span></li>`;
      })}</ol>
    </section>
    ${editing ? html`<${UserEditor} user=${editing} onClose=${() => setEditing(null)} />` : ''}
  </section>`;
}
