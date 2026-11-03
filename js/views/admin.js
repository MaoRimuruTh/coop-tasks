// "จัดการระบบ" — approve people, set roles, company details, internship dates and hours,
// the assigner-mode lock for an admin who is also an intern, export, activity log.
import { html, useState } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { displayName, toLocalDate, fmtDay, fmtTime, isStudent, isInternAdmin, assignerOpen, assignerUntil } from '../model.js';
import { Sheet, Field, Icon, Avatar, ConfirmButton } from '../ui.js';

const ROLES = [
  { value: 'student', label: 'นักศึกษา' },
  { value: 'supervisor', label: 'พนักงานผู้ดูแล' },
  { value: 'admin', label: 'แอดมิน' },
];
const roleName = (r) => (ROLES.find((x) => x.value === r) || { label: r }).label;

function UserEditor({ user, onClose }) {
  const { store, toast, me } = useApp();
  const self = user.uid === me.uid;
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
      ${self ? html`<p class="hint-line">บทบาทของตัวเองเปลี่ยนเองไม่ได้ ต้องให้แอดมินคนอื่นเปลี่ยนให้</p>` : html`
      <${Field} id="ue-role" label="บทบาท">
        <label class="select-wrap select-wrap--grow"><select id="ue-role" value=${f.role} onChange=${set('role')}>
          ${ROLES.map((r) => html`<option value=${r.value}>${r.label}</option>`)}</select></label>
      <//>
      ${f.role === 'admin' ? html`<label class="switch"><input id="ue-isstudent" type="checkbox" checked=${!!f.isStudent} onChange=${set('isStudent')} />
        <span class="switch-ui" aria-hidden="true"></span><span><b>เป็นนักศึกษาฝึกงานด้วย</b><small>รับงานได้ แต่สั่งงานและตรวจงานไม่ได้</small></span></label>` : ''}`}
      ${showStudent ? html`<div class="form-pair">
        <${Field} id="ue-sid" label="เลขประจำตัวนิสิต"><input id="ue-sid" type="text" inputmode="numeric" value=${f.studentId || ''} onInput=${set('studentId')} /><//>
        <${Field} id="ue-fac" label="คณะ"><input id="ue-fac" type="text" value=${f.faculty || ''} onInput=${set('faculty')} /><//>
      </div>
      <${Field} id="ue-major" label="สาขาวิชา"><input id="ue-major" type="text" value=${f.major || ''} onInput=${set('major')} /><//>` : ''}
      ${f.role === 'supervisor' ? html`<${Field} id="ue-pos" label="ตำแหน่ง (ลงในฟอร์มมหาลัย)"><input id="ue-pos" type="text" value=${f.position || ''} onInput=${set('position')} /><//>` : ''}
    </div>
  <//>`;
}

/** Only for an admin who is also an intern: assigning work stays locked unless a one-time code is entered. */
function AssignerLock() {
  const { me, now, store, toast } = useApp();
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const open = assignerOpen(me, now);
  const unlock = async () => {
    setBusy(true);
    try { await store.unlockAssigner(code, reason); setCode(''); setReason(''); toast('เปิดโหมดผู้มอบงาน 1 ชั่วโมง', 'ok'); } catch (ex) { toast(ex.message, 'bad'); }
    setBusy(false);
  };
  const lock = async () => { try { await store.lockAssigner(); toast('ล็อกโหมดผู้มอบงานแล้ว'); } catch (ex) { toast(ex.message, 'bad'); } };
  return html`<section class="panel lock-panel">
    <div class="section-head"><h2>โหมดผู้มอบงาน</h2><span class=${`pill ${open ? 'pill--wait' : ''}`}>${open ? `เปิดอยู่ถึง ${fmtTime(assignerUntil(me))} น.` : 'ล็อกอยู่'}</span></div>
    ${open ? html`<p class="quiet">ตอนนี้สั่งงาน แก้ใบสั่งงาน และลงแผนให้คนอื่นได้ ส่วนงานที่ตัวเองเป็นผู้รับ ยังแก้ไม่ได้ และตรวจงานใครไม่ได้ ทุกอย่างที่ทำถูกบันทึกในประวัติการใช้งาน</p>
      <div class="btn-row"><button type="button" class="btn btn--primary" onClick=${lock}>ล็อกเลย</button></div>`
    : html`<p class="quiet">บัญชีนี้เป็นทั้งแอดมินและนักศึกษา จึงล็อกการสั่งงาน แก้ใบสั่งงาน และลงแผนไว้ ถ้าจำเป็นต้องใช้ ขอรหัสจากชิเอลพร้อมบอกเหตุผล รหัสใช้ได้ครั้งเดียว เปิดได้ 1 ชั่วโมง และเหตุผลจะขึ้นในประวัติการใช้งานให้พี่ผู้ดูแลเห็น</p>
      <div class="form">
        <${Field} id="lk-code" label="รหัสจากชิเอล"><input id="lk-code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"
          maxlength="16" placeholder="XXXX-XXXX-XXXX" value=${code} onInput=${(e) => setCode(e.target.value)} /><//>
        <${Field} id="lk-reason" label="จะเข้าไปทำอะไร"><textarea id="lk-reason" rows="2" maxlength="300" placeholder="เช่น พี่เอกให้ช่วยลงงานล็อต B ให้ต้นกับฟ้า"
          value=${reason} onInput=${(e) => setReason(e.target.value)}></textarea><//>
        <div class="btn-row"><button type="button" class="btn btn--primary" disabled=${busy} onClick=${unlock}>${busy ? 'กำลังตรวจรหัส…' : 'เปิดโหมดผู้มอบงาน 1 ชั่วโมง'}</button></div>
      </div>`}
  </section>`;
}

export function AdminView() {
  const { db, me, store, toast } = useApp();
  const st = db.settings;
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(() => ({
    startDate: st.startDate, endDate: st.endDate, company: st.company || '', companyAddress: st.companyAddress || '',
    companyPhone: st.companyPhone || '', companyFax: st.companyFax || '', companyHours: st.companyHours || '',
    workDays: st.workDays || 'จันทร์–เสาร์', workStart: st.workStart || '08:00', workEnd: st.workEnd || '17:00',
    breakStart: st.breakStart || '12:00', breakEnd: st.breakEnd || '13:00',
  }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
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
    const s = toLocalDate(f.startDate);
    if (!s || s.getDay() !== 1) { toast('วันเริ่มฝึกงานต้องเป็นวันจันทร์', 'bad'); return; }
    if (!f.endDate || f.endDate <= f.startDate) { toast('วันสิ้นสุดต้องอยู่หลังวันเริ่ม', 'bad'); return; }
    if (!f.workStart || !f.workEnd || f.workEnd <= f.workStart) { toast('เวลาเลิกฝึกงานต้องหลังเวลาเข้า', 'bad'); return; }
    const patch = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, String(v).trim()]));
    try { await store.updateSettings(patch); toast('บันทึกการตั้งค่าแล้ว', 'ok'); } catch (ex) { toast(ex.message, 'bad'); }
  };
  const doExport = async () => {
    const text = JSON.stringify(store.exportData(), null, 2);
    setExportText(text);
    try { await navigator.clipboard.writeText(text); toast('คัดลอกข้อมูลทั้งหมดแล้ว', 'ok'); } catch { toast('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความด้านล่างแล้วคัดลอกเอง'); }
  };
  const saveRow = html`<div class="btn-row"><button type="button" class="btn btn--primary" onClick=${saveSettings}>บันทึกการตั้งค่า</button></div>`;

  return html`<section class="page">
    <header class="page-head"><h1>จัดการระบบ</h1></header>
    ${!st.company ? html`<p class="callout callout--wait">ยังไม่ได้กรอกชื่อสถานประกอบการ กรอกที่ “สถานประกอบการ” ด้านล่าง ชื่อนี้ใช้ลงฟอร์มส่งมหาลัย</p>` : ''}

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

    ${isInternAdmin(me) ? html`<${AssignerLock} />` : ''}

    <section class="panel">
      <div class="section-head"><h2>ผู้ใช้ทั้งหมด <span class="count">${active.length}</span></h2></div>
      <ul class="user-list">${active.map((u) => html`<li class="user-row" key=${u.uid}>
        <${Avatar} user=${u} /><span class="user-main"><b>${displayName(u)}</b><small>${u.name}${isStudent(u) && u.studentId ? ` · ${u.studentId}` : ''}</small></span>
        <span class="pill">${roleName(u.role)}${u.role === 'admin' && u.isStudent ? ' · นักศึกษา' : ''}</span>
        <button type="button" class="icon-btn" onClick=${() => setEditing(u)} aria-label=${`แก้ไข ${displayName(u)}`}><${Icon} name="edit" /></button>
      </li>`)}</ul>
    </section>

    <section class="panel">
      <div class="section-head"><h2>สถานประกอบการ</h2></div>
      <div class="form">
        <${Field} id="st-company" label="ชื่อสถานประกอบการ (ลงในฟอร์มส่งมหาลัย)"><input id="st-company" type="text" value=${f.company} onInput=${set('company')} /><//>
        <${Field} id="st-address" label="ที่อยู่"><textarea id="st-address" rows="2" value=${f.companyAddress} onInput=${set('companyAddress')}></textarea><//>
        <div class="form-pair">
          <${Field} id="st-phone" label="โทรศัพท์"><input id="st-phone" type="tel" value=${f.companyPhone} onInput=${set('companyPhone')} /><//>
          <${Field} id="st-fax" label="แฟกซ์"><input id="st-fax" type="tel" value=${f.companyFax} onInput=${set('companyFax')} /><//>
        </div>
        <${Field} id="st-hours" label="เวลาทำการของบริษัท" hint="เวลาของบริษัท แยกจากเวลาฝึกงานด้านล่าง"><input id="st-hours" type="text" value=${f.companyHours} onInput=${set('companyHours')} /><//>
        ${saveRow}
      </div>
    </section>

    <section class="panel">
      <div class="section-head"><h2>ช่วงฝึกงานและเวลาฝึกงาน</h2></div>
      <div class="form">
        <div class="form-pair">
          <${Field} id="st-start" label="วันเริ่ม (ต้องเป็นวันจันทร์)"><input id="st-start" type="date" value=${f.startDate} onInput=${set('startDate')} /><//>
          <${Field} id="st-end" label="วันสิ้นสุด"><input id="st-end" type="date" value=${f.endDate} onInput=${set('endDate')} /><//>
        </div>
        <${Field} id="st-days" label="วันฝึกงาน"><input id="st-days" type="text" value=${f.workDays} onInput=${set('workDays')} /><//>
        <div class="form-pair">
          <${Field} id="st-in" label="เวลาเข้า"><input id="st-in" type="time" value=${f.workStart} onInput=${set('workStart')} /><//>
          <${Field} id="st-out" label="เวลาเลิก" hint="ใช้เป็นเวลาส่งงานตั้งต้นตอนสั่งงาน"><input id="st-out" type="time" value=${f.workEnd} onInput=${set('workEnd')} /><//>
        </div>
        <div class="form-pair">
          <${Field} id="st-bs" label="พักตั้งแต่"><input id="st-bs" type="time" value=${f.breakStart} onInput=${set('breakStart')} /><//>
          <${Field} id="st-be" label="ถึง"><input id="st-be" type="time" value=${f.breakEnd} onInput=${set('breakEnd')} /><//>
        </div>
        ${saveRow}
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
