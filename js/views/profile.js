// "ข้อมูลของฉัน" — each person fills the details that go on the university form.
import { html, useState } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { isStudent, isStaff, displayName } from '../model.js';
import { Sheet, Field, Icon } from '../ui.js';

export function ProfileSheet({ onClose }) {
  const { db, me, store, toast } = useApp();
  const [f, setF] = useState({ name: me.name || '', nickname: me.nickname || '', studentId: me.studentId || '',
    major: me.major || '', faculty: me.faculty || '', position: me.position || '', mentor: me.mentor || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const student = isStudent(me);
  const staffMember = isStaff(me);
  const byName = (a, b) => displayName(a).localeCompare(displayName(b), 'th');
  const staff = Object.values(db.users).filter(isStaff).sort(byName);
  const interns = Object.values(db.users).filter((u) => isStudent(u) && ['student', 'admin'].includes(u.role)).sort(byName);
  const save = async () => {
    if (!f.name.trim()) { toast('ใส่ชื่อ–นามสกุล', 'bad'); return; }
    const patch = { name: f.name.trim(), nickname: f.nickname.trim() };
    if (student) Object.assign(patch, { studentId: f.studentId.trim(), major: f.major.trim(), faculty: f.faculty.trim() });
    if (staffMember) patch.position = f.position.trim();
    try {
      await store.updateUser(me.uid, patch);
      if (student && f.mentor !== (me.mentor || '')) await store.setMentor(me.uid, f.mentor || null);
      toast('บันทึกข้อมูลของฉันแล้ว', 'ok'); onClose();
    } catch (ex) { toast(ex.message, 'bad'); }
  };
  // staff: tap an intern to become (or stop being) their พนักงานที่ปรึกษา; saved straight away
  const toggleMentee = async (u) => {
    const on = u.mentor === me.uid;
    try { await store.setMentor(u.uid, on ? null : me.uid); toast(on ? `เลิกดูแล ${displayName(u)} แล้ว` : `รับดูแล ${displayName(u)} แล้ว`, 'ok'); } catch (ex) { toast(ex.message, 'bad'); }
  };
  return html`<${Sheet} title="ข้อมูลของฉัน" onClose=${onClose}
    footer=${html`${store.mode !== 'demo' ? html`<button type="button" class="btn btn--ghost" onClick=${() => store.signOut()}><${Icon} name="logout" size=${18} />ออกจากระบบ</button>` : ''}
      <span class="foot-space"></span>
      <button type="button" class="btn btn--primary" onClick=${save}>บันทึก</button>`}>
    <div class="form">
      ${me.email ? html`<p class="quiet">ล็อกอินด้วย ${me.email}</p>` : ''}
      <div class="form-pair">
        <${Field} id="pf-name" label="ชื่อ – นามสกุล"><input id="pf-name" type="text" value=${f.name} onInput=${set('name')} /><//>
        <${Field} id="pf-nick" label="ชื่อเล่น" hint="ใช้แสดงในรายการงาน"><input id="pf-nick" type="text" value=${f.nickname} onInput=${set('nickname')} /><//>
      </div>
      ${student ? html`<p class="hint-line">ข้อมูลด้านล่างใช้กรอกฟอร์มส่งมหาลัย</p>
        <div class="form-pair">
          <${Field} id="pf-sid" label="เลขประจำตัวนิสิต"><input id="pf-sid" type="text" inputmode="numeric" value=${f.studentId} onInput=${set('studentId')} /><//>
          <${Field} id="pf-fac" label="คณะ"><input id="pf-fac" type="text" value=${f.faculty} onInput=${set('faculty')} /><//>
        </div>
        <${Field} id="pf-major" label="สาขาวิชา"><input id="pf-major" type="text" value=${f.major} onInput=${set('major')} /><//>
        <${Field} id="pf-mentor" label="พนักงานที่ปรึกษา (พี่ที่ดูแลเรา)" hint=${staff.length ? 'ชื่อและตำแหน่งของพี่จะลงในช่องลงชื่อของฟอร์มส่งมหาลัย' : 'ยังไม่มีพี่ในระบบ ให้พี่สมัครเข้าทีมด้วยลิงก์ชวนก่อน'}>
          <div class="select-wrap"><select id="pf-mentor" value=${f.mentor} onChange=${set('mentor')}>
            <option value="">— ยังไม่เลือก —</option>
            ${staff.map((u) => html`<option value=${u.uid}>${u.name || displayName(u)}${u.position ? ` · ${u.position}` : ''}</option>`)}
          </select></div><//>` : ''}
      ${staffMember ? html`<${Field} id="pf-pos" label="ตำแหน่ง" hint="ลงในช่องตำแหน่งของฟอร์มมหาลัย"><input id="pf-pos" type="text" value=${f.position} onInput=${set('position')} /><//>
        <div class="field">
          <span class="field-label">น้องที่ฉันดูแล (เป็นพนักงานที่ปรึกษา)</span>
          ${interns.length ? html`<div class="chips" role="group" aria-label="น้องที่ฉันดูแล">${interns.map((u) => {
            const on = u.mentor === me.uid;
            const other = !on && u.mentor && db.users[u.mentor];
            return html`<button type="button" class=${`chip chip--sm${on ? ' is-on' : ''}`} aria-pressed=${on} onClick=${() => toggleMentee(u)}>
              ${on ? html`<${Icon} name="check" size=${16} />` : ''}${displayName(u)}${other ? html`<small class="chip-note">ดูแลโดย ${displayName(other)}</small>` : ''}</button>`;
          })}</div>
          <p class="hint-line">แตะชื่อน้องที่เราดูแล บันทึกทันที ชื่อและตำแหน่งของเราจะลงในฟอร์มส่งมหาลัยของน้องคนนั้น</p>`
          : html`<p class="hint-line">ยังไม่มีน้องฝึกงานในระบบ</p>`}
        </div>` : ''}
    </div>
  <//>`;
}
